import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { UI } from '../src/content/content.js';

// A slow load: after 8 s the boot screen offers the plain-HTML page ("taking a while? skip 3D") under the
// bar, loading goes on behind it, and the line goes again once the scene is up.
const base = process.argv[2] || 'http://127.0.0.1:4320/';
const SLOW_MS = 8000;
const browser = await chromium.launch({ channel: 'chromium' });
const link = (page) => page.locator('.boot-slow');
const open = async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return { page, errors };
};

try {
  {
    // Throttled to a crawl (200 kB/s: the scene is tens of seconds away): the line shows, and it leads to lo-fi.
    const { page, errors } = await open();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200e3, uploadThroughput: 100e3 });
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.locator('#boot').waitFor({ state: 'visible' });
    assert.equal(await link(page).isVisible(), false, 'no line while the load is young');
    await page.waitForTimeout(SLOW_MS + 500);
    assert.equal(await link(page).isVisible(), true, `the line shows after ${SLOW_MS / 1000} s`);
    assert.equal(await link(page).textContent(), UI.slowLoad);
    assert.equal(await link(page).evaluate((a) => getComputedStyle(a).fontFamily.includes('Martian Mono')), true, 'Martian Mono');
    assert.equal(await page.locator('.boot-bar').getAttribute('role'), 'progressbar');
    await link(page).hover();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.boot-slow .boot-arrow')).opacity === '1', null, { timeout: 2000 }); // ▶ by it on hover
    await link(page).click();
    await page.locator('#lofi').waitFor({ timeout: 15000 });
    assert.ok(page.url().includes('?lofi'), `it leads to the lo-fi page: ${page.url()}`);
    assert.deepEqual(errors, []);
    console.log('PASS throttled load: the skip line shows after 8 s, ▶ on hover, click lands on lo-fi');
    await page.close();
  }

  {
    // The scene arrives after the line showed: loading was never stopped, and the line goes.
    const { page, errors } = await open();
    let release;
    const held = new Promise((ok) => { release = ok; });
    await page.route('**/models/scene*.glb', async (r) => { await held; r.continue(); });
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await link(page).waitFor({ state: 'visible', timeout: SLOW_MS + 4000 });
    release();
    await page.waitForFunction(() => document.body.classList.contains('intro-ready'), null, { timeout: 30000 });
    assert.equal(await link(page).isVisible(), false, 'the line is gone once the scene is up');
    assert.deepEqual(errors, []);
    console.log('PASS the scene finishes after the line showed: it carries on and the line hides');
    await page.close();
  }

  {
    // A normal load never shows it.
    const { page, errors } = await open();
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.body.classList.contains('intro-ready'), null, { timeout: 30000 });
    await page.waitForTimeout(SLOW_MS + 500);
    assert.equal(await link(page).isVisible(), false, 'a fast load never offers it');
    assert.deepEqual(errors, []);
    console.log('PASS fast load: no skip line');
    await page.close();
  }
} finally {
  await browser.close();
}
