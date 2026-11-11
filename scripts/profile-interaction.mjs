import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

// External instrumentation works on production and Pages without shipping a meter.
// Alternate origins each trial to reduce driver warming / machine load bias.
const urls = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
if (!urls.length) urls.push('http://127.0.0.1:4320/', 'https://trish222.github.io/');
const option = (name, fallback) => process.argv.find(arg => arg.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? fallback;
const output = path.resolve(option('output', process.env.PROFILE_OUTPUT || '.interaction-profiles'));
const trials = Number(option('trials', process.env.TRIALS || 3));
const width = Number(option('width', process.env.WIDTH || 1440));
const height = Number(option('height', process.env.HEIGHT || 900));
const dpr = Number(option('dpr', process.env.DPR || 1));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', headless: !process.argv.includes('--headed') });
const results = [];
try {
  for (let trial = 0; trial < trials; trial++) {
    for (const url of trial % 2 ? [...urls].reverse() : urls) {
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr,
        isMobile: process.argv.includes('--touch'), hasTouch: process.argv.includes('--touch') });
      const page = await context.newPage();
      const errors = [];
      const failedRequests = [];
      const assets = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
      page.on('requestfailed', req => failedRequests.push({ url: req.url(), error: req.failure() }));
      page.on('response', response => {
        if (response.status() >= 400) failedRequests.push({ url: response.url(), status: response.status() });
      });
      console.log(`Starting trial ${trial + 1}/${trials}: ${url} (${width}x${height}, DPR ${dpr})`);
      await page.addInitScript(() => {
        const data = window.__interactionProbe = { frames: [], longTasks: [], gl: {}, sizes: [], canvasWrites: 0, cameraFrames: 0, lastCamera: null, active: false };
        for (const key of ['width', 'height']) {
          const descriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, key);
          Object.defineProperty(HTMLCanvasElement.prototype, key, {
            ...descriptor,
            set(value) {
              if (data.active && this.id === 'scene') data.canvasWrites++;
              descriptor.set.call(this, value);
            },
          });
        }
        new PerformanceObserver(list => {
          if (data.active) data.longTasks.push(...list.getEntries().map(e => ({ start: e.startTime, ms: e.duration })));
        }).observe({ type: 'longtask', buffered: true });
        for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced',
          'compileShader', 'linkProgram', 'getProgramParameter', 'texImage2D', 'texSubImage2D',
          'bufferData', 'renderbufferStorageMultisample']) {
          const original = WebGL2RenderingContext.prototype[name];
          WebGL2RenderingContext.prototype[name] = function (...args) {
            if (data.active) data.gl[name] = (data.gl[name] || 0) + 1;
            return original.apply(this, args);
          };
        }
        function tick(t) {
          if (data.active) {
            data.frames.push(t);
            const position = window.__camera?.position;
            if (position) {
              const last = data.lastCamera;
              if (last && (last.x !== position.x || last.y !== position.y || last.z !== position.z)) data.cameraFrames++;
              data.lastCamera = { x: position.x, y: position.y, z: position.z };
            }
            const c = document.querySelector('#scene');
            const last = data.sizes.at(-1);
            if (c && (!last || c.width !== last.width || c.height !== last.height)) {
              data.sizes.push({ t, width: c.width, height: c.height });
            }
          }
          requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      });
      const client = await context.newCDPSession(page);
      await client.send('Network.enable');
      await client.send('Network.setCacheDisabled', { cacheDisabled: true });
      const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
      // Compare loaded entry bytes, not just filenames or a GitHub branch label.
      const entries = await page.locator('script[src], link[rel="stylesheet"]').evaluateAll(els => els.map(e => e.src || e.href));
      for (const entry of entries) {
        const res = await context.request.get(entry);
        const bytes = await res.body();
        const relative = new URL(entry).pathname.slice(1);
        let matchesLocal = false;
        try { matchesLocal = bytes.equals(await readFile(path.join('dist', relative))); } catch { /* old artifact */ }
        assets.push({ path: relative, status: res.status(), sha256: createHash('sha256').update(bytes).digest('hex'), matchesLocal });
      }
      await page.waitForFunction(() => performance.getEntriesByName('room:interactive').length, null, { timeout: 120000 });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(() => window.__stillReady?.(), null, { timeout: 30000 });
      await page.waitForTimeout(2000);
      await page.evaluate(() => window.__flyTo?.(0));
      await page.waitForTimeout(500);
      if (process.argv.includes('--fixed-resolution') || process.argv.includes('--fixed-canvas')) {
        // Diagnostic A/B only: keep the already allocated high-density canvas
        // and composer buffers while the app still switches its AO motion pass.
        await page.evaluate(() => {
          const c = window.__composer;
          if (!c) throw new Error('Fixed-resolution diagnostic needs the desktop composer');
          c.renderer.setPixelRatio = () => {};
        });
        if (process.argv.includes('--fixed-resolution')) await page.evaluate(() => { window.__composer.setPixelRatio = () => {}; });
      }
      const environment = await page.evaluate(async () => {
        const canvas = document.querySelector('#scene');
        const gl = canvas.getContext('webgl2');
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        let meshes = 0, instances = 0, triangles = 0;
        window.__scene?.traverse(o => {
          if (!o.isMesh) return;
          meshes++;
          instances += o.isInstancedMesh ? o.count : 1;
          triangles += (o.geometry.index?.count ?? o.geometry.attributes.position?.count ?? 0) / 3 * (o.isInstancedMesh ? o.count : 1);
        });
        return {
          userAgent: navigator.userAgent, dpr: devicePixelRatio,
          viewport: [innerWidth, innerHeight], canvas: [canvas.width, canvas.height],
          renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
          composer: !!window.__composer, meshes, instances, triangles,
          serviceWorkers: navigator.serviceWorker ? (await navigator.serviceWorker.getRegistrations()).map(r => r.scope) : [],
          startup: Object.fromEntries(performance.getEntriesByType('mark').filter(e => e.name.startsWith('room:')).map(e => [e.name, e.startTime])),
        };
      });
      const phases = {};
      async function measure(name, action) {
        if (process.argv.includes('--cpu')) {
          await client.send('Profiler.enable');
          await client.send('Profiler.start');
        }
        await page.evaluate(() => {
          Object.assign(window.__interactionProbe, { frames: [], longTasks: [], gl: {}, sizes: [], canvasWrites: 0, cameraFrames: 0, lastCamera: null, active: true });
        });
        await action();
        phases[name] = await page.evaluate(() => {
          const d = window.__interactionProbe;
          d.active = false;
          const deltas = d.frames.slice(1).map((t, i) => t - d.frames[i]);
          const sorted = [...deltas].sort((a, b) => a - b);
          const quantile = q => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
          const mean = deltas.reduce((sum, x) => sum + x, 0) / deltas.length;
          return { frames: d.frames.length, fps: 1000 / mean, mean, p50: quantile(.5), p95: quantile(.95),
            worst: sorted.at(-1), over25: deltas.filter(x => x > 25).length, over33: deltas.filter(x => x > 33.4).length,
            gl: d.gl, sizes: d.sizes, canvasWrites: d.canvasWrites, cameraFrames: d.cameraFrames, longTasks: d.longTasks, orbit: window.__orbit?.(), deltas };
        });
        if (process.argv.includes('--cpu')) {
          const { profile } = await client.send('Profiler.stop');
          await writeFile(path.join(output, `${results.length}-${name}.cpuprofile`), JSON.stringify(profile));
        }
      }
      await measure('idle', () => page.waitForTimeout(2000));
      // Real input, delivered at one event per animation frame. Stay off monitor/lamp.
      // The repeating path changes direction sharply without touching orbit limits.
      await measure('drag', async () => {
        await page.mouse.move(width * .8, height * .8);
        await page.mouse.down();
        for (let i = 0; i < 180; i++) {
          const x = width * .8 + Math.sin(i / 15 * Math.PI) * width * .07;
          const y = height * .8 + Math.sin(i / 30 * Math.PI) * height * .025;
          await page.mouse.move(x, y);
          await page.evaluate(() => new Promise(requestAnimationFrame));
        }
        await page.mouse.up();
      });
      await measure('settle-return', () => page.waitForTimeout(5000));
      await page.evaluate(() => window.__orbit?.(0, 0));
      await page.waitForTimeout(500);
      await measure('fly-in', async () => {
        await page.evaluate(() => window.__enter());
        await page.waitForFunction(() => document.body.classList.contains('screen-focused'));
      });
      await measure('fly-out', async () => {
        await page.locator('#screen-back').click();
        await page.waitForFunction(() => document.body.classList.contains('orbit-live'));
      });
      const validDrag = phases.drag.cameraFrames > 10;
      if (!validDrag) console.warn('INVALID DRAG: camera did not move reliably; do not use this trial as interaction evidence.');
      const result = { url, trial, validDrag, fixedResolutionDiagnostic: process.argv.includes('--fixed-resolution'), fixedCanvasDiagnostic: process.argv.includes('--fixed-canvas'), environment, assets, headers: await response.allHeaders(), errors, failedRequests, phases };
      results.push(result);
      await writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
      console.log(JSON.stringify({ url, trial, validDrag, renderer: environment.renderer, assetsMatch: assets.every(a => a.matchesLocal), errors,
        phases: Object.fromEntries(Object.entries(phases).map(([name, { deltas, orbit, ...stats }]) => [name, stats])) }));
      await context.close();
    }
  }
} finally {
  await browser.close();
}
console.log(`Saved ${results.length} trials in ${output}`);
