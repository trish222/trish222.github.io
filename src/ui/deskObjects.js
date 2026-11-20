import * as THREE from 'three';
import { FLOPPIES, UI } from '../content/content.js';

// One pill label for whatever the pointer (or a first tap) is on, placed above that object's
// click_* proxy, plus one focusable button per pressable object: focused, the button itself
// becomes the pill at the object, so the keyboard route shows the same thing a hover does.
export function createDeskObjects({ proxies, camera, canvas, actions }) {
  const objects = [
    ['machine', UI.objects.crt, proxies.crt],
    ['lamp', UI.objects.lamp, proxies.lampChain],
    ...FLOPPIES.map((f, i) => [`project:${i}`, f.label, proxies.projects[i]]),
    ['treehouse', UI.objects.treehouse, proxies.treehouse],
  ].map(([id, label, proxy]) => ({ id, label, box: new THREE.Box3().setFromObject(proxy) }));
  const byId = new Map(objects.map((o) => [o.id, o]));

  const label = Object.assign(document.createElement('div'), { id: 'hover-label', className: 'ux desk-pill' });
  label.setAttribute('aria-hidden', 'true');
  const glow = Object.assign(document.createElement('div'), { className: 'ux desk-glow' });
  const group = document.getElementById('desk-objects');
  const buttons = objects.filter((o) => actions[o.id]).map((o) => {
    const button = Object.assign(document.createElement('button'), { type: 'button', className: 'desk-pill', textContent: o.label });
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

  // The proxy's projected screen box, in CSS pixels.
  function rect(box) {
    const r = canvas.getBoundingClientRect();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < 8; i++) {
      corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(camera);
      const x = r.left + (corner.x + 1) / 2 * r.width, y = r.top + (1 - corner.y) / 2 * r.height;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    return { x0, y0, x1, y1 };
  }

  function place() {
    const o = current && byId.get(current);
    document.body.classList.toggle('desk-hover', !!o);
    if (!o) return;
    const { x0, y0, x1, y1 } = rect(o.box);
    const top = Math.max(8, y0 - 10);
    for (const el of [label, document.activeElement?.closest?.('#desk-objects') && document.activeElement].filter(Boolean)) {
      el.style.left = `${Math.round((x0 + x1) / 2)}px`;
      el.style.top = `${Math.round(top)}px`;
    }
    Object.assign(glow.style, { left: `${x0}px`, top: `${y0}px`, width: `${x1 - x0}px`, height: `${y1 - y0}px` });
  }

  function show(id) {
    if (id === current) return;
    current = id;
    if (id) label.textContent = byId.get(id).label;
    glow.hidden = id === 'machine'; // the CRT's own picture glows instead (crtMaterial.js)
    place();
  }

  return {
    show, place,
    get current() { return current; },
    dispose() { label.remove(); glow.remove(); group?.replaceChildren(); document.body.classList.remove('desk-hover'); },
  };
}
