import { readFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';

// Pages must receive Vite's output, including every stable public asset.
const output = path.resolve('dist');
const html = await readFile(path.join(output, 'index.html'), 'utf8');
if (html.includes('/src/') || !html.includes('/assets/')) {
  throw new Error('dist/index.html must reference the compiled Vite assets.');
}

async function checkFile(relative) {
  await access(path.join(output, relative));
}

for (const [, url] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  if (!url.startsWith('/') || url.startsWith('//')) continue;
  await checkFile(decodeURIComponent(url.split(/[?#]/)[0]).slice(1));
}

async function checkPublic(directory = 'public') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await checkPublic(file);
    else await checkFile(path.relative('public', file));
  }
}
await checkPublic();
console.log('Build verified: compiled entry assets and all public assets exist in dist/.');
