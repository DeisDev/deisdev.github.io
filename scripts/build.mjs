import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { renderFeatured } from './catalog.mjs';

const root = new URL('../', import.meta.url);
const data = JSON.parse(await readFile(new URL('data/projects.json', root), 'utf8'));
const template = await readFile(new URL('src/index.html', root), 'utf8');
const html = renderFeatured(template, data);
await mkdir(new URL('dist/', root), { recursive: true });
await writeFile(new URL('dist/index.html', root), html);
for (const file of ['style.css', 'theme.js', 'favicon.svg', 'doto-latin-800.woff2', 'Doto-OFL.txt']) {
  await copyFile(new URL('src/' + file, root), new URL('dist/' + file, root));
}
await writeFile(new URL('dist/.nojekyll', root), '');
console.log('Built dist/ with Better Lights and ' + data.name + '.');
