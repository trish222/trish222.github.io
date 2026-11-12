import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chromium' });
try {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(process.argv[2] || 'http://127.0.0.1:4321/');
  await page.waitForFunction(() => window.__stillReady?.());
  const result = await page.evaluate(async () => {
    // Use Vite's loaded module URL, including its HMR timestamp. Importing
    // the bare path can create a second scene instance beside the desktop's.
    const sceneURL = performance.getEntriesByType('resource')
      .filter(entry => new URL(entry.name).pathname === '/src/scene.js').at(-1).name;
    const scene = await import(sceneURL);
    const oldScene = window.__scene;
    scene.disposeScene();
    const removed = !window.__scene && !window.__orbit;
    await new Promise(resolve => setTimeout(resolve, 700));
    const restarted = await scene.initScene(document.getElementById('scene'));
    return { removed, restarted, replaced: window.__scene !== oldScene };
  });
  assert.deepEqual(result, { removed: true, restarted: true, replaced: true });
  await page.waitForFunction(() => window.__stillReady?.());
  await page.evaluate(() => window.__enter());
  await page.waitForFunction(() => document.body.classList.contains('screen-focused'));
  await page.locator('#screen-back').click();
  await page.waitForFunction(() => document.body.classList.contains('orbit-live'));
  await page.evaluate(() => window.__enter());
  await page.waitForFunction(() => document.body.classList.contains('screen-focused'));
  await page.mouse.click(4, 4);
  await page.waitForFunction(() => document.body.classList.contains('orbit-live'));
  await page.evaluate(() => {
    for (const name of ['__cam','__fov','__tonemap','__lights','__lamp','__rain','__gtao','__zoom','__flyFrom','__fit','__shadowfit','__probes','__pixel','__histogram']) window[name]();
    window.__flyTo(.5);
    window.__flyTo(1);
    window.__diveTo(.5);
    window.__diveTo(0);
    window.__flyTo(0);
  });
  assert.deepEqual(errors, []);
  console.log('PASS retained diagnostic reports and camera-seek tools');
  console.log('PASS back-bar and room-click exit routes');
  console.log('PASS disposal, delayed snapshot cancellation, scene reinitialization, and monitor reentry');
  for (const url of ['?desk=classic', '?lamp=lamp']) {
    await page.goto(`http://127.0.0.1:4321/${url}`);
    await page.waitForFunction(() => window.__stillReady?.());
    assert.deepEqual(errors, []);
  }
  console.log('PASS development-only classic desk and cone lamp');
} finally { await browser.close(); }
