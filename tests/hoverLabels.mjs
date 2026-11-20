import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { FLOPPIES, UI } from '../src/content/content.js';

// Hovering a click_* proxy shows its friendly pill label with a pointer cursor and the glow (for the computer,
// only its screen glows; the nameplate is inert: nothing labels or presses it); on touch
// the first tap only labels and the second presses; the keyboard reaches every object through a
// focusable button that shows the same label with a visible focus ring.
const url = process.argv[2] || 'http://127.0.0.1:4320/?diagnostics=1';
const OBJECTS = [['click_crt', 'machine', UI.objects.crt], ['click_lamp_chain', 'lamp', UI.objects.lamp],
  ['click_treehouse', 'treehouse', UI.objects.treehouse],
  ...FLOPPIES.map((f, i) => [`click_project_0${i + 1}`, `project:${i}`, f.label])];

// A viewport point inside the proxy's projected box that the nearest-hit picker gives to it.
const pointFor = (page, [name, target]) => page.evaluate(([name, target]) => {
  const proxy = window.__scene.getObjectByName(name);
  proxy.geometry.computeBoundingBox();
  const { min, max } = proxy.geometry.boundingBox;
  const V = window.__camera.position.constructor;
  const r = document.querySelector('#scene').getBoundingClientRect();
  const pts = [];
  for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) {
    const p = proxy.localToWorld(new V(x, y, z)).project(window.__camera);
    pts.push([(p.x + 1) / 2 * r.width, (1 - p.y) / 2 * r.height]);
  }
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  for (let fy = 0.5; fy < 1; fy += 0.1) for (const sy of [1, -1]) for (let fx = 0.5; fx < 1; fx += 0.1) for (const sx of [1, -1]) {
    const x = Math.min(...xs) + (0.5 + sx * (fx - 0.5)) * (Math.max(...xs) - Math.min(...xs));
    const y = Math.min(...ys) + (0.5 + sy * (fy - 0.5)) * (Math.max(...ys) - Math.min(...ys));
    if (window.__pick(x, y) === target && document.elementFromPoint(r.left + x, r.top + y)?.closest('#scene, #screen'))
      return { x: r.left + x, y: r.top + y };
  }
  return null;
}, [name, target]);

const labelState = (page) => page.evaluate(() => {
  const el = document.getElementById('hover-label');
  return { text: el.textContent, shown: getComputedStyle(el).opacity === '1', cursor: document.querySelector('#scene').style.cursor,
    glow: getComputedStyle(document.querySelector('.desk-glow')).display !== 'none' && getComputedStyle(document.querySelector('.desk-glow')).opacity === '1',
    screen: window.__scene.getObjectByName('screen_plane').material.uniforms.hover.value, top: el.getBoundingClientRect().bottom };
});

const browser = await chromium.launch({ channel: 'chromium' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await page.goto(url);
  await page.waitForFunction(() => document.body.classList.contains('orbit-live') && window.__stillReady?.());
  for (const object of OBJECTS) {
    const point = await pointFor(page, object);
    assert.ok(point, `${object[0]} is pickable from the overview`);
    await page.mouse.move(point.x, point.y);
    await page.waitForFunction((text) => document.getElementById('hover-label').textContent === text, object[2]);
    const state = await labelState(page);
    const machine = object[1] === 'machine';
    assert.ok(state.shown, `${object[0]}: label shows`);
    assert.equal(state.glow, !machine, `${object[0]}: box glow ${machine ? 'hidden' : 'shows'}`);
    assert.equal(state.screen, machine ? 1 : 0, `${object[0]}: screen glow`);
    assert.ok(state.top <= point.y + 1, `${object[0]}: the label sits above the pointer's object`);
    assert.equal(state.cursor, object[1] === 'treehouse' ? 'grab' : 'pointer', `${object[0]}: cursor`);
    assert.doesNotMatch(state.text, /\[|\(.\)|^\w\s*[:·-]/, `${object[0]}: no shortcut letters in "${state.text}"`);
  }
  await page.mouse.move(5, 450);
  await page.waitForFunction(() => !document.body.classList.contains('desk-hover'));
  const plate = await pointFor(page, ['click_nameplate', null]);
  assert.ok(plate, 'the nameplate is on screen');
  await page.mouse.move(plate.x, plate.y);
  await page.mouse.click(plate.x, plate.y);
  await page.waitForTimeout(300);
  assert.deepEqual(await page.evaluate(() => [document.body.classList.contains('desk-hover'), document.querySelector('#scene').style.cursor,
    document.body.classList.contains('screen-active') || window.__lamp().mix !== 1]), [false, 'grab', false], 'the nameplate is inert');

  // Keyboard: every pressable object has a button that shows its label and a visible focus ring.
  const labels = [];
  await page.locator('#desk-objects button').first().focus();
  for (let i = 0; i < OBJECTS.length - 1; i++) {
    const focused = await page.evaluate(() => {
      const el = document.activeElement, s = getComputedStyle(el);
      return { text: el.textContent, ring: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2, w: el.getBoundingClientRect().width };
    });
    assert.ok(focused.ring && focused.w > 20, `"${focused.text}" shows a visible focused pill`);
    labels.push(focused.text);
    await page.keyboard.press('Tab');
  }
  assert.deepEqual(labels.sort(), OBJECTS.filter((o) => o[1] !== 'treehouse').map((o) => o[2]).sort(), 'one button per pressable object');
  await page.close();

  // Touch: tap once to label, again to press.
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const phone = await context.newPage();
  await phone.goto(url);
  await phone.waitForFunction(() => document.body.classList.contains('orbit-live') && window.__stillReady?.());
  // cam_mobile frames the monitor alone, so the phone taps the CRT: its press flies to the screen.
  const object = OBJECTS[0], point = await pointFor(phone, object);
  assert.ok(point, 'an object is tappable in the phone framing');
  const pressed = () => phone.evaluate((lamp) => lamp ? window.__lamp().on : document.body.classList.contains('screen-active'), object[1] === 'lamp');
  const before = await pressed();
  await phone.touchscreen.tap(point.x, point.y);
  await phone.waitForFunction(() => document.body.classList.contains('desk-hover'));
  assert.equal(await phone.evaluate(() => document.getElementById('hover-label').textContent), object[2], `first tap labels ${object[2]}`);
  assert.equal(await pressed(), before, 'first tap does not press it');
  await phone.touchscreen.tap(point.x, point.y);
  await phone.waitForTimeout(100);
  assert.equal(await pressed(), !before, 'second tap presses it');
  await context.close();
  console.log(`PASS hover labels on ${OBJECTS.length} proxies, keyboard pills, touch tap-to-label`);
} finally { await browser.close(); }
