import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { PROJECTS } from '../src/config/projects.js';

// Each floppy label shows its project's title (drawn at runtime from PROJECTS), and
// clicking a floppy flies into the screen and opens that project's window.
const url = process.argv[2] || 'http://127.0.0.1:4320/?diagnostics=1';
const browser = await chromium.launch({ channel: 'chromium' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  await page.waitForFunction(() => performance.getEntriesByName('room:interactive').length);

  const labels = await page.evaluate(() => {
    const text = window.__scene.getObjectByName('baked_floppy_labels').material.userData.labelText;
    const ctx = text.image.getContext('2d');
    const w = text.image.width / 3, h = text.image.height / 2;
    const ink = [0, 1, 2, 3, 4, 5].map(i => ctx.getImageData((i % 3) * w, Math.floor(i / 3) * h, w, h).data
      .filter((v, k) => k % 4 === 3 && v > 128).length);
    return { titles: text.userData.titles, ink };
  });
  assert.deepEqual(labels.titles, PROJECTS.map(p => p.title), 'labels are drawn from PROJECTS in order');
  labels.ink.forEach((n, i) => assert.ok(n > 500, `label cell ${i + 1} has ink: ${n} px`));

  // A point inside click_project_0i's projected box that the nearest-hit picker gives to that floppy.
  const floppyPoint = (i) => page.evaluate((i) => {
    const proxy = window.__scene.getObjectByName(`click_project_0${i + 1}`);
    proxy.geometry.computeBoundingBox();
    const { min, max } = proxy.geometry.boundingBox;
    const V = window.__camera.position.constructor;
    const r = document.querySelector('#scene').getBoundingClientRect();
    const pts = [];
    for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) {
      const p = proxy.localToWorld(new V(x, y, z)).project(window.__camera);
      pts.push([(p.x + 1) / 2 * r.width, (1 - p.y) / 2 * r.height]);
    }
    const [x0, x1] = [Math.min(...pts.map(p => p[0])), Math.max(...pts.map(p => p[0]))];
    const [y0, y1] = [Math.min(...pts.map(p => p[1])), Math.max(...pts.map(p => p[1]))];
    for (let fy = 0.5; fy < 1; fy += 0.1) for (const sy of [1, -1]) for (let fx = 0.5; fx < 1; fx += 0.1) for (const sx of [1, -1]) {
      const x = x0 + (0.5 + sx * (fx - 0.5)) * (x1 - x0), y = y0 + (0.5 + sy * (fy - 0.5)) * (y1 - y0);
      if (window.__pick(x, y) === `project:${i}`) return { x: r.left + x, y: r.top + y };
    }
    return null;
  }, i);

  for (const [i, { window: id, card }] of PROJECTS.entries()) {
    const point = await floppyPoint(i);
    assert.ok(point, `click_project_0${i + 1} is pickable from the overview`);
    await page.mouse.click(point.x, point.y);
    await page.waitForFunction(() => document.body.classList.contains('screen-focused'));
    if (!(await page.evaluate(() => document.body.classList.contains('signed-in')))) {
      await page.locator('#login-user').fill('Trish');
      await page.locator('.login-dialog button.default').click();
      await page.waitForFunction(() => document.body.classList.contains('signed-in'));
    }
    await page.locator(`#window-${id}`).waitFor({ state: 'visible' });
    if (card) assert.ok(await page.locator(`[data-project="${card}"]`).evaluate(el => el.classList.contains('selected')),
      `floppy ${i + 1} selects the ${card} card`);
    await page.locator(`#window-${id} .close-btn`).click();
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.body.classList.contains('orbit-live'));
  }
  assert.deepEqual(errors, []);
  console.log(`PASS floppy labels ${labels.titles.join(', ')}; each floppy opens its window`);
} finally { await browser.close(); }
