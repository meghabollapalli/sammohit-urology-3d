// Fails the build if the JavaScript or CSS that loads before the 3D scene exceeds budget.
// The lazy three.js scene chunk (scene3d-*.js) is excluded on purpose.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET = { js: 15 * 1024, css: 15 * 1024 }; // compressed bytes
const dir = join(process.argv[2] || 'dist', 'assets');
const totals = { js: 0, css: 0 };

for (const file of readdirSync(dir)) {
  const ext = file.endsWith('.js') ? 'js' : file.endsWith('.css') ? 'css' : null;
  if (!ext || file.startsWith('scene3d-')) continue;
  totals[ext] += gzipSync(readFileSync(join(dir, file))).length;
}

let failed = false;
for (const kind of ['js', 'css']) {
  const ok = totals[kind] <= BUDGET[kind];
  failed ||= !ok;
  console.log(`[budget] first-load ${kind}: ${(totals[kind] / 1024).toFixed(1)} KB gzip (budget ${BUDGET[kind] / 1024} KB) ${ok ? 'ok' : 'OVER'}`);
}
if (failed) process.exit(1);
