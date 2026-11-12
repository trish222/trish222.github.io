import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const url = process.argv[2] || 'http://127.0.0.1:4320/';
const browser = await chromium.launch({channel:'chromium'});
try {
  for (const [width,height] of [[1440,900],[390,844]]) {
    for (const reducedMotion of ['no-preference','reduce']) {
      const page=await browser.newPage({viewport:{width,height},reducedMotion});
      const errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.goto(url);
      await page.waitForFunction(()=>performance.getEntriesByName('room:interactive').length);
      assert.equal(await page.locator('#scene-poster').count(),0);
      assert.equal(await page.evaluate(()=>document.body.classList.contains('no-scene')),false);
      await page.locator('#lamp-toggle').focus();
      await page.keyboard.press('Space');
      assert.equal(await page.locator('#lamp-toggle').getAttribute('aria-pressed'),'false');
      await page.keyboard.press('Space');
      assert.equal(await page.locator('#lamp-toggle').getAttribute('aria-pressed'),'true');
      const screen=await page.locator('#screen').boundingBox();
      await page.mouse.click(screen.x+screen.width/2,screen.y+screen.height/2);
      await page.waitForFunction(()=>document.body.classList.contains('screen-focused'));
      await page.keyboard.press('Escape');
      await page.waitForFunction(()=>document.body.classList.contains('orbit-live'));
      assert.deepEqual(errors,[]);
      console.log('PASS',width,reducedMotion,'first frame, lamp, monitor flight, Escape');
      await page.close();
    }
  }
  const fallback=await browser.newPage();
  await fallback.addInitScript(()=>{
    const getContext=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){
      return type.startsWith('webgl') ? null : getContext.call(this,type,...args);
    };
  });
  await fallback.goto(url);
  await fallback.waitForFunction(()=>document.body.classList.contains('no-scene'));
  assert.equal(await fallback.locator('#screen').getAttribute('hidden'),null);
  console.log('PASS no-WebGL login fallback');
} finally {await browser.close();}
