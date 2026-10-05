(() => {
  'use strict';

  const STORE_KEY = 'carb-load:v1';
  const KG_PER_LB = 0.45359237;
  const FOODS = window.CARB_FOODS;
  const BEET_SHOT = window.BEET_SHOT;
  const AISLES = window.AISLE_ORDER;

  const DISTANCES = [
    { id: '5k', label: '5K' },
    { id: '10k', label: '10K' },
    { id: 'half', label: 'Half' },
    { id: 'marathon', label: 'Marathon' },
    { id: 'ultra', label: 'Ultra' },
  ];

  // [key, label, meal type, % of the day's carbs]
  const MEAL_PLANS = {
    3: [['breakfast', 'Breakfast', 'breakfast', 30], ['lunch', 'Lunch', 'main', 35], ['dinner', 'Dinner', 'main', 35]],
    4: [['breakfast', 'Breakfast', 'breakfast', 25], ['lunch', 'Lunch', 'main', 30], ['pm', 'Afternoon snack', 'snack', 15], ['dinner', 'Dinner', 'main', 30]],
    5: [['breakfast', 'Breakfast', 'breakfast', 22], ['am', 'Mid-morning', 'snack', 13], ['lunch', 'Lunch', 'main', 25], ['pm', 'Afternoon', 'snack', 13], ['dinner', 'Dinner', 'main', 27]],
    6: [['breakfast', 'Breakfast', 'breakfast', 20], ['am', 'Mid-morning', 'snack', 12], ['lunch', 'Lunch', 'main', 22], ['pm', 'Afternoon', 'snack', 12], ['dinner', 'Dinner', 'main', 24], ['eve', 'Evening', 'snack', 10]],
  };

  // Food slots each meal type draws from, in order (first = main item).
  const MEAL_SOURCES = {
    breakfast: ['breakfast', 'topping', 'drink'],
    main: ['main', 'side', 'drink'],
    snack: ['snack', 'drink'],
  };

  // rate = extra carbs (g per kg per hour) to cover the session.
  const TRAINING = {
    rest: { label: 'Rest', rate: 0 },
    easy: { label: 'Easy run', rate: 1 },
    strides: { label: 'Easy + strides', rate: 1 },
    workout: { label: 'Workout / tempo', rate: 1.5, hard: true },
    long: { label: 'Long run', rate: 1.2, hard: true },
  };

  // Suggested taper by days-before-race: [type, minutes]
  const TRAINING_DEFAULTS = {
    1: ['strides', 20], 2: ['rest', 0], 3: ['easy', 30], 4: ['strides', 35],
    5: ['easy', 40], 6: ['rest', 0], 7: ['easy', 45],
  };

  const GUT_LABELS = {
    easy: ['Gut-friendly', 'good'],
    ok: ['Moderate fibre', 'mid'],
    heavy: ['High fibre', 'bad'],
  };

  const DIET_FILTERS = [
    ['veg', 'Vegetarian'],
    ['vegan', 'Vegan'],
    ['gf', 'Gluten-free'],
    ['df', 'Dairy-free'],
  ];

  // How foods are grouped on the Foods list (by each food's main use).
  const ROLE_GROUPS = [
    ['breakfast', 'Breakfast'], ['main', 'Main meals'], ['snack', 'Snacks'],
    ['drink', 'Drinks'], ['topping', 'Toppings'], ['side', 'Sides & sauces'],
  ];

  const SLOT_OPTIONS = [
    ['breakfast', 'Breakfast'], ['main', 'Main meal'], ['snack', 'Snack'],
    ['drink', 'Drink'], ['topping', 'Topping (jam etc.)'], ['side', 'Side / sauce'],
  ];

  // ---------- dates ----------

  const pad = (n) => String(n).padStart(2, '0');
  const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  function fromISO(s) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  function addDays(iso, n) {
    const d = fromISO(iso);
    d.setDate(d.getDate() + n);
    return toISO(d);
  }
  const daysBetween = (a, b) => Math.round((fromISO(b) - fromISO(a)) / 864e5);
  const fmtDay = (iso) => fromISO(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  function minusHours(time, hours) {
    const [h, m] = time.split(':').map(Number);
    const t = (((h * 60 + m - hours * 60) % 1440) + 1440) % 1440;
    return `${pad(Math.floor(t / 60))}:${pad(Math.round(t % 60))}`;
  }

  // ---------- helpers ----------

  const round5 = (x) => Math.round(x / 5) * 5;
  const fmtN = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ''));
  const fmtG = (g) => `${Math.round(g).toLocaleString()}g`;
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  const makeId = () => `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  // ---------- state ----------

  function defaultState() {
    const today = toISO(new Date());
    return {
      onboarded: false,
      onboardStep: 1,
      tab: 'setup',
      profile: {
        units: 'metric', weightKg: 70, distance: 'marathon', finishMin: null,
        raceDate: addDays(today, 14), raceTime: '09:00',
        loadDays: 2, gkg: 10, auto: true, meals: 5,
        breakfastGkg: 2, breakfastHours: 3,
      },
      beet: { on: false, mode: 'chronic', days: 5, shots: 1 },
      diet: { veg: false, vegan: false, gf: false, df: false },
      preferred: FOODS.filter((f) => f.fav).map((f) => f.id),
      customFoods: [],
      training: {},
      log: {},
      overrides: {}, // 'date|mealKey' -> [{ id, n }], one day only
      mealDefaults: {}, // mealKey -> [{ id, n }], every load day
      raceBreakfast: null, // [{ id, n }] once the user has built it
      shop: {},
    };
  }

  function loadState() {
    const base = defaultState();
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return base;
      const s = JSON.parse(raw);
      return {
        ...base, ...s,
        profile: { ...base.profile, ...s.profile },
        beet: { ...base.beet, ...s.beet },
        diet: { ...base.diet, ...s.diet },
      };
    } catch {
      return base;
    }
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch {
      // storage unavailable (private mode) — app still works for this session
    }
  }

  const state = loadState();

  // ---------- recommendations ----------

  function recommend(p) {
    const fm = p.finishMin;
    switch (p.distance) {
      case '5k':
      case '10k':
        return { days: 0, gkg: 6, why: 'Races under 90 minutes run fine on normal glycogen stores. Eat your usual carb-rich diet and get race breakfast right.' };
      case 'half':
        return fm && fm >= 90
          ? { days: 1, gkg: 8, why: 'At 90+ minutes, a 24–36 hour top-up helps. One day at about 8 g/kg is plenty for a half.' }
          : { days: 1, gkg: 7, why: 'Optional for a quicker half. One higher-carb day (about 7 g/kg) tops you up without feeling heavy.' };
      case 'ultra':
        return { days: 3, gkg: 10, why: 'Long events drain glycogen fully. 2–3 days at 10–12 g/kg, plus a solid fuelling plan on the day.' };
      default:
        return { days: 2, gkg: 10, why: 'A marathon outlasts your normal glycogen stores. The standard approach is 36–48 hours at 8–12 g/kg of body weight.' };
    }
  }

  function applyRecommendation() {
    const r = recommend(state.profile);
    state.profile.loadDays = r.days;
    state.profile.gkg = r.gkg;
    state.profile.auto = true;
  }

  // ---------- foods ----------

  const allFoods = () => FOODS.concat(state.customFoods);
  const foodById = (id) => (id === BEET_SHOT.id ? BEET_SHOT : allFoods().find((f) => f.id === id));

  function dietOk(f) {
    const d = f.diet || '';
    const D = state.diet;
    if (D.vegan && !d.includes('N')) return false;
    if (D.veg && !(d.includes('V') || d.includes('N'))) return false;
    if (D.gf && !d.includes('G')) return false;
    if (D.df && !(d.includes('D') || d.includes('N'))) return false;
    return true;
  }

  const planFoods = () => allFoods().filter((f) => state.preferred.includes(f.id) && dietOk(f));
  const pool = (slot) => planFoods().filter((f) => f.slots.includes(slot));
  const roundStep = (x, step) => Math.round(x / step) * step;

  // Fill one meal's carb target from the user's preferred foods.
  // rot rotates which food is picked so days and meals vary.
  function fillMeal(target, sources, rot) {
    const items = [];
    const used = new Set();
    let remaining = target;

    const pick = (list, idx) => {
      for (let i = 0; i < list.length; i++) {
        const f = list[(idx + i) % list.length];
        if (!used.has(f.id)) return f;
      }
      return null;
    };

    sources.forEach((slot, si) => {
      const list = pool(slot);
      if (!list.length || remaining < 8) return;
      const f = pick(list, rot + si);
      if (!f) return;
      const step = f.step || 0.5;
      const share = si === 0 && sources.length > 1 ? remaining * 0.75 : remaining;
      const n = Math.min(f.max || 2, roundStep(share / f.carbs, step));
      if (n <= 0) return;
      used.add(f.id);
      items.push({ food: f, n });
      remaining -= n * f.carbs;
    });

    // Top up existing items toward the target, within each food's max.
    for (const it of items) {
      const step = it.food.step || 0.5;
      while (remaining >= it.food.carbs * step * 0.6 && it.n + step <= (it.food.max || 2) + 1e-9) {
        it.n += step;
        remaining -= it.food.carbs * step;
      }
    }

    // Still short: add a second main item.
    if (remaining > 15) {
      const f = pick(pool(sources[0]), rot + 1);
      if (f) {
        const step = f.step || 0.5;
        const n = Math.min(f.max || 2, Math.max(step, Math.floor(remaining / f.carbs / step) * step));
        items.push({ food: f, n });
        remaining -= n * f.carbs;
      }
    }

    const carbs = items.reduce((s, it) => s + it.n * it.food.carbs, 0);
    return { items, carbs: Math.round(carbs) };
  }

  // ---------- training ----------

  function trainingFor(date) {
    if (state.training[date]) return state.training[date];
    const d = daysBetween(date, state.profile.raceDate);
    const [type, min] = TRAINING_DEFAULTS[d] || ['easy', 40];
    return { type, min };
  }

  function trainingCarbs(tr) {
    const t = TRAINING[tr.type] || TRAINING.rest;
    return round5(state.profile.weightKg * t.rate * (tr.min || 0) / 60);
  }

  // ---------- plan ----------

  // Turn saved [{ id, n }] picks into plan items, skipping deleted foods.
  function itemsFrom(list) {
    const items = list.map((x) => ({ food: foodById(x.id), n: x.n })).filter((it) => it.food && it.n > 0);
    return { items, carbs: Math.round(items.reduce((s, it) => s + it.n * it.food.carbs, 0)) };
  }

  function buildPlan() {
    const p = state.profile;
    const w = p.weightKg;
    const tmpl = MEAL_PLANS[p.meals] || MEAL_PLANS[5];

    const loadDates = [];
    for (let i = p.loadDays; i >= 1; i--) loadDates.push(addDays(p.raceDate, -i));

    const beetDates = [];
    if (state.beet.on && state.beet.mode === 'chronic') {
      for (let i = state.beet.days; i >= 1; i--) beetDates.push(addDays(p.raceDate, -i));
    }
    const beetCarbs = state.beet.shots * BEET_SHOT.carbs;

    const days = loadDates.map((date, di) => {
      const tr = trainingFor(date);
      const trainCarbs = trainingCarbs(tr);
      const base = round5(w * p.gkg);
      const target = base + trainCarbs;
      const beet = beetDates.includes(date) ? beetCarbs : 0;
      const mealTotal = Math.max(0, target - beet);

      // Meals you've set are fixed; suggested meals share whatever is left.
      const meals = tmpl.map(([key, label, type, pct]) => {
        const own = state.overrides[`${date}|${key}`];
        const chosen = own || state.mealDefaults[key];
        return chosen
          ? { key, label, type, pct, target: round5(mealTotal * pct / 100), ...itemsFrom(chosen), source: own ? 'day' : 'every' }
          : { key, label, type, pct, source: 'auto' };
      });
      const fixed = meals.filter((m) => m.source !== 'auto').reduce((s, m) => s + m.carbs, 0);
      const autoPct = meals.filter((m) => m.source === 'auto').reduce((s, m) => s + m.pct, 0);
      meals.forEach((m, mi) => {
        if (m.source !== 'auto') return;
        m.target = round5(Math.max(0, mealTotal - fixed) * m.pct / autoPct);
        Object.assign(m, fillMeal(m.target, MEAL_SOURCES[m.type], di + mi));
      });

      const planned = meals.reduce((s, m) => s + m.carbs, 0) + beet;
      const log = state.log[date] || {};
      const eaten = meals.reduce((s, m) => s + (log[m.key] ? m.carbs : 0), 0) + (beet && log.beet ? beet : 0);

      return { date, idx: di, base, tr, trainCarbs, target, beet, meals, planned, eaten, last: di === loadDates.length - 1 };
    });

    const bt = round5(w * p.breakfastGkg);
    const raceBreakfast = {
      target: bt,
      time: minusHours(p.raceTime, p.breakfastHours),
      source: state.raceBreakfast ? 'race' : 'auto',
      ...(state.raceBreakfast ? itemsFrom(state.raceBreakfast) : fillMeal(bt, MEAL_SOURCES.breakfast, 0)),
    };

    return { days, raceBreakfast, beetDates, beetCarbs };
  }

  function shoppingList(plan) {
    const need = new Map();
    const add = (f, n) => {
      const e = need.get(f.id) || { food: f, n: 0 };
      e.n += n;
      need.set(f.id, e);
    };
    plan.days.forEach((d) => d.meals.forEach((m) => m.items.forEach((it) => add(it.food, it.n))));
    plan.raceBreakfast.items.forEach((it) => add(it.food, it.n));
    if (state.beet.on) add(BEET_SHOT, state.beet.shots * (plan.beetDates.length + 1));
    return [...need.values()].map((e) => ({ ...e, packs: Math.max(1, Math.ceil(e.n / e.food.perPack - 1e-9)) }));
  }

  // ---------- formatting ----------

  const kgToDisplay = (kg) => (state.profile.units === 'imperial' ? kg / KG_PER_LB : kg);
  const weightUnit = () => (state.profile.units === 'imperial' ? 'lb' : 'kg');
  const distanceLabel = () => (DISTANCES.find((d) => d.id === state.profile.distance) || DISTANCES[3]).label;
  const fmtDayShort = (iso) => fromISO(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });

  // Phosphor icon. weight: 'ph' (regular), 'ph-bold' or 'ph-fill'.
  const icon = (name, weight = 'ph') => `<i class="${weight} ph-${name}" aria-hidden="true"></i>`;

  const MEAL_ICONS = {
    breakfast: 'coffee', am: 'cookie', lunch: 'bowl-food', pm: 'cookie',
    dinner: 'cooking-pot', eve: 'moon-stars', race: 'flag-checkered', beet: 'drop',
  };
  const TRAINING_ICONS = { rest: 'bed', easy: 'person-simple-run', strides: 'sneaker-move', workout: 'lightning', long: 'path' };
  const FIBRE_LABELS = { easy: 'Low fibre', ok: 'Some fibre', heavy: 'High fibre' };

  // Circular progress ring with optional content in the middle.
  function ring(pct, size, stroke, inner = '') {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const off = c * (1 - Math.max(0, Math.min(100, pct)) / 100);
    return `
      <span class="ring" style="width:${size}px;height:${size}px">
        <svg viewBox="0 0 ${size} ${size}" aria-hidden="true">
          <circle class="ring-bg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" />
          <circle class="ring-fg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"
            stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})" />
        </svg>
        <span class="ring-inner">${inner}</span>
      </span>`;
  }

  // Round tick-box used for meals, foods and the shopping list.
  function tick(attrs, checked, label, id = '') {
    return `<label class="tick"${id ? ` for="${id}"` : ''}>
      <input type="checkbox" ${id ? `id="${id}"` : ''} ${attrs} ${checked ? 'checked' : ''} aria-label="${esc(label)}">
      <span class="tick-ui">${icon('check', 'ph-bold')}</span>
    </label>`;
  }

  function itemLines(items) {
    return `<ul class="item-lines">${items.map((it) => `
      <li><span><b>${fmtN(it.n)}×</b> ${esc(it.food.name)} <span class="dim">${esc(it.food.serving)}</span></span><span class="g">${fmtG(it.n * it.food.carbs)}</span></li>`).join('')}</ul>`;
  }

  function sourceTag(source) {
    if (source === 'every') return '<span class="tag">Every day</span>';
    if (source === 'day' || source === 'race') return '<span class="tag">Your pick</span>';
    return '';
  }

  // ---------- header ----------

  const TAB_TITLES = { plan: 'Your load', training: 'Training', foods: 'Foods', shop: 'Shopping', setup: 'Setup' };

  function renderHeader() {
    const p = state.profile;
    const toGo = daysBetween(toISO(new Date()), p.raceDate);
    const when = toGo > 1 ? `${toGo} days to go` : toGo === 1 ? 'tomorrow' : toGo === 0 ? 'race day' : 'race passed';
    document.getElementById('race-line').textContent = `${distanceLabel()} · ${fmtDay(p.raceDate)} · ${p.raceTime} · ${when}`;
    document.getElementById('page-title').textContent = state.tab === 'setup' && !state.onboarded ? 'Let’s set up' : TAB_TITLES[state.tab];

    let actions = '';
    if (state.tab === 'shop') actions = `<button type="button" class="round-btn" data-action="share-list" aria-label="Share shopping list">${icon('share-network')}</button>`;
    if (state.tab === 'plan') actions = `<button type="button" class="round-btn" data-action="goto" data-tab="setup" aria-label="Edit race and load settings">${icon('sliders-horizontal')}</button>`;
    document.getElementById('top-actions').innerHTML = actions;
  }

  // ---------- Plan tab ----------

  function selectedPlanDay(plan) {
    const dates = plan.days.map((d) => d.date).concat(state.profile.raceDate);
    if (state.planDay && dates.includes(state.planDay)) return state.planDay;
    const today = toISO(new Date());
    return dates.includes(today) ? today : dates[0];
  }

  function renderPlan() {
    const el = document.getElementById('tab-plan');
    const p = state.profile;
    const plan = buildPlan();
    const rb = plan.raceBreakfast;
    const today = toISO(new Date());
    const sel = selectedPlanDay(plan);
    const raceLog = state.log[p.raceDate] || {};
    const out = [];

    if (daysBetween(today, p.raceDate) < 0) {
      out.push(`<div class="notice">${icon('warning-circle', 'ph-fill')}<span>Your race date has passed. <button type="button" class="text-btn" data-action="goto" data-tab="setup">Update it in Setup</button></span></div>`);
    }

    // Hero
    const plannedAll = plan.days.reduce((s, d) => s + d.planned, 0) + rb.carbs;
    const eatenAll = plan.days.reduce((s, d) => s + d.eaten, 0) + (raceLog.race ? rb.carbs : 0);
    const pctAll = plannedAll ? Math.round((eatenAll / plannedAll) * 100) : 0;
    const daily = round5(p.weightKg * p.gkg);
    const start = addDays(p.raceDate, -p.loadDays);
    const startsIn = daysBetween(today, start);
    const heroBtn = plan.days.some((d) => d.date === today)
      ? `${icon('play', 'ph-fill')} Today’s meals`
      : startsIn > 0 && p.loadDays ? `${icon('play', 'ph-fill')} Preview day 1` : `${icon('play', 'ph-fill')} Race morning`;
    const heroDate = plan.days.some((d) => d.date === today) ? today : p.loadDays ? plan.days[0].date : p.raceDate;
    out.push(`
      <section class="hero">
        <div class="hero-top">
          <span class="mono">${p.loadDays ? `${p.loadDays}-day load · ${fmtN(p.gkg)} g/kg` : 'Race morning only'}</span>
          <span class="hero-progress"><span class="hbar"><span style="width:${pctAll}%"></span></span>${pctAll}%</span>
        </div>
        <div class="hero-body">
          <span class="hero-icon">${icon('battery-charging', 'ph-fill')}</span>
          <h2 class="hero-title">${distanceLabel()}<br>carb load</h2>
          <p class="hero-sub">${p.loadDays
            ? `${fmtG(daily)} of carbs a day, ${startsIn > 0 ? `starting in ${startsIn} day${startsIn > 1 ? 's' : ''}` : `from ${fmtDay(start)}`}`
            : `No load needed for a ${distanceLabel()}. Get race breakfast right.`}</p>
          <button type="button" class="pill-btn light" data-action="plan-day" data-date="${heroDate}" data-scroll="1">${heroBtn}</button>
        </div>
      </section>`);

    // Day strip
    const strip = plan.days.map((d) => ({
      date: d.date, label: fmtDayShort(d.date), eaten: d.eaten, pct: d.planned ? (d.eaten / d.planned) * 100 : 0, ic: 'fork-knife',
    })).concat({
      date: p.raceDate, label: 'Race', eaten: raceLog.race ? rb.carbs : 0, pct: raceLog.race ? 100 : 0, ic: 'flag-checkered',
    });
    out.push(`
      <section class="tile strip" aria-label="Days">
        ${strip.map((s) => `
          <button type="button" class="strip-item${s.date === sel ? ' active' : ''}" data-action="plan-day" data-date="${s.date}" aria-pressed="${s.date === sel}">
            ${ring(s.pct, 40, 4, icon(s.ic, 'ph-fill'))}
            <span class="strip-text"><b>${fmtG(s.eaten)}</b><span class="mono">${s.label}</span></span>
          </button>`).join('')}
      </section>`);

    // Stats
    const total = plan.days.reduce((s, d) => s + d.target, 0);
    const gain = p.units === 'imperial' ? '2–4' : '1–2';
    out.push(`
      <section class="stat-grid">
        <div class="tile stat"><div class="stat-num">${p.loadDays ? Math.round(total).toLocaleString() : '0'}<sup>g</sup></div><div class="mono">Total carbs</div></div>
        <div class="tile stat"><div class="stat-num">${rb.time}</div><div class="mono">Breakfast by</div></div>
        <div class="tile stat"><div class="stat-num">+${gain}<sup>${weightUnit()}</sup></div><div class="mono">Water weight</div><span class="stat-mark lime">${icon('triangle', 'ph-fill')}</span></div>
        <div class="tile stat"><div class="stat-num">${p.meals}<sup>/day</sup></div><div class="mono">Meals</div><span class="stat-mark">${icon('fork-knife', 'ph-fill')}</span></div>
      </section>`);

    if (!planFoods().length) {
      out.push(`<div class="notice">${icon('warning-circle', 'ph-fill')}<span>You haven’t ticked any foods yet. <button type="button" class="text-btn" data-action="goto" data-tab="foods">Choose foods</button></span></div>`);
    }

    const day = plan.days.find((d) => d.date === sel);
    out.push(day ? renderDay(day) : renderRaceMorning(plan));

    if (state.beet.on) out.push(renderBeetCard(plan));
    if (p.loadDays) out.push(renderTips());

    el.innerHTML = out.join('');
  }

  function renderTips() {
    const tips = [
      ['scales', 'The scales will go up', `Expect +${state.profile.units === 'imperial' ? '2–4 lb' : '1–2 kg'}. Each gram of glycogen stores about 3g of water. That’s fuel, not fat.`],
      ['grains', 'Keep fibre and fat low', 'Choose white over wholegrain, and skip big salads, beans and creamy sauces.'],
      ['drop', 'Drink some of your carbs', 'Juice, sports drink and flavoured milk add carbs without making you feel stuffed.'],
      ['egg', 'Keep protein steady', 'A palm-sized portion at meals. Cut back on fat to make room for carbs.'],
      ['drop-half', 'Hydrate and add salt', 'Drink to thirst and aim for pale urine. Salt your food or add an electrolyte tab.'],
      ['flag', 'Nothing new', 'Stick to foods you’ve trained with, and rehearse the load before a long run.'],
    ];
    return `
      <details class="card tips">
        <summary><span class="badge-ico soft">${icon('lightbulb', 'ph-fill')}</span><span class="row-title">Before you start</span>${icon('caret-down', 'ph-bold')}</summary>
        <div class="tip-list">
          ${tips.map(([ic, title, body]) => `
            <div class="tip">${icon(ic)}<div><b>${title}</b><p>${body}</p></div></div>`).join('')}
        </div>
      </details>`;
  }

  function renderBeetCard(plan) {
    const p = state.profile;
    const b = state.beet;
    const shot = `${b.shots} shot${b.shots > 1 ? 's' : ''}`;
    return `
      <section class="card beet">
        <div class="row">
          <span class="badge-ico beet-bg">${icon('drop', 'ph-fill')}</span>
          <div class="row-main">
            <div class="row-title">Beetroot / nitrate</div>
            <div class="row-sub">${plan.beetDates.length
              ? `${shot} a day from ${fmtDay(plan.beetDates[0])}, plus race morning at ${minusHours(p.raceTime, 2.5)}.`
              : `${shot} on race morning at ${minusHours(p.raceTime, 2.5)}, about 2½ hours before the start.`}</div>
          </div>
        </div>
        <p class="fine">About ${BEET_SHOT.carbs}g of carbs per shot, already counted in your targets. Avoid antibacterial mouthwash while dosing, because it blocks the nitrate effect. Pink urine is harmless.</p>
      </section>`;
  }

  function mealRow({ date, key, label, carbs, items, source, done, iconName, empty }) {
    return `
      <div class="row meal${done ? ' done' : ''}">
        <span class="badge-ico">${icon(iconName, 'ph-fill')}</span>
        <div class="row-main">
          <div class="row-title"><b>${fmtG(carbs)}</b> ${label} ${sourceTag(source)}</div>
          ${items.length ? itemLines(items) : `<p class="row-sub">${empty}</p>`}
          ${key ? `<button type="button" class="text-btn small" data-action="edit-meal" data-date="${date}" data-key="${key}">${icon('pencil-simple')} Edit meal</button>` : ''}
        </div>
        ${tick(`data-action="toggle-log" data-date="${date}" data-key="${key || 'beet'}"`, done, `Mark ${label} as eaten`)}
      </div>`;
  }

  function renderDay(d) {
    const log = state.log[d.date] || {};
    const tr = TRAINING[d.tr.type];
    const trainLine = d.tr.type === 'rest' ? 'Rest day' : `${tr.label} · ${d.tr.min} min${d.trainCarbs ? ` · +${fmtG(d.trainCarbs)}` : ''}`;
    const diff = d.planned - d.target;

    const rows = d.meals.map((m) => mealRow({
      date: d.date, key: m.key, label: m.label, carbs: m.carbs, items: m.items, source: m.source,
      done: !!log[m.key], iconName: MEAL_ICONS[m.key] || 'fork-knife',
      empty: `No ${m.type === 'main' ? 'main-meal' : m.type} foods ticked yet.`,
    }));
    if (d.beet) {
      rows.push(`
        <div class="row meal${log.beet ? ' done' : ''}">
          <span class="badge-ico beet-bg">${icon('drop', 'ph-fill')}</span>
          <div class="row-main"><div class="row-title"><b>${fmtG(d.beet)}</b> Beetroot shot ×${state.beet.shots}</div></div>
          ${tick(`data-action="toggle-log" data-date="${d.date}" data-key="beet"`, !!log.beet, 'Mark beetroot shot as taken')}
        </div>`);
    }

    return `
      <section class="day" id="day-view">
        <div class="day-head">
          <div>
            <div class="mono dim">Load day ${d.idx + 1} of ${state.profile.loadDays}</div>
            <h2 class="day-title">${fmtDay(d.date)}</h2>
          </div>
          <div class="day-target"><span class="num">${Math.round(d.target).toLocaleString()}<sup>g</sup></span><span class="mono dim">Target</span></div>
        </div>
        <div class="pills">
          <span class="pill${tr.hard ? ' warn' : ''}">${icon(TRAINING_ICONS[d.tr.type], 'ph-bold')} ${trainLine}</span>
          ${diff < -d.target * 0.05 ? `<span class="pill warn">${icon('warning-circle', 'ph-bold')} ${fmtG(-diff)} short</span>`
            : Math.abs(diff) > 15 ? `<span class="pill">Planned ${fmtG(d.planned)}</span>` : ''}
        </div>
        <div class="card list">${rows.join('')}</div>
        ${d.last ? `<p class="fine">${icon('moon-stars')} Night before: eat dinner early (by about 7pm), keep it plain and familiar, with no spice, fibre or rich sauces.</p>` : ''}
      </section>`;
  }

  function renderRaceMorning(plan) {
    const p = state.profile;
    const rb = plan.raceBreakfast;
    const log = state.log[p.raceDate] || {};
    const steps = [
      [rb.time, 'Breakfast', 'Foods you’ve practised, low in fibre'],
      ...(state.beet.on ? [[minusHours(p.raceTime, 2.5), 'Beetroot', `${state.beet.shots} shot${state.beet.shots > 1 ? 's' : ''}`]] : []),
      [minusHours(p.raceTime, 1.5), 'Fluids', 'Sip 300–500ml, then stop about 30 min out'],
      [minusHours(p.raceTime, 0.25), 'Top-up', 'Optional gel or a few mouthfuls of sports drink'],
      [p.raceTime, 'Start', 'Begin fuelling early, at 30–90g of carbs an hour'],
    ];
    return `
      <section class="day" id="day-view">
        <div class="day-head">
          <div>
            <div class="mono dim">Race morning</div>
            <h2 class="day-title">${fmtDay(p.raceDate)}</h2>
          </div>
          <div class="day-target"><span class="num">${rb.target}<sup>g</sup></span><span class="mono dim">${fmtN(p.breakfastGkg)} g/kg</span></div>
        </div>
        <div class="card list">
          ${mealRow({
            date: p.raceDate, key: 'race', label: `Breakfast by ${rb.time}`, carbs: rb.carbs, items: rb.items,
            source: rb.source, done: !!log.race, iconName: 'flag-checkered', empty: 'Nothing picked yet.',
          })}
        </div>
        ${rb.source === 'auto' ? `<p class="fine">${icon('info')} This is a suggestion. Tap Edit meal and set the breakfast you’ve practised before long runs.</p>` : ''}
        <div class="tile timeline">
          ${steps.map(([t, title, body]) => `
            <div class="tl-row"><span class="tl-time">${t}</span><div><b>${title}</b><span>${body}</span></div></div>`).join('')}
        </div>
      </section>`;
  }

  // ---------- Training tab ----------

  function renderTraining() {
    const el = document.getElementById('tab-training');
    const p = state.profile;
    const n = Math.max(p.loadDays, 3);
    const rows = [];

    for (let i = n; i >= 1; i--) {
      const date = addDays(p.raceDate, -i);
      const tr = trainingFor(date);
      const t = TRAINING[tr.type];
      const isLoad = i <= p.loadDays;
      const extra = isLoad ? trainingCarbs(tr) : 0;
      rows.push(`
        <div class="row train${isLoad ? ' is-load' : ''}">
          <span class="badge-ico${isLoad ? '' : ' soft'}">${icon(TRAINING_ICONS[tr.type], 'ph-fill')}</span>
          <div class="row-main">
            <div class="row-title">${fmtDay(date)}</div>
            <div class="mono dim">${i === 1 ? 'Day before' : `${i} days out`}${isLoad ? ' · Load day' : ''}${extra ? ` · +${fmtG(extra)} carbs` : ''}</div>
            <div class="train-inputs">
              <div class="select-wrap">
                <select data-train-type="${date}" aria-label="Session type for ${fmtDay(date)}">
                  ${Object.entries(TRAINING).map(([k, v]) => `<option value="${k}" ${k === tr.type ? 'selected' : ''}>${v.label}</option>`).join('')}
                </select>${icon('caret-down', 'ph-bold')}
              </div>
              ${tr.type === 'rest' ? '' : `<div class="input-unit mins"><input type="number" inputmode="numeric" min="0" max="300" step="5" value="${tr.min}" data-train-min="${date}" aria-label="Minutes"><span>min</span></div>`}
            </div>
            ${isLoad && t.hard ? `<p class="warn-box">${icon('warning-circle', 'ph-fill')} Hard or long sessions burn the glycogen you’re trying to store. Move this before the load, or swap it for an easy run with strides.</p>` : ''}
          </div>
        </div>`);
    }

    el.innerHTML = `
      <p class="lede">Pre-filled with a typical taper. Change it to match your plan. Carbs for runs on load days are added to that day automatically.</p>
      <div class="card list">${rows.join('')}</div>
      <button type="button" class="text-btn" data-action="reset-training">${icon('arrow-counter-clockwise')} Reset to suggested taper</button>
      <div class="tile tips-dark">
        <div class="mono">Taper notes</div>
        <p><b>Short and easy.</b> A few 20-second strides keep your legs sharp.</p>
        <p><b>No depletion phase.</b> The old “deplete then load” method isn’t necessary.</p>
        <p><b>Feeling heavy is normal.</b> It goes away once you start racing.</p>
      </div>`;
  }

  // ---------- Foods tab ----------

  let foodQuery = '';

  function renderFoods() {
    const el = document.getElementById('tab-foods');
    el.innerHTML = foodsHTML();
    renderFoodList(el);
    renderFinder('foods');
  }

  // Shared by the Foods tab and the food step of first-run setup.
  function foodsHTML(intro) {
    return `
      <p class="lede">${intro || 'Tick foods you’ve trained with or are happy to eat. Suggested meals only use ticked foods, and you can set any meal exactly from the Plan tab.'}</p>
      <div class="chips">
        ${DIET_FILTERS.map(([k, label]) => `<button type="button" class="chip${state.diet[k] ? ' active' : ''}" data-action="diet" data-key="${k}" aria-pressed="${state.diet[k]}">${label}</button>`).join('')}
      </div>
      <div class="search-wrap">${icon('magnifying-glass')}<input type="search" class="food-search" placeholder="Search foods" value="${esc(foodQuery)}" aria-label="Search foods"></div>
      <div class="food-list"></div>
      <div class="list-foot"><button type="button" class="text-btn" data-action="clear-prefs">${icon('x')} Untick all</button></div>
      <details class="card add-food"${finderIsActive('foods') ? ' open' : ''}>
        <summary><span class="badge-ico">${icon('plus', 'ph-bold')}</span><span class="row-title">Add a food</span>${icon('caret-down', 'ph-bold')}</summary>
        <div class="finder-host"></div>
      </details>`;
  }

  function renderFoodList(root) {
    const listEl = root.querySelector('.food-list');
    if (!listEl) return;
    const q = foodQuery.trim().toLowerCase();
    const foods = allFoods().filter(dietOk).filter((f) => !q || f.name.toLowerCase().includes(q));
    const groups = ROLE_GROUPS.map(([slot, label]) => [label, foods.filter((f) => f.slots[0] === slot)]).filter(([, fs]) => fs.length);

    listEl.innerHTML = groups.length
      ? groups.map(([label, fs]) => `
          <div class="group-head"><span class="mono">${label}</span><span class="mono dim">${fs.filter((f) => state.preferred.includes(f.id)).length} ticked</span></div>
          <div class="card list">
            ${fs.map((f) => `
              <div class="row food">
                <label class="row-main" for="pref-${f.id}">
                  <span class="row-title">${esc(f.name)}</span>
                  <span class="row-sub">${esc(f.serving)} · <b>${fmtN(f.carbs)}g</b> carbs</span>
                  <span class="fibre fibre-${f.gut}"><span class="dot"></span>${FIBRE_LABELS[f.gut] || 'Some fibre'}${f.custom ? ' · Custom' : ''}</span>
                </label>
                ${f.custom ? `<button type="button" class="round-btn small" data-action="delete-food" data-id="${f.id}" aria-label="Delete ${esc(f.name)}">${icon('trash')}</button>` : ''}
                ${tick(`data-action="toggle-pref" data-id="${f.id}"`, state.preferred.includes(f.id), `Use ${f.name}`, `pref-${f.id}`)}
              </div>`).join('')}
          </div>`).join('')
      : '<p class="lede">No foods match.</p>';
  }

  // ---------- Shop tab ----------

  function shopText(list) {
    const lines = ['Carb load shopping list', ''];
    AISLES.forEach((a) => {
      const items = list.filter((e) => e.food.aisle === a);
      if (!items.length) return;
      lines.push(a.toUpperCase());
      items.forEach((e) => lines.push(`- ${e.food.name}: ${e.packs} × ${e.food.pack} (need ${fmtN(e.n)} × ${e.food.serving})`));
      lines.push('');
    });
    return lines.join('\n').trim();
  }

  function renderShop() {
    const el = document.getElementById('tab-shop');
    const plan = buildPlan();
    const list = shoppingList(plan);
    const p = state.profile;
    const from = p.loadDays ? fmtDay(addDays(p.raceDate, -p.loadDays)) : fmtDay(p.raceDate);
    const got = list.filter((e) => state.shop[e.food.id]).length;

    if (!list.length) {
      el.innerHTML = '<p class="lede">Nothing to buy yet. Tick some foods and your list will appear here.</p>';
      return;
    }

    el.innerHTML = `
      <section class="tile shop-sum">
        ${ring(list.length ? (got / list.length) * 100 : 0, 64, 5, icon('basket', 'ph-fill'))}
        <div>
          <div class="stat-num">${got}<sup>/${list.length}</sup></div>
          <div class="mono">In the basket</div>
        </div>
        <div class="mono dim shop-range">${from}<br>→ race</div>
      </section>
      ${AISLES.map((a) => {
        const items = list.filter((e) => e.food.aisle === a);
        if (!items.length) return '';
        return `
          <div class="group-head"><span class="mono">${a}</span></div>
          <div class="card list">${items.map((e) => `
            <div class="row shop${state.shop[e.food.id] ? ' done' : ''}">
              <label class="row-main" for="shop-${e.food.id}">
                <span class="row-title">${e.packs} × ${esc(e.food.pack)}</span>
                <span class="row-sub">${esc(e.food.name)}</span>
                <span class="mono dim">Need ${fmtN(e.n)} × ${esc(e.food.serving)} · ${fmtG(e.n * e.food.carbs)}</span>
              </label>
              ${tick(`data-action="toggle-shop" data-id="${e.food.id}"`, !!state.shop[e.food.id], `Got ${e.food.name}`, `shop-${e.food.id}`)}
            </div>`).join('')}
          </div>`;
      }).join('')}
      <p class="fine">Typical UK pack sizes, so you’ll usually have some left over. Tick anything you already have at home.</p>
      <button type="button" class="text-btn" data-action="clear-shop">${icon('arrow-counter-clockwise')} Untick all</button>`;
  }

  // ---------- Setup tab ----------

  const SETUP_STEPS = ['Race & load', 'Your foods', 'Race breakfast'];

  function seg(name, options, value) {
    return `<div class="seg" role="group">${options.map(([v, l]) =>
      `<button type="button" class="seg-btn${String(v) === String(value) ? ' active' : ''}" data-action="set" data-field="${name}" data-value="${v}" aria-pressed="${String(v) === String(value)}">${l}</button>`).join('')}</div>`;
  }

  function stepper(field, value, label) {
    return `<div class="stepper">
      <button type="button" data-action="step" data-field="${field}" data-delta="-1" aria-label="Fewer ${label}">${icon('minus', 'ph-bold')}</button>
      <output>${value}</output>
      <button type="button" data-action="step" data-field="${field}" data-delta="1" aria-label="More ${label}">${icon('plus', 'ph-bold')}</button>
    </div>`;
  }

  function renderSetup() {
    const el = document.getElementById('tab-setup');
    const step = state.onboarded ? 1 : state.onboardStep;
    const steps = state.onboarded ? '' : `
      <div class="steps">
        <div class="steps-bar">${SETUP_STEPS.map((_, i) => `<span class="${i + 1 <= step ? 'on' : ''}"></span>`).join('')}</div>
        <div class="mono">Step ${step} of 3 · ${SETUP_STEPS[step - 1]}</div>
      </div>`;

    if (step === 2) {
      el.innerHTML = `${steps}
        ${foodsHTML('Tick the foods you’ve trained with or are happy to eat. Suggested meals are built only from ticked foods. You can set any meal exactly later.')}
        <div class="wizard-nav">
          <button type="button" class="pill-btn ghost" data-action="setup-step" data-step="1">${icon('arrow-left', 'ph-bold')} Back</button>
          <button type="button" class="pill-btn primary" data-action="setup-step" data-step="3">Next: race breakfast ${icon('arrow-right', 'ph-bold')}</button>
        </div>`;
      renderFoodList(el);
      renderFinder('foods');
      return;
    }

    if (step === 3) {
      el.innerHTML = `${steps}
        <p class="lede">Race morning isn’t the time to try something new. Set the breakfast you’ve practised before long runs and sessions, and it goes in your plan exactly as you set it.</p>
        ${raceBreakfastSummary()}
        <div class="wizard-nav">
          <button type="button" class="pill-btn ghost" data-action="setup-step" data-step="2">${icon('arrow-left', 'ph-bold')} Back</button>
          <button type="button" class="pill-btn primary" data-action="goto" data-tab="plan">Build my plan ${icon('arrow-right', 'ph-bold')}</button>
        </div>`;
      return;
    }

    el.innerHTML = `${steps}${raceSetupHTML()}
      ${state.onboarded
        ? `<button type="button" class="pill-btn primary wide" data-action="goto" data-tab="plan">See my plan ${icon('arrow-right', 'ph-bold')}</button>`
        : `<button type="button" class="pill-btn primary wide" data-action="setup-step" data-step="2">Next: your foods ${icon('arrow-right', 'ph-bold')}</button>`}`;
    updateSetupLive();
  }

  // Shows the saved race breakfast (or that none is set) with an edit button.
  function raceBreakfastSummary() {
    const p = state.profile;
    const target = round5(p.weightKg * p.breakfastGkg);
    if (!state.raceBreakfast) {
      return `
        <div class="card rb">
          <div class="row">
            <span class="badge-ico">${icon('flag-checkered', 'ph-fill')}</span>
            <div class="row-main">
              <div class="row-title">Race breakfast not set</div>
              <div class="row-sub">Aim for about ${fmtG(target)} of carbs (${fmtN(p.breakfastGkg)} g/kg), eaten by ${minusHours(p.raceTime, p.breakfastHours)}.</div>
            </div>
          </div>
          <button type="button" class="pill-btn primary wide" data-action="edit-meal" data-key="race" data-date="${p.raceDate}">${icon('plus', 'ph-bold')} Build race breakfast</button>
        </div>`;
    }
    const { items, carbs } = itemsFrom(state.raceBreakfast);
    return `
      <div class="card rb">
        <div class="row">
          <span class="badge-ico">${icon('flag-checkered', 'ph-fill')}</span>
          <div class="row-main">
            <div class="row-title"><b>${fmtG(carbs)}</b> Race breakfast <span class="dim">/ ${fmtG(target)}</span></div>
            ${itemLines(items)}
            <div class="mono dim">Eat by ${minusHours(p.raceTime, p.breakfastHours)}</div>
          </div>
        </div>
        <button type="button" class="pill-btn ghost wide" data-action="edit-meal" data-key="race" data-date="${p.raceDate}">${icon('pencil-simple')} Edit race breakfast</button>
      </div>`;
  }

  function raceSetupHTML() {
    const p = state.profile;
    const b = state.beet;
    const fm = p.finishMin;

    return `
      <section class="card form">
        <h3 class="card-title">You</h3>
        <div class="field-row"><span class="mono">Units</span>${seg('units', [['metric', 'kg'], ['imperial', 'lb']], p.units)}</div>
        <label class="field">
          <span class="mono">Weight at the start of your load</span>
          <div class="input-unit"><input type="number" id="weight" inputmode="decimal" min="25" max="400" step="0.1" value="${fmtN(Math.round(kgToDisplay(p.weightKg) * 10) / 10)}"><span>${weightUnit()}</span></div>
        </label>
      </section>

      <section class="card form">
        <h3 class="card-title">Race</h3>
        <div class="chips">${DISTANCES.map((d) => `<button type="button" class="chip${d.id === p.distance ? ' active' : ''}" data-action="set" data-field="distance" data-value="${d.id}" aria-pressed="${d.id === p.distance}">${d.label}</button>`).join('')}</div>
        <div class="grid2">
          <label class="field"><span class="mono">Race date</span><input type="date" id="race-date" value="${p.raceDate}"></label>
          <label class="field"><span class="mono">Start time</span><input type="time" id="race-time" value="${p.raceTime}"></label>
        </div>
        <div class="field">
          <span class="mono">Expected finish (optional)</span>
          <div class="grid2">
            <div class="input-unit"><input type="number" id="finish-h" inputmode="numeric" min="0" max="48" placeholder="0" value="${fm != null ? Math.floor(fm / 60) : ''}"><span>hrs</span></div>
            <div class="input-unit"><input type="number" id="finish-m" inputmode="numeric" min="0" max="59" placeholder="0" value="${fm != null ? fm % 60 : ''}"><span>min</span></div>
          </div>
        </div>
      </section>

      <section class="tile rec" id="rec-box"></section>

      <section class="card form">
        <h3 class="card-title">Load</h3>
        <div class="field-row"><span class="mono">Days of loading</span>${stepper('loadDays', `<span id="days-val">${p.loadDays}</span>`, 'days')}</div>
        <label class="field">
          <span class="field-row tight"><span class="mono">Carbs per kg per day</span><output id="gkg-val" class="val">${fmtN(p.gkg)} g/kg</output></span>
          <input type="range" id="gkg" min="5" max="12" step="0.5" value="${p.gkg}">
        </label>
        <div class="field-row"><span class="mono">Meals per day</span>${seg('meals', [[3, '3'], [4, '4'], [5, '5'], [6, '6']], p.meals)}</div>
        <div class="summary" id="load-summary"></div>
      </section>

      <section class="card form">
        <h3 class="card-title">Race-morning breakfast</h3>
        <label class="field">
          <span class="field-row tight"><span class="mono">Carbs</span><output id="bf-val" class="val">${fmtN(p.breakfastGkg)} g/kg</output></span>
          <input type="range" id="bf-gkg" min="1" max="4" step="0.5" value="${p.breakfastGkg}">
        </label>
        <div class="field-row"><span class="mono">Hours before start</span>${seg('breakfastHours', [[2, '2h'], [3, '3h'], [4, '4h']], p.breakfastHours)}</div>
        <div class="summary" id="bf-summary"></div>
        <p class="fine">Allow more time for a bigger breakfast. Go nearer 1 g/kg if your stomach is sensitive on race morning.</p>
      </section>
      ${state.onboarded ? raceBreakfastSummary() : ''}

      <section class="card form">
        <div class="field-row first">
          <h3 class="card-title flush"><span class="badge-ico beet-bg sm">${icon('drop', 'ph-fill')}</span> Beetroot / nitrate</h3>
          <label class="switch"><input type="checkbox" data-action="beet-toggle" ${b.on ? 'checked' : ''}><span class="switch-ui" aria-hidden="true"></span><span class="sr-only">Include beetroot loading</span></label>
        </div>
        <p class="fine">Dietary nitrate may improve running economy slightly. Most of the evidence comes from shorter, faster efforts. A typical dose is a concentrated 70ml shot with about 400mg (6.4 mmol) of nitrate.</p>
        ${b.on ? `
          <div class="field-row"><span class="mono">Approach</span>${seg('beet.mode', [['chronic', 'Daily'], ['acute', 'Race day']], b.mode)}</div>
          ${b.mode === 'chronic' ? `<div class="field-row"><span class="mono">Days before race</span>${stepper('beet.days', b.days, 'days')}</div>` : ''}
          <div class="field-row"><span class="mono">Shots per dose</span>${seg('beet.shots', [[1, '1'], [2, '2']], b.shots)}</div>
          <p class="fine">Take the race-day dose 2–3 hours before the start. Try it in training first, because some people get stomach upset.</p>` : ''}
      </section>`;
  }

  // Refresh computed bits of Setup without re-rendering inputs (keeps focus).
  function updateSetupLive() {
    const p = state.profile;
    const r = recommend(p);
    const recEl = document.getElementById('rec-box');
    if (!recEl) return;
    recEl.innerHTML = `
      <div class="rec-top"><span class="mono">Suggested</span>${icon('sparkle', 'ph-fill')}</div>
      <div class="stat-num">${r.days ? `${r.days}<sup>day${r.days > 1 ? 's' : ''}</sup> ${r.gkg}<sup>g/kg</sup>` : 'No load'}</div>
      <p>${r.why}</p>
      ${p.auto ? '' : `<button type="button" class="pill-btn light small" data-action="use-rec">${icon('arrow-counter-clockwise', 'ph-bold')} Use suggestion</button>`}`;
    document.getElementById('days-val').textContent = p.loadDays;
    document.getElementById('gkg-val').textContent = `${fmtN(p.gkg)} g/kg`;
    const gkgInput = document.getElementById('gkg');
    if (document.activeElement !== gkgInput) gkgInput.value = p.gkg;
    const daily = round5(p.weightKg * p.gkg);
    document.getElementById('load-summary').innerHTML = p.loadDays
      ? `<div><span class="big">${fmtG(daily)}</span><span class="mono dim">Per day</span></div><div><span class="big">${fmtG(daily * p.loadDays)}</span><span class="mono dim">Total, before training</span></div>`
      : '<p class="fine">No loading days. You’ll just get a race-morning breakfast plan.</p>';
    document.getElementById('bf-val').textContent = `${fmtN(p.breakfastGkg)} g/kg`;
    document.getElementById('bf-summary').innerHTML = `<div><span class="big">${fmtG(round5(p.weightKg * p.breakfastGkg))}</span><span class="mono dim">Carbs</span></div><div><span class="big">${minusHours(p.raceTime, p.breakfastHours)}</span><span class="mono dim">Eat by</span></div>`;
    renderHeader();
  }

  // ---------- meal editor ----------

  const sheet = document.getElementById('meal-sheet');
  let editing = null; // { date, key, label, type, target, items: [{ id, n }], every, source }
  let pickQuery = '';

  function openEditor(date, key) {
    const plan = buildPlan();
    if (key === 'race') {
      const rb = plan.raceBreakfast;
      editing = {
        date, key, label: 'Race breakfast', type: 'breakfast', target: rb.target,
        dateLabel: `Race morning · eat by ${rb.time}`,
        // Start empty rather than from the suggestion: this should be what you've practised.
        items: rb.source === 'auto' ? [] : rb.items.map((it) => ({ id: it.food.id, n: it.n })),
        source: rb.source, every: false,
      };
    } else {
      const day = plan.days.find((d) => d.date === date);
      const meal = day && day.meals.find((m) => m.key === key);
      if (!meal) return;
      editing = {
        date, key, label: meal.label, type: meal.type, target: meal.target,
        dateLabel: fmtDay(date),
        items: meal.items.map((it) => ({ id: it.food.id, n: it.n })),
        source: meal.source, every: meal.source === 'every',
      };
    }
    pickQuery = '';
    renderSheet();
    if (!sheet.open) sheet.showModal();
    sheet.scrollTop = 0;
  }

  function closeEditor() {
    editing = null;
    if (sheet.open) sheet.close();
  }

  function renderSheet() {
    stopScan('sheet');
    const e = editing;
    const items = e.items.map((x) => ({ ...x, food: foodById(x.id) })).filter((x) => x.food);
    const total = Math.round(items.reduce((s, x) => s + x.n * x.food.carbs, 0));
    const pct = e.target ? Math.min(100, Math.round((total / e.target) * 100)) : 0;
    const isRace = e.key === 'race';

    sheet.innerHTML = `
      <div class="sheet-inner">
        <div class="sheet-grab" aria-hidden="true"></div>
        <div class="sheet-head">
          <div>
            <div class="mono dim">${esc(e.dateLabel)}</div>
            <h2 class="day-title">${esc(e.label)}</h2>
          </div>
          <button type="button" class="round-btn" data-sheet="close" aria-label="Close">${icon('x', 'ph-bold')}</button>
        </div>

        <div class="tile sheet-total">
          ${ring(pct, 52, 5, `<span class="ring-pct">${pct}%</span>`)}
          <div><div class="stat-num">${total}<sup>g</sup></div><div class="mono">Of ${fmtG(e.target)} target</div></div>
        </div>

        ${items.length ? `<div class="card list edit-list">${items.map((x, i) => `
          <div class="row">
            <div class="row-main">
              <span class="row-title">${esc(x.food.name)}</span>
              <span class="row-sub">${esc(x.food.serving)} · ${fmtN(x.food.carbs)}g each · <b>${fmtG(x.n * x.food.carbs)}</b></span>
            </div>
            <div class="stepper">
              <button type="button" data-sheet="dec" data-i="${i}" aria-label="Less ${esc(x.food.name)}">${icon(x.n <= (x.food.step || 0.5) ? 'trash' : 'minus', 'ph-bold')}</button>
              <output>${fmtN(x.n)}</output>
              <button type="button" data-sheet="inc" data-i="${i}" aria-label="More ${esc(x.food.name)}">${icon('plus', 'ph-bold')}</button>
            </div>
          </div>`).join('')}</div>`
        : '<p class="lede">Nothing in this meal yet. Add foods below.</p>'}

        <div class="group-head"><span class="mono">Add a food</span></div>
        <div class="search-wrap">${icon('magnifying-glass')}<input type="search" class="sheet-search" placeholder="Search all foods" value="${esc(pickQuery)}" aria-label="Search all foods"></div>
        <div class="pick-list"></div>

        <div class="group-head"><span class="mono">Not in your foods? Search UK products</span></div>
        <div class="finder-host"></div>

        <div class="sheet-foot">
          ${isRace ? '' : `
            <label class="every">
              <span><b>Every load day</b><span class="mono dim">Use this ${esc(e.label.toLowerCase())} each day</span></span>
              <span class="switch"><input type="checkbox" data-sheet="every" ${e.every ? 'checked' : ''}><span class="switch-ui" aria-hidden="true"></span></span>
            </label>`}
          <div class="sheet-actions">
            ${e.source !== 'auto' ? `<button type="button" class="pill-btn ghost" data-sheet="reset">${isRace ? 'Clear' : 'Use suggested'}</button>` : ''}
            <button type="button" class="pill-btn primary" data-sheet="save">${icon('check', 'ph-bold')} Save</button>
          </div>
        </div>
      </div>`;
    renderPickList();
    renderFinder('sheet');
  }

  function renderPickList() {
    const listEl = sheet.querySelector('.pick-list');
    const q = pickQuery.trim().toLowerCase();
    const inMeal = new Set(editing.items.map((x) => x.id));
    const slots = MEAL_SOURCES[editing.type];
    let foods;
    let note = '';
    if (q) {
      foods = allFoods().filter((f) => dietOk(f) && f.name.toLowerCase().includes(q));
    } else {
      // Your ticked foods, the ones that suit this meal first.
      const rank = (f) => { const i = slots.findIndex((sl) => f.slots.includes(sl)); return i < 0 ? 9 : i; };
      foods = planFoods().sort((a, b) => rank(a) - rank(b));
      note = '<p class="fine">Showing your ticked foods. Search to find anything else.</p>';
    }
    foods = foods.filter((f) => !inMeal.has(f.id)).slice(0, 40);
    listEl.innerHTML = note + (foods.length
      ? `<div class="card list">${foods.map((f) => `
          <button type="button" class="row pick" data-sheet="add" data-id="${f.id}">
            <span class="row-main">
              <span class="row-title">${esc(f.name)}</span>
              <span class="row-sub">${esc(f.serving)} · ${fmtN(f.carbs)}g</span>
            </span>
            <span class="plus">${icon('plus', 'ph-bold')}</span>
          </button>`).join('')}</div>`
      : `<p class="fine">None of your foods match. <button type="button" class="text-btn small inline" data-off="search-online" data-ctx="sheet" data-q="${esc(pickQuery)}">${icon('globe-simple')} Search UK products for “${esc(pickQuery)}”</button></p>`);
  }

  function saveEditor() {
    const e = editing;
    const items = e.items.filter((x) => x.n > 0).map(({ id, n }) => ({ id, n }));
    if (e.key === 'race') {
      state.raceBreakfast = items.length ? items : null;
    } else if (e.every) {
      state.mealDefaults[e.key] = items;
      // An every-day choice replaces one-off edits of the same meal.
      Object.keys(state.overrides).forEach((k) => { if (k.endsWith(`|${e.key}`)) delete state.overrides[k]; });
    } else {
      state.overrides[`${e.date}|${e.key}`] = items;
    }
    // Foods you put in a meal count as foods you like.
    items.forEach((x) => { if (!state.preferred.includes(x.id)) state.preferred.push(x.id); });
    save();
    closeEditor();
    rerender();
  }

  function resetEditor() {
    const e = editing;
    if (e.key === 'race') state.raceBreakfast = null;
    else if (e.source === 'day') delete state.overrides[`${e.date}|${e.key}`];
    else if (e.source === 'every') delete state.mealDefaults[e.key];
    save();
    closeEditor();
    rerender();
  }

  sheet.addEventListener('click', (ev) => {
    if (ev.target === sheet) { closeEditor(); return; } // backdrop
    const t = ev.target.closest('[data-sheet]');
    if (!t || !editing) return;
    const a = t.dataset.sheet;
    const items = editing.items;
    if (a === 'close') { closeEditor(); return; }
    if (a === 'save') { saveEditor(); return; }
    if (a === 'reset') { resetEditor(); return; }
    if (a === 'add') {
      items.push({ id: t.dataset.id, n: 1 });
      pickQuery = '';
    } else if (a === 'inc' || a === 'dec') {
      const x = items[Number(t.dataset.i)];
      const step = foodById(x.id).step || 0.5;
      x.n = Math.round((x.n + (a === 'inc' ? step : -step)) * 10) / 10;
      if (x.n <= 0) items.splice(Number(t.dataset.i), 1);
    } else {
      return;
    }
    renderSheet();
  });

  sheet.addEventListener('change', (ev) => {
    if (ev.target.dataset.sheet === 'every' && editing) editing.every = ev.target.checked;
  });

  sheet.addEventListener('input', (ev) => {
    if (!ev.target.classList.contains('sheet-search')) return;
    pickQuery = ev.target.value;
    renderPickList();
  });

  sheet.addEventListener('close', () => {
    editing = null;
    stopScan('sheet');
    finder.sheet = blankFinder();
  });

  // ---------- online food lookup (Open Food Facts) ----------

  const Lookup = window.FoodLookup;
  const round1 = (x) => Math.round(x * 10) / 10;
  const blankFinder = () => ({ query: '', status: 'idle', results: [], message: '', draft: null, scanning: false, scan: null, scanError: '', added: '', token: 0 });
  // One finder in the Foods panel (also used by setup step 2) and one in the meal editor.
  const finder = { foods: blankFinder(), sheet: blankFinder() };

  const finderIsActive = (ctx) => { const f = finder[ctx]; return f.status !== 'idle' || f.draft || f.scanning || f.added; };

  function finderHost(ctx) {
    return ctx === 'sheet'
      ? sheet.querySelector('.finder-host')
      : document.querySelector('.tab-panel:not([hidden]) .finder-host');
  }

  function renderFinder(ctx) {
    const host = finderHost(ctx);
    if (!host) return;
    const f = finder[ctx];
    let body = '';
    if (f.draft) {
      body = '';
    } else if (f.scanning) {
      body = `
        <div class="scan-box">
          ${f.scanError ? `<p class="off-status err">${icon('camera-slash', 'ph-fill')} ${esc(f.scanError)}</p>` : `<div id="scan-${ctx}" class="scan-view"></div>`}
          <form class="barcode-form" data-ctx="${ctx}">
            <input name="code" inputmode="numeric" pattern="[0-9]*" maxlength="14" placeholder="Or type the barcode number" aria-label="Barcode number">
            <button type="submit" class="pill-btn ghost small">Look up</button>
          </form>
          <button type="button" class="text-btn small" data-off="stop-scan" data-ctx="${ctx}">${icon('x')} Cancel scan</button>
        </div>`;
    } else if (f.status === 'loading') {
      body = `<p class="off-status">${icon('circle-notch', 'ph-bold spin')} ${esc(f.message)}</p>`;
    } else if (f.status === 'error') {
      body = `<p class="off-status err">${icon('warning-circle', 'ph-fill')} ${esc(f.message)}</p>`;
    } else if (f.status === 'results') {
      body = f.results.length
        ? `<div class="card list off-results">${f.results.map((r) => `
            <button type="button" class="row pick" data-off="pick" data-ctx="${ctx}" data-code="${esc(r.code)}">
              <span class="row-main">
                <span class="row-title">${esc(r.name)}</span>
                <span class="row-sub">${esc([r.brand, r.quantity].filter(Boolean).join(' · '))}</span>
              </span>
              <span class="off-carbs"><b>${fmtN(round1(r.carbs100))}g</b><span class="mono dim">/100g</span></span>
            </button>`).join('')}</div>`
        : `<p class="off-status">No UK products with carb data matched “${esc(f.query)}”. Try fewer words, or scan the barcode.</p>`;
    }

    const showForm = f.draft || ctx === 'foods';
    host.innerHTML = `
      ${f.added ? `<p class="off-status ok">${icon('check-circle', 'ph-fill')} Added ${esc(f.added)}${ctx === 'foods' ? ' and ticked it' : ' to this meal'}.</p>` : ''}
      ${f.draft ? '' : `
        <form class="off-search" data-ctx="${ctx}" role="search">
          <div class="search-wrap">${icon('globe-simple')}<input type="search" name="q" value="${esc(f.query)}" placeholder="Search UK products" enterkeyhint="search" aria-label="Search Open Food Facts"></div>
          <button type="button" class="round-btn" data-off="scan" data-ctx="${ctx}" aria-label="Scan a barcode">${icon('barcode')}</button>
        </form>`}
      ${body}
      ${showForm ? `${f.draft ? '' : '<div class="or"><span class="mono dim">Or enter it yourself</span></div>'}${foodFormHTML(ctx, f.draft)}` : ''}
      <p class="fine source">Product data from <a href="https://world.openfoodfacts.org" target="_blank" rel="noopener">Open Food Facts</a>, added by shoppers. Check it against the pack.</p>`;
  }

  function foodFormHTML(ctx, d) {
    d = d || {};
    const fl = d.flags || { easy: true };
    const fromPack = d.code != null;
    return `
      <form class="food-form" data-ctx="${ctx}" autocomplete="off">
        ${fromPack ? `<div class="draft-head"><span class="mono">Check the details</span><button type="button" class="text-btn small" data-off="clear-draft" data-ctx="${ctx}">${icon('arrow-left')} Back</button></div>` : ''}
        <label class="field"><span class="mono">Name</span><input name="name" required maxlength="60" value="${esc(d.name || '')}" placeholder="Mum’s banana bread"></label>
        ${d.carbs100 != null ? `
          <div class="per100">${icon('database')}<span><b>${fmtN(round1(d.carbs100))}g</b> carbs per 100g${d.packG ? ` · ${fmtN(d.packG)}g pack` : ''}</span></div>
          <label class="field"><span class="mono">Serving weight (g)</span><input name="servingG" type="number" inputmode="decimal" min="1" max="2000" value="${d.servingG}" data-c100="${d.carbs100}" data-packg="${d.packG || ''}"></label>` : ''}
        <div class="grid2">
          <label class="field"><span class="mono">Serving</span><input name="serving" required maxlength="30" value="${esc(d.serving || '')}" placeholder="1 slice"></label>
          <label class="field"><span class="mono">Carbs / serving (g)</span><input name="carbs" type="number" inputmode="decimal" min="0.1" max="300" step="0.1" value="${d.carbs ?? ''}" required></label>
        </div>
        <div class="grid2">
          <label class="field"><span class="mono">Servings per pack</span><input name="perPack" type="number" inputmode="decimal" min="1" max="200" step="0.1" value="${d.perPack || 1}" required></label>
          <label class="field"><span class="mono">Pack</span><input name="pack" maxlength="30" value="${esc(d.pack || '')}" placeholder="1 loaf"></label>
        </div>
        <div class="grid2">
          <label class="field"><span class="mono">Use as</span><div class="select-wrap"><select name="slot">${SLOT_OPTIONS.map(([v, l]) => `<option value="${v}" ${v === (d.slot || 'breakfast') ? 'selected' : ''}>${l}</option>`).join('')}</select>${icon('caret-down', 'ph-bold')}</div></label>
          <label class="field"><span class="mono">Aisle</span><div class="select-wrap"><select name="aisle">${AISLES.map((a) => `<option ${a === (d.aisle || 'Other') ? 'selected' : ''}>${a}</option>`).join('')}</select>${icon('caret-down', 'ph-bold')}</div></label>
        </div>
        <fieldset class="flags">
          <legend class="mono">This food is</legend>
          ${[['easy', 'Low fibre / fat'], ['V', 'Vegetarian'], ['N', 'Vegan'], ['G', 'Gluten-free'], ['D', 'Dairy-free']].map(([n, l]) => `
            <label class="flag"><input type="checkbox" name="${n}" ${fl[n] ? 'checked' : ''}><span>${l}</span></label>`).join('')}
        </fieldset>
        ${fromPack ? `<p class="fine">Fibre and diet are guessed from the label${d.gut === 'heavy' ? ', and this looks high in fibre' : ''}. Check them.</p>` : ''}
        <button type="submit" class="pill-btn primary wide">${icon('plus', 'ph-bold')} ${ctx === 'sheet' ? 'Add to meal' : fromPack ? 'Save food' : 'Add food'}</button>
      </form>`;
  }

  async function runSearch(ctx, query) {
    const f = finder[ctx];
    const q = String(query || '').trim();
    if (q.length < 2) return;
    stopScan(ctx);
    const token = ++f.token;
    Object.assign(f, { query: q, status: 'loading', message: 'Searching Open Food Facts…', draft: null, added: '' });
    renderFinder(ctx);
    try {
      const results = await Lookup.search(q);
      if (token !== f.token) return;
      Object.assign(f, { status: 'results', results });
    } catch {
      if (token !== f.token) return;
      Object.assign(f, { status: 'error', message: 'Couldn’t reach Open Food Facts. Check your connection and try again.' });
    }
    renderFinder(ctx);
  }

  async function loadProduct(ctx, code, viaBarcode) {
    const f = finder[ctx];
    const token = ++f.token;
    const back = f.results.length ? 'results' : 'idle';
    Object.assign(f, { status: 'loading', message: viaBarcode ? `Looking up ${code}…` : 'Loading product…', added: '' });
    renderFinder(ctx);
    try {
      const p = await Lookup.product(code);
      if (token !== f.token) return;
      if (p) {
        Object.assign(f, { status: back, draft: Lookup.toDraft(p) });
      } else {
        // Not in the database: open a blank form so it can be entered by hand.
        Object.assign(f, { status: back, draft: { code, flags: { easy: true } }, added: '' });
        f.notFound = code;
      }
    } catch {
      if (token !== f.token) return;
      Object.assign(f, { status: 'error', message: 'Couldn’t load that product. Check your connection and try again.' });
    }
    renderFinder(ctx);
    if (f.notFound) {
      const host = finderHost(ctx);
      host?.insertAdjacentHTML('afterbegin', `<p class="off-status">${icon('info', 'ph-fill')} Barcode ${esc(f.notFound)} isn’t on Open Food Facts yet. Enter it from the pack below.</p>`);
      f.notFound = null;
    }
  }

  async function startScanning(ctx) {
    const f = finder[ctx];
    stopScan(ctx);
    Object.assign(f, { scanning: true, scanError: '', draft: null, added: '', status: 'idle' });
    renderFinder(ctx);
    try {
      const scan = await Lookup.startScan(`scan-${ctx}`, (code) => { stopScan(ctx); loadProduct(ctx, code, true); });
      if (!f.scanning) { scan.stop(); return; } // cancelled while the camera was starting
      f.scan = scan;
    } catch (err) {
      if (!f.scanning) return;
      const blocked = err && (err.name === 'NotAllowedError' || /permission/i.test(String(err.message || err)));
      f.scanError = blocked
        ? 'Camera access is blocked. Allow it in your browser settings, or type the barcode below.'
        : 'Couldn’t start the camera. Type the barcode number below instead.';
      renderFinder(ctx);
    }
  }

  function stopScan(ctx) {
    const f = finder[ctx];
    if (!f.scanning) return;
    f.scanning = false;
    if (f.scan) { f.scan.stop(); f.scan = null; }
  }

  function saveFoodForm(form) {
    const ctx = form.dataset.ctx;
    const f = finder[ctx];
    const fd = new FormData(form);
    const diet = ['V', 'N', 'G', 'D'].filter((k) => fd.get(k)).join('');
    const food = {
      id: makeId(),
      custom: true,
      name: String(fd.get('name')).trim(),
      serving: String(fd.get('serving')).trim(),
      carbs: round1(Number(fd.get('carbs'))),
      perPack: Number(fd.get('perPack')) || 1,
      pack: String(fd.get('pack') || '').trim() || '1 pack',
      aisle: String(fd.get('aisle')),
      slots: [String(fd.get('slot'))],
      gut: fd.get('easy') ? 'easy' : f.draft && f.draft.gut === 'heavy' ? 'heavy' : 'ok',
      diet: diet.includes('N') && !diet.includes('V') ? `V${diet}` : diet,
      max: 2,
      ...(f.draft && f.draft.code ? { barcode: f.draft.code } : {}),
    };
    if (!food.name || !(food.carbs > 0)) return;
    state.customFoods.push(food);
    if (!state.preferred.includes(food.id)) state.preferred.push(food.id);
    finder[ctx] = { ...blankFinder(), added: food.name };
    if (ctx === 'sheet' && editing) {
      editing.items.push({ id: food.id, n: 1 });
      save();
      renderSheet();
      return;
    }
    save();
    rerender();
  }

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-off]');
    if (!t) return;
    const ctx = t.dataset.ctx || 'foods';
    const a = t.dataset.off;
    if (a === 'scan') startScanning(ctx);
    else if (a === 'stop-scan') { stopScan(ctx); renderFinder(ctx); }
    else if (a === 'pick') loadProduct(ctx, t.dataset.code, false);
    else if (a === 'clear-draft') { finder[ctx].draft = null; renderFinder(ctx); }
    else if (a === 'search-online') {
      runSearch(ctx, t.dataset.q);
      finderHost(ctx)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  document.addEventListener('submit', (e) => {
    const form = e.target;
    if (form.classList.contains('off-search')) {
      e.preventDefault();
      runSearch(form.dataset.ctx, new FormData(form).get('q'));
    } else if (form.classList.contains('barcode-form')) {
      e.preventDefault();
      const code = String(new FormData(form).get('code') || '').replace(/\D/g, '');
      if (code.length < 8) return;
      stopScan(form.dataset.ctx);
      loadProduct(form.dataset.ctx, code, true);
    } else if (form.classList.contains('food-form')) {
      e.preventDefault();
      saveFoodForm(form);
    }
  });

  // Changing the serving weight recalculates carbs and servings per pack.
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.name !== 'servingG' || !t.form) return;
    const g = Number(t.value);
    if (!(g > 0)) return;
    const form = t.form;
    form.elements.carbs.value = round1(Number(t.dataset.c100) * g / 100);
    form.elements.serving.value = `${fmtN(g)}g`;
    const packG = Number(t.dataset.packg);
    if (packG > 0) form.elements.perPack.value = Math.max(1, round1(packG / g));
    const f = finder[form.dataset.ctx];
    if (f.draft) Object.assign(f.draft, { servingG: g, carbs: Number(form.elements.carbs.value), serving: form.elements.serving.value, perPack: Number(form.elements.perPack.value) });
  });

  // ---------- tabs ----------

  const RENDERERS = { plan: renderPlan, training: renderTraining, foods: renderFoods, shop: renderShop, setup: renderSetup };

  function showTab(tab) {
    stopScan('foods');
    state.tab = tab;
    save();
    document.querySelectorAll('.tab-panel').forEach((s) => { s.hidden = s.id !== `tab-${tab}`; });
    document.querySelectorAll('.tab-btn').forEach((b) => {
      const on = b.dataset.tab === tab;
      b.classList.toggle('active', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    RENDERERS[tab]();
    renderHeader();
  }

  const rerender = () => { RENDERERS[state.tab](); renderHeader(); };

  // ---------- events ----------

  function setField(field, value) {
    if (field.startsWith('beet.')) {
      state.beet[field.slice(5)] = value;
    } else {
      state.profile[field] = value;
    }
  }

  document.querySelector('.tab-bar').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (btn) {
      showTab(btn.dataset.tab);
      window.scrollTo(0, 0);
    }
  });

  const app = document.querySelector('.app');

  app.addEventListener('click', (e) => {
    const t = e.target.closest('[data-action]');
    if (!t) return;
    const a = t.dataset.action;
    const p = state.profile;

    if (a === 'goto') {
      if (t.dataset.tab === 'plan') state.onboarded = true;
      showTab(t.dataset.tab);
      window.scrollTo(0, 0);
      return;
    }
    if (a === 'plan-day') {
      state.planDay = t.dataset.date;
      save();
      rerender();
      if (t.dataset.scroll) document.getElementById('day-view')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (a === 'set') {
      let v = t.dataset.value;
      if (/^\d+$/.test(v)) v = Number(v);
      setField(t.dataset.field, v);
      if (t.dataset.field === 'distance' && p.auto) applyRecommendation();
    } else if (a === 'step') {
      const delta = Number(t.dataset.delta);
      if (t.dataset.field === 'loadDays') {
        p.loadDays = Math.max(0, Math.min(4, p.loadDays + delta));
        p.auto = false;
      } else {
        state.beet.days = Math.max(1, Math.min(7, state.beet.days + delta));
      }
    } else if (a === 'use-rec') {
      applyRecommendation();
    } else if (a === 'edit-meal') {
      openEditor(t.dataset.date, t.dataset.key);
      return;
    } else if (a === 'setup-step') {
      state.onboardStep = Number(t.dataset.step);
      save();
      rerender();
      window.scrollTo(0, 0);
      return;
    } else if (a === 'clear-prefs') {
      if (!confirm('Untick all foods?')) return;
      state.preferred = [];
    } else if (a === 'diet') {
      state.diet[t.dataset.key] = !state.diet[t.dataset.key];
    } else if (a === 'delete-food') {
      const f = foodById(t.dataset.id);
      if (!f || !confirm(`Delete "${f.name}"?`)) return;
      state.customFoods = state.customFoods.filter((x) => x.id !== f.id);
      state.preferred = state.preferred.filter((id) => id !== f.id);
    } else if (a === 'reset-training') {
      state.training = {};
    } else if (a === 'clear-shop') {
      state.shop = {};
    } else if (a === 'share-list') {
      shareList();
      return;
    } else {
      return; // checkbox actions handled on change
    }
    save();
    rerender();
  });

  app.addEventListener('change', (e) => {
    const t = e.target;
    const a = t.dataset.action;
    if (a === 'toggle-log') {
      const day = state.log[t.dataset.date] || (state.log[t.dataset.date] = {});
      day[t.dataset.key] = t.checked;
    } else if (a === 'toggle-pref') {
      const id = t.dataset.id;
      state.preferred = t.checked ? [...new Set([...state.preferred, id])] : state.preferred.filter((x) => x !== id);
      save();
      renderFoodList(t.closest('.tab-panel')); // refresh "ticked" counts
      return;
    } else if (a === 'toggle-shop') {
      state.shop[t.dataset.id] = t.checked;
    } else if (a === 'beet-toggle') {
      state.beet.on = t.checked;
    } else if (t.dataset.trainType) {
      const tr = { ...trainingFor(t.dataset.trainType) };
      tr.type = t.value;
      if (tr.type === 'rest') tr.min = 0;
      else if (!tr.min) tr.min = 30;
      state.training[t.dataset.trainType] = tr;
    } else if (t.dataset.trainMin) {
      const tr = { ...trainingFor(t.dataset.trainMin) };
      tr.min = Math.max(0, Math.min(300, Number(t.value) || 0));
      state.training[t.dataset.trainMin] = tr;
    } else if (t.id === 'race-date' && t.value) {
      state.profile.raceDate = t.value;
    } else if (t.id === 'race-time' && t.value) {
      state.profile.raceTime = t.value;
    } else {
      return;
    }
    save();
    rerender();
  });

  app.addEventListener('input', (e) => {
    const t = e.target;
    const p = state.profile;
    if (t.id === 'weight') {
      const v = Number(t.value);
      if (v > 0) p.weightKg = p.units === 'imperial' ? v * KG_PER_LB : v;
    } else if (t.id === 'gkg') {
      p.gkg = Number(t.value);
      p.auto = false;
    } else if (t.id === 'bf-gkg') {
      p.breakfastGkg = Number(t.value);
    } else if (t.id === 'finish-h' || t.id === 'finish-m') {
      const h = Number(document.getElementById('finish-h').value) || 0;
      const m = Number(document.getElementById('finish-m').value) || 0;
      p.finishMin = h || m ? h * 60 + m : null;
      if (p.auto) applyRecommendation();
    } else if (t.classList.contains('food-search')) {
      foodQuery = t.value;
      renderFoodList(t.closest('.tab-panel'));
      return;
    } else {
      return;
    }
    save();
    updateSetupLive();
  });

  async function shareList() {
    const text = shopText(shoppingList(buildPlan()));
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Carb load shopping list', text });
        return;
      }
      await navigator.clipboard.writeText(text);
      alert('Shopping list copied to clipboard.');
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      prompt('Copy your shopping list:', text);
    }
  }

  // ---------- boot ----------

  showTab(state.onboarded ? state.tab : 'setup');

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
