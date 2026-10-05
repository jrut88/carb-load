// Food lookup via Open Food Facts (https://world.openfoodfacts.org).
// Free, no API key, CORS-enabled. Data is crowd-sourced, so results are
// always shown to the user to check before saving.
window.FoodLookup = (() => {
  'use strict';

  const SEARCH_URL = 'https://search.openfoodfacts.org/search';
  const PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product/';
  const SCANNER_SRC = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
  const PRODUCT_FIELDS = [
    'code', 'product_name', 'brands', 'quantity', 'product_quantity', 'product_quantity_unit',
    'serving_size', 'serving_quantity', 'nutriments', 'categories_tags', 'labels_tags', 'allergens_tags',
  ].join(',');

  async function getJSON(url, timeoutMs = 12000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  const num = (v) => (v == null || v === '' ? NaN : Number(v));
  const round1 = (x) => Math.round(x * 10) / 10;
  const firstBrand = (b) => String(Array.isArray(b) ? b[0] || '' : b || '').split(',')[0].trim();

  // Name search, UK products first. Only results with carb data are useful.
  async function search(query) {
    const params = new URLSearchParams({
      q: `${query} countries_tags:"en:united-kingdom"`,
      page_size: '20',
      fields: 'code,product_name,brands,quantity,nutriments',
    });
    const data = await getJSON(`${SEARCH_URL}?${params}`);
    return (data && data.hits || [])
      .map((p) => ({
        code: p.code,
        name: String(p.product_name || '').trim(),
        brand: firstBrand(p.brands),
        quantity: p.quantity || '',
        carbs100: num(p.nutriments && p.nutriments.carbohydrates_100g),
      }))
      .filter((r) => r.code && r.name && r.carbs100 >= 0)
      .map((r, i) => ({ r, i, score: score(r, query) }))
      .sort((a, b) => b.score - a.score || a.i - b.i)
      .map((x) => x.r);
  }

  // Prefer names containing the whole query, then fuller listings.
  function score(r, query) {
    const q = query.toLowerCase().trim();
    const name = r.name.toLowerCase();
    const words = q.split(/\s+/);
    let s = 0;
    if (name.includes(q)) s += 4;
    else if (words.every((w) => name.includes(w) || r.brand.toLowerCase().includes(w))) s += 2;
    if (r.brand) s += 1;
    if (r.quantity) s += 1;
    return s;
  }

  async function product(code) {
    const data = await getJSON(`${PRODUCT_URL}${encodeURIComponent(code)}?fields=${PRODUCT_FIELDS}`);
    return data && data.status === 1 ? data.product : null;
  }

  // Best guess at where a product fits, from its categories.
  function guessPlacement(allCats) {
    // Broad umbrella tags like "cereals-and-potatoes" would match almost anything.
    const cats = allCats.filter((c) => !c.includes('-and-'));
    const has = (...keys) => keys.some((k) => cats.some((c) => c.includes(k)));
    let slot = 'snack';
    if (has('dessert', 'pudding', 'yogurt', 'yoghurt')) slot = 'snack';
    else if (has('breakfast-cereal', 'porridge', 'muesli', 'granola', 'puffed')) slot = 'breakfast';
    else if (has('bread', 'bagel', 'crumpet', 'pancake', 'muffin')) slot = 'breakfast';
    else if (has('juice', 'beverage', 'drink', 'milkshake', 'flavoured-milk')) slot = 'drink';
    else if (has('pasta', 'rice', 'noodle', 'gnocchi', 'couscous', 'potato', 'meal')) slot = 'main';
    else if (has('jam', 'honey', 'spread', 'syrup', 'marmalade')) slot = 'topping';
    else if (has('sauce')) slot = 'side';

    let aisle = 'Other';
    if (has('canned', 'tinned')) aisle = 'Tins & jars';
    else if (has('dessert', 'yogurt', 'yoghurt')) aisle = 'Dairy & chilled';
    else if (has('bread', 'bagel', 'crumpet', 'pancake', 'muffin', 'wrap', 'tortilla', 'cake')) aisle = 'Bakery';
    else if (has('cereal', 'porridge', 'muesli', 'granola', 'jam', 'honey', 'spread', 'syrup')) aisle = 'Cereal & spreads';
    else if (has('pasta', 'rice', 'noodle', 'gnocchi', 'couscous', 'grain')) aisle = 'Rice, pasta & grains';
    else if (has('fruit', 'vegetable', 'potato')) aisle = 'Fruit & veg';
    else if (has('dair', 'yogurt', 'yoghurt', 'milk', 'dessert')) aisle = 'Dairy & chilled';
    else if (has('beverage', 'juice', 'drink')) aisle = 'Drinks';
    else if (has('sauce', 'canned', 'tinned')) aisle = 'Tins & jars';
    else if (has('snack', 'confectioner', 'sweet', 'biscuit', 'crisp', 'bar')) aisle = 'Snacks & sweets';
    return { slot, aisle };
  }

  // Turn a full product into the add-food form's fields.
  function toDraft(p) {
    const n = p.nutriments || {};
    const carbs100 = num(n.carbohydrates_100g);
    const sq = num(p.serving_quantity);
    const servingG = sq > 0 && sq < 1000 ? Math.round(sq) : 100;
    const carbsServing = num(n.carbohydrates_serving);
    const carbs = sq > 0 && carbsServing >= 0 ? round1(carbsServing) : round1(carbs100 * servingG / 100);
    const unit = String(p.product_quantity_unit || 'g').toLowerCase();
    const packG = unit === 'g' || unit === 'ml' ? num(p.product_quantity) : NaN;
    // Quantity is sometimes a count ("4" bagels) rather than a weight.
    const count = /^\s*\d{1,2}\s*$/.test(String(p.quantity || '')) ? Number(p.quantity) : NaN;
    const perPack = packG > 0 ? Math.max(1, round1(packG / servingG)) : count > 0 ? count : 1;

    const fibre = num(n.fiber_100g);
    const fat = num(n.fat_100g);
    const gut = fibre > 6 ? 'heavy' : fibre > 3 || fat > 15 ? 'ok' : 'easy';

    const labels = p.labels_tags || [];
    const allergens = p.allergens_tags || [];
    const knownAllergens = allergens.length > 0;
    const vegan = labels.includes('en:vegan');
    const flags = {
      easy: gut === 'easy',
      V: vegan || labels.includes('en:vegetarian'),
      N: vegan,
      G: labels.includes('en:gluten-free') || labels.includes('en:no-gluten') || (knownAllergens && !allergens.includes('en:gluten')),
      D: vegan || labels.includes('en:no-milk') || (knownAllergens && !allergens.includes('en:milk')),
    };

    const brand = firstBrand(p.brands);
    let name = String(p.product_name || '').trim();
    if (brand && !name.toLowerCase().includes(brand.toLowerCase())) name = `${brand} ${name}`;

    return {
      code: p.code,
      name: name.slice(0, 60),
      serving: (p.serving_size || `${servingG}g`).slice(0, 30),
      servingG,
      carbs100: carbs100 >= 0 ? carbs100 : null,
      carbs: carbs >= 0 ? carbs : '',
      perPack,
      packG: packG > 0 ? packG : null,
      pack: (count > 0 ? `pack of ${count}` : p.quantity || '1 pack').slice(0, 30),
      gut,
      flags,
      ...guessPlacement(p.categories_tags || []),
    };
  }

  // ---------- barcode scanner ----------

  let scannerLib = null;
  function loadScanner() {
    if (scannerLib) return scannerLib;
    scannerLib = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SCANNER_SRC;
      s.onload = () => resolve(window.__Html5QrcodeLibrary__);
      s.onerror = () => { scannerLib = null; reject(new Error('Scanner failed to load')); };
      document.head.appendChild(s);
    });
    return scannerLib;
  }

  // Starts the camera in the element with id `elId`; calls onCode once.
  async function startScan(elId, onCode) {
    const lib = await loadScanner();
    const F = lib.Html5QrcodeSupportedFormats;
    const scanner = new lib.Html5Qrcode(elId, {
      formatsToSupport: [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E],
      experimentalFeatures: { useBarCodeDetectorIfSupported: true },
      verbose: false,
    });
    let done = false;
    await scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: (w, h) => ({ width: Math.min(280, w * 0.8), height: Math.min(140, h * 0.5) }) },
      (code) => { if (!done) { done = true; onCode(code); } },
      () => {},
    );
    return {
      stop: async () => {
        try { if (scanner.isScanning) await scanner.stop(); scanner.clear(); } catch { /* already stopped */ }
      },
    };
  }

  return { search, product, toDraft, startScan };
})();
