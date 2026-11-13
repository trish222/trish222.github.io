import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// art/ export -> public/models. Mobile gets 1024 px textures, desktop 2048.
const INPUT = 'art/export/scene-raw.glb';
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

for (const [name, size] of VARIANTS) {
  const [a, b, c] = ['resized', 'uastc', 'etc1s'].map(s => path.join(tmp, `${size}-${s}.glb`));
  gt('resize', INPUT, a, '--width', size, '--height', size);
  gt('uastc', a, b, '--pattern', 'lightmap*');
  // etc1s skips textures that are already KTX2.
  gt('etc1s', b, c);
  gt('meshopt', c, path.join('public/models', name));
}
