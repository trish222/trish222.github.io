import { desktopEvents } from './session.js';
import { openWindow } from './windows.js';

// A floppy on the desk asks for its window through `desk:open` once the camera
// lands on the screen; a request made while signed out waits for the sign-in.
let pending = null;

function show({ window: id, card }) {
  openWindow(id);
  if (!card) return;
  document.querySelectorAll('.project-card.selected').forEach((c) => c.classList.remove('selected'));
  const el = document.querySelector(`[data-project="${card}"]`);
  el?.classList.add('selected');
  el?.scrollIntoView({ block: 'nearest' });
}

export function initProjectLinks(signedIn) {
  pending = null;
  desktopEvents.on(document, 'desk:open', (e) => {
    if (signedIn()) show(e.detail);
    else pending = e.detail;
  });
}

export function openPendingProject() {
  if (pending) show(pending);
  pending = null;
}
