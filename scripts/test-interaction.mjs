import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://127.0.0.1:4320/';
const browser = await chromium.launch({ channel: 'chromium' });
try {
  for (const [width, height, dpr, touch, reducedMotion] of [
    [1440, 900, 1, false, 'no-preference'],
    [1440, 900, 2, false, 'no-preference'],
    [1440, 900, 2, false, 'reduce'],
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
    for (const [actual, expected] of initial.orbit.limits.swing.map((v, i) => [v, [-7, 7][i]])) {
      assert.ok(Math.abs(actual - expected) < .01, 'horizontal limits follow the neutral pose by ±7 degrees');
    }
    assert.deepEqual(initial.orbit.limits.rise, [-4, 4]);
    await page.evaluate(() => { window.__canvasWrites = 0; window.__measureAllocations = true; });
    // A drag, reversal, damping glide, and automatic walk home must never
    // reallocate the drawing buffer or accidentally activate the monitor.
    await page.mouse.move(width * .8, height * .8);
    await page.mouse.down();
    await page.mouse.move(width * .15, height * .15, { steps: 12 });
    await page.waitForTimeout(150);
    const heldLeft = await page.evaluate(() => window.__orbit());
    assert.ok(heldLeft.swing > 2 && heldLeft.swing <= 7.01 && heldLeft.rise < -2 && heldLeft.rise >= -4.01,
      `large diagonal drag stays inside the head-turn limits: ${JSON.stringify(heldLeft)}`);
    await page.mouse.move(width * .85, height * .85, { steps: 12 });
    await page.waitForTimeout(150);
    const heldRight = await page.evaluate(() => window.__orbit());
    assert.ok(heldRight.swing < -2 && heldRight.swing >= -7.01 && heldRight.rise > 2 && heldRight.rise <= 4.01,
      `reverse drag stays inside the opposite head-turn limits: ${JSON.stringify(heldRight)}`);
    await page.mouse.up();
    if (reducedMotion !== 'reduce') {
      await page.waitForTimeout(100);
      const returning = await page.evaluate(() => window.__orbit());
      assert.ok(Math.abs(returning.swing) > .05 && Math.abs(returning.swing) < Math.abs(heldRight.swing),
        'release starts a gradual return immediately without snapping');
    }
    await page.waitForTimeout(reducedMotion === 'reduce' ? 100 : 950);
    assert.equal(await page.evaluate(() => window.__canvasWrites), 0, 'camera motion must not resize WebGL canvas');
    assert.equal(await page.evaluate(() => window.__gpuAllocations), 0, 'camera motion must reuse textures, buffers, and shader programs');
    await page.evaluate(() => { window.__measureAllocations = false; });
    assert.deepEqual(await page.locator('#scene').evaluate(c => [c.width, c.height]), [initial.width, initial.height]);
    assert.equal(await page.locator('body').evaluate(b => b.classList.contains('screen-active')), false);
    const centered = await page.evaluate(() => window.__orbit());
    assert.ok(Math.abs(centered.swing) < .01 && Math.abs(centered.rise) < .01, 'release restores the exact neutral pose within one second');
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
    assert.ok(Math.abs(await page.evaluate(() => window.__orbit().front) - 10) < .1, 'opening reveals the monitor casing at a gentle seated angle');
    const elevation = await page.evaluate(() => {
      const direction = window.__camera.getWorldDirection(window.__camera.position.clone());
      return Math.asin(-direction.y) * 180 / Math.PI;
    });
    assert.ok(Math.abs(elevation - 12) < .1, 'opening looks gently downward toward the desk');
    await page.mouse.move(width / 2, height / 2);
    await page.waitForTimeout(1200);
    await page.evaluate(() => {
      const camera = window.__camera;
      const base = camera.position.clone();
      const right = base.clone().set(1, 0, 0).applyQuaternion(camera.quaternion);
      const up = base.clone().set(0, 1, 0).applyQuaternion(camera.quaternion);
      const delta = base.clone();
      const original = camera.updateMatrixWorld;
      window.__parallaxSample = { x: 0, y: 0, max: 0 };
      camera.updateMatrixWorld = function (...args) {
        delta.copy(this.position).sub(base);
        const sample = window.__parallaxSample;
        if (delta.length() > sample.max) {
          sample.x = delta.dot(right);
          sample.y = delta.dot(up);
          sample.max = delta.length();
        }
        return original.apply(this, args);
      };
      window.__restoreCameraSample = () => { camera.updateMatrixWorld = original; };
    });
    await page.mouse.move(width * .9, height * .1);
    await page.waitForTimeout(180);
    const response = await page.evaluate(() => window.__parallaxSample);
    if (!touch && reducedMotion !== 'reduce') {
      assert.ok(response.x < -.18 && response.y < -.15, 'parallax responds visibly within 180ms');
    }
    await page.waitForTimeout(500);
    const parallax = await page.evaluate(() => window.__parallaxSample);
    if (touch || reducedMotion === 'reduce') {
      assert.ok(parallax.max < .0001, 'touch and reduced motion disable passive camera movement');
    } else {
      assert.ok(parallax.x < -.27 && parallax.y < -.22, 'upper-right pointer produces stronger inverted movement on both axes');
      assert.ok(parallax.max <= .42001, 'diagonal movement stays inside the radial cap');
      await page.mouse.move(width - 1, 1);
      await page.waitForTimeout(650);
      const corner = await page.evaluate(() => window.__parallaxSample);
      assert.ok(corner.max > .40 && corner.max <= .42001, 'viewport corner reaches the maximum offset without exceeding it');
      await page.evaluate(() => { window.__parallaxSample.max = 0; });
      await page.mouse.move(width * .1, height * .9);
      await page.waitForTimeout(1200);
      // Discard the first frames while damping reverses the previous offset.
      await page.evaluate(() => { window.__parallaxSample.max = 0; });
      await page.waitForTimeout(100);
      const reversed = await page.evaluate(() => window.__parallaxSample);
      assert.ok(reversed.x > .27 && reversed.y > .22, 'lower-left pointer produces stronger rightward and upward movement');
    }
    const neutral = await page.evaluate(() => window.__camera.position.toArray());
    assert.ok(neutral.every((v, i) => Math.abs(v - home[i]) < .0001), 'parallax never alters the permanent camera pose');
    await page.mouse.move(width / 2, height / 2);
    await page.waitForTimeout(1500);
    await page.evaluate(() => { window.__parallaxSample.max = 0; });
    await page.waitForTimeout(100);
    assert.ok(await page.evaluate(() => window.__parallaxSample.max) < .001, 'pointer centering smoothly restores neutral');
    await page.evaluate(() => window.__restoreCameraSample());
    if (reducedMotion !== 'reduce') {
      // Interrupt a return with a second grab, then with a programmed flight.
      await page.mouse.move(width * .85, height * .85);
      await page.mouse.down();
      await page.mouse.move(width * .2, height * .2, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(150);
      await page.mouse.down();
      const grabbed = await page.evaluate(() => window.__camera.position.toArray());
      await page.waitForTimeout(100);
      const frozen = await page.evaluate(() => window.__camera.position.toArray());
      assert.ok(frozen.every((v, i) => Math.abs(v - grabbed[i]) < .001), 'a new grab cancels the return without stale damping or drift');
      await page.mouse.up();
      await page.waitForTimeout(150);
      const jump = await page.evaluate(() => {
        const before = window.__camera.position.clone();
        window.__enter();
        return before.distanceTo(window.__camera.position);
      });
      assert.ok(jump < .001, 'screen flight interrupts the return without jumping to cached orbit angles');
    } else {
      await page.evaluate(() => window.__enter());
    }
    await page.waitForFunction(() => document.body.classList.contains('screen-focused'));
    assert.equal(await page.evaluate(() => window.__orbit().enabled), false, 'flight owns the camera');
    await page.locator('#login-user').fill('Trish');
    await page.locator('.login-dialog button.default').click();
    await page.waitForFunction(() => document.body.classList.contains('signed-in'));
    if (touch) await page.waitForFunction(() => document.body.classList.contains('glass-fullscreen'));
    await page.locator('#start-button').click();
    await page.locator('.start-menu-item[data-window="resume"]').click();
    await page.locator('#window-resume').waitFor({ state: 'visible' });
    const desktopCamera = await page.evaluate(() => window.__camera.position.toArray());
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
    assert.deepEqual(await page.evaluate(() => window.__camera.position.toArray()), desktopCamera,
      'HTML clicking, scrolling, and window dragging leave the camera untouched');
    await page.locator('#start-button').click();
    await page.locator('#logoff-item').click();
    await page.waitForFunction(() => !document.body.classList.contains('signed-in') && !document.body.classList.contains('glass-fullscreen'));
    await page.waitForFunction(() => document.body.classList.contains('screen-focused'));
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.body.classList.contains('orbit-live'));
    const back = await page.evaluate(() => window.__camera.position.toArray());
    assert.ok(Math.abs(await page.evaluate(() => window.__orbit().front) - 37) < .1, 'return navigation restores the isometric room view');
    assert.ok(back[2] > home[2], 'room overview pulls back from the seated opening');
    const overviewLimits = await page.evaluate(() => window.__orbit().limits.swing);
    assert.ok(Math.abs(overviewLimits[0] + 7) < .01 && Math.abs(overviewLimits[1] - 7) < .01,
      'programmed overview navigation reseeds the limited drag range around its own neutral pose');
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
