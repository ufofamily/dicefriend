import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const code = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert(code && code.includes('ATMOSLAM'), 'Early error diagnostics are missing');
function simulate({hostname, ready, raw}) {
  const inserted = [];
  const window = {__ATMOSLAM_READY__: ready};
  const document = {
    querySelector: () => raw ? {} : null,
    getElementById: () => inserted.find(x => x.id === 'atmoslam-boot-error'),
    createElement: () => ({style: {}, setAttribute() {}}),
    body: {appendChild: item => inserted.push(item)},
  };
  runInNewContext(code, {window, document, location:{hostname}, setTimeout: fn => fn(), addEventListener() {}});
  return inserted;
}
assert.equal(simulate({hostname:'demo.github.io', ready:true, raw:false}).length, 0, 'Loaded site must not show a warning');
const raw = simulate({hostname:'demo.github.io', ready:false, raw:true});
assert.equal(raw.length, 1);
assert.match(raw[0].textContent, /GitHub Actions/);
assert.match(raw[0].textContent, /исходники/);
const compiled = simulate({hostname:'demo.github.io', ready:false, raw:false});
assert.equal(compiled.length, 1);
assert.match(compiled[0].textContent, /модули/);
console.log('PASS boot diagnostics for working, unbuilt, and failed sites');
