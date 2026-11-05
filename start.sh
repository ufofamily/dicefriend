#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo 'Install Node.js 20 or newer: https://nodejs.org/' >&2
  exit 1
fi
if [ ! -f node_modules/vite/bin/vite.js ]; then
  npm install
fi
echo 'Generative Studio at http://127.0.0.1:5176/'
npm run dev
