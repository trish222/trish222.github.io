import { desktopEvents } from './session.js';
import { initWindowResizing } from './resize.js';
import { DESKTOP_FULLSCREEN_QUERY } from '../config/experience.js';
export const WINDOWS = {
  projects: { title: 'Projects',    icon: 'projects' },
  about:    { title: 'About Me',    icon: 'about-me' },
  resume:   { title: 'Resume',      icon: 'resume' },
  contact:  { title: 'Contact',     icon: 'contact' },
  credits:  { title: 'Credits',     icon: 'document' },
  recycle:  { title: 'Recycle Bin', icon: 'recycle-bin' },
};

let zCounter = 100;
let activeWindow = null;
let dragState = null;

/* ==========================================
   WINDOW MANAGEMENT
   ========================================== */

/* ------------------------------------------------------------------
   POINTER COORDINATES, THROUGH THE GLASS

   The desktop lives inside #screen, which scene.js maps onto the
   monitor's screen plane with a CSS transform — so a pointer event's
   clientX/clientY are viewport pixels while every figure a window is
   positioned in is in the box's own. Hit-testing, hover, focus and
   scrolling all go through the transform by themselves, because they
   are about *targets*; a drag is the one thing that is not, because it
   reads coordinates. Left unmapped, a window lags the pointer by
   whatever the box is scaled to and slides out from under the grab.

   The mapping is the box's rendered width against its layout width,
   and that is enough rather than a matrix inversion because the
   framing the desktop is used at is head-on and centred: there the
   transform is a plain scale and translate, which is the case
   `quadTransform` in scene.js writes a 2D `matrix()` for deliberately,
   and the orbit is disabled while the camera is parked so nothing can
   skew it. The no-WebGL path and the narrow-viewport break-out carry
   no transform at all and fall out of this as scale 1.
   ------------------------------------------------------------------ */
function glassPoint(e) {
  const desk = document.getElementById('desktop');
  const r = desk.getBoundingClientRect();
  const scale = r.width / (desk.offsetWidth || r.width || 1);
  return {
    x: (e.clientX - r.left) / scale,
    y: (e.clientY - r.top) / scale,
  };
}

export function getWin(id) {
  return document.getElementById(`window-${id}`);
}

export function winId(el) {
  return el.id.replace('window-', '');
}

/* How far a window's top-left may travel. Measured off #desktop, which
   is the window's own containing block, so `left`/`top` and these are
   in the same coordinates — the glass's, not the viewport's, and the
   mapping between the two is none of this code's business. The max()es
   matter: a window clamped
   by its own max-width can be *wider* than the desktop is at that
   moment, and a negative bound would then pin it off the left edge. */
function dragBounds(win) {
  const desk = document.getElementById('desktop');
  return {
    maxX: Math.max(0, desk.clientWidth  - win.offsetWidth),
    maxY: Math.max(0, desk.clientHeight - win.offsetHeight),
  };
}

function moveWindow(win, x, y) {
  const { maxX, maxY } = dragBounds(win);
  win.style.left = `${Math.max(0, Math.min(x, maxX))}px`;
  win.style.top  = `${Math.max(0, Math.min(y, maxY))}px`;
}

/* A window placed on a wide frame can sit off-stage after a resize to
   a narrow one. Run every window through this as it opens, and again
   on resize. */
function clampIntoView(win) {
  if (win.dataset.maximized === 'true') return;
  moveWindow(win, win.offsetLeft, win.offsetTop);
}

/* ------------------------------------------------------------------
   OPENING GEOMETRY  (desktop only — a phone maximizes instead)

   Every window opens at the same share of the screen, centred, the body
   scrolling if the content is taller. Fractions of #desktop, which is
   the area above the taskbar, so a window never covers it.

   Only on the window's **first** open. After that it reopens where it
   was last left, because a visitor who dragged it there meant it —
   which is also why the resize handler only clamps and never re-places.
   Signing out clears the flags, so a new session starts centred again.
   ------------------------------------------------------------------ */
const OPEN_SIZE = { width: 0.7, height: 0.75 };
const CASCADE   = 28; // per window already up, so the second lands beside the first

function placeWindow(win) {
  if (win.dataset.maximized === 'true' || win.dataset.placed === 'true') return;
  win.dataset.placed = 'true';

  const desk = document.getElementById('desktop');
  win.style.width  = `${Math.round(desk.clientWidth  * OPEN_SIZE.width)}px`;
  win.style.height = `${Math.round(desk.clientHeight * OPEN_SIZE.height)}px`;

  const others = document.querySelectorAll('.window:not(.hidden)').length - 1;
  const step = Math.max(0, others % 5) * CASCADE;
  moveWindow(win,
    Math.round((desk.clientWidth  - win.offsetWidth)  / 2 + step),
    Math.round((desk.clientHeight - win.offsetHeight) / 2 + step));
}

