# Feed Eggs

Small browser rebuild of the "Feed Eggs" office-computer game vibe, based on references in `images/`.

## Project layout

- `index.html` - game shell and UI structure
- `styles.css` - visual styling and animations
- `game.js` - game state, interactions, and audio logic
- `audio/` - optional voice-over files (not required)
- `images/` - reference assets (optional)
- `vercel.json` - static-site deploy settings for Vercel
- `docs/qa-checklist.md` - manual smoke-test checklist
- `docs/release-checklist.md` - pre/post merge release checks

## Run locally

Open `index.html` directly in a browser, or run a local server.

### Option 1: Python

```sh
python3 -m http.server 4173
```

### Option 2: npm script

```sh
npm run dev
```

Then open `http://127.0.0.1:4173`.

## Controls

- Click the basket to spawn eggs.
- Drag an egg to the mouth to feed it.
- Use `RESET` to restart the run.
- Use `SOUND ON/OFF` to mute or unmute effects.

## Known behavior

Egg math and counts are intentionally scripted and absurd. The mismatch is part of the game vibe, not a scoring bug.

## Included

- Drag an egg from the basket into the mouth.
- Deliberately broken egg math.
- Weird text-input purchase prompt.
- Abrupt reward sequence with front/back nude-egg states.
- Synthesized retro beeps.
- Optional voice-over hooks.

## Optional voice-over files

Drop any of these files into `audio/` to replace synth fallback tones:

- `what-six.mp3`
- `that-one-egg-was-40-eggs.mp3`
- `never-gotten-here-before.mp3`
- `bush-what-the-hell.mp3`
- `nude-egg-i-won.mp3`

If a file is missing, the game automatically falls back to generated synth tones.

## Troubleshooting

- Audio may not play until the first user interaction (click/drag), due to browser autoplay rules.
- If `audio/*.mp3` files are missing, the game falls back to synthesized tones.

## Deploy on Vercel

This repo deploys as a static site.

- Import the repo into Vercel
- Keep root directory as repository root
- Set Framework Preset to `Other`
- No build command needed

`vercel.json` sets the framework value to `null`, matching Vercel's `Other` preset.
