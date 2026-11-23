import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// The phone's home view shows the desk scene: the whole monitor and keyboard (the lamp may be cut off at
// the edge) and some desk, in portrait and landscape; in portrait the screen is centred sideways and the
// lens stays at or under LOOK.mobileFov (55), on scene-mobile.glb with the pixel ratio capped at 1.5. One tap on the
// monitor zooms in; the intro's fly-out lands on the same framing.
const base = process.argv[2] || 'http://127.0.0.1:4320/';
const SHOWN = ['baked_crt_monitor', 'baked_crt_case', 'baked_crt_keyboard', 'screen_plane', 'baked_lamp', 'baked_desk'];
const FITTED = SHOWN.slice(0, 3);
const MARGIN = 0.03; // of the viewport, on every side of the fitted three (the desk only has to be in view)
// NDC: how far the screen's centre may sit off the middle of a portrait frame. 0.03 before the tuned mobileOffsetX
// (0.02 m), which by design puts it 0.036 right of centre.
const CENTRED = 0.05;
const FOV_CAP = 52.5;
const browser = await chromium.launch({ channel: 'chromium' });

// NDC extents of the named objects' vertices, and the lens, for the current camera.
const extents = (page) => page.evaluate((names) => {
  const camera = window.__camera, scene = window.__scene, V = camera.position.constructor;
  camera.updateMatrixWorld();
  return { fov: camera.fov, ...Object.fromEntries(names.map((name) => {
    const o = scene.getObjectByName(name);
    const min = [Infinity, Infinity], max = [-Infinity, -Infinity];
    o.traverse((m) => {
      if (!m.isMesh) return;
      const position = m.geometry.attributes.position, p = new V();
      for (let i = 0; i < position.count; i++) {
        p.fromBufferAttribute(position, i);
        m.localToWorld(p).project(camera);
        min[0] = Math.min(min[0], p.x); max[0] = Math.max(max[0], p.x);
        min[1] = Math.min(min[1], p.y); max[1] = Math.max(max[1], p.y);
      }
    });
    return [name, { min, max }];
  })) };
}, SHOWN);

function assertFramed(label, e, portrait) {
  const edge = 1 - 2 * MARGIN;
  for (const name of FITTED) {
    const { min, max } = e[name];
    assert.ok(min[0] >= -edge && max[0] <= edge && min[1] >= -edge && max[1] <= edge,
      `${label}: ${name} sits inside the frame (x ${min[0].toFixed(2)}..${max[0].toFixed(2)}, y ${min[1].toFixed(2)}..${max[1].toFixed(2)})`);
  }
  if (portrait) {
    const { min, max } = e.screen_plane;
    assert.ok(Math.abs(min[0] + max[0]) / 2 <= CENTRED, `${label}: the screen is centred sideways (${((min[0] + max[0]) / 2).toFixed(3)})`);
    assert.ok(e.fov <= FOV_CAP + 1e-6, `${label}: lens ${e.fov.toFixed(1)} is at most ${FOV_CAP}`);
  }
  const desk = e.baked_desk;
  assert.ok(desk.max[0] > 0.5 && desk.min[0] < -0.5 || desk.max[0] - desk.min[0] > 1, `${label}: some desk shows around them`);
}

try {
  for (const [width, height] of [[390, 844], [844, 390]]) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 3, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const models = [];
    page.on('request', (r) => { if (r.url().endsWith('.glb')) models.push(r.url().split('/').pop()); });
    await page.goto(`${base}?diagnostics=1`);
    await page.waitForFunction(() => document.body.classList.contains('orbit-live') && window.__stillReady?.());
    assert.deepEqual(models, ['scene-mobile.glb'], `${width}x${height} loads only the mobile scene`);
    const ratio = await page.evaluate(() => { const c = document.querySelector('#scene'); return c.width / c.clientWidth; });
    assert.ok(ratio <= 1.5 + 1e-6, `pixel ratio capped at 1.5 (canvas is ${ratio})`);
    assertFramed(`${width}x${height}`, await extents(page), width < height);
    console.log(`PASS ${width}x${height} home view frames the desk scene`);

    // The intro's fly-out ends on the same framing (a fresh visit, the camera starts at the screen).
    const flying = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
    const intro = await flying.newPage();
    await intro.goto(`${base}?diagnostics=1&intro=1`);
    await intro.waitForFunction(() => document.body.classList.contains('intro-ready'), null, { timeout: 60000 });
    assertFramed(`${width}x${height} after the intro`, await extents(intro), width < height);
    console.log(`PASS ${width}x${height} intro fly-out lands on the home framing`);
    await context.close();
    await flying.close();
  }
} finally { await browser.close(); }
