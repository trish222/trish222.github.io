import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

// Every src/ file stays at or under LIMIT lines. Files over it today are
// capped at their current length so they can only shrink; see "split <file>"
// in docs/TODO.md. Do not add entries: split the file instead.
const LIMIT = 250;
const CAPS = {
  'src/desktop/desktop.js': 447,
  'src/desktop/windows.js': 438,
  'src/scene.js': 992,
  'src/style.css': 1430,
};

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(e => e.isDirectory() ? files(path.join(directory, e.name)) : path.join(directory, e.name)))).flat();
}

const failures = [];
for (const file of (await files('src')).filter(f => /\.(js|css)$/.test(f) && !f.includes('/vendor/'))) {
  const lines = (await readFile(file, 'utf8')).split('\n').length - 1;
  const cap = CAPS[file.split(path.sep).join('/')] ?? LIMIT;
  if (lines > cap) failures.push(`${file}: ${lines} lines, limit ${cap}`);
}
if (failures.length) {
  console.error(`Over the size limit:\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`Source sizes within limits (${LIMIT} lines; ${Object.keys(CAPS).length} capped).`);
