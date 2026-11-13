import { readFile } from 'node:fs/promises';
import { ImageUtils } from '@gltf-transform/core';
import { KHRTextureBasisu } from '@gltf-transform/extensions';

KHRTextureBasisu.register(); // lets ImageUtils read KTX2 headers

// Budgets come from the table in docs/visual-plan.md so there is one source of truth.
const plan = await readFile('docs/visual-plan.md', 'utf8');
function budget(metric) {
  const row = plan.split('\n').find(l => l.startsWith(`| ${metric}`));
  const [desktop, mobile] = (row?.split('|').slice(2, 4) ?? []).map(c => parseFloat(c.match(/≤\s*([\d.]+)/)?.[1]));
  if (!(desktop > 0 && mobile > 0)) throw new Error(`Cannot parse "${metric}" budget from docs/visual-plan.md`);
  return { desktop, mobile };
}
const BUDGETS = {
  download: budget('Total download before first frame'),
  draws: budget('Draw calls'),
  textures: budget('Texture memory'),
};

function measure(glb) {
  const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
  const jsonLength = view.getUint32(12, true);
  const json = JSON.parse(Buffer.from(glb.subarray(20, 20 + jsonLength)).toString());
  const bin = glb.subarray(20 + jsonLength + 8);

  const roots = json.scenes[json.scene ?? 0].nodes;
  const count = i => (json.meshes?.[json.nodes[i].mesh]?.primitives.length ?? 0)
    + (json.nodes[i].children ?? []).reduce((n, c) => n + count(c), 0);
  const draws = roots.reduce((n, i) => n + count(i), 0);

  // Worst case: every texture decoded to RGBA8 with a full mip chain.
  const textureBytes = (json.images ?? []).reduce((sum, { bufferView, mimeType }) => {
    const { byteOffset = 0, byteLength } = json.bufferViews[bufferView];
    const [w, h] = ImageUtils.getSize(bin.subarray(byteOffset, byteOffset + byteLength), mimeType);
    return sum + w * h * 4 * (4 / 3);
  }, 0);
  return { draws, textureMB: textureBytes / 2 ** 20 };
}

const targets = process.argv.length > 2
  ? process.argv.slice(2).map(file => [file, 'desktop'])
  : [['public/models/scene.glb', 'desktop'], ['public/models/scene-mobile.glb', 'mobile']];

const failures = [];
for (const [file, tier] of targets) {
  const glb = await readFile(file);
  const { draws, textureMB } = measure(glb);
  const checks = [
    ['download MB', glb.length / 1e6, BUDGETS.download[tier]],
    ['draw calls', draws, BUDGETS.draws[tier]],
    ['texture MB', textureMB, BUDGETS.textures[tier]],
  ];
  for (const [label, value, limit] of checks) {
    if (value > limit) failures.push(`${file} (${tier}): ${label} ${value.toFixed(1)} > ${limit}`);
  }
  console.log(`${file} (${tier}): ${(glb.length / 1e6).toFixed(2)} MB, ${draws} draws, ${textureMB.toFixed(1)} MB textures`);
}
if (failures.length) {
  console.error(`Over budget:\n${failures.join('\n')}`);
  process.exit(1);
}
console.log('Asset budgets met.');
