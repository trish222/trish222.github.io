import { writeFile, mkdir } from 'node:fs/promises';
import { SCREEN_W, SCREEN_H, MON_W, MON_H } from '../src/scene/screenSpec.js';

// Placeholder for public/models/scene.glb until the Blender export exists (P2).
// Names follow docs/scene-contract.md.
const SCREEN_Y = 5.0;

function box(w, h, d) {
  const [x, y, z] = [w / 2, h / 2, d / 2];
  const faces = [
    [[1, 0, 0], [[x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z]]],
    [[-1, 0, 0], [[-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z]]],
    [[0, 1, 0], [[-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z]]],
    [[0, -1, 0], [[-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z]]],
    [[0, 0, 1], [[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]]],
    [[0, 0, -1], [[x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z]]],
  ];
  const uvs = [[0, 1], [1, 1], [1, 0], [0, 0]];
  const pos = [], nor = [], uv = [], idx = [];
  faces.forEach(([n, corners], f) => {
    corners.forEach((c, i) => { pos.push(...c); nor.push(...n); uv.push(...uvs[i]); });
    idx.push(f * 4, f * 4 + 1, f * 4 + 2, f * 4, f * 4 + 2, f * 4 + 3);
  });
  return { pos, nor, uv, idx, min: [-x, -y, -z], max: [x, y, z] };
}

// Flat +Z-facing quad centred on the origin, UVs 0-1 (the contract's screen_plane).
function quad(w, h) {
  const [x, y] = [w / 2, h / 2];
  return { pos: [-x, -y, 0, x, -y, 0, x, y, 0, -x, y, 0], nor: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
    uv: [0, 0, 1, 0, 1, 1, 0, 1], idx: [0, 1, 2, 0, 2, 3], min: [-x, -y, 0], max: [x, y, 0] };
}

const parts = [
  { name: 'screen_plane', size: [SCREEN_W, SCREEN_H], at: [0, SCREEN_Y, 0], flat: true },
  { name: 'click_crt', size: [MON_W, MON_H, 2], at: [0, SCREEN_Y - 0.5, -1], proxy: true },
  { name: 'click_lamp_chain', size: [0.4, 1.2, 0.4], at: [-7, 4, -3.6], proxy: true },
];
const empties = [
  { name: 'cam_overview', at: [0, 8, 20] },
  { name: 'cam_screen', at: [0, SCREEN_Y, 8] },
  { name: 'cam_mobile', at: [0, 7, 24] },
];

const chunks = [], views = [], accessors = [], meshes = [], nodes = [], materials = [];
let length = 0;
function add(data, target) {
  const buf = Buffer.from(data.buffer);
  views.push({ buffer: 0, byteOffset: length, byteLength: buf.length, target });
  chunks.push(buf);
  length += buf.length;
  return views.length - 1;
}
function accessor(view, componentType, count, type, extra = {}) {
  accessors.push({ bufferView: view, componentType, count, type, ...extra });
  return accessors.length - 1;
}

for (const p of parts) {
  const b = p.flat ? quad(...p.size) : box(...p.size);
  const n = b.pos.length / 3;
  const attributes = {
    POSITION: accessor(add(new Float32Array(b.pos), 34962), 5126, n, 'VEC3', { min: b.min, max: b.max }),
    NORMAL: accessor(add(new Float32Array(b.nor), 34962), 5126, n, 'VEC3'),
    TEXCOORD_0: accessor(add(new Float32Array(b.uv), 34962), 5126, n, 'VEC2'),
  };
  const indices = accessor(add(new Uint16Array(b.idx), 34963), 5123, b.idx.length, 'SCALAR');
  materials.push({ name: `${p.name}_mat`, pbrMetallicRoughness: { baseColorFactor: p.proxy ? [1, 1, 1, 1] : [0.1, 0.35, 0.33, 1], metallicFactor: 0, roughnessFactor: 1 } });
  meshes.push({ name: p.name, primitives: [{ attributes, indices, material: materials.length - 1 }] });
  nodes.push({ name: p.name, mesh: meshes.length - 1, translation: p.at });
}
for (const e of empties) nodes.push({ name: e.name, translation: e.at });

const pad = (buf, byte) => Buffer.concat([buf, Buffer.alloc((4 - (buf.length % 4)) % 4, byte)]);
const bin = pad(Buffer.concat(chunks), 0);
const json = pad(Buffer.from(JSON.stringify({
  asset: { version: '2.0', generator: 'make-placeholder-glb.mjs' },
  scene: 0, scenes: [{ nodes: nodes.map((_, i) => i) }], nodes, meshes, materials, accessors,
  bufferViews: views, buffers: [{ byteLength: bin.length }],
})), 0x20);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8);
const chunkHead = (len, type) => { const h = Buffer.alloc(8); h.writeUInt32LE(len, 0); h.writeUInt32LE(type, 4); return h; };
await mkdir('public/models', { recursive: true });
await writeFile('public/models/scene.glb', Buffer.concat([header, chunkHead(json.length, 0x4e4f534a), json, chunkHead(bin.length, 0x004e4942), bin]));
console.log('Wrote public/models/scene.glb');
