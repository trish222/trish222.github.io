import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://127.0.0.1:4320/';
const browser = await chromium.launch({ channel: 'chromium' });
try {
  for (const [width, height, dpr, touch, reducedMotion] of [
    [1440, 900, 1, false, 'no-preference'],
    [1440, 900, 2, false, 'no-preference'],
    [390, 844, 3, true, 'no-preference'],
    [390, 844, 3, true, 'reduce'],
  ]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr,
      isMobile: touch, hasTouch: touch, reducedMotion });
    const page = await context.newPage();
    const errors = [];
    const missing = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) missing.push(response.url());
    });
    await page.addInitScript(() => {
      window.__canvasWrites = 0;
      window.__gpuAllocations = 0;
      window.__measureAllocations = false;
      for (const name of ['texImage2D', 'bufferData', 'compileShader', 'linkProgram']) {
        const original = WebGL2RenderingContext.prototype[name];
        WebGL2RenderingContext.prototype[name] = function (...args) {
          if (window.__measureAllocations) window.__gpuAllocations++;
          return original.apply(this, args);
        };
      }
      for (const key of ['width', 'height']) {
        const descriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, key);
        Object.defineProperty(HTMLCanvasElement.prototype, key, { ...descriptor, set(value) {
          if (this.id === 'scene') window.__canvasWrites++;
          descriptor.set.call(this, value);
        } });
      }
    });
    await page.goto(url);
    await page.waitForFunction(() => performance.getEntriesByName('room:interactive').length);
    await page.waitForFunction(() => window.__stillReady?.());
    await page.waitForTimeout(300);
    const initial = await page.evaluate(() => ({ width: scene.width, height: scene.height, orbit: window.__orbit() }));
    await page.evaluate(() => { window.__canvasWrites = 0; window.__measureAllocations = true; });
    // A drag, reversal, damping glide, and automatic walk home must never
    // reallocate the drawing buffer or accidentally activate the monitor.
    await page.mouse.move(width * .8, height * .8);
    await page.mouse.down();
    await page.mouse.move(width * .7, height * .77, { steps: 12 });
    await page.mouse.move(width * .84, height * .82, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(reducedMotion === 'reduce' ? 200 : 5000);
    assert.equal(await page.evaluate(() => window.__canvasWrites), 0, 'camera motion must not resize WebGL canvas');
    assert.equal(await page.evaluate(() => window.__gpuAllocations), 0, 'camera motion must reuse textures, buffers, and shader programs');
    await page.evaluate(() => { window.__measureAllocations = false; });
    assert.deepEqual(await page.locator('#scene').evaluate(c => [c.width, c.height]), [initial.width, initial.height]);
    assert.equal(await page.locator('body').evaluate(b => b.classList.contains('screen-active')), false);
    if (reducedMotion !== 'reduce') {
      const orbit = await page.evaluate(() => window.__orbit());
      assert.ok(Math.abs(orbit.swing) < .2 && Math.abs(orbit.rise) < .2, 'idle camera returns home');
    }
    if (dpr === 1) {
      // Browser zoom / moving between displays can change DPR after startup.
      const client = await context.newCDPSession(page);
      await client.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: false });
      await page.waitForFunction(() => document.querySelector('#scene').width === 2160);
      await page.waitForTimeout(300);
      await page.evaluate(() => { window.__canvasWrites = window.__gpuAllocations = 0; window.__measureAllocations = true; });
      await page.mouse.move(width * .8, height * .8);
      await page.mouse.down();
      await page.mouse.move(width * .75, height * .79, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(300);
      assert.equal(await page.evaluate(() => window.__canvasWrites), 0, 'DPR change prepares a stable canvas before dragging');
      assert.equal(await page.evaluate(() => window.__gpuAllocations), 0, 'DPR change prewarms motion buffers before dragging');
      await page.evaluate(() => { window.__measureAllocations = false; });
      await client.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
      await page.waitForFunction(() => document.querySelector('#scene').width === 1440);
    }
    await page.evaluate(() => window.__orbit(0, 0));
    const home = await page.evaluate(() => window.__camera.position.toArray());
    assert.ok(Math.abs(await page.evaluate(() => window.__orbit().front)) < .1, 'opening faces the monitor head-on');
    await page.evaluate(() => window.__enter());
    await page.waitForFunction(() => document.body.classList.contains('screen-focused'));
    assert.equal(await page.evaluate(() => window.__orbit().enabled), false, 'flight owns the camera');
    await page.locator('#login-user').fill('Trish');
    await page.locator('.login-dialog button.default').click();
    await page.waitForFunction(() => document.body.classList.contains('signed-in'));
    if (touch) await page.waitForFunction(() => document.body.classList.contains('glass-fullscreen'));
    await page.locator('#start-button').click();
    await page.locator('.start-menu-item[data-window="resume"]').click();
    await page.locator('#window-resume').waitFor({ state: 'visible' });
    const content = page.locator('#window-resume .window-body');
    const scroll = await content.evaluate(el => {
      el.scrollTop = el.scrollHeight;
      return { top: el.scrollTop, max: el.scrollHeight - el.clientHeight };
    });
    assert.ok(scroll.max <= 0 || scroll.top > 0, 'resume content remains scrollable');
    assert.ok(await page.locator('#window-resume a[href]').count(), 'resume links remain present');
    if (touch) assert.equal(await page.locator('#window-resume').getAttribute('data-maximized'), 'true');
    else {
      const title = page.locator('#window-resume .window-titlebar');
      const rect = await title.boundingBox();
      const left = await page.locator('#window-resume').evaluate(el => el.offsetLeft);
      await page.mouse.move(rect.x + 60, rect.y + rect.height / 2);
      await page.mouse.down();
      await page.mouse.move(rect.x + 110, rect.y + rect.height / 2 + 15, { steps: 5 });
      await page.mouse.up();
      assert.ok(await page.locator('#window-resume').evaluate(el => el.offsetLeft) > left, 'desktop window drag works');
    }
    await page.locator('#start-button').click();
    await page.locator('#logoff-item').click();
    await page.waitForFunction(() => !document.body.classList.contains('signed-in') && !document.body.classList.contains('glass-fullscreen'));
    await page.waitForFunction(() => document.body.classList.contains('screen-focused'));
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.body.classList.contains('orbit-live'));
    const back = await page.evaluate(() => window.__camera.position.toArray());
    assert.ok(Math.abs(await page.evaluate(() => window.__orbit().front) - 37) < .1, 'return navigation restores the isometric room view');
    assert.ok(back[2] > home[2], 'room overview pulls back from the seated opening');
    await page.setViewportSize({ width: width - 10, height: height - 10 });
    await page.waitForTimeout(200);
    const raster = await page.locator('#scene').evaluate(c => ({ width: c.width, height: c.height, cssWidth: c.clientWidth, cssHeight: c.clientHeight }));
    const ratio = Math.min(dpr, width < 560 ? 2 : 1.5);
    assert.equal(raster.width, Math.floor(raster.cssWidth * ratio));
    assert.equal(raster.height, Math.floor(raster.cssHeight * ratio));
    assert.deepEqual(errors, []);
    assert.deepEqual(missing, []);
    console.log(`PASS ${width}x${height} DPR ${dpr} ${reducedMotion}: orbit, fixed buffers, flight, login, windows, scrolling, links, logoff, resize`);
    await context.close();
  }
} finally { await browser.close(); }
