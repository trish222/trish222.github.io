import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { UI } from '../src/content/content.js';

// The corner menu. Wider than 760px: no "menu" word, the items are one row on the name's line (credits stays
// bottom-left); keyboard only it zooms into the screen, signs in and opens each window. At 760px and under:
// "menu" opens a vertical column. Both share one ▶ cursor, one font and no box. Also: the desk's credits link
// and About's Credits button open Credits; the hint shows on a first visit only; "◀ desk" (aria-label "Back to desk") returns.
const url = process.argv[2] || 'http://127.0.0.1:4320/?diagnostics=1';
const browser = await chromium.launch({ channel: 'chromium' });
const live = (page) => page.waitForFunction(() => document.body.classList.contains('orbit-live') && window.__stillReady?.());
const hintShown = (page) => page.evaluate(() => getComputedStyle(document.getElementById('orbit-hint')).opacity !== '0');

// Layout facts about each element: computed text style, the text's own rect (not the padded hit box), the hit box.
const measure = (page, selector) => page.evaluate((selector) => [...document.querySelectorAll(selector)].map((el) => {
  const c = getComputedStyle(el), range = document.createRange();
  range.selectNodeContents([...el.childNodes].filter((n) => n.nodeType === 3).at(-1)); // the label itself, not a ▶ span
  const text = range.getBoundingClientRect(), box = el.getBoundingClientRect();
  return { text: el.textContent, transform: c.textTransform, font: c.fontFamily, size: parseFloat(c.fontSize), weight: c.fontWeight,
    bg: c.backgroundColor, border: c.borderTopWidth, tl: text.left, tr: text.right, ty: (text.top + text.bottom) / 2,
    bl: box.left, br: box.right, w: box.width, h: box.height, shown: el.offsetParent !== null };
}), selector);
const approx = (a, b, tolerance = 1) => Math.abs(a - b) <= tolerance;
const cursorKit = (page) => {
  const cursor = page.locator('.ux-cursor:not(.is-static)');
  return {
    cursor,
    shown: () => cursor.evaluate((el) => getComputedStyle(el).opacity === '1'),
    pos: () => cursor.evaluate((el) => el.style.transform.match(/-?[\d.]+/g).map(Number)),
    // The cursor's gutter: its offset from the entry's left edge never varies.
    gutter: (sel) => page.evaluate((sel) => document.querySelector('.ux-cursor:not(.is-static)').getBoundingClientRect().left - document.querySelector(sel).getBoundingClientRect().left, sel),
  };
};

