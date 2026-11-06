# Проверка версии с внутренней генеративной сетью

- `tests/peer-excitation.mjs`: отправка/приём, самоблокировка, лимиты, выбор источников, DSP-реакция — PASS.
- `tests/peer-worklet.mjs`: реальные автономные атаки, безопасные пики, обработка внешнего импульса без немедленной ретрансляции — PASS.
- `tests/peer-offline.mjs`: офлайн-шина (ограничение частоты, адресная доставка) — PASS.
- `tests/dsp.mjs`: оригинальные 24 DSP-движка — PASS.
- `tests/slambient.mjs`, `tests/bass-controls.mjs` — PASS.
- `tests/audio-stability.mjs`, `tests/worklet-fades.mjs` — PASS.
- `tests/category-dice.mjs`, `tests/preset-controls.mjs`, `tests/forensics-presets.mjs` — PASS.
- `tests/master-scenes.mjs` — PASS (проверка фабричных сцен; новая PEER-миграция проверена отдельно).
- `tests/tabpages-default.mjs`, `tests/pages-boot.mjs` — PASS.
- `tests/studio.mjs`, `tests/midi-timing.mjs` — PASS (регрессия устаревших модулей, не показываемых пользователю).
- `node --check` модифицированных JS — PASS.
- `npm ci` в среде не завершён; `vite build` не подтверждён.
