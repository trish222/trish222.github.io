import { chromium } from 'playwright';
import {mkdir} from 'node:fs/promises';
const url=process.argv[3] || 'http://127.0.0.1:4320/?diagnostics=1';
const output=process.argv[2] || '/tmp/nameplate-review';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chromium'});
try {
  for (const [name,width,height,deviceScaleFactor] of [['desktop',1440,900,1],['phone',390,844,1],['phone-retina',390,844,3],['tablet',768,1024,2]]) {
    const page=await browser.newPage({viewport:{width,height},deviceScaleFactor});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url);
    await page.waitForFunction(()=>performance.getEntriesByName('room:interactive').length);
    await page.waitForTimeout(300);
    const info=await page.evaluate(()=>{
      const {ndc,world}=window.__fit('nameplate');
      const root=window.__scene.getObjectByName('nameplate');
      let face;
      root.traverse(o=>{if(o.material?.map && o.material?.bumpMap)face=o;});
      return {ndc,world,font:document.fonts.check('500 100px "Playfair Display"'),letterTexture:face.material.map.image.width,metalnessMap:!!face.material.metalnessMap};
    });
    const {ndc}=info;
    const clip={x:Math.max(0,(ndc.x0+1)*width/2-8),y:Math.max(0,(1-ndc.y1)*height/2-8),width:(ndc.x1-ndc.x0)*width/2+16,height:(ndc.y1-ndc.y0)*height/2+16};
    await page.screenshot({path:`${output}/${name}-detail.png`,clip});
    await page.screenshot({path:`${output}/${name}.png`});
    if(name==='phone-retina') {
      await page.evaluate(()=>window.__lamp({on:false}));
      await page.screenshot({path:`${output}/${name}-lamp-off.png`,clip});
    }
    console.log(name,JSON.stringify({...info,errors}));
    await page.close();
  }
}finally{await browser.close();}
