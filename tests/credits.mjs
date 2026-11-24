import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { CREDITS } from '../src/content/content.js';

// The Credits window lists exactly the CC BY assets and the OFL and ITF FFL fonts in art/credits.md, and every
// font shipped in public/fonts is among them.
const md = await readFile(new URL('../art/credits.md', import.meta.url), 'utf8');
function table(heading) {
  const section = md.split(/^## /m).find((s) => s.startsWith(heading));
  assert.ok(section, `art/credits.md has a "${heading}" section`);
  return section.split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| Asset') && !l.startsWith('| ---'))
    .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()))
    .map(([title, , author, href]) => ({ title, author, href }));
}
const pick = (rows) => rows.map(({ title, author, href }) => ({ title, author, href }));

assert.deepEqual(pick(CREDITS.assets), table('CC BY'), 'Credits assets match the CC BY table');
const byTitle = (a, b) => a.title.localeCompare(b.title);
const ofl = table('SIL Open Font License'), ffl = table('ITF Free Font License');
assert.deepEqual(pick(CREDITS.fonts).sort(byTitle), [...ofl, ...ffl].sort(byTitle), 'Credits fonts match the OFL and ITF FFL tables');
assert.ok(CREDITS.assets.every((a) => a.license === 'CC BY 4.0'));
const licenseOf = (font) => (ffl.some((row) => row.title === font.title) ? 'ITF FFL 2.0' : 'SIL OFL 1.1');
assert.ok(CREDITS.fonts.every((f) => f.license === licenseOf(f)), 'each font names the license of the table it is listed in');

const shipped = (await readdir(new URL('../public/fonts/', import.meta.url))).filter((f) => f.endsWith('.woff2'));
for (const file of shipped) {
  const family = file.replace(/-(latin-)?\d{3}-normal|-regular|\.woff2/g, '').replace(/-/g, ' ');
  assert.ok(CREDITS.fonts.some((f) => f.title.toLowerCase() === family), `${file} (${family}) is credited`);
}
assert.ok(CREDITS.inspiredBy.length && /Three\.js/.test(CREDITS.builtWith) && /Blender/.test(CREDITS.builtWith));
console.log(`PASS Credits: ${CREDITS.assets.length} CC BY assets and ${CREDITS.fonts.length} fonts match art/credits.md; ${shipped.length} shipped fonts credited`);
