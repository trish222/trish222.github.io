import { chromium } from 'playwright';
import { access, constants } from 'node:fs/promises';

const executable = chromium.executablePath();
await access(executable, constants.X_OK);
console.log(JSON.stringify({ executable, platform: process.platform, arch: process.arch }));
// Each mode is attempted once. macOS uses WindowServer, not DISPLAY/X11.
for (const headless of [true, false]) {
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chromium', headless, timeout: 15000 });
    const page = await browser.newPage();
    await page.setContent('<title>Playwright browser check</title><canvas id="gpu"></canvas>');
    const result = await page.evaluate(() => {
      const gl = document.querySelector('canvas').getContext('webgl2');
      const info = gl?.getExtension('WEBGL_debug_renderer_info');
      return {
        title: document.title, webgl2: !!gl,
        renderer: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl?.getParameter(gl.RENDERER),
      };
    });
    console.log(JSON.stringify({ headless, version: browser.version(), ...result, ok: true }));
  } catch (error) {
    console.error(JSON.stringify({ headless, ok: false, error: String(error) }));
    process.exitCode = 1;
  } finally {
    await browser?.close();
  }
}
