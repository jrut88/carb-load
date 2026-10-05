// Built-in UK food list. Carb values are typical per-serving figures from
// common UK supermarket labels — always check your own packs.
//
// slots: where the planner may use a food
//   breakfast | main | snack | drink | topping (jam on toast) | side (sauce with pasta)
// gut:   easy  = low fibre / low fat, ideal for loading
//        ok    = moderate fibre, fine in small amounts
//        heavy = high fibre, best avoided in the last 48h
// diet:  V vegetarian, N vegan, G gluten-free, D dairy-free
// max:   most servings the planner will put in one meal
// step:  serving increment (0.5 = half portions allowed)
// fav:   selected by default for new users

window.AISLE_ORDER = [
  'Bakery',
  'Cereal & spreads',
  'Rice, pasta & grains',
  'Fruit & veg',
  'Tins & jars',
  'Dairy & chilled',
  'Snacks & sweets',
  'Drinks',
  'Sports nutrition',
  'Other',
];

window.CARB_FOODS = [
  // Bakery
  { id: 'bagel', name: 'White bagel', serving: '1 bagel', carbs: 45, perPack: 5, pack: 'pack of 5', aisle: 'Bakery', slots: ['breakfast', 'snack'], gut: 'easy', diet: 'VND', max: 2, fav: true },
  { id: 'toast', name: 'White bread', serving: '2 slices', carbs: 30, perPack: 11, pack: '800g loaf', aisle: 'Bakery', slots: ['breakfast', 'snack'], gut: 'easy', diet: 'VND', max: 2, fav: true },
  { id: 'crumpets', name: 'Crumpets', serving: '2 crumpets', carbs: 38, perPack: 3, pack: 'pack of 6', aisle: 'Bakery', slots: ['breakfast', 'snack'], gut: 'easy', diet: 'VND', max: 2, fav: true },
  { id: 'baguette', name: 'White baguette', serving: '½ baguette', carbs: 65, perPack: 2, pack: '1 baguette', aisle: 'Bakery', slots: ['side', 'snack'], gut: 'easy', diet: 'VND', max: 1 },
  { id: 'wraps', name: 'White tortilla wrap', serving: '1 large wrap', carbs: 33, perPack: 8, pack: 'pack of 8', aisle: 'Bakery', slots: ['main', 'snack'], gut: 'easy', diet: 'VND', max: 2, step: 1 },
  { id: 'pancakes', name: 'Scotch pancakes', serving: '2 pancakes', carbs: 28, perPack: 3, pack: 'pack of 6', aisle: 'Bakery', slots: ['breakfast', 'snack'], gut: 'easy', diet: 'V', max: 2 },
  { id: 'maltloaf', name: 'Malt loaf', serving: '2 slices', carbs: 32, perPack: 5, pack: '1 loaf', aisle: 'Bakery', slots: ['snack', 'breakfast'], gut: 'ok', diet: 'VND', max: 2 },
  { id: 'gfbread', name: 'Gluten-free white bread', serving: '2 slices', carbs: 30, perPack: 6, pack: '400g loaf', aisle: 'Bakery', slots: ['breakfast', 'snack'], gut: 'easy', diet: 'VGD', max: 2 },
  { id: 'wholemeal', name: 'Wholemeal bread', serving: '2 slices', carbs: 28, perPack: 11, pack: '800g loaf', aisle: 'Bakery', slots: ['breakfast', 'snack'], gut: 'heavy', diet: 'VND', max: 2 },

  // Cereal & spreads
  { id: 'cornflakes', name: 'Cornflakes', serving: '40g bowl', carbs: 34, perPack: 12, pack: '500g box', aisle: 'Cereal & spreads', slots: ['breakfast'], gut: 'easy', diet: 'VND', max: 2, fav: true },
  { id: 'ricecereal', name: 'Rice Krispies / puffed rice', serving: '40g bowl', carbs: 34, perPack: 12, pack: '500g box', aisle: 'Cereal & spreads', slots: ['breakfast'], gut: 'easy', diet: 'VND', max: 2 },
  { id: 'oats', name: 'Porridge oats', serving: '40g', carbs: 24, perPack: 25, pack: '1kg bag', aisle: 'Cereal & spreads', slots: ['breakfast'], gut: 'ok', diet: 'VND', max: 2 },
  { id: 'jam', name: 'Jam', serving: '1 tbsp', carbs: 10, perPack: 22, pack: '340g jar', aisle: 'Cereal & spreads', slots: ['topping'], gut: 'easy', diet: 'VNGD', max: 2, step: 1, fav: true },
  { id: 'honey', name: 'Honey', serving: '1 tbsp', carbs: 16, perPack: 17, pack: '340g jar', aisle: 'Cereal & spreads', slots: ['topping'], gut: 'easy', diet: 'VGD', max: 2, step: 1, fav: true },

  // Rice, pasta & grains
  { id: 'rice', name: 'White rice', serving: '75g dry', carbs: 60, perPack: 13, pack: '1kg bag', aisle: 'Rice, pasta & grains', slots: ['main'], gut: 'easy', diet: 'VNGD', max: 2, fav: true },
  { id: 'ricepouch', name: 'Microwave rice pouch', serving: '1 pouch (250g)', carbs: 75, perPack: 1, pack: '1 pouch', aisle: 'Rice, pasta & grains', slots: ['main'], gut: 'easy', diet: 'VNGD', max: 1, step: 1 },
  { id: 'pasta', name: 'White pasta', serving: '100g dry', carbs: 72, perPack: 5, pack: '500g bag', aisle: 'Rice, pasta & grains', slots: ['main'], gut: 'easy', diet: 'VND', max: 1.5, fav: true },
  { id: 'gfpasta', name: 'Gluten-free pasta', serving: '100g dry', carbs: 75, perPack: 5, pack: '500g bag', aisle: 'Rice, pasta & grains', slots: ['main'], gut: 'easy', diet: 'VNGD', max: 1.5 },
  { id: 'gnocchi', name: 'Gnocchi', serving: '½ pack (250g)', carbs: 80, perPack: 2, pack: '500g pack', aisle: 'Rice, pasta & grains', slots: ['main'], gut: 'easy', diet: 'VD', max: 1, fav: true },
  { id: 'noodles', name: 'Rice noodles', serving: '75g dry', carbs: 60, perPack: 4, pack: '300g pack', aisle: 'Rice, pasta & grains', slots: ['main'], gut: 'easy', diet: 'VNGD', max: 2 },
  { id: 'couscous', name: 'Couscous', serving: '75g dry', carbs: 54, perPack: 6, pack: '500g bag', aisle: 'Rice, pasta & grains', slots: ['main'], gut: 'easy', diet: 'VND', max: 2 },
  { id: 'brownrice', name: 'Brown rice', serving: '75g dry', carbs: 57, perPack: 13, pack: '1kg bag', aisle: 'Rice, pasta & grains', slots: ['main'], gut: 'heavy', diet: 'VNGD', max: 2 },

  // Fruit & veg
  { id: 'potatoes', name: 'Potatoes (peeled)', serving: '300g', carbs: 51, perPack: 8, pack: '2.5kg bag', aisle: 'Fruit & veg', slots: ['main'], gut: 'easy', diet: 'VNGD', max: 2, fav: true },
  { id: 'sweetpotato', name: 'Sweet potato', serving: '300g', carbs: 60, perPack: 3, pack: '1kg bag', aisle: 'Fruit & veg', slots: ['main'], gut: 'ok', diet: 'VNGD', max: 1.5 },
  { id: 'banana', name: 'Banana', serving: '1 medium', carbs: 23, perPack: 5, pack: 'bunch of 5', aisle: 'Fruit & veg', slots: ['snack', 'breakfast'], gut: 'easy', diet: 'VNGD', max: 2, step: 1, fav: true },
  { id: 'dates', name: 'Medjool dates', serving: '2 dates', carbs: 36, perPack: 5, pack: '200g pack', aisle: 'Fruit & veg', slots: ['snack'], gut: 'ok', diet: 'VNGD', max: 2 },
  { id: 'raisins', name: 'Raisins', serving: '30g handful', carbs: 21, perPack: 16, pack: '500g bag', aisle: 'Fruit & veg', slots: ['snack', 'topping'], gut: 'ok', diet: 'VNGD', max: 2 },

  // Tins & jars
  { id: 'pastasauce', name: 'Tomato pasta sauce', serving: '½ jar', carbs: 18, perPack: 2, pack: '500g jar', aisle: 'Tins & jars', slots: ['side'], gut: 'ok', diet: 'VNGD', max: 1, step: 1, fav: true },
  { id: 'ricepudding', name: 'Rice pudding', serving: '½ can (200g)', carbs: 32, perPack: 2, pack: '400g can', aisle: 'Tins & jars', slots: ['snack', 'breakfast'], gut: 'easy', diet: 'VG', max: 2, fav: true },
  { id: 'beans', name: 'Baked beans', serving: '½ can', carbs: 26, perPack: 2, pack: '415g can', aisle: 'Tins & jars', slots: ['side'], gut: 'heavy', diet: 'VNGD', max: 1 },

  // Dairy & chilled
  { id: 'yoghurt', name: 'Low-fat fruit yoghurt', serving: '1 pot', carbs: 18, perPack: 4, pack: 'pack of 4', aisle: 'Dairy & chilled', slots: ['snack', 'breakfast'], gut: 'easy', diet: 'VG', max: 2, step: 1 },
  { id: 'milkshake', name: 'Flavoured milk', serving: '500ml bottle', carbs: 50, perPack: 1, pack: '500ml bottle', aisle: 'Dairy & chilled', slots: ['drink'], gut: 'easy', diet: 'VG', max: 1, step: 1 },

  // Snacks & sweets
  { id: 'ricecakes', name: 'Rice cakes', serving: '3 cakes', carbs: 22, perPack: 4, pack: '100g pack', aisle: 'Snacks & sweets', slots: ['snack'], gut: 'easy', diet: 'VNGD', max: 2, fav: true },
  { id: 'pretzels', name: 'Pretzels', serving: '30g', carbs: 23, perPack: 6, pack: '175g bag', aisle: 'Snacks & sweets', slots: ['snack'], gut: 'easy', diet: 'VND', max: 2, fav: true },
  { id: 'jellysweets', name: 'Jelly sweets', serving: '50g', carbs: 40, perPack: 3, pack: '140g bag', aisle: 'Snacks & sweets', slots: ['snack'], gut: 'easy', diet: 'GD', max: 2, fav: true },
  { id: 'vegansweets', name: 'Vegan jelly sweets', serving: '50g', carbs: 40, perPack: 3, pack: '140g bag', aisle: 'Snacks & sweets', slots: ['snack'], gut: 'easy', diet: 'VNGD', max: 2 },
  { id: 'cerealbar', name: 'Cereal bar', serving: '1 bar', carbs: 25, perPack: 6, pack: 'pack of 6', aisle: 'Snacks & sweets', slots: ['snack'], gut: 'easy', diet: 'V', max: 2, step: 1 },
  { id: 'figrolls', name: 'Fig rolls', serving: '2 biscuits', carbs: 26, perPack: 6, pack: '200g pack', aisle: 'Snacks & sweets', slots: ['snack'], gut: 'ok', diet: 'VND', max: 2 },

  // Drinks
  { id: 'oj', name: 'Orange juice (smooth)', serving: '250ml glass', carbs: 22, perPack: 4, pack: '1L carton', aisle: 'Drinks', slots: ['drink'], gut: 'easy', diet: 'VNGD', max: 2, step: 1, fav: true },
  { id: 'applejuice', name: 'Apple juice', serving: '250ml glass', carbs: 25, perPack: 4, pack: '1L carton', aisle: 'Drinks', slots: ['drink'], gut: 'easy', diet: 'VNGD', max: 2, step: 1 },
  { id: 'cola', name: 'Cola (full sugar)', serving: '330ml can', carbs: 35, perPack: 6, pack: '6 cans', aisle: 'Drinks', slots: ['drink'], gut: 'easy', diet: 'VNGD', max: 1, step: 1 },

  // Sports nutrition
  { id: 'sportsdrink', name: 'Sports drink', serving: '500ml bottle', carbs: 32, perPack: 1, pack: '500ml bottle', aisle: 'Sports nutrition', slots: ['drink'], gut: 'easy', diet: 'VNGD', max: 1, step: 1, fav: true },
  { id: 'carbmix', name: 'Carb drink powder', serving: '1 scoop in 500ml', carbs: 47, perPack: 20, pack: '1kg tub', aisle: 'Sports nutrition', slots: ['drink'], gut: 'easy', diet: 'VNGD', max: 1, step: 1 },
];

// Concentrated beetroot shot, ~400mg (6.4 mmol) nitrate per 70ml.
window.BEET_SHOT = {
  id: 'beetshot', name: 'Beetroot shot (concentrated)', serving: '70ml shot', carbs: 15,
  perPack: 15, pack: 'box of 15', aisle: 'Sports nutrition', slots: [], gut: 'easy', diet: 'VNGD', step: 1,
};
