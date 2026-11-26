import { desktopEvents } from './session.js';
import { blurWindows, openWindow } from './windows.js';

/* ==========================================
   DESKTOP ICONS  (double-click with a mouse, one tap with a finger)
   ========================================== */

/* Which kind of pointer is in use *right now*, rather than what the
   device is capable of: a laptop with a touchscreen answers yes to
   `(pointer: coarse)` and is still being driven by a mouse. Captured on
   the way down so the click that follows can read it. */
let lastPointerType = 'mouse';

export function initPointerKind() {
  desktopEvents.on(document, 'pointerdown', e => {
    lastPointerType = e.pointerType || 'mouse';
  }, true);
}

export function initDesktopIcons() {
  document.querySelectorAll('.desktop-icon').forEach(icon => {
    let clicks = 0;
    let timer  = null;

    desktopEvents.on(icon, 'click', e => {
      e.stopPropagation();
      icon.classList.add('selected');
      /* Selecting an icon is working on the desktop, so whatever window
         was lit stops being so — opening one lights the new one
         straight back up. */
      blurWindows();

      /* A finger opens on the first tap. Double-tap is the desktop's
         idiom and has never been a touch one — there is no hover to
         preview with, so the first tap has nothing else to mean, and
         the gesture collides with double-tap-to-zoom (which
         `touch-action: manipulation` in style.css also turns off). */
      if (lastPointerType !== 'mouse') {
        clearTimeout(timer);
        clicks = 0;
        openWindow(icon.dataset.window);
        return;
      }

      clicks++;
      if (clicks === 1) {
        timer = desktopEvents.timeout(() => { clicks = 0; }, 400);
      } else {
        clearTimeout(timer);
        clicks = 0;
        openWindow(icon.dataset.window);
      }
    });
  });

  /* Windows live inside #desktop, so their clicks bubble here too:
     only a click on the bare desktop clears the selection and drops
     the focus. (The taskbar and Start menu are outside #desktop and so
     never reach this, which is right — clicking those is not clicking
     away.) */
  desktopEvents.on(document.getElementById('desktop'), 'click', e => {
    if (e.target.closest('.desktop-icon') || e.target.closest('.window')) return;
    document.querySelectorAll('.desktop-icon').forEach(i => i.classList.remove('selected'));
    blurWindows();
  });
}
