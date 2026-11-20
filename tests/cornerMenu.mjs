import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { UI } from '../src/content/content.js';

// The corner menu (keyboard only) zooms into the screen, signs in and opens each window; the desk's
// credits link and About's Credits button open Credits; the hint shows on a first visit only and
// goes on the first interaction; "back to desk" returns to the room.
const url = process.argv[2] || 'http://127.0.0.1:4320/?diagnostics=1';
const browser = await chromium.launch({ channel: 'chromium' });
const live = (page) => page.waitForFunction(() => document.body.classList.contains('orbit-live') && window.__stillReady?.());
const hintShown = (page) => page.evaluate(() => getComputedStyle(document.getElementById('orbit-hint')).opacity !== '0');
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(url);
  await live(page);
  assert.equal(await page.locator('#orbit-hint').textContent(), UI.hint);
  await page.waitForFunction(() => getComputedStyle(document.getElementById('orbit-hint')).opacity === '1');
  assert.equal(await page.locator('#corner-name').textContent(), 'Trish Nguyen');

  for (const [id] of UI.menuItems) {
    await page.locator('#menu-button').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#menu-button').getAttribute('aria-expanded'), 'true');
    assert.ok(await page.evaluate(() => document.activeElement.closest('#menu-list') !== null), 'focus moves into the open menu');
    await page.locator(`#menu-list [data-window="${id}"]`).focus();
    await page.keyboard.press('Enter');
    await page.locator(`#window-${id}`).waitFor({ state: 'visible' });
    assert.ok(await page.evaluate(() => document.body.classList.contains('signed-in')), `${id}: signed in without the login`);
    assert.equal(await page.locator('#screen-back').textContent(), UI.back);
    await page.locator(`#window-${id} .close-btn`).click();
    await page.locator('#screen-back').click();
    await live(page);
  }
  assert.equal(await hintShown(page), false, 'the hint goes after the first interaction');

  await page.locator('#menu-button').click();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#menu-list').isHidden(), true, 'Escape closes the menu');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'menu-button', 'and returns focus to its button');
  assert.equal(await page.evaluate(() => document.body.classList.contains('orbit-live')), true, 'without leaving the room');

  await page.locator('#credits-link').click();
  await page.locator('#window-credits').waitFor({ state: 'visible' });
  const credits = await page.locator('#window-credits .window-body').textContent();
  assert.match(credits, /seanaiux\.com\/computer/);
  assert.match(credits, /fizyman/);
  await page.locator('#window-credits .close-btn').click();
  await page.locator('#start-button').click();
  await page.locator('.start-menu-item[data-window="about"]').click();
  await page.locator('#window-about [data-open-window="credits"]').click();
  await page.locator('#window-credits').waitFor({ state: 'visible' });

  const again = await context.newPage();
  await again.goto(url);
  await live(again);
  await again.waitForTimeout(1600);
  assert.equal(await hintShown(again), false, 'a returning visitor gets no hint');
  await context.close();
  console.log('PASS corner menu, credits link, About credits, back to desk, first-visit hint');
} finally { await browser.close(); }
