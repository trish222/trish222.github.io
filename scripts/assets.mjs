import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { crc32 } from 'node:zlib';
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

// Blender tags every PNG sRGB (even Non-Color ones), and ktx create then converts the
// lightmaps' encoded codes to linear, crushing the darks. Retag them linear (gAMA 1.0)
// after every resize, which re-encodes the PNG, so the codes ship unchanged.
function linearPng(png) {
  const chunks = [png.subarray(0, 8)];
  for (let at = 8; at < png.length;) {
    const end = at + 12 + png.readUInt32BE(at);
    const type = png.toString('latin1', at + 4, at + 8);
    if (!['sRGB', 'gAMA', 'cHRM', 'iCCP'].includes(type)) chunks.push(png.subarray(at, end));
    if (type === 'IHDR') {
      const gama = Buffer.from([...Buffer.from('gAMA'), 0, 1, 0x86, 0xa0]);
      const chunk = Buffer.alloc(16);
      chunk.writeUInt32BE(4, 0);
      gama.copy(chunk, 4);
      chunk.writeUInt32BE(crc32(gama), 12);
      chunks.push(chunk);
    }
    at = end;
  }
  return Buffer.concat(chunks);
}

async function retagLightmaps(file) {
  const doc = await io.read(file);
  for (const t of doc.getRoot().listTextures()) if (LIGHTMAPS.includes(t.getName())) t.setImage(linearPng(Buffer.from(t.getImage())));
  await io.write(file, doc);
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
  // Download budget: lamp-off light ships at half size (1024; 512 on mobile) with RDO. The screen
  // light stays at 1024 in both builds: at 512 the CRT and keyboard islands blotch in lamp-off.
  // lampOn, the hero map, stays at full size without RDO.
  gt('resize', a, a, '--pattern', 'lightmap_lampOff', '--width', size / 2, '--height', size / 2);
  gt('resize', a, a, '--pattern', 'lightmap_screen', '--width', 1024, '--height', 1024);
  await retagLightmaps(a);
  gt('uastc', a, b, '--pattern', 'lightmap_lampOff', '--rdo');
  for (const map of ['lightmap_lampOn', 'lightmap_screen']) gt('uastc', b, b, '--pattern', map);
  // etc1s skips textures that are already KTX2.
  gt('etc1s', b, c);
  gt('meshopt', c, path.join('public/models', name));
}
