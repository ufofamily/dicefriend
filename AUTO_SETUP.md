# Automatic setup (Windows)

Double-click **`start.cmd`** or **`start-fixed.cmd`** in the extracted project folder.

The launcher now:

1. Finds installed Node.js (version 20 or newer) and npm, if available.
2. Otherwise downloads official **Node.js 24 LTS** Windows ZIP into `.tools/node/`, **without administrator access or changing the system PATH**. The ZIP is verified using SHA-256 checksums from nodejs.org.
3. Installs dependencies from `package-lock.json` with `npm ci --include=dev --no-audit --no-fund` (or `npm install` when no lockfile exists).
4. Saves a dependency stamp; on later runs it skips npm if `package.json`, `package-lock.json`, and Node major version have not changed and Vite is present.
5. Runs Vite at **http://127.0.0.1:5176/**.

**Internet is required for the first download** of Node.js and npm packages. A 64-bit Windows 10/11 system and built-in Windows PowerShell 5.1 are required. Local Node lives under `.tools/node/` and does not affect other software. Run `start.cmd` normally; **do not use Run as administrator**.

If your firewall blocks `nodejs.org` or `registry.npmjs.org`, download/install Node.js separately from https://nodejs.org/ and try again. Subsequent launches generally work without Internet once dependencies are cached. To force a reinstall of npm dependencies, delete `.tools/dependencies.stamp` and launch again. To force a new portable Node download, delete `.tools/node/` (only if no compatible system Node exists).

`start-fixed.cmd` remains a shortcut that delegates to `start.cmd`; both now use automatic setup. Your original presets, scenes and source code are unchanged.
