import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// The tube's rounded outline clips the live DOM and its hit-testing together (clicks land where they
// appear; the tube glass around it takes none), and the animated CRT, the live screen's grain and
// flicker, and the window rain freeze under prefers-reduced-motion.
const url = process.argv[2] || 'http://127.0.0.1:4320/?diagnostics=1';
const browser = await chromium.launch({ channel: 'chromium' });
try {
  for (const [width, height] of [[1440, 900], [1024, 768]]) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    await page.goto(url);
    await page.waitForFunction(() => window.__stillReady?.());
    await page.evaluate(() => window.__enter());
    await page.waitForFunction(() => document.body.classList.contains('screen-focused'));
    const probe = await page.evaluate(() => {
      const box = document.querySelector('#screen').getBoundingClientRect();
      const hit = (fx, fy) => document.elementFromPoint(box.left + box.width * fx, box.top + box.height * fy)?.closest('#screen') !== null;
      return {
        clipped: getComputedStyle(document.querySelector('#screen-glass')).clipPath.startsWith('polygon'),
        corners: [[0.005, 0.005], [0.995, 0.005], [0.995, 0.995], [0.005, 0.995]].map(([x, y]) => hit(x, y)),
        edges: [[0.5, 0.01], [0.99, 0.5], [0.5, 0.99], [0.01, 0.5], [0.5, 0.5]].map(([x, y]) => hit(x, y)),
      };
    });
    assert.ok(probe.clipped, 'the live screen is clipped to the tube outline');
    assert.deepEqual(probe.corners, [false, false, false, false], 'the rounded corners do not take clicks');
    assert.deepEqual(probe.edges, [true, true, true, true, true], 'the edge midpoints and the centre still do');
    await context.close();
  }
  for (const [reducedMotion, expectFrozen] of [['reduce', true], ['no-preference', false]]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion });
    const page = await context.newPage();
    await page.goto(url);
    await page.waitForFunction(() => window.__stillReady?.());
    await page.waitForTimeout(800);
    const shot = () => page.screenshot({ clip: { x: 180, y: 0, width: 1080, height: 380 } });
    const a = await shot();
    await page.waitForTimeout(2500);
    const b = await shot();
    assert.equal(a.equals(b), expectFrozen, `${reducedMotion}: window and CRT ${expectFrozen ? 'hold still' : 'animate'}`);
    const animations = await page.evaluate(() => ['::before', '::after'].map((p) => getComputedStyle(document.querySelector('#screen .crt-fx'), p).animationName));
    assert.deepEqual(animations.map((n) => n === 'none'), [expectFrozen, expectFrozen], `${reducedMotion}: live-screen grain and flicker`);
    await context.close();
  }
  console.log('PASS CRT outline clips clicks; reduced motion freezes rain, flicker and grain');
} finally { await browser.close(); }
