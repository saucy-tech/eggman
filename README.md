# Feed Eggs

Browser arcade game where you fling eggs from a slingshot into a moving egg-mouth target. Vanilla JS, no build step, no framework.

## Project layout

- `index.html` — game shell, HUD, launcher and target zones
- `game.js` — physics, aim/launch loop, scoring, streaks, levels
- `styles.css` — visuals and animations
- `vercel.json` — static-site deploy config (`framework: null`)
- `audio/` — empty by default; reserved for optional sound assets
- `images/` — reference art
- `docs/qa-checklist.md` — manual smoke-test checklist
- `docs/release-checklist.md` — pre/post-merge release checks

## Run locally

```sh
npm run dev
```

That runs `python3 -m http.server 4173`. Open `http://127.0.0.1:4173`.

You can also just open `index.html` directly in a browser.

## How to play

- Press and drag from the slingshot on the left side of the playfield, then release to fling an egg.
- A dotted trajectory previews your shot while you aim.
- Hit the egg-mouth target on the right to score. The target moves more aggressively as your level rises.
- Consecutive hits build a streak (2.5x cap). Misses reset the streak. Streaks decay after ~4.5s of inactivity.
- Streak medals trigger at 3, 5, 8, and 12; majors flash the playfield and burst particles.
- Level increases every 4 hits.
- `RESET` restarts the run. `SOUND ON/OFF` toggles audio.
- Best score persists in `localStorage` under `feed-eggs-best-score`.

## Deploy

Static site on Vercel. Push to `main` and Vercel auto-deploys. Framework preset is `Other`; no build command.

## Notes

- Audio is synthesized via WebAudio (`triangle` oscillator beeps). No mp3 assets are required.
- Audio won't start until the first user interaction due to browser autoplay rules.
- Tuning constants live at the top of `game.js` in `PHYSICS` and `STREAK_MEDALS`.
