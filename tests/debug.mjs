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
} finally {
  await browser.close();
  await server.close();
}
