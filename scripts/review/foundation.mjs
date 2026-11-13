import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const stage = process.argv[2] || 'ao';
const output = process.argv[3] || `.review-artifacts/foundation/${stage}`;
const trials = Number(process.argv[4] || 1);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium' });
const results = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    window.__auditRAF = raf;
    window.requestAnimationFrame = fn => raf(t => { if (!window.__auditFrozen) fn(t); });
  });
  await page.goto('http://127.0.0.1:4321/?diagnostics=1');
  await page.waitForFunction(() => window.__stillReady?.());
  await page.waitForTimeout(2500);
  const variants = await page.evaluate(async stage => {
    window.__orbit(0, 0); window.__auditFrozen = true;
    const module = await import('/scripts/review/foundation-variants.js');
    window.__foundation = await module.install();
    return module.stages[stage];
  }, stage);
  for (let trial = 0; trial < trials; trial++) {
    for (const variant of trial % 2 ? [...variants].reverse() : variants) {
      const result = await page.evaluate(async ({ variant, trial }) => {
        const configuration = window.__foundation.configure(variant);
        const c = window.__composer, r = c.renderer, gl = r.getContext();
        const next = () => new Promise(window.__auditRAF);
        for (let i = 0; i < 25; i++) { await next(); c.render(); }
        const intervals = [], cpu = [];
        let last = await next();
        for (let i = 0; i < 90; i++) {
          const t = await next(); intervals.push(t - last); last = t;
          const start = performance.now(); c.render(); cpu.push(performance.now() - start);
        }
        intervals.sort((a,b) => a-b); cpu.sort((a,b) => a-b);
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        return { trial, variant, configuration, p50: intervals[45], p95: intervals[85], worst: intervals.at(-1),
          over25: intervals.filter(t => t > 25).length, cpuP50: cpu[45],
          gpu: gl.getParameter(ext.UNMASKED_RENDERER_WEBGL), canvas: [r.domElement.width, r.domElement.height],
          camera: window.__camera.position.toArray(), quaternion: window.__camera.quaternion.toArray() };
      }, { variant, trial });
      if (trial === 0) await page.screenshot({ path: `${output}/${variant.name}.png` });
      results.push(result);
      await writeFile(`${output}/results.json`, JSON.stringify({ results, errors }, null, 2));
      console.log(JSON.stringify(result));
    }
  }
} finally { await browser.close(); }
