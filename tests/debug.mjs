import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'vite';
// The panel is dev-only (import.meta.env.DEV), so this starts its own Vite dev server.
const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ channel: 'chromium' });
try {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => m.type() === 'error' && !m.text().startsWith('Failed to load resource') && errors.push(m.text()));
  await page.goto(base + '?debug');
  await page.waitForFunction(() => window.__stillReady?.());
  await page.waitForSelector('#look-panel');
  assert.equal(await page.evaluate(() => document.body.classList.contains('no-scene')), false);
  assert.ok(await page.locator('#look-panel input[type=range]').count() > 0);
  const scroll = await page.evaluate(async () => {
    const list = document.getElementById('look-list');
    const reached = [];
    document.addEventListener('wheel', () => reached.push('wheel'));
    list.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 40 }));
    const before = list.scrollTop;
    list.scrollTop = 120;
    return { scrollable: list.scrollHeight > list.clientHeight, moved: list.scrollTop > before, leaked: reached.length };
  });
  assert.ok(scroll.scrollable && scroll.moved, 'slider list scrolls');
  assert.equal(scroll.leaked, 0, 'wheel inside the panel does not reach the scene');
  // drawImage on a WebGL canvas reads blank without preserveDrawingBuffer, so decode a screenshot.
  const shot = (await page.locator('#scene').screenshot()).toString('base64');
  const lit = await page.evaluate(async (b64) => {
    const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
    const ctx = Object.assign(document.createElement('canvas'), { width: bitmap.width, height: bitmap.height }).getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    return ctx.getImageData(0, 0, bitmap.width, bitmap.height).data.some((v, i) => i % 4 < 3 && v > 8);
  }, shot);
  assert.ok(lit, 'canvas rendered non-black pixels');
  assert.deepEqual(errors, []);
  console.log('PASS ?debug scene renders with the look panel');

  // Desktops default to "orbit" (LOOK.lookMode), phones and tablets too (LOOK.lookModeHandheld). Orbit swings the
  // camera about a pivot pivotDepth (pivotDepthHandheld) times as far out as the screen; turn rotates it in place. The limits keep void out
  // of the frame at every corner in the default mode, and the panel's toggle for the device's own mode swaps to turn.
  const pivotRadius = (page, key) => page.evaluate((key) => {
    window.__orbit(0, 0);
    const { world } = window.__fit('screen_plane');
    const centre = world[0].map((v, i) => (v + world[1][i]) / 2);
    const eye = window.__camera.position;
    const toScreen = Math.hypot(eye.x - centre[0], eye.y - centre[1], eye.z - centre[2]);
    return { radius: window.__orbit().radius, expected: window.__look.LOOK[key] * toScreen };
  }, key);
  for (const [width, height, touch] of [[1920, 1080, false], [1440, 900, false], [844, 390, true]]) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: touch, hasTouch: touch });
    const page = await context.newPage();
    await page.goto(base + '?debug&diagnostics=1');
    await page.waitForFunction(() => window.__stillReady?.() && window.__look);
    const key = touch ? 'lookModeHandheld' : 'lookMode';
    const [mode, other] = ['orbit', 'turn'];
    const { limits } = await page.evaluate(() => window.__orbit());
    const first = await pivotRadius(page, touch ? 'pivotDepthHandheld' : 'pivotDepth');
    assert.ok(Math.abs(first.radius - first.expected) < 0.02, `${width}x${height} orbits a pivot ${first.radius} m away, expected ${first.expected}`);
    const worst = [];
    for (const swing of limits.swing) {
      for (const rise of limits.rise) {
        const voidPixels = await page.evaluate(([s, r]) => {
          window.__orbit(s, r);
          const canvas = document.querySelector('#scene');
          return canvas.width * canvas.height - window.__histogram().roomPixels;
        }, [swing, rise]);
        if (voidPixels) worst.push(`${swing.toFixed(1)},${rise}: ${voidPixels}px`);
      }
    }
    assert.deepEqual(worst, [], `${width}x${height} ${mode} shows void at its yaw limit ${limits.swing[1].toFixed(1)}`);
    console.log(`PASS ${width}x${height} ${mode}: pivot ${first.radius.toFixed(2)} m, no void at yaw ${limits.swing.map((v) => v.toFixed(1))}`);
    await page.getByRole('button', { name: `${key}: ${mode}` }).click();
    const swapped = await pivotRadius(page, 'pivotDepth');
    assert.ok(swapped.radius < 0.01, `${width}x${height} ${key} turns in place: pivot ${swapped.radius} m away`);
    console.log(`PASS ${width}x${height} ${key} toggle to ${other}: pivot ${swapped.radius.toFixed(2)} m`);
    const invert = touch ? 'invertDragHandheld' : 'invertDrag';
    const was = await page.evaluate((k) => window.__look.LOOK[k], invert);
    await page.getByRole('button', { name: `${invert}: ${was}` }).click();
    assert.equal(await page.evaluate((k) => window.__look.LOOK[k], invert), !was, `${invert} toggles`);
    await context.close();
  }

  // Handheld home angles (LOOK.mobileYaw / mobilePitch / mobileHeight): the framing stays centred on the screen and the
  // re-clamped drag limits keep void out of every corner.
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const angled = await phone.newPage();
  await angled.goto(base + '?debug&diagnostics=1');
  await angled.waitForFunction(() => window.__stillReady?.() && window.__look);
  for (const [yaw, pitch, height] of [[-15, 0, 0], [15, 0, 0], [0, 8, 0], [0, 0, 0.1]]) {
    const result = await angled.evaluate(async ([yaw, pitch, height]) => {
      Object.assign(window.__look.LOOK, { mobileYaw: yaw, mobilePitch: pitch, mobileHeight: height });
      window.__look.apply();
      await new Promise((r) => setTimeout(r, 300));
      const { limits } = window.__orbit();
      const voids = [];
      for (const s of [limits.swing[0], 0, limits.swing[1]]) {
        for (const r of [limits.rise[0], 0, limits.rise[1]]) {
          window.__orbit(s, r);
          const canvas = document.querySelector('#scene');
          voids.push(canvas.width * canvas.height - window.__histogram().roomPixels);
        }
      }
      window.__orbit(0, 0);
      const { ndc } = window.__fit('screen_plane');
      return { voids, centre: (ndc.x0 + ndc.x1) / 2 };
    }, [yaw, pitch, height]);
    assert.deepEqual(result.voids.filter(Boolean), [], `yaw ${yaw} pitch ${pitch} height ${height}: void in the limits`);
    assert.ok(Math.abs(result.centre) < 0.2, `yaw ${yaw} pitch ${pitch} height ${height}: screen centred (${result.centre.toFixed(2)})`);
    console.log(`PASS 390x844 mobile home yaw ${yaw} pitch ${pitch} height ${height}: no void, screen at ${result.centre.toFixed(2)}`);
  }
  await phone.close();
} finally {
  await browser.close();
  await server.close();
}
