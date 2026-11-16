import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

// art/ export -> public/models. Mobile gets 1024 px textures, desktop 2048.
// `npm run assets -- art/export/scene-raw-preview.glb` packs a bake.py --preview run.
const INPUT = process.argv[2] ?? 'art/export/scene-raw.glb';
const BAKES = INPUT.endsWith('-preview.glb') ? 'art/bakes/preview' : 'art/bakes';
const LIGHTMAPS = ['lightmap_lampOn', 'lightmap_lampOff', 'lightmap_screen'];
const VARIANTS = [['scene.glb', 2048], ['scene-mobile.glb', 1024]];

if (!existsSync(INPUT)) {
  console.error(`Missing ${INPUT}. Run the Blender bake (art/scripts/bake.py) first.`);
  process.exit(1);
}
if (spawnSync('toktx', ['--version']).error) {
  console.error('toktx not found. Install KTX-Software from github.com/KhronosGroup/KTX-Software/releases (macOS .pkg); brew has no ktx formula.');
  process.exit(1);
}

const tmp = mkdtempSync(path.join(tmpdir(), 'assets-'));
const gt = (...args) => execFileSync('npx', ['gltf-transform', ...args], { stdio: 'inherit' });

// glTF has no lightmap slot, so the lightmaps ride along as named, unreferenced images:
// the writer keeps every texture and only `optimize` would prune them.
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(INPUT);
for (const name of LIGHTMAPS) {
  const file = path.join(BAKES, `${name}.png`);
  if (!existsSync(file)) {
    console.error(`Missing ${file}. Run the Blender bake (art/scripts/bake.py) first.`);
    process.exit(1);
  }
  doc.createTexture(name).setImage(readFileSync(file)).setMimeType('image/png').setURI(`${name}.png`);
}
const withLightmaps = path.join(tmp, 'lightmapped.glb');
await io.write(withLightmaps, doc);

for (const [name, size] of VARIANTS) {
  const [a, b, c] = ['resized', 'uastc', 'etc1s'].map(s => path.join(tmp, `${size}-${s}.glb`));
  gt('resize', withLightmaps, a, '--width', size, '--height', size);
  // Download budget: the dimmer lamp-off light is smooth enough to ship at 1024 everywhere.
  gt('resize', a, a, '--pattern', 'lightmap_lampOff', '--width', 1024, '--height', 1024);
  gt('uastc', a, b, '--pattern', 'lightmap*');
  // etc1s skips textures that are already KTX2.
  gt('etc1s', b, c);
  gt('meshopt', c, path.join('public/models', name));
}
