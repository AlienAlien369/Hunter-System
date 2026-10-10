// Runs after `vite build`: writes dist/in.html (the India landing page's own
// static tags). Vercel serves it for /in via the rewrite in vercel.json.
import { readFileSync, writeFileSync } from 'node:fs';
import { buildVariantHtml, VARIANTS } from './seo.mjs';

const index = readFileSync('dist/index.html', 'utf8');
for (const [name, v] of Object.entries(VARIANTS)) {
  writeFileSync(`dist/${name}.html`, buildVariantHtml(index, v));
  console.log(`prerendered dist/${name}.html for ${v.path}`);
}