/* Below this the desktop metaphor stops paying for itself: a window is
   already the full width of the frame (max-width clamps it, and `left`
   can then only be 0), so what it actually gives you is a window that
   covers the icons *and* leaves a dead strip under itself. Better to
   commit — one window at a time, filling the frame, with the taskbar as
   the switcher, which is how a phone works anyway. */
/* The height arm is a phone held sideways — 844x390, where a window
   has no more room than it does upright. `pointer: coarse` keeps a
   short *laptop* window out of it, which matters because that viewport
   still shows the desktop inside the monitor at the machine's own
   900px and wants the machine's own chrome. `isHandheld` in scene.js
   and "THE PHONE'S DESKTOP" in style.css are the same test; keep the
   three in step. */
const PHONE = window.matchMedia(DESKTOP_FULLSCREEN_QUERY);

/* Maximized because of the viewport, not because anyone pressed the
   button. The flag is what lets a resize back to a desktop width undo
   it, while leaving a deliberate press alone. */
function fitWindow(win) {
  if (PHONE.matches) {
    if (win.dataset.maximized !== 'true') {
      maximize(win);
      win.dataset.autoMax = 'true';
    }
    return;
  }
  if (win.dataset.autoMax === 'true') {
    delete win.dataset.autoMax;
    restore(win);
  }
  /* After the restore, so a window first opened on a phone — which
     never got placed — is sized and centred rather than left at 0,0. */
  placeWindow(win);
  clampIntoView(win);
}

export function fitAllWindows() {
  document.querySelectorAll('.window:not(.hidden)').forEach(fitWindow);
}

function focusWindow(id) {
  const win = getWin(id);
  if (!win) return;

  /* Every pointerdown inside a window arrives here, so the common case
     is a window that is already on top. Leaving early keeps a click in
     a text field from rebuilding the taskbar's DOM under it. */
  if (activeWindow === id && win.classList.contains('active') &&
      !win.classList.contains('hidden') && !win.classList.contains('minimized')) {
    return;
  }

  document.querySelectorAll('.window').forEach(w => {
    w.classList.remove('active');
    w.classList.add('inactive');
  });

  win.style.zIndex = ++zCounter;
  win.classList.add('active');
  win.classList.remove('inactive', 'minimized', 'hidden');
  activeWindow = id;
  updateTaskbar();
}

/* Clicking the desktop itself drops the focus, the way it did in 98:
   the title bar greys and the taskbar button comes back up. Without
   this a window stays lit even with nothing of it under the pointer. */
export function blurWindows() {
  if (!activeWindow) return;
  document.querySelectorAll('.window.active').forEach(w => {
    w.classList.remove('active');
    w.classList.add('inactive');
  });
  activeWindow = null;
  updateTaskbar();
}

export function openWindow(id) {
  const win = getWin(id);
  if (!win) return;
  win.classList.remove('hidden', 'minimized');
  /* After the unhide, not before: a display:none window measures 0 and
     would clamp itself to the top-left corner. */
  fitWindow(win);
  focusWindow(id);
}

/* Closing or minimizing the active window hands the focus down to
   whatever is left on top, rather than leaving every remaining window
   greyed out with nothing active. The stacking order is the inline
   zIndex focusWindow writes, so the topmost is simply the largest. */
function focusTopmost() {
  const open = [...document.querySelectorAll('.window:not(.hidden):not(.minimized)')];
  if (!open.length) return;
  const top = open.reduce((a, b) =>
    (Number(b.style.zIndex) || 0) >= (Number(a.style.zIndex) || 0) ? b : a);
  focusWindow(winId(top));
}

export function closeWindow(id) {
  const win = getWin(id);
  if (!win) return;
  win.classList.add('hidden');
  if (activeWindow === id) {
    activeWindow = null;
    focusTopmost();
  }
  updateTaskbar();
}

function minimizeWindow(id) {
  const win = getWin(id);
  if (!win) return;
  win.classList.add('minimized');
  if (activeWindow === id) {
    activeWindow = null;
    focusTopmost();
  }
  updateTaskbar();
}

function toggleWindow(id) {
  const win = getWin(id);
  if (!win) return;

  if (win.classList.contains('hidden') || win.classList.contains('minimized')) {
    openWindow(id);
  } else if (activeWindow === id) {
    minimizeWindow(id);
  } else {
    focusWindow(id);
  }
}

/* ==========================================
   TASKBAR
   ========================================== */

export function updateTaskbar() {
  const container = document.getElementById('taskbar-windows');
  container.innerHTML = '';

  Object.entries(WINDOWS).forEach(([id, info]) => {
    const win = getWin(id);
    if (!win || win.classList.contains('hidden')) return;

    const btn = document.createElement('button');
    btn.className = 'taskbar-item';
    if (activeWindow === id && !win.classList.contains('minimized')) {
      btn.classList.add('pressed');
    }
    const img = document.createElement('img');
    img.src = `/icons/${info.icon}.png`;
    img.width = img.height = 16;
    img.alt = '';
    btn.append(img, info.title);
    desktopEvents.on(btn, 'click', () => toggleWindow(id));
    container.appendChild(btn);
  });
}

