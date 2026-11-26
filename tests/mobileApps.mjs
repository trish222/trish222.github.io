import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { UI } from '../src/content/content.js';

// On a 390x844 touch phone every app opens by tap: About, Projects, Resume and Contact from the desktop icons
// (Credits, which has no icon, from About's link), and all five from the corner menu. Each window ends up
// visible and inside the viewport.
const base = process.argv[2] || 'http://127.0.0.1:4320/';
const W = 390, H = 844;
const ICON_APPS = ['about', 'projects', 'resume', 'contact'];
const browser = await chromium.launch({ channel: 'chromium' });

async function phone() {
  const context = await browser.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}?diagnostics=1`);
  await page.waitForFunction(() => document.body.classList.contains('orbit-live') && window.__stillReady?.());
  return { context, page, errors };
}

async function assertOpen(page, id, label) {
  const win = page.locator(`#window-${id}`);
  await win.waitFor({ state: 'visible', timeout: 10000 });
  const box = await win.boundingBox();
  assert.ok(box && box.x >= -1 && box.y >= -1 && box.x + box.width <= W + 1 && box.y + box.height <= H + 1,
    `${label}: #window-${id} sits inside the ${W}x${H} viewport (${JSON.stringify(box)})`);
}

// A real tap on the monitor: the screen plane's centre, projected to CSS pixels.
async function tapMonitor(page) {
  const [x, y] = await page.evaluate(() => {
    const camera = window.__camera, V = camera.position.constructor, p = new V();
    new V().copy(window.__scene.getObjectByName('screen_plane').getWorldPosition(p));
    camera.updateMatrixWorld();
    p.project(camera);
    return [(p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight];
  });
  await page.touchscreen.tap(x, y);
  await page.waitForFunction(() => document.body.classList.contains('screen-focused'), null, { timeout: 10000 });
}

try {
  // Desktop icons: one tap on the monitor, sign in, then one tap per icon.
  {
    const { context, page, errors } = await phone();
    await tapMonitor(page);
    await page.tap('.login-dialog button.default');
    await page.waitForFunction(() => document.body.classList.contains('signed-in'));
    for (const id of ICON_APPS) {
      await page.tap(`.desktop-icon[data-window="${id}"]`);
      await assertOpen(page, id, 'icon');
      await page.tap(`#window-${id} .close-btn`);
      await page.locator(`#window-${id}`).waitFor({ state: 'hidden' });
      console.log(`PASS ${W}x${H} the ${id} icon opens it by tap`);
    }
    await page.tap('.desktop-icon[data-window="about"]');
    await page.tap('#window-about [data-open-window="credits"]');
    await assertOpen(page, 'credits', 'about link');
    console.log(`PASS ${W}x${H} credits opens from About's link`);
    assert.deepEqual(errors, [], 'no page errors');
    await context.close();
  }

  // Corner menu: each item flies in, signs in on its own and opens the window.
  for (const [id] of UI.menuItems) {
    const { context, page, errors } = await phone();
    await page.tap('#menu-button');
    await page.tap(`#menu-list [data-window="${id}"]`);
    await assertOpen(page, id, 'menu');
    assert.deepEqual(errors, [], 'no page errors');
    console.log(`PASS ${W}x${H} menu > ${id} opens it by tap`);
    await context.close();
  }
} finally { await browser.close(); }
