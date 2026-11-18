import './crt.css';
import { CRT, crtClipPath } from '../config/crt.js';
import { LOOK } from '../config/look.js';

const NS = 'http://www.w3.org/2000/svg';

// R/G hold the outward offset at each point as 0.5 + 0.25 * c * |c|^2 (c in -1..1 over the
// box): zero in the middle, 1 at the edge midpoints, so the fringe stays off central text.
function displacementMap(size = 32) {
  const canvas = Object.assign(document.createElement('canvas'), { width: size, height: size });
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cx = (x + 0.5) / size * 2 - 1, cy = (y + 0.5) / size * 2 - 1;
      const r2 = cx * cx + cy * cy, i = (y * size + x) * 4;
      image.data.set([(0.5 + 0.25 * cx * r2) * 255, (0.5 + 0.25 * cy * r2) * 255, 128, 255], i);
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL();
}

const el = (name, attrs, ...children) => {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  node.append(...children);
  return node;
};
const keep = (channel) => Array.from({ length: 4 }, (_, row) =>
  Array.from({ length: 5 }, (_, col) => +(col === row && (row === channel || row === 3)))).flat().join(' ');

// Red shifts out and blue in by the same map; green stays put. Built in the box's own px.
function buildFilter(width, height) {
  const box = { x: 0, y: 0, width, height };
  const shift = (scale, result) => el('feDisplacementMap',
    { in: 'SourceGraphic', in2: 'map', scale, xChannelSelector: 'R', yChannelSelector: 'G', result });
  const add = (a, b, result) => el('feComposite', { in: a, in2: b, operator: 'arithmetic', k2: 1, k3: 1, result });
  return el('svg', { width: 0, height: 0, 'aria-hidden': 'true', style: 'position:absolute' },
    el('filter', { id: 'crt-ca', filterUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB', ...box },
      el('feImage', { href: displacementMap(), preserveAspectRatio: 'none', result: 'map', ...box }),
      shift(0, 'r'), shift(0, 'b'),
      el('feColorMatrix', { in: 'r', values: keep(0), result: 'r1' }),
      el('feColorMatrix', { in: 'SourceGraphic', values: keep(1), result: 'g1' }),
      el('feColorMatrix', { in: 'b', values: keep(2), result: 'b1' }),
      add('r1', 'g1', 'rg'), add('rg', 'b1', 'rgb')));
}

// The clip outline as a soft alpha mask, so the picture's edge melts into the tube glass instead
// of ending at the polygon (which stays for hit-testing).
function softEdge(width, height) {
  const w = Math.round(width / 4), h = Math.round(height / 4);
  const canvas = Object.assign(document.createElement('canvas'), { width: w, height: h });
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cx = Math.abs((x + 0.5) / w * 2 - 1), cy = Math.abs((y + 0.5) / h * 2 - 1);
      const d = (cx ** CRT.edge + cy ** CRT.edge) ** (1 / CRT.edge);
      const t = Math.min(Math.max((d - 1 + CRT.soft) / CRT.soft, 0), 1);
      image.data[(y * w + x) * 4 + 3] = 255 * (1 - t * t * (3 - 2 * t));
    }
  }
  ctx.putImageData(image, 0, 0);
  return `url(${canvas.toDataURL()})`;
}

let svg = null;

// LOOK -> the custom properties in crt.css. Mask, flicker and tint are the shader's own keys.
export function applyScreenFx() {
  const screen = document.getElementById('screen');
  if (!screen || !svg) return;
  const set = (k, v) => screen.style.setProperty(k, v);
  const tint = CRT.tint.map((c) => Math.round(255 * (1 + (c - 1) * LOOK.crtTint)));
  set('--crt-tint', `rgb(${tint.join(' ')})`);
  set('--crt-mask', LOOK.crtMask * 1.5);
  set('--crt-flicker', LOOK.crtFlicker);
  set('--crt-edge', LOOK.screenEdge);
  set('--crt-glow', LOOK.screenGlow);
  set('--crt-grain', LOOK.screenGrain);
  set('--crt-glare', LOOK.screenGlare);
  set('--crt-filter', `${LOOK.screenCA > 0 ? 'url(#crt-ca) ' : ''}brightness(${LOOK.screenBrightness})`);
  set('--crt-lift', Array(3).fill(Math.round(255 * LOOK.screenLift)).join(' '));
  const [r, b] = svg.querySelectorAll('feDisplacementMap');
  r.setAttribute('scale', 4 * LOOK.screenCA);
  b.setAttribute('scale', -4 * LOOK.screenCA);
}

export function installScreenFx(screen, width, height) {
  disposeScreenFx();
  svg = buildFilter(width, height);
  document.body.append(svg);
  screen.style.setProperty('--crt-clip', crtClipPath());
  screen.style.setProperty('--crt-soft', softEdge(width, height));
  applyScreenFx();
}

export function disposeScreenFx() {
  svg?.remove();
  svg = null;
}
