import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { UI } from '../src/content/content.js';

// Every corner-menu item opens its window from every state: on the desk, zoomed in at the login, zoomed in and
// signed in (already open -> front, minimized -> restored), and mid-zoom (queued, opened once on arrival).
// Also the phone's "menu" list and Enter on a focused item.
const url = process.argv[2] || 'http://127.0.0.1:4320/?diagnostics=1';
const browser = await chromium.launch({ channel: 'chromium' });
const ids = UI.menuItems.map(([id]) => id);
const live = (page) => page.waitForFunction(() => document.body.classList.contains('orbit-live') && window.__stillReady?.());
const focused = (page) => page.waitForFunction(() => document.body.classList.contains('screen-focused'));
const signedIn = (page) => page.waitForFunction(() => document.body.classList.contains('signed-in'));
const state = (page, id) => page.evaluate((id) => {
  const w = document.getElementById(`window-${id}`);
  return { open: !w.classList.contains('hidden') && !w.classList.contains('minimized'), active: w.classList.contains('active'),
    z: Number(w.style.zIndex) || 0, opened: document.querySelectorAll('.window:not(.hidden):not(.minimized)').length };
}, id);
const opened = (page, id) => page.waitForFunction((id) => {
  const w = document.getElementById(`window-${id}`);
  return w && !w.classList.contains('hidden') && !w.classList.contains('minimized') && w.classList.contains('active');
}, id);
// The phone's corner is hidden once the glass is fullscreen, so there it is clicked through the DOM.
async function click(page, id, phone) {
  const hidden = await page.evaluate(() => document.body.classList.contains('screen-active') && document.body.classList.contains('glass-fullscreen'));
  if (phone && hidden) return page.locator(`#menu-list [data-window="${id}"]`).evaluate((el) => el.click());
  if (phone) await page.locator('#menu-button').click();
  await (id === 'credits' && !phone ? page.locator('#credits-link') : page.locator(`#menu-list [data-window="${id}"]`)).click();
}
async function fresh(width, height, reducedMotion = 'reduce') {
  const page = await (await browser.newContext({ viewport: { width, height }, reducedMotion })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await live(page);
  return Object.assign(page, { errors });
}

try {
  for (const [width, height, phone] of [[1440, 900, false], [390, 844, true]]) {
    const label = `${width}px`;
    for (const id of ids) {
      // Desk view: zoom in, sign in, open.
      let page = await fresh(width, height);
      await click(page, id, phone);
      await focused(page); await signedIn(page); await opened(page, id);
      assert.equal((await state(page, id)).opened, 1, `${label} ${id}: desk -> one window`);

      // Zoomed in, signed in: another item opens right away; the same item again stays one window.
      const other = ids.find((x) => x !== id);
      await click(page, other, phone);
      await opened(page, other);
      assert.equal((await state(page, other)).opened, 2, `${label} ${other}: opens beside ${id}`);
      await click(page, id, phone);
      await opened(page, id);
      const [a, b] = [await state(page, id), await state(page, other)];
      assert.ok(a.z > b.z && a.opened === 2, `${label} ${id}: already open -> brought to the front, not opened twice`);

      // Minimized -> restored.
      await page.evaluate((id) => document.querySelector(`#window-${id} .minimize-btn`)?.click(), id);
      assert.equal((await state(page, id)).open, false, `${label} ${id}: minimized`);
      await click(page, id, phone);
      await opened(page, id);
      assert.equal((await state(page, id)).open, true, `${label} ${id}: restored from minimized`);
      assert.deepEqual(page.errors, [], `${label} ${id}: no page errors`);
      await page.context().close();

      // Zoomed in on the login screen: sign in automatically and open.
      page = await fresh(width, height);
      await page.evaluate(() => window.__enter());
      await focused(page);
      assert.equal(await page.evaluate(() => document.body.classList.contains('signed-in')), false, `${label}: still at the login`);
      await click(page, id, phone);
      await signedIn(page); await opened(page, id);
      assert.equal((await state(page, id)).opened, 1, `${label} ${id}: login -> signed in, one window`);
      await page.context().close();
    }

    // During the zoom (motion on): the request queues and opens once on arrival.
    const page = await fresh(width, height, 'no-preference');
    await click(page, 'about', phone);
    assert.equal(await page.evaluate(() => document.body.classList.contains('screen-zooming')), true, `${label}: mid-zoom`);
    await click(page, 'resume', phone);
    await focused(page); await signedIn(page); await opened(page, 'resume');
    await page.waitForTimeout(500);
    const [about, resume] = [await state(page, 'about'), await state(page, 'resume')];
    assert.ok(resume.open && !about.open && resume.opened === 1, `${label}: the latest queued request opens, once`);
    await page.context().close();
  }

  // Keyboard: Enter on a focused item.
  const wide = await fresh(1440, 900);
  await wide.locator('#menu-list [data-window="contact"]').focus();
  await wide.keyboard.press('Enter');
  await focused(wide); await signedIn(wide); await opened(wide, 'contact');
  await wide.locator('#menu-list [data-window="about"]').focus();
  await wide.keyboard.press('Enter');
  await opened(wide, 'about');
  assert.equal((await state(wide, 'about')).opened, 2, 'Enter while signed in opens right away');
  await wide.context().close();

  console.log('PASS corner menu opens its window from the desk, login, signed in (front/restore) and mid-zoom; phone list and Enter');
} finally {
  await browser.close();
}
