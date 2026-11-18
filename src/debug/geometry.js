import * as THREE from 'three';

export function installGeometryDiagnostics({ scene, camera, renderer, background, render }) {
  window.__fit = (...names) => {
    const box = new THREE.Box3();
    for (const n of names.length ? names : ["screen_plane"]) {
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
  // Void is any pixel no geometry covers. It renders as exact black, which crushed shadows reach too, so
  // colour cannot tell them apart: redraw every mesh flat white and call whatever stays black void.
  // (The material is swapped per mesh because the render pass resets scene.overrideMaterial.)
  const coverage = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, side: THREE.DoubleSide });
  const read = (gl) => {
    const buf = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    return buf;
  };
  window.__histogram = () => {
    render();
    const gl = renderer.getContext();
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    const buf = read(gl);
    const swapped = [];
    scene.traverse((o) => {
      if (!o.isMesh || !o.visible) return;
      swapped.push([o, o.material, o.visible]);
      if (o.name.startsWith('click_')) o.visible = false;
      else o.material = coverage;
    });
    render();
    const mask = read(gl);
    for (const [o, material, visible] of swapped) { o.material = material; o.visible = visible; }
    render();
    const isVoid = (i) => mask[i] < 128;
    const lumas = [];
    for (let i = 0; i < buf.length; i += 4) {
      if (isVoid(i)) continue;
      lumas.push(0.2126 * buf[i] + 0.7152 * buf[i + 1] + 0.0722 * buf[i + 2]);
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
    const bg = new THREE.Color(background);
    const want = [bg.r, bg.g, bg.b].map((v) => Math.round(v * 255));
    const hex = (a) => "#" + a.map((v) => v.toString(16).padStart(2, "0")).join("");
    return {
      got: hex(got),
      want: hex(want),
      err: Math.max(...got.map((v, i) => Math.abs(v - want[i]))),
    };
  };
return () => {
  delete window.__fit;
  delete window.__pixel;
  delete window.__histogram;
  delete window.__voidcheck;
};
}