/* ==========================================
   CLOCK
   ========================================== */

/* ==========================================
   DRAG
   ========================================== */

/* Pointer events, not mouse: the same three handlers then cover a
   finger as well, which the mouse-only version did not at all. And the
   stream is captured to the title bar, so the drag survives the
   pointer outrunning the bar or leaving the viewport — the old code
   listened on `document` to paper over the first of those and still
   lost the drag to anything that swallowed the event. */
export function initDragging() {
  document.querySelectorAll('[data-drag]').forEach(titlebar => {
    const win = document.getElementById(titlebar.dataset.drag);
    if (!win) return;

    desktopEvents.on(titlebar, 'pointerdown', e => {
      if (e.button !== 0) return;                 // a right-click is not a drag
      if (e.target.closest('.win-btn')) return;   // a control, not the bar
      if (win.dataset.maximized === 'true') return;

      focusWindow(winId(win));

      /* Where in the window it was grabbed, in the window's own
         coordinates — which are the desktop's, and so the ones `top`
         and `left` are written in. */
      const p = glassPoint(e);
      dragState = {
        win,
        pointerId: e.pointerId,
        offsetX: p.x - win.offsetLeft,
        offsetY: p.y - win.offsetTop,
      };
      titlebar.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    desktopEvents.on(titlebar, 'pointermove', e => {
      if (!dragState || dragState.pointerId !== e.pointerId) return;
      const p = glassPoint(e);
      moveWindow(dragState.win, p.x - dragState.offsetX, p.y - dragState.offsetY);
    });

    /* pointercancel as well as pointerup: the browser can take the
       gesture back mid-drag, and a dragState left set would then have
       the window follow the next pointer that moves. */
    const end = e => {
      if (dragState && dragState.pointerId === e.pointerId) dragState = null;
    };
    desktopEvents.on(titlebar, 'pointerup', end);
    desktopEvents.on(titlebar, 'pointercancel', end);
  });
}

/* ==========================================
   MAXIMIZE / RESTORE
   ========================================== */

function maximize(win) {
  if (win.dataset.maximized === 'true') return;
  win.dataset.prevTop    = win.style.top;
  win.dataset.prevLeft   = win.style.left;
  win.dataset.prevWidth  = win.style.width;
  /* Placement may have set one, and `height: ''` would drop it. */
  win.dataset.prevHeight = win.style.height;
  win.style.top    = '0';
  win.style.left   = '0';
  win.style.width  = '100%';
  /* 100% of #desktop, which is the containing block and is already
     the glass less the taskbar — so a maximized window lands on the
     screen's own rectangle, not on the viewport. */
  win.style.height = '100%';
  win.dataset.maximized = 'true';
}

function restore(win) {
  if (win.dataset.maximized !== 'true') return;
  win.style.top    = win.dataset.prevTop;
  win.style.left   = win.dataset.prevLeft;
  win.style.width  = win.dataset.prevWidth;
  win.style.height = win.dataset.prevHeight || '';
  win.dataset.maximized = 'false';
}

function toggleMaximize(id) {
  const win = getWin(id);
  if (!win) return;
  /* A press owns the state from here: it is no longer the phone rule's
     to undo on the next resize. */
  delete win.dataset.autoMax;
  if (win.dataset.maximized === 'true') restore(win); else maximize(win);
}

/* ==========================================
   WINDOW CONTROLS
   ========================================== */

export function initWindowControls() {
  initWindowResizing({ point: glassPoint, focus: focusWindow, isFullscreen: () => PHONE.matches, signal: desktopEvents.signal });
  document.querySelectorAll('.close-btn').forEach(btn => {
    desktopEvents.on(btn, 'click', () => closeWindow(btn.dataset.target));
  });

  document.querySelectorAll('.minimize-btn').forEach(btn => {
    desktopEvents.on(btn, 'click', () => minimizeWindow(btn.dataset.target));
  });

  document.querySelectorAll('.maximize-btn').forEach(btn => {
    desktopEvents.on(btn, 'click', () => toggleMaximize(btn.dataset.target));
  });

  /* Anywhere in a window raises it. pointerdown rather than click, so
     it happens on the way down — a click that lands in a text field
     should raise the window before the caret moves, not after. */
  document.querySelectorAll('.window').forEach(win => {
    desktopEvents.on(win, 'pointerdown', () => focusWindow(winId(win)));
  });
}


export function resetWindows() {
  zCounter = 100;
  activeWindow = null;
  dragState = null;
}
