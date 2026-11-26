import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// The widened drag-to-look range (LOOK.yawLimit / pitchUpLimit / pitchDownLimit, *Handheld on phones) never shows the void
// past the room, at every orbit extreme and corner, on desktop and on cam_mobile; a real drag (mouse)
// or swipe (touch) far past the range stops at it and eases back home on release. The limits come from
// framing the room (roomFit.js); the camera stays on a sphere around the pivot (the home distance, a ~1 mm
// radius when turning in place) at every extreme and during a drag.
const onSphere = (o) => Math.abs(o.distance - o.radius) < 1e-4 * o.radius;
const url = process.argv[2] || 'http://127.0.0.1:4320/?diagnostics=1';
const SIZES = [[1920, 1080, false], [1440, 900, false], [1024, 768, false], [650, 900, false],
  [390, 844, true], [360, 640, true], [844, 390, true]];
const failures = [];
const browser = await chromium.launch({ channel: 'chromium' });
try {
  for (const [width, height, touch] of SIZES) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: touch, hasTouch: touch });
    const page = await context.newPage();
    await page.goto(url);
    await page.waitForFunction(() => performance.getEntriesByName('room:interactive').length);
    await page.waitForFunction(() => window.__stillReady?.());
    const { limits } = await page.evaluate(() => window.__orbit());
    const [yawMin, yawMax] = limits.swing;
    const [pitchDown, pitchUp] = limits.rise; // [-down, up]
    // Desktops keep the tuned ranges; a phone that backs off to frame the desk (camera.js) gets a smaller one (navigation.js).
    const [yawFloor, downFloor] = width >= 1024 ? [19.9, 9] : [8.5, 2];
    assert.ok(yawMax >= yawFloor && -yawMin >= yawFloor, `yaw limit is at least +-${yawFloor} degrees: ${limits.swing}`);
    assert.ok(pitchUp >= 9.9 && -pitchDown >= downFloor, `pitch limit is at least +10 up, -${downFloor} down: ${limits.rise}`);
    const worst = [];
    for (const swing of [yawMin, 0, yawMax]) {
      for (const rise of [pitchDown, 0, pitchUp]) {
        const orbit = await page.evaluate(([s, r]) => window.__orbit(s, r), [swing, rise]);
        assert.ok(onSphere(orbit), `${width}x${height} ${swing},${rise}: orbits at the home distance: ${orbit.distance} vs ${orbit.radius}`);
        const voidPixels = await page.evaluate(() => {
          const canvas = document.querySelector('#scene');
          return canvas.width * canvas.height - window.__histogram().roomPixels;
        });
        if (voidPixels) worst.push(`${swing},${rise}: ${voidPixels}px`);
      }
    }
    if (worst.length) failures.push(`${width}x${height}: void at orbit extremes (swing,rise): ${worst}`);
    else console.log(`PASS ${width}x${height}${touch ? ' touch' : ''}: no void at yaw ${yawMin}/${yawMax}, pitch ${pitchDown}/${pitchUp}`);
    await context.close();
  }
  for (const [width, height, touch] of [[1440, 900, false], [390, 844, true]]) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: touch, hasTouch: touch });
    const page = await context.newPage();
    await page.goto(url);
    await page.waitForFunction(() => document.body.classList.contains('orbit-live') && window.__stillReady?.());
    const cdp = touch && await context.newCDPSession(page);
    const touchAt = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    const x0 = width * 0.15, y0 = height * 0.5;
    // Grab-style: the monitor follows the finger (NDC y points up, the page's y down).
    const monitor = () => page.evaluate(() => { const { ndc } = window.__fit('screen_plane'); return [(ndc.x0 + ndc.x1) / 2, (ndc.y0 + ndc.y1) / 2]; });
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const before = await monitor();
      if (touch) await touchAt('touchStart', x0, y0); else { await page.mouse.move(x0, y0); await page.mouse.down(); }
      for (let i = 1; i <= 12; i++) {
        const x = x0 + dx * width * 0.07 * i, y = y0 + dy * height * 0.07 * i;
        if (touch) await touchAt('touchMove', x, y); else await page.mouse.move(x, y);
        await page.waitForTimeout(16);
      }
      await page.waitForTimeout(250);
      const held = await page.evaluate(() => window.__orbit());
      const [yawMin, yawMax] = held.limits.swing, [down, up] = held.limits.rise;
      const after = await monitor();
      assert.ok(dx ? Math.sign(after[0] - before[0]) === dx : Math.sign(after[1] - before[1]) === -dy,
        `${width}x${height} drag ${dx},${dy} moves the monitor with the finger: ${before} -> ${after}`);
      assert.ok(onSphere(held), `${width}x${height} drag ${dx},${dy} orbits at the home distance: ${held.distance} vs ${held.radius}`);
      assert.ok(held.swing >= yawMin - 0.5 && held.swing <= yawMax + 0.5 && held.rise >= down - 0.5 && held.rise <= up + 0.5,
        `${width}x${height} drag ${dx},${dy} stays inside the leash: ${held.swing.toFixed(1)}, ${held.rise.toFixed(1)}`);
      const limit = dx ? (held.swing < 0 ? -yawMin : yawMax) : (held.rise < 0 ? -down : up);
      assert.ok(Math.abs(dx ? held.swing : held.rise) > limit - 1, `${width}x${height} drag ${dx},${dy} reaches the leash: ${held.swing.toFixed(1)}, ${held.rise.toFixed(1)}`);
      if (touch) await touchAt('touchEnd'); else await page.mouse.up();
      await page.waitForTimeout(1500);
      const rest = await page.evaluate(() => window.__orbit());
      assert.ok(Math.abs(rest.swing) < 0.5 && Math.abs(rest.rise) < 0.5, `${width}x${height} eases home after release: ${rest.swing}, ${rest.rise}`);
    }
    console.log(`PASS ${width}x${height}${touch ? ' swipe' : ' drag'}: clamped at the leash, eased home on release`);
    await context.close();
  }
} finally { await browser.close(); }
assert.deepEqual(failures, []);
