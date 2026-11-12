import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chromium' });
try {
  for (const [width,height,touch,fullscreen] of [[560,900,false,true],[561,900,false,true],[650,900,false,true],[760,900,false,true],[761,900,false,false],[844,390,true,true]]) {
    const page = await browser.newPage({ viewport:{width,height}, hasTouch:touch, isMobile:touch, reducedMotion:'reduce' });
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:4320/?diagnostics=1');
    await page.waitForFunction(()=>window.__stillReady?.());
    await page.evaluate(()=>window.__enter());
    await page.locator('.login-dialog button.default').click();
    await page.waitForFunction(()=>document.body.classList.contains('signed-in'));
    assert.equal(await page.locator('body').evaluate(b=>b.classList.contains('glass-fullscreen')),fullscreen);
    await page.locator('#start-button').click();
    await page.locator('.start-menu-item[data-window="resume"]').click();
    assert.equal(await page.locator('#window-resume').getAttribute('data-maximized') === 'true',fullscreen);
    if (!fullscreen) {
      const grip=page.locator('#window-resume > .window-resize');
      const before=await page.locator('#window-resume').evaluate(w=>[w.offsetWidth,w.offsetHeight]);
      await grip.focus();
      await page.keyboard.press('ArrowLeft');
      const after=await page.locator('#window-resume').evaluate(w=>[w.offsetWidth,w.offsetHeight]);
      assert.equal(after[0],before[0]-10,'keyboard resizing uses desktop coordinates');
    }
    assert.deepEqual(errors,[]);
    console.log(`PASS ${width}x${height}: fullscreen=${fullscreen}, window sizing`);
    await page.close();
  }
} finally {await browser.close();}
