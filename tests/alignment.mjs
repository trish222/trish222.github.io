import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { registration } from './screenRegistration.mjs';

// CRT zoom through the click_crt proxy, with the live screen registered to
// screen_plane within 2 CSS px at the overview, on arrival and after exit.
const url = process.argv[2] || 'http://127.0.0.1:4320/?diagnostics=1';
const TOLERANCE = 2;
const browser = await chromium.launch({ channel: 'chromium' });
try {
  for (const [width, height, touch] of [[1440, 900, false], [390, 844, true]]) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: touch, hasTouch: touch });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await page.waitForFunction(() => performance.getEntriesByName('room:interactive').length);
    await page.waitForFunction(() => window.__stillReady?.());

    const overview = await registration(page);
    assert.ok(overview.flat, 'screen_plane is a flat quad');
    assert.ok(overview.error < TOLERANCE, `overview overlay within ${TOLERANCE} px: ${overview.error}`);

    // The widened overview (LOOK.overviewZoom) never shows the void past the room, even at full parallax.
    for (const [x, y] of touch ? [[width / 2, height / 2]] : [[1, 1], [width - 2, 1], [1, height - 2], [width - 2, height - 2]]) {
      await page.mouse.move(x, y);
      await page.waitForTimeout(500);
      const voidPixels = await page.evaluate(() => {
        const canvas = document.querySelector('#scene');
        return canvas.width * canvas.height - window.__histogram().roomPixels;
      });
      assert.equal(voidPixels, 0, `overview shows ${voidPixels} void pixels with the pointer at ${x},${y}`);
    }
    await page.mouse.move(width / 2, height / 2);
    await page.waitForTimeout(500);

    // A point on the casing below the glass, so the press lands on click_crt, not #screen.
    const press = await page.evaluate(() => {
      const box = new window.__camera.position.constructor();
      const proxy = window.__scene.getObjectByName('click_crt');
      proxy.geometry.computeBoundingBox();
      const { min, max } = proxy.geometry.boundingBox;
      const glass = document.querySelector('#screen').getBoundingClientRect();
      const canvas = document.querySelector('#scene').getBoundingClientRect();
      const bottom = proxy.localToWorld(box.set((min.x + max.x) / 2, min.y, (min.z + max.z) / 2)).project(window.__camera);
      const x = glass.left + glass.width / 2;
      const y = (glass.bottom + (1 - bottom.y) * canvas.height / 2 + canvas.top) / 2;
      return { x, y, hit: window.__pick(x - canvas.left, y - canvas.top) };
    });
    assert.equal(press.hit, 'machine', `the casing below the glass picks click_crt: ${JSON.stringify(press)}`);
    await page.mouse.click(press.x, press.y);
    await page.waitForFunction(() => document.body.classList.contains('screen-focused'));

    const arrived = await registration(page);
    assert.ok(arrived.error < TOLERANCE, `zoomed overlay within ${TOLERANCE} px: ${arrived.error}`);
    assert.ok(arrived.skew < 0.5, `cam_screen frames the glass straight-on: ${arrived.skew}`);

    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.body.classList.contains('orbit-live'));
    const back = await registration(page);
    assert.ok(back.error < TOLERANCE, `overlay within ${TOLERANCE} px after exit: ${back.error}`);
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}x${height}: CRT zoom via click_crt; overlay error ` +
      `${[overview, arrived, back].map(r => r.error.toFixed(3)).join(' / ')} px, skew ${arrived.skew.toFixed(3)} px`);
    await context.close();
  }
} finally { await browser.close(); }
