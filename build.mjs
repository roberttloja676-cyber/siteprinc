import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { products } from './public/catalog.mjs';

const paths = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/checkout': ['checkout.html', 'text/html; charset=utf-8'],
  '/atendimento': ['atendimento.html', 'text/html; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
  '/catalog.mjs': ['catalog.mjs', 'text/javascript; charset=utf-8'],
  '/merchant.mjs': ['merchant.mjs', 'text/javascript; charset=utf-8'],
  '/store.mjs': ['store.mjs', 'text/javascript; charset=utf-8'],
  '/assets/mark.png': ['assets/mark.png', 'image/png']
};
for (const route of ['/assets/hero.jpg', ...products.map(product => product.image)]) {
  paths[route] = [route.slice(1), 'image/jpeg'];
}
const assets = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([route, [file, type]]) => [
  route, [type, await readFile(new URL(`./public/${file}`, import.meta.url), type.startsWith('image/') ? 'base64' : 'utf8')]
])));
const catalog = await readFile(new URL('./public/catalog.mjs', import.meta.url), 'utf8');
const merchantConfig = await readFile(new URL('./public/merchant.mjs', import.meta.url), 'utf8');
const worker = await readFile(new URL('./worker.mjs', import.meta.url), 'utf8');
const bundled = [catalog, merchantConfig, worker.replace(/^import .+\r?\n/gm, ''), 'export default serve(' + JSON.stringify(assets) + ');'].join('\n');
await mkdir(new URL('./dist/server/', import.meta.url), { recursive: true });
await writeFile(new URL('./dist/server/index.js', import.meta.url), bundled);
