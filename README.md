# Carb Load

A mobile-first web app for runners that builds a race-week carb-loading plan.

Enter your weight, race distance and date. It works out a daily carb target (g per kg of body weight, suggested from race distance), splits it into meals using foods you like, adjusts for your taper runs, and builds a shopping list.

- **First run:** three steps: race and load, your foods (tick what you've trained with), and your race-morning breakfast, which you build yourself.
- **Plan:** each load day, meal by meal, with tick-off tracking and a progress bar. Tap **Edit** on any meal to set exact foods and portions, for that day or every load day. Meals you haven't set are suggested from your ticked foods and absorb whatever carbs are left. Includes a race-morning breakfast and timeline.
- **Training:** your taper runs. Carbs for runs on load days are added to that day, and hard or long sessions on load days are flagged.
- **Foods:** 43 built-in UK foods with typical carbs per serving, gut-friendliness flags and diet filters (vegetarian, vegan, gluten-free, dairy-free). You can also add your own.
- **Shop:** quantities rounded up to typical pack sizes and grouped by aisle. Shareable as text.
- **Beetroot/nitrate (optional):** daily loading or race-day-only dosing, with shot carbs counted toward your targets.

Everything is stored in `localStorage` on the device. It installs to the home screen as a PWA and works offline.

## Run it

No build step. It's plain HTML/CSS/JS. Serve the folder (the service worker needs http):

```
python3 -m http.server 8935
```

then open http://localhost:8935. To use it on your phone, deploy the folder to any static host (GitHub Pages, Netlify, etc.) and choose "Add to Home Screen".

## Files

- `index.html`: shell and tab bar
- `style.css`: styles (light/dark aware)
- `app.js`: plan logic and rendering
- `foods.js`: built-in food database. Edit carbs and pack sizes here.
- `sw.js`, `manifest.webmanifest`, `icon*`: PWA bits

General guidance, not medical advice.
