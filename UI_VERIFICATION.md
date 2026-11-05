# UI/parameter regression report

## Verified locally

- Node.js syntax check of all project `.js` files.
- `tests/preset-controls.mjs`: PASS; 233 presets, 3 control pages, 18 mappings each, normalized controls round-trip, 12 unique DSP targets, six real Generator/Filter controls, valid MIDI and generative settings, 233 preset replacements preserve tab identity and MIDI config without mutating original state.
- `tests/category-dice.mjs`: PASS; old grouped selection remains bounded, different preset when candidates exist.
- `tests/forensics-presets.mjs`: PASS; 207 archive-derived + 26 original sound presets, 28 sample effect presets, six master scenes.
- `tests/master-scenes.mjs`: PASS; six scenes in AUDIO and MIDI.
- `tests/bass-controls.mjs`: PASS; 12 DSP controls tested on eight rhythm/bass engines.
- `tests/ambient-controls.mjs`: PASS; 12 DSP controls tested on six ambient engines.

## Not fully verified

- Production Vite build and actual browser integration. `npm ci` could not download packages (`EAI_AGAIN` from `registry.npmjs.org`), and attempts to open a test page in Chromium were blocked by environment policy (`ERR_BLOCKED_BY_ADMINISTRATOR`). Unit tests validate state updates, but the full rendered interaction on Windows remains to be checked.
- Actual audio continuity while rolling an already-playing DSP in the user's browser. The replacement pipeline prepares new engine before releasing old one; real playback remains untested here.
- Original Windows automatic setup script is preserved verbatim; it has not been executed on Windows in this environment.
