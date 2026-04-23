# Feed Eggs

Small browser rebuild of the "Feed Eggs" office-computer game vibe, based on the references in [`images/`](/Users/brandon/Developer/eggman/images).

## Run it

Open [`index.html`](/Users/brandon/Developer/eggman/index.html) directly in a browser, or serve the folder locally:

```sh
python3 -m http.server 4173
```

Then open `http://127.0.0.1:4173`.

## Included

- Drag an egg from the basket into the mouth.
- Deliberately broken egg math.
- Weird text-input purchase prompt.
- Abrupt reward sequence with front/back nude-egg states.
- Synthesized retro beeps.
- Optional voice-over hooks.

## Optional voice-over files

Drop any of these files into `/Users/brandon/Developer/eggman/audio/` if you want your own recorded lines:

- `what-six.mp3`
- `that-one-egg-was-40-eggs.mp3`
- `never-gotten-here-before.mp3`
- `bush-what-the-hell.mp3`
- `nude-egg-i-won.mp3`

If a file is missing, the game falls back to simple synth tones.
