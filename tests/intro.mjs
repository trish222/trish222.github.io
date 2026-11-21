import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { UI } from '../src/content/content.js';

// The intro: the boot screen loads inside the CRT at the cam_screen framing (phase A, scene.glb), the
// camera flies out before the bar is full, the bar finishes on the monitor (phase B), then "click me"
// shows there and clicking it zooms in. Repeat visits end on the desk with no click; reduced motion cuts.
const base = process.argv[2] || 'http://127.0.0.1:4320/';
const url = `${base}?diagnostics=1&intro=1`;
const HANDOVER_MAX = 3; // per channel, 0-255, as tests/crt.mjs
const browser = await chromium.launch({ channel: 'chromium' });

// One observer, so the log keeps the order things happened in: bar values, the fly-out, the CTA, and
// the screen box and page background while the bar first moves (before the scene exists).
async function open({ reducedMotion = 'no-preference', returning = false, throttle = false, holdIcons = false } = {}) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  if (throttle) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 20, downloadThroughput: 6e6, uploadThroughput: 1e6 });
  }
  let release;
  const held = new Promise((ok) => { release = ok; });
  if (holdIcons) await page.route('**/icons/*.png', async (r) => { await held; r.continue(); });
  await page.addInitScript((returning) => {
    if (returning) localStorage.setItem('trish-desk-visited', '1');
    const log = window.__introLog = { events: [], early: null, flying: false };
    addEventListener('DOMContentLoaded', () => {
      const bar = document.querySelector('.boot-bar');
      new MutationObserver((records) => {
        for (const { target } of records) {
          if (target === bar) {
            const v = +bar.getAttribute('aria-valuenow');
            log.events.push(v);
            if (!log.early && v > 0 && v < 80) {
              const r = document.querySelector('#boot').getBoundingClientRect();
              log.early = { box: [r.x, r.y, r.width, r.height], bg: getComputedStyle(document.body).backgroundColor,
                scene: performance.getEntriesByName('room:assets-ready').length > 0 };
            }
          } else if (target === document.body) {
            const c = document.body.classList;
            if (c.contains('screen-zooming') !== log.flying && (log.flying = !log.flying)) log.events.push('fly');
            if (c.contains('intro-ready') && !log.events.includes('cta')) log.events.push('cta');
          }
        }
      }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class', 'aria-valuenow'] });
    });
  }, returning);
  await page.goto(url, { waitUntil: 'domcontentloaded' }); // held icons keep `load` from firing
  return { page, errors, release };
}
const has = (page, c) => page.evaluate((c) => document.body.classList.contains(c), c);
const log = (page) => page.evaluate(() => window.__introLog);
const progressOf = (events) => events.filter((e) => typeof e === 'number');

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
const shot = async (page) => `data:image/png;base64,${(await page.screenshot()).toString('base64')}`;

// Mean luminance of a viewport box in a screenshot.
const luma = (page, url, [x, y, w, h]) => page.evaluate(async ({ url, x, y, w, h }) => {
  const img = new Image(); img.src = url; await img.decode();
  const c = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height });
  const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(x, y, w, h).data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
  return sum / (d.length / 4);
}, { url, x, y, w, h });

