import assert from 'node:assert/strict';
import {readFile, readdir, stat} from 'node:fs/promises';
import path from 'node:path';

const base = process.env.PAGES_BASE_PATH || './';
const dist = path.resolve('dist');
const html = await readFile(path.join(dist, 'index.html'), 'utf8');
const assets = await readdir(path.join(dist, 'assets'));

assert(html.includes('<html'), 'compiled index.html is missing');
assert(!html.includes('"/src/main.js"'), 'unbundled entrypoint remains in HTML');
assert(!html.includes('"/src/style.css"'), 'unbundled stylesheet remains in HTML');
assert(assets.some(name => /^index-.*\.js$/.test(name)), 'main JS bundle is missing');
assert(assets.some(name => name.endsWith('.css')), 'CSS bundle is missing');

const attributeUrls = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1]);
const resources = attributeUrls.filter(url => url.includes('/assets/') || url.startsWith('assets/'));
assert(resources.length >= 2, 'HTML must include JS and CSS bundles');
for (const url of resources) {
  assert(url.startsWith(base), `asset URL ${url} is not beneath base ${base}`);
  const relative = url.slice(base.length);
  const location = path.join(dist, relative);
  assert((await stat(location)).isFile(), `missing asset ${location}`);
}

assert((await stat(path.join(dist, '.nojekyll'))).isFile(), '.nojekyll must be deployed');
console.log(`PASS GitHub Pages build: ${base}; ${assets.length} bundled assets; all entry files exist`);
