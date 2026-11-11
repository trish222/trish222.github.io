import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Run against a production preview. CPU profiles open in Chrome's
// Performance panel; keep reports outside the published public/ directory.
const url = process.env.PROFILE_URL || 'http://127.0.0.1:4320/';
const output = path.resolve(process.argv[2] || process.env.PROFILE_OUTPUT || '.startup-profiles');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium' });
try {
  for (const [name, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.__startupGL = {};
      for (const method of ['compileShader', 'linkProgram', 'bufferData', 'texImage2D']) {
        const original = WebGL2RenderingContext.prototype[method];
        WebGL2RenderingContext.prototype[method] = function (...args) {
          const start = performance.now();
          try { return original.apply(this, args); }
          finally {
            const entry = window.__startupGL[method] ||= { calls: 0, ms: 0 };
            entry.calls++;
            entry.ms += performance.now() - start;
          }
        };
      }
    });
    const client = await context.newCDPSession(page);
    await client.send('Network.enable');
    await client.send('Network.setCacheDisabled', { cacheDisabled: true });
    await client.send('Profiler.enable');
    await client.send('Profiler.start');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => performance.getEntriesByName('room:interactive').length, { timeout: 120000 });
    const { profile } = await client.send('Profiler.stop');
    const result = await page.evaluate(() => {
      const canvas = document.querySelector('#scene');
      const gl = canvas.getContext('webgl2');
      const extension = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        marks: Object.fromEntries(performance.getEntriesByType('mark').filter(e => e.name.startsWith('room:')).map(e => [e.name, Math.round(e.startTime)])),
        gl: window.__startupGL,
        renderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        resources: performance.getEntriesByType('resource').map(e => ({ name: new URL(e.name).pathname, duration: Math.round(e.duration), bytes: e.transferSize })),
      };
    });
    result.errors = errors;
    const samples = new Map();
    const nodes = new Map(profile.nodes.map(node => [node.id, node.callFrame]));
    profile.samples?.forEach((id, index) => {
      const frame = nodes.get(id);
      const key = `${frame.functionName || '(anonymous)'} ${frame.url ? new URL(frame.url).pathname : ''}:${frame.lineNumber + 1}`;
      samples.set(key, (samples.get(key) || 0) + (profile.timeDeltas[index] || 0) / 1000);
    });
    result.cpu = [...samples].sort((a,b) => b[1]-a[1]).slice(0, 20).map(([functionName, ms]) => ({ functionName, ms: Math.round(ms) }));
    await writeFile(path.join(output, `${name}.cpuprofile`), JSON.stringify(profile));
    await writeFile(path.join(output, `${name}.json`), JSON.stringify(result, null, 2));
    await page.screenshot({ path: path.join(output, `${name}.png`), timeout: 120000 });
    console.log(name, JSON.stringify({ marks: result.marks, renderer: result.renderer, errors }));
    console.log(`Saved CPU profile, timing report, and screenshot in ${output}`);
    await context.close();
  }
} finally {
  await browser.close();
}
