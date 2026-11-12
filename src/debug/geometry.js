import * as THREE from 'three';
import { VOID } from '../room.js';

export function installGeometryDiagnostics({ scene, camera, renderer, composer, lights, render }) {
  window.__fit = (...names) => {
    const box = new THREE.Box3();
    for (const n of names.length ? names : ["desk", "computer"]) {
      const o = scene.getObjectByName(n);
      if (o) box.union(new THREE.Box3().setFromObject(o));
    }
    const v = new THREE.Vector3();
    const out = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
    for (const x of [box.min.x, box.max.x])
      for (const y of [box.min.y, box.max.y])
        for (const z of [box.min.z, box.max.z]) {
          v.set(x, y, z).project(camera);
          out.x0 = Math.min(out.x0, v.x);
          out.x1 = Math.max(out.x1, v.x);
          out.y0 = Math.min(out.y0, v.y);
          out.y1 = Math.max(out.y1, v.y);
        }
    return { world: [box.min.toArray(), box.max.toArray()], ndc: out };
  };
  window.__shadowfit = (...names) => {
    const light = lights.moon;
    const fwd = new THREE.Vector3()
      .subVectors(light.target.position, light.position)
      .normalize();
    const right = new THREE.Vector3(0, 1, 0).cross(fwd).normalize();
    const up = new THREE.Vector3().crossVectors(fwd, right).normalize();
    const v = new THREE.Vector3();
    const out = {};
    let all = null;
    for (const n of names.length
      ? names
      : ["room", "desk", "computer", "treehouse", "lamp"]) {
      const o = scene.getObjectByName(n);
      if (!o) continue;
      const b = new THREE.Box3().setFromObject(o);
      const r = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity };
      for (const x of [b.min.x, b.max.x])
        for (const y of [b.min.y, b.max.y])
          for (const z of [b.min.z, b.max.z]) {
            v.set(x, y, z).sub(light.position);
            const a = v.dot(right), c = v.dot(up), d = v.dot(fwd);
            r.x0 = Math.min(r.x0, a); r.x1 = Math.max(r.x1, a);
            r.y0 = Math.min(r.y0, c); r.y1 = Math.max(r.y1, c);
            r.z0 = Math.min(r.z0, d); r.z1 = Math.max(r.z1, d);
          }
      out[n] = r;
      all = all
        ? {
            x0: Math.min(all.x0, r.x0), x1: Math.max(all.x1, r.x1),
            y0: Math.min(all.y0, r.y0), y1: Math.max(all.y1, r.y1),
            z0: Math.min(all.z0, r.z0), z1: Math.max(all.z1, r.z1),
          }
        : { ...r };
    }
    const c = light.shadow.camera;
    return {
      perObject: out,
      union: all,
      camera: { left: c.left, right: c.right, top: c.top, bottom: c.bottom, near: c.near, far: c.far },
      /* World units a shadow texel covers, on each lateral axis. */
      texel: [
        Number(((c.right - c.left) / light.shadow.mapSize.x).toFixed(4)),
        Number(((c.top - c.bottom) / light.shadow.mapSize.y).toFixed(4)),
      ],
      normalBias: light.shadow.normalBias,
      bias: light.shadow.bias,
    };
  };
  window.__pixel = (u, v) => {
    render();
    const gl = renderer.getContext();
    const px = new Uint8Array(4);
    gl.readPixels(
      Math.min(gl.drawingBufferWidth - 1, Math.max(0, Math.round(u * gl.drawingBufferWidth))),
      Math.min(gl.drawingBufferHeight - 1, Math.max(0, Math.round((1 - v) * gl.drawingBufferHeight))),
      1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px,
    );
    const rgb = [px[0], px[1], px[2]];
    return {
      hex: "#" + rgb.map((c) => c.toString(16).padStart(2, "0")).join(""),
      rgb,
      luma: Math.round(0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]),
    };
  };
  window.__histogram = () => {
    render();
    const gl = renderer.getContext();
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    const buf = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    const voidRgb = new THREE.Color(VOID);
    const vr = Math.round(voidRgb.r * 255);
    const vg = Math.round(voidRgb.g * 255);
    const vb = Math.round(voidRgb.b * 255);
    const lumas = [];
    for (let i = 0; i < buf.length; i += 4) {
      const r = buf[i], g = buf[i + 1], b = buf[i + 2];
      /* Within a level or two of the backdrop, on every channel. The
         fog resolves to exactly the void, so this also drops the far
         corner of the diorama, which is correct — it is backdrop by
         construction. */
      if (Math.abs(r - vr) <= 2 && Math.abs(g - vg) <= 2 && Math.abs(b - vb) <= 2) continue;
      lumas.push(0.2126 * r + 0.7152 * g + 0.0722 * b);
    }
    lumas.sort((a, b) => a - b);
    const n = lumas.length;
    if (!n) return { room: 0 };
    const pct = (q) => Math.round(lumas[Math.min(n - 1, Math.floor(q * n))]);
    const under = (t) => Number((lumas.filter((v) => v < t).length / n).toFixed(3));
    return {
      roomPixels: n,
      roomShare: Number((n / (w * h)).toFixed(3)),
      p05: pct(0.05),
      p25: pct(0.25),
      median: pct(0.5),
      p75: pct(0.75),
      p95: pct(0.95),
      under8: under(8),
      under16: under(16),
      under32: under(32),
    };
  };
  window.__voidcheck = () => {
    const hidden = [];
    for (const child of scene.children) {
      if (child.visible) {
        hidden.push(child);
        child.visible = false;
      }
    }
    render();
    const gl = renderer.getContext();
    const px = new Uint8Array(4);
    gl.readPixels(
      Math.floor(gl.drawingBufferWidth / 2),
      Math.floor(gl.drawingBufferHeight / 2),
      1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px,
    );
    for (const child of hidden) child.visible = true;
    render();
    const got = [px[0], px[1], px[2]];
    const want = [0x1c, 0x1a, 0x2a];
    const hex = (a) => "#" + a.map((v) => v.toString(16).padStart(2, "0")).join("");
    return {
      path: composer ? "composer" : "direct",
      got: hex(got),
      want: hex(want),
      err: Math.max(...got.map((v, i) => Math.abs(v - want[i]))),
    };
  };
return () => {
  delete window.__fit;
  delete window.__shadowfit;
  delete window.__pixel;
  delete window.__histogram;
  delete window.__voidcheck;
};
}
