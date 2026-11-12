import assert from 'node:assert/strict';
import { readdir, readFile, access } from 'node:fs/promises';
import path from 'node:path';

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(e => e.isDirectory() ? files(path.join(directory, e.name)) : path.join(directory, e.name)))).flat();
}
const modules = (await files('src')).filter(file => file.endsWith('.js'));
const graph = new Map();
for (const file of modules) {
  const source = await readFile(file, 'utf8');
  const imports = [...source.matchAll(/(?:from\s*|import\s*\(\s*|import\s*)['"](\.[^'"]+)['"]/g)]
    .map(match => path.normalize(path.join(path.dirname(file), match[1])));
  for (const target of imports) await access(target);
  graph.set(file, imports.filter(target => target.endsWith('.js')));
}
const visited = new Set();
function visit(file, stack = []) {
  assert.ok(!stack.includes(file), `Circular import: ${[...stack, file].join(' -> ')}`);
  if (visited.has(file)) return;
  for (const dependency of graph.get(file) || []) visit(dependency, [...stack, file]);
  visited.add(file);
}
for (const file of modules) visit(file);
const reachable = new Set();
function reach(file) {
  if (reachable.has(file)) return;
  reachable.add(file);
  for (const dependency of graph.get(file) || []) reach(dependency);
}
reach('src/main.js');
const outsideMainSourceGraph = modules.filter(file => !reachable.has(file));
console.log(JSON.stringify({ modules: modules.length, productionEntry: 'index.html -> src/main.js',
  outsideMainSourceGraph, graph: process.argv.includes('--graph') ? Object.fromEntries(graph) : undefined }, null, 2));
console.log('Source imports exist; no circular local ES-module imports.');