try {
  {
    // Slow download (phase A observable) and the desktop icons held (phase B, for the hand-over check).
    const { page, errors, release } = await open({ throttle: true, holdIcons: true });
    await page.waitForFunction(() => document.body.classList.contains('orbit-live'), null, { timeout: 60000 });
    await page.waitForFunction(() => !document.body.classList.contains('screen-zooming'));
    const { early, events } = await log(page);
    assert.ok(early && !early.scene, 'the bar moved before the scene existed');
    assert.equal(early.bg, 'rgb(0, 0, 0)', 'only black around the tube while loading');
    assert.ok(early.box[2] < 1440 * 0.8 && early.box[3] < 900 * 0.9, `the loader is inside the screen, not the viewport: ${early.box}`);
    const fly = events.indexOf('fly');
    assert.ok(fly > 0 && progressOf(events.slice(0, fly)).at(-1) < 100, `the fly-out starts before 100%: ${events}`);
    assert.ok(await has(page, 'intro') === false && !(await has(page, 'intro-ready')), 'phase B still running at the desk');

    // The hand-over at the screen while phase B holds: the shader's boot screen just before arrival
    // against the live DOM just after, and the DOM box against where the loader sat before the GLB.
    const before = await average(page, await page.evaluate(() => { window.__flyTo(0.985); return document.querySelector('#scene').toDataURL(); }));
    await page.evaluate(() => window.__flyTo(1));
    await page.waitForTimeout(400);
    const after = await average(page, await shot(page));
    const gap = before.map((v, i) => Math.abs(v - after[i]));
    assert.ok(Math.max(...gap) <= HANDOVER_MAX, `boot screen hand-over colour jump ${gap.map((v) => v.toFixed(1))} > ${HANDOVER_MAX}`);
    const box = await page.evaluate(() => { const r = document.querySelector('#screen').getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; });
    assert.ok(box.every((v, i) => Math.abs(v - early.box[i]) <= 1), `the loader sat where the scene's screen lands: ${early.box} vs ${box}`);
    assert.equal(await page.locator('#boot').isVisible(), true, 'zoomed back in mid-load: still the boot screen');
    await page.evaluate(() => window.__flyTo(0));
    release();

    await page.waitForFunction(() => document.body.classList.contains('intro-ready'), null, { timeout: 15000 });
    const progress = progressOf((await log(page)).events);
    assert.ok(progress.every((v, i) => !i || v >= progress[i - 1]), `progress never goes back: ${progress}`);
    assert.equal(progress.at(-1), 100);
    assert.ok(progress.some((v) => v > 0 && v < 80) && progress.some((v) => v > 80 && v < 100), `both phases move the bar: ${progress}`);
    assert.ok(await page.evaluate(() => window.__orbit().enabled), 'the desk is usable while "click me" shows');
    assert.equal(await page.locator('#intro-cta span:first-child').textContent(), UI.introCta);

    // "click me" is on the monitor (the CRT shader's picture): its text is brighter than the tube below it.
    const cta = await page.locator('#intro-cta span:first-child').boundingBox();
    const text = [cta.x, cta.y, cta.width, cta.height].map(Math.round);
    const picture = await shot(page);
    const [lit, dark] = [await luma(page, picture, text), await luma(page, picture, [text[0], text[1] + 2 * text[3], text[2], text[3]])];
    assert.ok(lit > dark + 8, `"${UI.introCta}" shows on the monitor (${lit.toFixed(1)} vs ${dark.toFixed(1)})`);

    // A real click on it (pointer-events: nothing in front of the canvas may swallow it).
    await page.mouse.click(cta.x + cta.width / 2, cta.y + cta.height / 2);
    await page.waitForFunction(() => document.body.classList.contains('screen-zooming'), null, { timeout: 2000 });
    await page.waitForFunction(() => !document.body.classList.contains('screen-zooming'), null, { timeout: 5000 });
    assert.equal(await has(page, 'screen-focused'), true, 'it lands on the screen');
    assert.ok((await log(page)).events.lastIndexOf('fly') > fly, 'it flies in');
    await page.locator('#boot').waitFor({ state: 'hidden', timeout: 2000 });
    assert.equal(await page.evaluate(() => document.activeElement.id), 'login-user', 'the login takes over');
    assert.deepEqual(errors, []);
    console.log(`PASS first visit: loader in the screen ${early.box.map(Math.round)}, fly-out at ${progressOf(events.slice(0, fly)).at(-1)}%, hand-over ${gap.map((v) => v.toFixed(1))}, "${UI.introCta}" on the monitor, click flies in`);
    await page.close();
  }

  {
    const { page, errors } = await open({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.body.classList.contains('intro-ready'), null, { timeout: 30000 });
    assert.ok(!(await log(page)).events.includes('fly'), 'reduced motion cuts out to the desk');
    assert.ok(Math.abs((await page.evaluate(() => window.__orbit())).swing) < 0.01, 'on the overview');
    await page.keyboard.press('Space');
    await page.waitForFunction(() => document.body.classList.contains('screen-focused'));
    assert.ok(!(await log(page)).events.includes('fly'), 'and cuts back in');
    assert.equal(await page.locator('#boot').isVisible(), false);
    assert.deepEqual(errors, []);
    console.log('PASS reduced motion: cut out, "click me", Space cuts in');
    await page.close();
  }

  {
    const { page, errors } = await open();
    await page.waitForFunction(() => document.body.classList.contains('intro-ready'), null, { timeout: 30000 });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.body.classList.contains('screen-focused'));
    assert.deepEqual(errors, []);
    console.log('PASS Enter on "click me" zooms in');
    await page.close();
  }

  {
    const { page, errors } = await open({ returning: true });
    await page.waitForFunction(() => document.body.classList.contains('orbit-live'), null, { timeout: 30000 });
    await page.locator('#boot').waitFor({ state: 'hidden', timeout: 5000 });
    assert.equal(await has(page, 'screen-focused'), false);
    assert.ok(!(await log(page)).events.includes('cta'), 'without waiting on "click me"');
    assert.ok((await log(page)).events.includes('fly'), 'after the same fly-out');
    assert.deepEqual(errors, []);
    console.log('PASS returning visit ends on the desk with the normal screen');
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
