import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const output = process.argv[2] || '.review-artifacts/foundation/production';
const urls = [
  ['before', process.argv[3] || 'http://127.0.0.1:4323/?diagnostics=1'],
  ['after', process.argv[4] || 'http://127.0.0.1:4320/?diagnostics=1'],
];
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium' });
const results = [];
try {
  for (let trial = 0; trial < 3; trial++) {
    for (const [name, url] of trial % 2 ? [...urls].reverse() : urls) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(() => {
        const raf = window.requestAnimationFrame.bind(window);
        window.__auditRAF = raf;
        window.requestAnimationFrame = fn => raf(t => { if (!window.__auditFrozen) fn(t); });
      });
      await page.goto(url);
      await page.waitForFunction(() => window.__stillReady?.());
      await page.waitForTimeout(2000);
      const result = await page.evaluate(async () => {
        window.__orbit(0, 0); window.__auditFrozen = true;
        const c = window.__composer, r = c.renderer, gl = r.getContext();
        const next = () => new Promise(window.__auditRAF);
        for (let i = 0; i < 25; i++) { await next(); c.render(); }
        let last = await next();
        const frames = [];
        for (let i = 0; i < 120; i++) {
          const t = await next(); frames.push(t - last); last = t; c.render();
        }
        frames.sort((a,b) => a-b);
        const ao = c.passes.find(p => p.gtaoMaterial);
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        return { p50: frames[60], p95: frames[114], worst: frames.at(-1), over25: frames.filter(t => t > 25).length,
          mean: frames.reduce((a,b) => a+b, 0) / frames.length,
          gpu: gl.getParameter(ext.UNMASKED_RENDERER_WEBGL), canvas: [r.domElement.width, r.domElement.height],
          ao: { size: [ao.width, ao.height], samples: ao.gtaoMaterial.defines.SAMPLES },
          camera: window.__camera.position.toArray(), quaternion: window.__camera.quaternion.toArray(),
          lights: window.__lights(), marks: Object.fromEntries(performance.getEntriesByType('mark').filter(m => m.name.startsWith('room:')).map(m => [m.name, m.startTime])) };
      });
      if (trial === 0) {
        for (const pose of ['home', 'turn', 'entered', 'lamp-off']) {
          await page.evaluate(async pose => {
            window.__lamp({ on: pose !== 'lamp-off', jump: true });
            window.__flyTo(pose === 'entered' ? 1 : 0);
            if (pose !== 'entered') window.__orbit(pose === 'turn' ? 7 : 0, pose === 'turn' ? 4 : 0);
            for (let i = 0; i < 5; i++) { await new Promise(window.__auditRAF); window.__composer.render(); }
          }, pose);
          await page.screenshot({ path: `${output}/${name}-${pose}.png` });
        }
      }
      results.push({ name, trial, ...result, errors });
      await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
      console.log(JSON.stringify({ name, trial, ...result, errors }));
      await page.close();
    }
  }
} finally { await browser.close(); }
