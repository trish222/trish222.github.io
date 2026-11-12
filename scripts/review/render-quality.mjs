import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

// Diagnostic only: freeze application scheduling after warm-up, then render the
// same scene/camera through one changed setting at a time. No shipped settings.
const url = process.argv[2] || 'http://127.0.0.1:4320/?diagnostics=1';
const output = process.argv[3] || '.review-artifacts/render-quality';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium' });
const results = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    window.__auditRAF = raf;
    window.requestAnimationFrame = fn => raf(t => { if (!window.__auditFrozen) fn(t); });
  });
  await page.goto(url);
  await page.waitForFunction(() => window.__stillReady?.());
  await page.waitForTimeout(2500);
  await page.evaluate(() => { window.__orbit(0, 0); window.__auditFrozen = true; });
  const inventory = await page.evaluate(() => {
    const c = window.__composer, r = c.renderer, gl = r.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const textures = new Map(), materials = new Set();
    let meshes = 0, triangles = 0;
    window.__scene.traverse(o => {
      if (!o.isMesh) return;
      meshes++;
      triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1);
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        materials.add(m);
        for (const key of ['map', 'bumpMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'envMap']) {
          const t = m[key];
          if (t && !textures.has(t.uuid)) textures.set(t.uuid, { slot: key, width: t.image?.width, height: t.image?.height,
            colorSpace: t.colorSpace, anisotropy: t.anisotropy, mipmaps: t.generateMipmaps,
            minFilter: t.minFilter, magFilter: t.magFilter, source: t.image?.src || 'generated' });
        }
      }
    });
    return { userAgent: navigator.userAgent, dpr: devicePixelRatio,
      viewport: [innerWidth, innerHeight], canvas: [r.domElement.width, r.domElement.height],
      css: { rect: r.domElement.getBoundingClientRect().toJSON(), filter: getComputedStyle(r.domElement).filter,
        transform: getComputedStyle(r.domElement).transform },
      gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      context: gl.getContextAttributes(), maxSamples: gl.getParameter(gl.MAX_SAMPLES),
      maxTextureSize: r.capabilities.maxTextureSize, maxAnisotropy: r.capabilities.getMaxAnisotropy(),
      passes: c.passes.map((p, i) => ({ name: ['RenderPass', 'GTAOPass', 'OutputPass'][i], enabled: p.enabled })),
      targets: [c.renderTarget1, c.renderTarget2].map(t => ({ width: t.width, height: t.height, samples: t.samples, type: t.texture.type })),
      camera: { position: window.__camera.position.toArray(), quaternion: window.__camera.quaternion.toArray(), fov: window.__camera.fov },
      lighting: window.__lights(), toneMapping: window.__tonemap(), shadowType: r.shadowMap.type,
      meshes, triangles, materials: materials.size, textures: [...textures.values()] };
  });
  await writeFile(`${output}/inventory.json`, JSON.stringify(inventory, null, 2));
  for (const trial of [0, 1, 2]) {
    for (const variant of (trial % 2 ? ['dpr2', 'msaa4', 'noAO', 'baseline', 'dpr1'] : ['dpr1', 'baseline', 'noAO', 'msaa4', 'dpr2'])) {
      const result = await page.evaluate(async ({ variant, trial }) => {
        const c = window.__composer, r = c.renderer;
        const ratio = variant === 'dpr1' ? 1 : variant === 'dpr2' ? 2 : 1.5;
        r.setPixelRatio(ratio); c.setPixelRatio(ratio);
        for (const target of [c.renderTarget1, c.renderTarget2]) {
          target.dispose(); target.samples = variant === 'msaa4' ? 4 : 0;
        }
        c.passes.find(p => p.gtaoMaterial).enabled = variant !== 'noAO';
        const next = () => new Promise(window.__auditRAF);
        for (let i = 0; i < 20; i++) { await next(); c.render(); }
        const deltas = [], submit = [];
        let last = await next();
        for (let i = 0; i < 90; i++) {
          const t = await next(); deltas.push(t - last); last = t;
          const start = performance.now(); c.render(); submit.push(performance.now() - start);
        }
        deltas.sort((a,b) => a-b); submit.sort((a,b) => a-b);
        return { trial, variant, ratio, canvas: [r.domElement.width, r.domElement.height],
          target: [c.renderTarget1.width, c.renderTarget1.height], samples: c.renderTarget1.samples,
          p50: deltas[45], p95: deltas[85], worst: deltas.at(-1), over25: deltas.filter(t => t > 25).length,
          cpuSubmitP50: submit[45], cpuSubmitP95: submit[85], camera: window.__camera.position.toArray() };
      }, { variant, trial });
      results.push(result);
      if (trial === 0) await page.screenshot({ path: `${output}/${variant}.png` });
      console.log(JSON.stringify(result));
    }
  }
} finally { await browser.close(); }
await writeFile(`${output}/timings.json`, JSON.stringify(results, null, 2));