try {
  // ---- Wider than 760px: the row ----
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(url);
  await live(page);
  assert.equal(await page.locator('#orbit-hint').textContent(), UI.hint);
  await page.waitForFunction(() => getComputedStyle(document.getElementById('orbit-hint')).opacity === '1');
  assert.equal(await page.locator('#corner-name').textContent(), 'Trish Nguyen');

  const rowIds = UI.menuItems.map(([id]) => id).filter((id) => id !== 'credits');
  assert.equal(await page.locator('#menu-button').isVisible(), false, 'no "menu" word on a wide screen');
  const items = (await measure(page, '#menu-list button')).filter((r) => r.shown);
  const [name] = await measure(page, '#corner-name');
  assert.deepEqual(items.map((r) => r.text.toLowerCase()), rowIds, 'the row is about, projects, resume, contact; credits is bottom-left only');
  assert.ok(items.every((r) => r.transform === 'lowercase' && /Martian Mono/.test(r.font) && r.weight === '600' && r.size === items[0].size), 'lowercase Martian Mono, one size');
  assert.ok(items.every((r) => r.bg === 'rgba(0, 0, 0, 0)' && r.border === '0px'), 'no box on the items');
  assert.ok(items.every((r) => r.w >= 44 && r.h >= 44), '44px hit areas');
  assert.ok(items.every((r) => approx(r.ty, items[0].ty, 0.5)), 'the items share one line');
  const gaps = items.slice(1).map((r, i) => r.tl - items[i].tr);
  assert.ok(gaps.every((g) => approx(g, gaps[0])), `evenly spaced (gaps ${gaps.map(Math.round)})`);
  assert.ok(approx(items.at(-1).tr, 1440 - 16), 'the row ends at the page margin');
  assert.ok(/Martian Mono/.test(name.font) && name.weight === '600', 'the name is semi-bold Martian Mono');
  assert.ok(approx(name.size / items[0].size, 1.25, 0.02), `the name is 1.25x the items (${name.size} / ${items[0].size})`);
  assert.ok(approx(name.ty, items[0].ty, 1), 'the row is vertically centred on the name');
  assert.ok(name.tr < items[0].bl, 'the row clears the name');

  await page.mouse.move(5, 450);
  const { cursor, shown, pos, gutter } = cursorKit(page);
  assert.equal(await cursor.count(), 1, 'one shared cursor element');
  assert.equal(await shown(), false, 'no cursor at rest');
  const handle = await cursor.elementHandle();
  const buttons = page.locator('#menu-list button');
  await buttons.nth(0).hover();
  assert.equal(await shown(), true, 'the cursor shows on a hovered item');
  const rowGutter = await gutter('#menu-list button');
  assert.ok(rowGutter >= 0 && rowGutter < 18, 'left of the text, inside the gutter');
  const [x1, y1] = await pos();
  await buttons.nth(1).hover();
  const [x2, y2] = await pos();
  assert.ok(x2 > x1 && y2 === y1, 'the cursor moves along the row, not up or down');
  assert.equal(await cursor.count(), 1, 'there is still one cursor');
  assert.ok(await page.evaluate((h) => h === document.querySelector('.ux-cursor:not(.is-static)'), handle), 'and it is the same element');
  await page.mouse.move(5, 450);
  assert.equal(await shown(), false, 'the cursor fades when nothing is hovered');

  // The bottom corners: Martian Mono, smaller than the menu, and the same cursor.
  assert.equal(await page.locator('#lofi-link').textContent(), 'skip 3D');
  for (const id of ['credits-link', 'lofi-link']) {
    const [link] = await measure(page, `#${id}`);
    assert.ok(/Martian Mono/.test(link.font) && link.size < items[0].size && link.h >= 44, `#${id}: small Martian Mono text`);
    await page.locator(`#${id}`).hover();
    assert.equal(await shown(), true, `#${id}: hover shows the cursor`);
    assert.equal(await cursor.count(), 1, `#${id}: it is the same shared cursor`);
    assert.equal(await gutter(`#${id}`), rowGutter, `#${id}: same gutter as the menu`);
    await page.mouse.move(5, 450);
    assert.equal(await shown(), false);
  }

  // Keyboard: arrows walk the row (the cursor follows), Enter opens the window.
  for (const id of rowIds) {
    await page.keyboard.press('Tab'); // a keyboard interaction, so the focus below is :focus-visible
    await page.locator(`#menu-list [data-window="${id}"]`).focus();
    assert.equal(await shown(), true, `${id}: keyboard focus shows the cursor`);
    const [fx, fy] = await pos();
    await page.keyboard.press('ArrowRight');
    const [nx, ny] = await pos();
    const next = await page.evaluate(() => document.activeElement.dataset.window);
    assert.ok(next !== id && ny === fy && (id === rowIds.at(-1) ? nx < fx : nx > fx), `${id}: ArrowRight moves the cursor along the row to ${next}`);
    await page.keyboard.press('ArrowLeft');
    assert.deepEqual(await pos(), [fx, fy], `${id}: ArrowLeft moves it back`);
    await page.keyboard.press('Enter');
    await page.locator(`#window-${id}`).waitFor({ state: 'visible' });
    assert.ok(await page.evaluate(() => document.body.classList.contains('signed-in')), `${id}: signed in without the login`);
    assert.equal(await page.locator('#screen-back').textContent(), UI.back);
    if (id === rowIds[0]) {
      // "◀ desk": menu-style text with its mirrored ▶ always on, in the name's place; no pill, and no second cursor.
      await page.waitForFunction(() => getComputedStyle(document.getElementById('screen-back-bar')).opacity === '1');
      const [back] = await measure(page, '#screen-back');
      assert.ok(/Martian Mono/.test(back.font) && back.weight === '600' && back.size === items[0].size && back.transform === 'lowercase', 'back to desk: the menu items\' text style');
      assert.ok(back.bg === 'rgba(0, 0, 0, 0)' && back.border === '0px' && back.w >= 44 && back.h >= 44, 'no pill, a 44px hit area');
      const margin = await page.evaluate(() => parseFloat(getComputedStyle(document.getElementById('screen-back-bar')).left));
      assert.ok(margin > 0 && approx(back.tl, name.tl + margin, 1) && approx(back.ty, name.ty, 1), `on the name's row, set in from its left edge by --back-margin (${margin}px)`);
      const arrow = await page.locator('#screen-back .ux-cursor').evaluate((el) => {
        const a = el.getBoundingClientRect(), b = el.parentElement.getBoundingClientRect();
        return { on: getComputedStyle(el).opacity === '1', inGutter: a.left >= b.left && a.right <= b.left + 18, centred: Math.abs((a.top + a.bottom) / 2 - (b.top + b.bottom) / 2) < 1,
          pointsBack: getComputedStyle(el).transform === 'matrix(-1, 0, 0, 1, 0, 0)' };
      });
      assert.deepEqual(arrow, { on: true, inGutter: true, centred: true, pointsBack: true }, 'the arrow is always shown, centred in the gutter, and mirrored to point back');
      assert.equal(await page.locator('#screen-back').getAttribute('aria-label'), UI.backLabel, 'screen readers still hear "Back to desk"');
      await page.mouse.move(2, 2);
      const before = [await shown(), await pos()];
      await page.locator('#screen-back').hover();
      assert.deepEqual([await shown(), await pos()], before, 'hovering it does not move or show the shared cursor');
      assert.equal(await page.locator('#screen-back .ux-cursor').evaluate((el) => getComputedStyle(el).transform), 'matrix(-1, 0, 0, 1, 0, 0)', 'reduced motion: the arrow does not nudge');
      await page.mouse.move(5, 450);
    }
    await page.locator(`#window-${id} .close-btn`).click();
    await page.locator('#screen-back').click();
    await live(page);
  }
  await page.waitForFunction(() => document.body.classList.contains('hint-seen') && getComputedStyle(document.getElementById('orbit-hint')).opacity === '0', null, { timeout: 3000 });
  assert.equal(await hintShown(page), false, 'the hint goes after the first interaction');

  await page.locator('#credits-link').click();
  await page.locator('#window-credits').waitFor({ state: 'visible' });
  const credits = await page.locator('#window-credits .window-body').textContent();
  assert.match(credits, /seanaiux\.com\/computer/);
  assert.match(credits, /fizyman/);
  await page.locator('#window-credits .close-btn').click();
  await page.locator('#start-button').click();
  await page.locator('.start-menu-item[data-window="about"]').click();
  await page.locator('#window-about [data-open-window="credits"]').click();
  await page.locator('#window-credits').waitFor({ state: 'visible' });

  const again = await context.newPage();
  await again.goto(url);
  await live(again);
  await again.waitForTimeout(1600);
  assert.equal(await hintShown(again), false, 'a returning visitor gets no hint');
  await context.close();

  // "◀ desk" with motion allowed: its arrow slides left on hover and focus, and settles back.
  const lively = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await lively.goto(url);
  await live(lively);
  await lively.evaluate(() => window.__enter());
  await lively.waitForFunction(() => document.body.classList.contains('screen-focused') && getComputedStyle(document.getElementById('screen-back-bar')).opacity === '1');
  const shift = () => lively.locator('#screen-back .ux-cursor').evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).e);
  assert.equal(await shift(), 0, 'the arrow rests in place');
  await lively.locator('#screen-back').hover();
  await lively.waitForFunction(() => new DOMMatrix(getComputedStyle(document.querySelector('#screen-back .ux-cursor')).transform).e <= -2.5);
  assert.ok(await shift() >= -3.5, 'it nudges 2-3px left on hover');
  await lively.mouse.move(700, 450);
  await lively.waitForFunction(() => new DOMMatrix(getComputedStyle(document.querySelector('#screen-back .ux-cursor')).transform).e === 0);
  await lively.keyboard.press('Tab');
  await lively.locator('#screen-back').focus();
  await lively.waitForFunction(() => new DOMMatrix(getComputedStyle(document.querySelector('#screen-back .ux-cursor')).transform).e <= -2.5);
  await lively.keyboard.press('Escape');
  await live(lively);
  await lively.context().close();

  // ---- 760px and under: "menu" opens the column ----
  for (const [width, height] of [[390, 844], [360, 640], [320, 568]]) {
    const phone = await (await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' })).newPage();
    await phone.goto(url);
    await live(phone);
    const [button] = await measure(phone, '#menu-button');
    const [title] = await measure(phone, '#corner-name');
    assert.equal(button.text, 'menu', `${width}: the corner button is the word "menu"`);
    assert.ok(title.tr < button.tl && approx(title.ty, button.ty, 1), `${width}: the name and "menu" share one line without overlapping`);
    assert.ok(title.size > button.size && /Martian Mono/.test(title.font), `${width}: the name is a little larger than "menu"`);
    assert.equal(await phone.locator('#menu-list').isHidden(), true, `${width}: the list starts closed`);
    if (width !== 390) { await phone.context().close(); continue; }

    await phone.locator('#menu-button').click();
    const rows = await measure(phone, '#menu-button, #menu-list button');
    assert.equal(rows.length, UI.menuItems.length + 1);
    assert.ok(rows.every((r) => r.transform === 'lowercase' && /Martian Mono/.test(r.font) && r.size === rows[0].size && r.weight === '600'), 'one lowercase Martian Mono size and weight');
    assert.ok(rows.every((r) => r.bg === 'rgba(0, 0, 0, 0)' && r.border === '0px'), 'no border or background');
    assert.equal(await phone.evaluate(() => { const l = getComputedStyle(document.getElementById('menu-list')); return [l.backgroundColor, l.borderTopWidth, l.borderRadius, l.padding].join('|'); }), 'rgba(0, 0, 0, 0)|0px|0px|0px', 'the list has no panel');
    assert.ok(rows.every((r) => r.tl === rows[0].tl && r.bl === rows[0].bl), 'one shared left edge');
    assert.ok(rows.every((r) => r.w >= 44 && r.h >= 44), '44px hit areas');
    assert.ok(approx(rows[0].br, width - 16), 'the column ends at the page margin');
    assert.equal(await phone.locator('#menu-list [data-window="credits"]').isVisible(), true, 'credits is in the phone list');

    await phone.mouse.move(5, 600);
    const kit = cursorKit(phone);
    assert.equal(await kit.shown(), false, 'no cursor at rest');
    await phone.locator('#menu-button').hover();
    assert.equal(await kit.shown(), true, 'the cursor shows on "menu"');
    const menuGutter = await kit.gutter('#menu-button');
    const first = phone.locator('#menu-list button').nth(0);
    await first.hover();
    assert.equal(await kit.gutter('#menu-list button'), menuGutter, 'the same gutter on the items as on "menu"');
    const [fx, fy] = await kit.pos();
    await phone.locator('#menu-list button').nth(1).hover();
    const [sx, sy] = await kit.pos();
    assert.ok(sy > fy && sx === fx, 'the cursor moves down the column');
    assert.equal(await kit.cursor.count(), 1, 'one cursor throughout');

    await phone.keyboard.press('Escape');
    assert.equal(await phone.locator('#menu-list').isHidden(), true, 'Escape closes the menu');
    assert.equal(await phone.evaluate(() => document.activeElement.id), 'menu-button', 'and returns focus to its button');
    assert.equal(await phone.evaluate(() => document.body.classList.contains('orbit-live')), true, 'without leaving the room');
    // Keyboard only from here: the pointer still rests where it hovered "Projects", and the list reopening under it
    // re-hovers that item a frame later, which races the first cursor read.
    await phone.mouse.move(5, 600);
    await phone.keyboard.press('ArrowDown');
    assert.equal(await phone.locator('#menu-list').isHidden(), false, 'ArrowDown opens the list');
    const [ax, ay] = await kit.pos();
    await phone.keyboard.press('ArrowDown');
    const [bx, by] = await kit.pos();
    assert.ok(by > ay && bx === ax, 'ArrowDown moves the cursor down the column');
    await phone.keyboard.press('Enter');
    await phone.locator('#window-projects').waitFor({ state: 'visible' });
    await phone.context().close();
  }
  console.log('PASS corner menu (row above 760px, "menu" column at 760px and under), credits link, About credits, back to desk, first-visit hint');
} finally { await browser.close(); }
