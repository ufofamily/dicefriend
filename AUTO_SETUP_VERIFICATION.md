# Automatic setup verification

## Implemented

- `start.cmd` launches bundled `tools/bootstrap.ps1` using Windows PowerShell.
- Compatible system Node.js >=20 is reused when available; otherwise official portable Node.js 24 LTS is downloaded locally to `.tools/node`.
- The Node.js ZIP's SHA-256 is validated against the official `SHASUMS256.txt` obtained over HTTPS from nodejs.org. A mismatch stops installation.
- `npm ci --include=dev` installs all locked dependencies on initial launch; `npm install --include=dev` is used only when there is no package-lock.json.
- A stamp based on Node major and package.json/package-lock.json hashes avoids reinstallation during routine launches.
- `npm run dev` starts the existing localhost Vite server. The default port remains 5176.
- The original audio engines, presets, scenes, and frontend files were not modified.

## Verified in this workspace

- Original ZIP compared byte-for-byte against unpacked files: only existing `start.cmd` and `README.md` changed.
- `node --check` passed for `src/studio.js` and `src/main.js`.
- Tests passed: `category-dice.mjs`, `forensics-presets.mjs`, `master-scenes.mjs`, `midi-timing.mjs`, `style-profiles.mjs`, `genres.mjs`.
- Windows-specific PowerShell/Batch bootstrapping **could not be executed** here because this environment has no Windows PowerShell or Windows command processor.
- Full npm installation was **not attempted** here: the environment cannot be assumed to have Internet connectivity. Actual download/setup must run once on the user's Windows PC.

## Requirements

Windows 10/11 64-bit, Windows PowerShell 5.1, Internet access to `nodejs.org` and `registry.npmjs.org` on first launch.
