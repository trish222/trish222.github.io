import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const target = new URL(process.argv[2] || 'http://127.0.0.1:4320/');
target.searchParams.set('diagnostics', '1');
const url = target.href;
const output = process.argv[3] || '.review-artifacts/current';
await mkdir(output, { recursive: true });
const metadata = [];
const browser = await chromium.launch({ channel: 'chromium' });
try {
  for (const [width,height] of [[1440,900],[390,844],[650,900]]) {
    const page = await browser.newPage({ viewport: { width,height }, reducedMotion: 'reduce' });
    await page.goto(url);
    await page.waitForFunction(() => performance.getEntriesByName('room:interactive').length);
    await page.waitForFunction(() => window.__stillReady?.());
    await page.waitForTimeout(2200);
    metadata.push(await page.evaluate(() => {
      const hint = document.getElementById('orbit-hint');
      const style = getComputedStyle(hint);
      return { width: innerWidth, classes: document.body.className, hint: {hidden: hint.hidden, opacity: style.opacity, display: style.display}, camera: window.__camera.position.toArray() };
    }));
    await page.screenshot({ path: `${output}/home-${width}.png` });
    await page.evaluate(() => window.__enter());
    await page.waitForFunction(() => document.body.classList.contains('screen-focused'));
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${output}/monitor-${width}.png` });
    await page.close();
  }
} finally { await browser.close(); }
console.log(`Captured home and monitor states in ${output}`);

await writeFile(`${output}/metadata.json`, JSON.stringify(metadata, null, 2));
console.log(JSON.stringify(metadata));
