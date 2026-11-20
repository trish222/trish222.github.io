import { CONTENT, UI } from '../content/content.js';
import { firstVisit, markVisited } from './visit.js';

// The room's own chrome, once the scene is live: the first-visit hint, the way back to the desk,
// the name and corner menu, and the credits link. Every entry zooms to the screen and opens a window.
export function initRoomUi(scene, events) {
  const $ = (id) => document.getElementById(id);
  $('orbit-hint').textContent = UI.hint;
  $('screen-back').textContent = UI.back;
  $('corner-name').textContent = CONTENT.owner.name;
  $('credits-link').textContent = UI.credits;
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
  list.replaceChildren(...UI.menuItems.map(([id, text]) => {
    const item = Object.assign(document.createElement('button'), { type: 'button', className: 'ux-menu-item', textContent: text });
    item.dataset.window = id;
    return Object.assign(document.createElement('li'), { role: 'none' }).appendChild(item).parentNode;
  }));
  const setOpen = (open, focus) => {
    list.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    if (open && focus) list.querySelector('button').focus();
    else if (!open && focus) button.focus();
  };
  const open = (id) => { setOpen(false); scene.openWindow(id); };
  events.on(button, 'click', () => setOpen(list.hidden, true));
  events.on(list, 'click', (e) => { const id = e.target.closest('[data-window]')?.dataset.window; if (id) open(id); });
  events.on($('credits-link'), 'click', () => open('credits'));
  events.on(document, 'pointerdown', (e) => { if (!list.hidden && !e.target.closest('#corner-menu')) setOpen(false); });
  events.on($('corner-menu'), 'keydown', (e) => {
    if (e.key === 'Escape' && !list.hidden) { e.stopPropagation(); setOpen(false, true); }
  });
  for (const el of [$('corner'), $('credits-link')]) el.hidden = false;
}
