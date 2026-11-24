import { CONTENT, UI } from '../content/content.js';
import { firstVisit, markVisited } from './visit.js';
import { buildCursor, initMenuCursor } from './menuCursor.js';

// The room's own chrome, once the scene is live: the first-visit hint, the way back to the desk,
// the name and corner menu, and the credits link. Every entry zooms to the screen and opens a window.
export function initRoomUi(scene, events) {
  const $ = (id) => document.getElementById(id);
  $('orbit-hint').textContent = UI.hint;
  // "◀ desk": the shared cursor's glyph, mirrored and parked in the gutter, always on; the button keeps its full name for screen readers.
  const arrow = buildCursor();
  arrow.classList.add('is-on', 'is-static');
  $('screen-back').replaceChildren(arrow, UI.back);
  $('screen-back').setAttribute('aria-label', UI.backLabel);
  $('corner-name').textContent = CONTENT.owner.name;
  $('credits-link').textContent = UI.credits;
  $('lofi-link').textContent = UI.lofi;
  document.body.classList.toggle('hint-seen', !firstVisit);
  // The first interaction once the room is showing (not the intro's own click) retires the hint.
  const seen = () => {
    if (!document.body.classList.contains('orbit-live') || document.body.classList.contains('hint-seen')) return;
    document.body.classList.add('hint-seen');
    markVisited();
  };
  for (const type of ['pointerdown', 'keydown', 'wheel']) events.on(window, type, seen, { capture: true });

  const button = $('menu-button'), list = $('menu-list');
  button.textContent = UI.menu;
  $('corner-menu').style.setProperty('--menu-cols', Math.max(UI.menu.length, ...UI.menuItems.map(([, text]) => text.length)));
  list.replaceChildren(...UI.menuItems.map(([id, text]) => {
    const item = Object.assign(document.createElement('button'), { type: 'button', className: 'ux-menu-item', textContent: text });
    item.dataset.window = id;
    item.dataset.cursor = '';
    return Object.assign(document.createElement('li'), { role: 'none' }).appendChild(item).parentNode;
  }));
  const cursor = initMenuCursor(events);
  // Wider than 760px the items are a permanent row (CSS hides the button); narrower, "menu" opens the list.
  const narrow = matchMedia('(max-width: 760px)');
  const setOpen = (open, focus) => {
    if (!narrow.matches) return;
    list.hidden = !open;
    if (!open) cursor.hide();
    button.setAttribute('aria-expanded', String(open));
    if (open && focus) list.querySelector('button').focus();
    else if (!open && focus) button.focus();
  };
  const syncLayout = () => { list.hidden = narrow.matches; button.setAttribute('aria-expanded', 'false'); cursor.hide(); };
  syncLayout();
  events.on(narrow, 'change', syncLayout);
  const open = (id) => { setOpen(false); scene.openWindow(id); };
  events.on(button, 'click', () => setOpen(list.hidden, true));
  events.on(list, 'click', (e) => { const id = e.target.closest('[data-window]')?.dataset.window; if (id) open(id); });
  events.on($('credits-link'), 'click', () => open('credits'));
  events.on(document, 'pointerdown', (e) => { if (narrow.matches && !list.hidden && !e.target.closest('#corner-menu')) setOpen(false); });
  events.on($('corner-menu'), 'keydown', (e) => {
    if (e.key === 'Escape' && narrow.matches && !list.hidden) { e.stopPropagation(); setOpen(false, true); return; }
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    if (list.hidden) return setOpen(true, true);
    const items = [...list.querySelectorAll('button')].filter((item) => item.offsetParent);
    items[(items.indexOf(document.activeElement) + step + items.length) % items.length].focus();
  });
  for (const el of [$('corner'), $('credits-link')]) el.hidden = false;
}
