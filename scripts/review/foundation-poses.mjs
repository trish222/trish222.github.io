import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const output = '.review-artifacts/foundation/poses';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    window.__auditRAF = raf;
    window.requestAnimationFrame = fn => raf(t => { if (!window.__auditFrozen) fn(t); });
  });
  await page.goto('http://127.0.0.1:4321/?diagnostics=1');
  await page.waitForFunction(() => window.__stillReady?.());
  await page.waitForTimeout(2000);
  await page.evaluate(async () => {
    window.__orbit(0, 0); window.__auditFrozen = true;
    const module = await import('/scripts/review/foundation-variants.js');
    window.__foundation = await module.install();
    window.__candidates = [module.stages.best[0], module.stages.best[3]];
  });
  const metadata = [];
  for (const pose of ['home', 'turn', 'entered', 'lamp-off']) {
    for (const index of [0, 1]) {
      const state = await page.evaluate(async ({ pose, index }) => {
        window.__lamp({ on: pose !== 'lamp-off', jump: true });
        window.__flyTo(pose === 'entered' ? 1 : 0);
        if (pose !== 'entered') window.__orbit(pose === 'turn' ? 7 : 0, pose === 'turn' ? 4 : 0);
        const variant = window.__candidates[index];
        window.__foundation.configure(variant);
        for (let i = 0; i < 10; i++) { await new Promise(window.__auditRAF); window.__composer.render(); }
        return { pose, variant: variant.name, camera: window.__camera.position.toArray(), quaternion: window.__camera.quaternion.toArray(),
          lamp: window.__lamp().on, lights: window.__lights(), filter: getComputedStyle(document.querySelector('#screen-page')).filter,
          transform: document.querySelector('#screen').style.transform };
      }, { pose, index });
      await page.screenshot({ path: `${output}/${pose}-${state.variant}.png` });
      metadata.push(state);
    }
  }
  // The interactive login is opaque HTML over the canvas. Its exact pixels must
  // remain identical when only the WebGL buffer resolution changes.
  await page.evaluate(() => { window.__lamp({ on: true }); window.__flyTo(1); });
  await page.addStyleTag({ content: '#screen input { caret-color: transparent !important; }' });
  const text = [];
  for (const dpr of [1, 1.5, 2]) {
    const state = await page.evaluate(dpr => {
      const c = window.__composer, r = c.renderer;
      r.setPixelRatio(dpr); c.setPixelRatio(dpr); c.render();
      return { dpr, buffer: [r.domElement.width, r.domElement.height],
        bounds: document.querySelector('#screen').getBoundingClientRect().toJSON(),
        transform: document.querySelector('#screen').style.transform };
    }, dpr);
    const pixels = await page.locator('.login-dialog').screenshot({ path: `${output}/html-dpr${dpr}.png` });
    text.push({ ...state, sha256: createHash('sha256').update(pixels).digest('hex') });
  }
  await writeFile(`${output}/metadata.json`, JSON.stringify({ metadata, text }, null, 2));
  console.log(JSON.stringify({ text }));
} finally { await browser.close(); }
