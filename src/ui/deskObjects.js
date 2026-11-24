import * as THREE from 'three';
import { FLOPPIES, UI } from '../content/content.js';
import { buildDownArrow } from './menuCursor.js';

// One pill label for whatever the pointer (or a first tap) is on, placed above that object's
// click_* proxy with a bobbing ▼ under it, plus one focusable button per pressable object: focused,
// the button itself becomes the pill at the object, so the keyboard route shows the same thing a hover
// does. The treehouse has no label or arrow, only the glow. The lamp's box is its whole body.
const ARROW_CLEARANCE = 12; // the arrow hangs this far (px) below the pill: its height plus gap, see .desk-arrow
// World-space vertices of the parts (the desk never moves), thinned to about MAX_POINTS each, so the label hugs
// the object as seen: the projected corners of a 3D box sit well above a lamp shade.
const MAX_POINTS = 400;
function surfacePoints(parts) {
  const points = [];
  for (const part of parts) part.traverse((mesh) => {
    const position = mesh.geometry?.attributes.position;
    if (!position) return;
    mesh.updateWorldMatrix(true, false);
    const stride = Math.max(1, Math.floor(position.count / MAX_POINTS));
    for (let i = 0; i < position.count; i += stride) points.push(new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld));
  });
  return points;
}

export function createDeskObjects({ proxies, camera, canvas, actions }) {
  const objects = [
    ['machine', UI.objects.crt, [proxies.crt]],
    ['lamp', UI.objects.lamp, [proxies.lampBody, proxies.lampChain]],
    ...FLOPPIES.map((f, i) => [`project:${i}`, f.label, [proxies.projects[i]]]),
    ['treehouse', null, [proxies.treehouse]],
  ].map(([id, label, parts]) => ({ id, label, points: surfacePoints(parts) }));
  const byId = new Map(objects.map((o) => [o.id, o]));

  const label = Object.assign(document.createElement('div'), { id: 'hover-label', className: 'ux desk-pill' });
  label.setAttribute('aria-hidden', 'true');
  label.append('', buildDownArrow());
  const glow = Object.assign(document.createElement('div'), { className: 'ux desk-glow' });
  const group = document.getElementById('desk-objects');
  const buttons = objects.filter((o) => actions[o.id]).map((o) => {
    const button = Object.assign(document.createElement('button'), { type: 'button', className: 'desk-pill', textContent: o.label });
    button.append(buildDownArrow());
    button.dataset.object = o.id;
    if (o.id === 'lamp') button.id = 'lamp-toggle';
    button.addEventListener('click', () => actions[o.id]());
    button.addEventListener('focus', () => show(o.id));
    button.addEventListener('blur', () => show(null));
    return button;
  });
  group?.replaceChildren(...buttons);
  document.body.append(glow, label);

  let current = null;
  const corner = new THREE.Vector3();

  // The object's projected screen box, in CSS pixels.
  function rect(points) {
    const r = canvas.getBoundingClientRect();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const point of points) {
      corner.copy(point).project(camera);
      const x = r.left + (corner.x + 1) / 2 * r.width, y = r.top + (1 - corner.y) / 2 * r.height;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    return { x0, y0, x1, y1 };
  }

  function place() {
    const o = current && byId.get(current);
    document.body.classList.toggle('desk-hover', !!o);
    if (!o) return;
    const { x0, y0, x1, y1 } = rect(o.points);
    const top = Math.max(8, y0 - 6 - ARROW_CLEARANCE);
    for (const el of [label, document.activeElement?.closest?.('#desk-objects') && document.activeElement].filter(Boolean)) {
      el.style.left = `${Math.round((x0 + x1) / 2)}px`;
      el.style.top = `${Math.round(top)}px`;
    }
    Object.assign(glow.style, { left: `${x0}px`, top: `${y0}px`, width: `${x1 - x0}px`, height: `${y1 - y0}px` });
  }

  function show(id) {
    if (id === current) return;
    current = id;
    label.hidden = !(id && byId.get(id).label);
    if (!label.hidden) label.firstChild.nodeValue = byId.get(id).label;
    glow.hidden = id === 'machine'; // the CRT's own picture glows instead (crtMaterial.js)
    place();
  }

  return {
    show, place,
    get current() { return current; },
    dispose() { label.remove(); glow.remove(); group?.replaceChildren(); document.body.classList.remove('desk-hover'); },
  };
}
