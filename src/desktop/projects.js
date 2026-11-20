import { desktopEvents } from './session.js';
import { openWindow } from './windows.js';

// A floppy, the nameplate or the corner menu asks for a window through `desk:open` once the
// camera lands on the screen; signed out, it signs in first and opens the window after.
let pending = null;

function show({ window: id, card }) {
  openWindow(id);
  if (!card) return;
  document.querySelectorAll('.project-card.selected').forEach((c) => c.classList.remove('selected'));
  const el = document.querySelector(`[data-project="${card}"]`);
  el?.classList.add('selected');
  el?.scrollIntoView({ block: 'nearest' });
}

export function initProjectLinks(signedIn, signIn) {
  pending = null;
  desktopEvents.on(document, 'desk:open', (e) => {
    if (signedIn()) return show(e.detail);
    pending = e.detail;
    signIn();
  });
  desktopEvents.on(document, 'click', (e) => {
    const id = e.target.closest?.('[data-open-window]')?.dataset.openWindow;
    if (id) openWindow(id);
  });
}

export function openPendingProject() {
  if (pending) show(pending);
  pending = null;
}
