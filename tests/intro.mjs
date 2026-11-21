import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { UI } from '../src/content/content.js';

// The intro: a boot screen whose bar follows the real download, then the camera at the screen behind
// "click me" until it is pressed (Enter here), then the desk. Reduced motion cuts instead of flying.
// A returning visitor flies out on its own; once loaded, Escape skips the rest of the boot screen.
const base = process.argv[2] || 'http://127.0.0.1:4320/';
const url = `${base}?diagnostics=1&intro=1`;
const browser = await chromium.launch({ channel: 'chromium' });

async function open({ reducedMotion = 'no-preference', returning = false } = {}) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((returning) => {
    if (returning) localStorage.setItem('trish-desk-visited', '1');
    window.__introLog = { progress: [], zooming: false, ctaShown: false };
    addEventListener('DOMContentLoaded', () => {
      const bar = document.querySelector('.boot-bar');
      new MutationObserver(() => window.__introLog.progress.push(+bar.getAttribute('aria-valuenow')))
        .observe(bar, { attributes: true, attributeFilter: ['aria-valuenow'] });
      new MutationObserver(() => {
        const c = document.body.classList;
        if (c.contains('screen-zooming')) window.__introLog.zooming = true;
        if (c.contains('intro-ready')) window.__introLog.ctaShown = true;
      }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    });
  }, returning);
  await page.goto(url);
  return { page, errors };
}
const has = (page, c) => page.evaluate((c) => document.body.classList.contains(c), c);

try {
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const { page, errors } = await open({ reducedMotion });
    await page.waitForFunction(() => performance.getEntriesByName('room:interactive').length);
    assert.ok(await has(page, 'screen-focused') && !(await page.evaluate(() => window.__orbit().enabled)), 'loads at the screen, not the desk');
    await page.waitForFunction(() => document.body.classList.contains('intro-ready'));
    await page.locator('#boot').waitFor({ state: 'hidden', timeout: 1000 }); // after its fade
    assert.equal(await page.evaluate(() => document.activeElement.id), 'intro-cta', 'the CTA has focus');
    assert.equal(await page.locator('#intro-cta').textContent(), UI.introCta);
    const { progress } = await page.evaluate(() => window.__introLog);
    assert.ok(progress.every((v, i) => !i || v >= progress[i - 1]), `progress never goes back: ${progress}`);
    assert.equal(progress.at(-1), 100);
    assert.ok(progress.some((v) => v > 0 && v < 90), `the bar moved with the download: ${progress}`);
    await page.evaluate(() => { window.__introLog.zooming = false; });
    const key = reducedMotion === 'reduce' ? 'Space' : 'Enter';
    await page.keyboard.press(key);
    await page.waitForFunction(() => document.body.classList.contains('orbit-live'));
    assert.equal(await page.evaluate(() => window.__introLog.zooming), reducedMotion !== 'reduce', `${reducedMotion}: ${reducedMotion === 'reduce' ? 'cuts' : 'flies'} to the desk`);
    assert.ok(Math.abs((await page.evaluate(() => window.__orbit())).swing) < 0.01, 'lands on the overview');
    assert.equal(await has(page, 'intro'), false);
    assert.deepEqual(errors, []);
    console.log(`PASS ${reducedMotion}: boot bar ${progress.length} steps, screen, "${UI.introCta}", ${key} to the desk`);
    await page.close();
  }

  // A real mouse click (Enter above only reaches the focused button): #screen is pointer-events:none,
  // so the CTA, and the picture around it, must take the click themselves.
  for (const target of ['#intro-cta', 'picture']) {
    const { page, errors } = await open();
    await page.waitForFunction(() => document.body.classList.contains('intro-ready'));
    await page.locator('#boot').waitFor({ state: 'hidden', timeout: 1000 });
    const r = await page.locator('#intro-cta').boundingBox();
    const [x, y] = target === 'picture' ? [r.x + r.width / 2, r.y - 60] : [r.x + r.width / 2, r.y + r.height / 2];
    await page.mouse.click(x, y);
    await page.waitForFunction(() => document.body.classList.contains('orbit-live'), null, { timeout: 5000 });
    await page.waitForFunction(() => !document.body.classList.contains('screen-zooming'));
    // Home is cam_overview with the tuned LOOK pitch/zoom/height applied (scene/camera.js home()).
    const { swing, rise, enabled } = await page.evaluate(() => window.__orbit());
    assert.ok(Math.abs(swing) < 0.01 && Math.abs(rise) < 0.01, `${target}: lands on the cam_overview home (${swing}, ${rise})`);
    assert.ok(enabled, `${target}: the desk is interactive`);
    assert.equal(await has(page, 'intro'), false);
    assert.deepEqual(errors, []);
    console.log(`PASS first visit: clicking ${target} flies out to the overview`);
    await page.close();
  }

  {
    const { page } = await open({ returning: true });
    await page.waitForFunction(() => document.body.classList.contains('orbit-live'), null, { timeout: 30000 });
    assert.equal(await page.evaluate(() => window.__introLog.ctaShown), false, 'a returning visitor never waits on the CTA');
    console.log('PASS returning visit flies out on its own');
    await page.close();
  }

  {
    const { page } = await open();
    await page.waitForFunction(() => performance.getEntriesByName('room:interactive').length);
    const t0 = Date.now();
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.body.classList.contains('intro-ready'));
    assert.ok(Date.now() - t0 < 500, 'Escape skips the boot screen');
    assert.equal(await has(page, 'screen-focused'), true, 'and only the boot screen: the camera still waits');
    console.log('PASS Escape skips the boot screen');
    await page.close();
  }

  const fallback = await browser.newPage();
  await fallback.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type.startsWith('webgl') ? null : getContext.call(this, type, ...args);
    };
  });
  await fallback.goto(base);
  await fallback.waitForFunction(() => document.body.classList.contains('no-scene'));
  assert.equal(await fallback.locator('#boot').count(), 0, 'no WebGL: no boot screen');
  console.log('PASS no-WebGL skips the intro');
} finally { await browser.close(); }
