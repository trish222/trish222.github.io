import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// The widened drag-to-look range (LOOK.yawLimit / pitchUpLimit / pitchDownLimit) never shows the void
// past the room, at every orbit extreme and corner, on desktop and on cam_mobile.
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
    assert.ok(yawMax >= 19.9 && -yawMin >= 19.9, `yaw limit is about +-20 degrees: ${limits.swing}`);
    assert.ok(pitchUp >= 9.9 && -pitchDown >= 9, `pitch limit is +10 up, -9 down (capped inside the 16:9 corner void at 10: ${limits.rise}`);
    const worst = [];
    for (const swing of [yawMin, 0, yawMax]) {
      for (const rise of [pitchDown, 0, pitchUp]) {
        await page.evaluate(([s, r]) => window.__orbit(s, r), [swing, rise]);
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
} finally { await browser.close(); }
assert.deepEqual(failures, []);
