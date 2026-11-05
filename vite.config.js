import {defineConfig} from 'vite';

// GitHub Pages project sites are hosted beneath /<repository>/.
// The GitHub Actions workflow discovers that path automatically.
// Relative paths are the safe default for local builds and previews.
const pagesBase = process.env.PAGES_BASE_PATH?.trim() || './';
if (!(pagesBase === './' || pagesBase === '/' || /^\/[A-Za-z0-9._-]+\/$/.test(pagesBase))) {
  throw new Error(`Invalid PAGES_BASE_PATH: ${pagesBase}`);
}

export default defineConfig({
  base: pagesBase,
  optimizeDeps: {include: ['@tonejs/midi', 'midi-file']},
});
