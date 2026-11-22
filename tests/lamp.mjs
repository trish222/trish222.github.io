import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// The lamp toggle crossfades the baked lampOn/lampOff lightmaps in under 400 ms:
// the desk under the lamp darkens, and the unlit window view does not change.
const url = process.argv[2] || 'http://127.0.0.1:4320/?diagnostics=1';
const browser = await chromium.launch({ channel: 'chromium' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  await page.waitForFunction(() => performance.getEntriesByName('room:interactive').length);

  // Screen points (0-1): the desk beside the lamp base (in front of it, the raised overview sees
  // the nameplate), and the upper-left of the city view.
  const probes = await page.evaluate(() => {
    const { __scene: scene, __camera: camera } = window;
    const V = camera.position.constructor;
    const box = (name) => {
      const o = scene.getObjectByName(name);
      o.geometry.computeBoundingBox();
      return o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    };
    const screen = (p) => { const n = p.project(camera); return { u: (n.x + 1) / 2, v: (1 - n.y) / 2 }; };
    const bulb = scene.getObjectByName('lamp_bulb').getWorldPosition(new V());
    const toCamera = camera.position.clone().sub(bulb).setY(0).normalize();
    const desk = bulb.clone().addScaledVector(toCamera, 0.05)
      .addScaledVector(new V(-toCamera.z, 0, toCamera.x), 0.15).setY(box('baked_desk').max.y);
    // The view is bigger than the frame (its top-left corner projects off screen), so take the
    // upper-left of the part on screen.
    const view = box('window_view');
    const left = screen(view.min.clone().setY(view.max.y)), right = screen(view.max.clone().setY(view.min.y));
    const u0 = Math.max(left.u, 0), v0 = Math.max(left.v, 0);
    const corner = { u: u0 + 0.25 * (Math.min(right.u, 1) - u0), v: v0 + 0.1 * (Math.min(right.v, 1) - v0) };
    return { desk: screen(desk), view: corner };
  });
  assert.ok(probes.desk && probes.view, `found desk and window probes: ${JSON.stringify(probes)}`);
  // The view is sampled without the lightmapped window glass (8% opaque), which dims with the lamp.
  const luma = () => page.evaluate(({ desk, view }) => {
    const glass = window.__scene.getObjectByName('baked_window_glass');
    glass.visible = false;
    const out = { desk: window.__pixel(desk.u, desk.v).luma, view: window.__pixel(view.u, view.v).luma };
    glass.visible = true;
    return out;
  }, probes);

  assert.equal((await page.evaluate(() => window.__lamp())).mix, 1, 'starts with the lamp on');
  const on = await luma();

  const fade = await page.evaluate(() => new Promise(resolve => {
    const t0 = performance.now();
    const seen = [];
    document.getElementById('lamp-toggle').click();
    (function poll() {
      const { mix } = window.__lamp();
      seen.push(mix);
      if (mix === 0) resolve({ ms: performance.now() - t0, seen });
      else requestAnimationFrame(poll);
    })();
  }));
  assert.ok(fade.ms <= 400, `crossfade finished in ${fade.ms.toFixed(0)} ms`);
  assert.ok(fade.seen.some(m => m > 0 && m < 1), `crossfade passes between the lightmaps: ${fade.seen.join(',')}`);
  const off = await luma();
  assert.ok(off.desk < on.desk * 0.7, `desk under the lamp darkens: ${on.desk} -> ${off.desk}`);
  assert.ok(off.view === on.view, `window view is unlit: ${on.view} -> ${off.view}`);

  // Back on through the pull chain, the way a visitor turns it on.
  const chain = await page.evaluate(() => {
    const proxy = window.__scene.getObjectByName('click_lamp_chain');
    const p = proxy.getWorldPosition(new window.__camera.position.constructor()).project(window.__camera);
    const r = document.querySelector('#scene').getBoundingClientRect();
    const x = (p.x + 1) / 2 * r.width, y = (1 - p.y) / 2 * r.height;
    return { x: r.left + x, y: r.top + y, hit: window.__pick(x, y) };
  });
  assert.equal(chain.hit, 'lamp', `the pull chain picks the lamp: ${JSON.stringify(chain)}`);
  await page.mouse.click(chain.x, chain.y);
  await page.waitForFunction(() => window.__lamp().mix === 1);
  const back = await luma();
  assert.ok(Math.abs(back.desk - on.desk) <= 2, `desk recovers: ${on.desk} -> ${back.desk}`);
  assert.deepEqual(errors, []);
  console.log(`PASS lamp crossfade ${fade.ms.toFixed(0)} ms over ${fade.seen.length} frames; ` +
    `desk luma ${on.desk} -> ${off.desk}, window ${on.view} -> ${off.view}`);
} finally { await browser.close(); }
