import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { CREDITS } from '../src/content/content.js';

// The Credits window lists exactly the rows of art/credits.md, every font shipped in public/fonts is credited and
// has its copyright line in public/fonts/LICENSE.txt, and the build ships every library's license text.
// Run after `npm run build`.
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const md = await read('art/credits.md');
function section(heading) {
  const found = md.split(/^#{2,3} /m).find((s) => s.startsWith(heading));
  assert.ok(found, `art/credits.md has a "${heading}" section`);
  return found;
}
function table(heading) {
  const [head, , ...rows] = section(heading).split('\n').filter((l) => l.startsWith('| '))
    .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
  return rows.map((cells) => Object.fromEntries(head.map((h, i) => [h.toLowerCase(), cells[i]])))
    .map(({ asset, author, source, license }) => ({ title: asset, author, href: source, ...(license && { license }) }));
}
const pick = (rows, keys = ['title', 'author', 'href']) => rows.map((r) => Object.fromEntries(keys.map((k) => [k, r[k]])));
const byTitle = (a, b) => a.title.localeCompare(b.title);

assert.deepEqual(CREDITS.inspiredBy.map((i) => i.href), section('Inspired by').match(/https:\S+/g), 'Inspired by matches');
assert.deepEqual(pick(CREDITS.assets), table('CC BY'), 'CC BY assets match');
assert.ok(CREDITS.assets.every((a) => a.license === 'CC BY 4.0'), 'every CC BY asset names its license');
assert.deepEqual(pick(CREDITS.cc0), table('CC0'), 'CC0 assets match');
const ofl = table('SIL Open Font License'), ffl = table('ITF Free Font License');
assert.deepEqual(pick(CREDITS.fonts).sort(byTitle), [...ofl, ...ffl].sort(byTitle), 'fonts match the OFL and ITF FFL tables');
const licenseOf = (font) => (ffl.some((row) => row.title === font.title) ? 'ITF FFL 2.0' : 'SIL OFL 1.1');
assert.ok(CREDITS.fonts.every((f) => f.license === licenseOf(f)), 'each font names the license of the table it is listed in');
const libraryKeys = ['title', 'author', 'href', 'license'];
assert.deepEqual(pick(CREDITS.libraries, libraryKeys), table('Code libraries'), 'code libraries match');
assert.ok(/Three\.js/.test(CREDITS.builtWith) && /Blender/.test(CREDITS.builtWith));

const fontNotices = await read('public/fonts/LICENSE.txt');
const shipped = (await readdir(new URL('../public/fonts/', import.meta.url))).filter((f) => f.endsWith('.woff2'));
for (const file of shipped) {
  const family = file.replace(/-(latin-)?\d{3}-normal|-regular|\.woff2/g, '').replace(/-/g, ' ');
  assert.ok(CREDITS.fonts.some((f) => f.title.toLowerCase() === family), `${file} (${family}) is credited`);
  assert.ok(fontNotices.includes(file), `${file} has its copyright line in public/fonts/LICENSE.txt`);
}

const notices = await read('dist/third-party-licenses.txt');
for (const { title, license } of CREDITS.libraries) {
  assert.ok(notices.includes(`${title} (${license})`), `dist/third-party-licenses.txt has ${title}`);
}
for (const text of ['Permission is hereby granted', 'This notice may not be removed', 'Apache License']) {
  assert.ok(notices.includes(text), `dist/third-party-licenses.txt has the full text containing "${text}"`);
}
console.log(`PASS Credits: ${CREDITS.assets.length} CC BY, ${CREDITS.cc0.length} CC0, ${CREDITS.fonts.length} fonts and `
  + `${CREDITS.libraries.length} libraries match art/credits.md; ${shipped.length} shipped fonts credited; license texts in dist`);
