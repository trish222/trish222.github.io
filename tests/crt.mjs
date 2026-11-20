import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// The tube's rounded outline clips the live DOM and its hit-testing together (clicks land where they
// appear; the tube glass around it takes none); the shader picture just before arrival matches the
// live DOM just after in average colour (login and desktop); and the animated CRT, the live screen's
// grain and flicker, and the window rain freeze under prefers-reduced-motion.
const HANDOVER_MAX = 3; // per channel, 0-255

// Average sRGB colour of the screen's central 60%, from a PNG data URL (canvas readback or screenshot).
const average = (page, url) => page.evaluate(async (url) => {
  const r = document.querySelector('#screen-glass').getBoundingClientRect();
  const img = new Image(); img.src = url; await img.decode();
  const c = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height });
  const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
  const s = img.width / innerWidth;
  const d = ctx.getImageData((r.x + r.width * 0.2) * s, (r.y + r.height * 0.2) * s, r.width * 0.6 * s, r.height * 0.6 * s).data;
  const sum = [0, 0, 0];
  for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) sum[k] += d[i + k];
  return sum.map((v) => v / (d.length / 4));
}, url);
// The WebGL picture alone just before the crossfade completes, then the live DOM at arrival. Parking at
// the desk first refreshes the still, as leaving the screen does for real.
async function handover(page) {
  await page.evaluate(() => window.__flyTo(0));
  await page.waitForTimeout(1000); // the still redraws in idle time
  const before = await average(page, await page.evaluate(() => { window.__flyTo(0.985); return document.querySelector('#scene').toDataURL(); }));
  await page.evaluate(() => window.__flyTo(1));
  await page.waitForTimeout(400);
  const after = await average(page, `data:image/png;base64,${(await page.screenshot()).toString('base64')}`);
  return before.map((v, i) => Math.abs(v - after[i]));
}
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
    const login = await handover(page);
    await page.locator('#login-user').fill('Trish');
    await page.locator('.login-dialog button.default').click();
    await page.waitForFunction(() => document.body.classList.contains('signed-in'));
    await page.locator('#start-button').click();
    await page.locator('.start-menu-item[data-window="about"]').click();
    const desktop = await handover(page);
    for (const [name, gap] of [['login', login], ['desktop', desktop]]) {
      assert.ok(Math.max(...gap) <= HANDOVER_MAX, `${width}x${height} ${name}: hand-over colour jump ${gap.map((v) => v.toFixed(1))} > ${HANDOVER_MAX}`);
    }
    console.log(`  ${width}x${height} hand-over gap: login ${login.map((v) => v.toFixed(1))}, desktop ${desktop.map((v) => v.toFixed(1))}`);
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
  console.log('PASS CRT outline clips clicks; hand-over colour matches; reduced motion freezes rain, flicker and grain');
} finally { await browser.close(); }
