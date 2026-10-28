import './style.css';

/* ==========================================
   WINDOW REGISTRY
   ========================================== */
/* Add a window by adding markup in index.html *and* an entry here. The
   `icon` is a basename in public/icons/ (see scripts/make-icons.mjs);
   an entry whose `#window-<id>` does not exist yet is simply skipped,
   which is what lets the desktop icons land before their windows do. */
const WINDOWS = {
  projects: { title: 'Projects',    icon: 'projects' },
  about:    { title: 'About Me',    icon: 'about-me' },
  resume:   { title: 'Resume',      icon: 'resume' },
  contact:  { title: 'Contact',     icon: 'contact' },
  recycle:  { title: 'Recycle Bin', icon: 'recycle-bin' },
  skills:   { title: 'Skills',      icon: 'resume' },
};

let zCounter = 100;
let activeWindow = null;
let dragState = null;

/* ==========================================
   WINDOW MANAGEMENT
   ========================================== */

function getWin(id) {
  return document.getElementById(`window-${id}`);
}

function winId(el) {
  return el.id.replace('window-', '');
}

/* How far a window's top-left may travel. Measured off #desktop, which
   is the window's own containing block, so `left`/`top` and these are
   in the same coordinates — and so the answer stays right whether or
   not the taskbar is there yet. The max()es matter: a window clamped
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

/* The inline positions in index.html are desktop figures: Contact opens
   at left:310px, which on a 390px phone is almost entirely off-stage.
   Run every window through this as it opens, and again on resize. */
function clampIntoView(win) {
  if (win.dataset.maximized === 'true') return;
  moveWindow(win, win.offsetLeft, win.offsetTop);
}

/* ------------------------------------------------------------------
   OPENING GEOMETRY  (desktop only — a phone maximizes instead)

   The widths and positions in index.html are 1995 figures. 480px of
   About Me at left:130 is a postage stamp pinned to the top-left corner
   of a 1567px display, with the rest of the screen bare teal. So on
   anything wider than a phone the authored width becomes a *floor*
   rather than the answer: the window is sized against the viewport and
   centred in it.

   Only on the window's **first** open. After that it reopens where it
   was last left, because a visitor who dragged it there meant it —
   which is also why the resize handler only clamps and never re-places.
   Signing out clears the flags, so a new session starts centred again.
   ------------------------------------------------------------------ */
const OPEN_FRAC   = 0.44; // of the desktop's width, before the floor
const OPEN_MAX    = 820;  // past this a line of body copy is too long to read
const OPEN_MARGIN = 56;   // breathing room left either side on a narrow frame
const CASCADE     = 28;   // per window already up, so the second lands beside the first
/* Width scales with the viewport but these windows are sized by their
   content, so without a floor About Me arrives 784x233 — bigger than
   before and *worse*, a letterbox slot with two sentences adrift in it.
   The floor is whichever is smaller: a share of the frame's height, or
   a proportion of the window's own width. Only a floor — the Resume is
   taller than both and keeps its natural height. */
const OPEN_MIN_H  = 0.52; // of the desktop's height
const OPEN_H_RATIO = 0.62; // of the window's own width
/* Centred on 0.5 reads as *low*, because the taskbar has already taken
   the bottom of the frame and the eye splits what is left. */
const OPEN_RISE   = 0.38;

function placeWindow(win) {
  if (win.dataset.maximized === 'true' || win.dataset.placed === 'true') return;
  win.dataset.placed = 'true';

  /* The authored width, remembered once — after the first placement
     style.width holds the computed one, and scaling that again every
     session would walk the window wider and wider. */
  if (!win.dataset.baseWidth) {
    win.dataset.baseWidth = String(parseInt(win.style.width, 10) || win.offsetWidth);
  }

  const desk = document.getElementById('desktop');
  const base = Number(win.dataset.baseWidth);
  const want = Math.max(base, desk.clientWidth * OPEN_FRAC);
  win.style.width = `${Math.round(Math.min(want, OPEN_MAX, desk.clientWidth - OPEN_MARGIN * 2))}px`;

  /* Read the height *after* the width lands: these windows are sized by
     their content, so the reflow is what decides how tall they are. */
  const floor = Math.round(Math.min(desk.clientHeight * OPEN_MIN_H,
                                    win.offsetWidth * OPEN_H_RATIO));
  if (win.offsetHeight < floor) win.style.height = `${floor}px`;

  const others = document.querySelectorAll('.window:not(.hidden)').length - 1;
  const step = Math.max(0, others % 5) * CASCADE;
  moveWindow(win,
    Math.round((desk.clientWidth  - win.offsetWidth)  / 2 + step),
    Math.round((desk.clientHeight - win.offsetHeight) * OPEN_RISE + step));
}

/* Below this the desktop metaphor stops paying for itself: a window is
   already the full width of the frame (max-width clamps it, and `left`
   can then only be 0), so what it actually gives you is a window that
   covers the icons *and* leaves a dead strip under itself. Better to
   commit — one window at a time, filling the frame, with the taskbar as
   the switcher, which is how a phone works anyway. */
const PHONE = window.matchMedia('(max-width: 560px)');

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
     never got placed — is centred rather than dropped back onto its
     authored 1995 corner. */
  placeWindow(win);
  clampIntoView(win);
}

function fitAllWindows() {
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
function blurWindows() {
  if (!activeWindow) return;
  document.querySelectorAll('.window.active').forEach(w => {
    w.classList.remove('active');
    w.classList.add('inactive');
  });
  activeWindow = null;
  updateTaskbar();
}

function openWindow(id) {
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

function closeWindow(id) {
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

function updateTaskbar() {
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
    btn.addEventListener('click', () => toggleWindow(id));
    container.appendChild(btn);
  });
}

/* ==========================================
   CLOCK
   ========================================== */

function updateClock() {
  const el = document.getElementById('taskbar-clock');
  const now = new Date();
  const h = now.getHours();
  const m = String(now.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  el.textContent = `${(h % 12) || 12}:${m} ${ampm}`;
}

/* ==========================================
   DRAG
   ========================================== */

/* Pointer events, not mouse: the same three handlers then cover a
   finger as well, which the mouse-only version did not at all. And the
   stream is captured to the title bar, so the drag survives the
   pointer outrunning the bar or leaving the viewport — the old code
   listened on `document` to paper over the first of those and still
   lost the drag to anything that swallowed the event. */
function initDragging() {
  document.querySelectorAll('[data-drag]').forEach(titlebar => {
    const win = document.getElementById(titlebar.dataset.drag);
    if (!win) return;

    titlebar.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;                 // a right-click is not a drag
      if (e.target.closest('.win-btn')) return;   // a control, not the bar
      if (win.dataset.maximized === 'true') return;

      focusWindow(winId(win));

      const rect = win.getBoundingClientRect();
      dragState = {
        win,
        pointerId: e.pointerId,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
      };
      titlebar.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    titlebar.addEventListener('pointermove', e => {
      if (!dragState || dragState.pointerId !== e.pointerId) return;
      moveWindow(dragState.win, e.clientX - dragState.offsetX, e.clientY - dragState.offsetY);
    });

    /* pointercancel as well as pointerup: the browser can take the
       gesture back mid-drag, and a dragState left set would then have
       the window follow the next pointer that moves. */
    const end = e => {
      if (dragState && dragState.pointerId === e.pointerId) dragState = null;
    };
    titlebar.addEventListener('pointerup', end);
    titlebar.addEventListener('pointercancel', end);
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
     the viewport less the taskbar — and is the full viewport before
     the sign-in, where `calc(100vh - 40px)` left a 40px gap. */
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

function initWindowControls() {
  document.querySelectorAll('.close-btn').forEach(btn => {
    btn.addEventListener('click', () => closeWindow(btn.dataset.target));
  });

  document.querySelectorAll('.minimize-btn').forEach(btn => {
    btn.addEventListener('click', () => minimizeWindow(btn.dataset.target));
  });

  document.querySelectorAll('.maximize-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleMaximize(btn.dataset.target));
  });

  /* Anywhere in a window raises it. pointerdown rather than click, so
     it happens on the way down — a click that lands in a text field
     should raise the window before the caret moves, not after. */
  document.querySelectorAll('.window').forEach(win => {
    win.addEventListener('pointerdown', () => focusWindow(winId(win)));
  });
}

/* ==========================================
   START MENU
   ========================================== */

function initStartMenu() {
  const startBtn  = document.getElementById('start-button');
  const startMenu = document.getElementById('start-menu');

  startBtn.addEventListener('click', e => {
    e.stopPropagation();
    startMenu.classList.toggle('hidden');
    startBtn.classList.toggle('active', !startMenu.classList.contains('hidden'));
  });

  document.addEventListener('click', () => {
    startMenu.classList.add('hidden');
    startBtn.classList.remove('active');
  });

  document.querySelectorAll('.start-menu-item[data-window]').forEach(item => {
    item.addEventListener('click', () => {
      openWindow(item.dataset.window);
      startMenu.classList.add('hidden');
      startBtn.classList.remove('active');
    });
  });

  document.getElementById('logoff-item')?.addEventListener('click', () => {
    startMenu.classList.add('hidden');
    startBtn.classList.remove('active');
    logOff();
  });

  document.getElementById('shutdown-item')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to shut down?')) {
      document.body.style.background = 'black';
      document.body.innerHTML = '<div style="color:white;font-family:monospace;padding:40px;font-size:14px;">It is now safe to turn off your computer.</div>';
    }
  });
}

/* ==========================================
   DESKTOP ICONS  (double-click with a mouse, one tap with a finger)
   ========================================== */

/* Which kind of pointer is in use *right now*, rather than what the
   device is capable of: a laptop with a touchscreen answers yes to
   `(pointer: coarse)` and is still being driven by a mouse. Captured on
   the way down so the click that follows can read it. */
let lastPointerType = 'mouse';

function initPointerKind() {
  document.addEventListener('pointerdown', e => {
    lastPointerType = e.pointerType || 'mouse';
  }, true);
}

function initDesktopIcons() {
  document.querySelectorAll('.desktop-icon').forEach(icon => {
    let clicks = 0;
    let timer  = null;

    icon.addEventListener('click', e => {
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
        timer = setTimeout(() => { clicks = 0; }, 400);
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
  document.getElementById('desktop').addEventListener('click', e => {
    if (e.target.closest('.desktop-icon') || e.target.closest('.window')) return;
    document.querySelectorAll('.desktop-icon').forEach(i => i.classList.remove('selected'));
    blurWindows();
  });
}

/* ==========================================
   THE RECYCLE BIN

   The one window carrying state. Its rows are hidden rather than
   removed, so Start > Log Off can put them back — which makes emptying
   it reversible, and makes it testable more than once per load.
   ========================================== */

function binRows() {
  return [...document.querySelectorAll('#bin-list .bin-item')];
}

function updateBin() {
  const left = binRows().filter(r => !r.hidden);
  const empty = document.getElementById('bin-empty');
  const count = document.getElementById('bin-count');
  const btn   = document.getElementById('bin-empty-btn');
  if (empty) empty.hidden = left.length > 0;
  if (count) count.textContent = `${left.length} object(s)`;
  /* Nothing to empty is a disabled button, not a button that does
     nothing when pressed. */
  if (btn) btn.disabled = left.length === 0;
}

function selectBinRow(row) {
  binRows().forEach(r => r.classList.toggle('selected', r === row));
}

function initRecycleBin() {
  const list = document.getElementById('bin-list');
  if (!list) return;

  /* Single selection, the way a 98 list view did it. Click and focus
     both, so the rows answer to the keyboard as well — they carry
     tabindex, and selection following focus is what a list view does. */
  list.addEventListener('click', e => selectBinRow(e.target.closest('.bin-item')));
  list.addEventListener('focusin', e => selectBinRow(e.target.closest('.bin-item')));

  document.getElementById('bin-empty-btn')?.addEventListener('click', () => {
    const left = binRows().filter(r => !r.hidden);
    if (!left.length) return;
    if (!confirm(`Are you sure you want to delete these ${left.length} items?`)) return;
    left.forEach(r => { r.hidden = true; r.classList.remove('selected'); });
    updateBin();
  });

  updateBin();
}

function refillBin() {
  binRows().forEach(r => { r.hidden = false; r.classList.remove('selected'); });
  updateBin();
}

/* ==========================================
   THE LOGIN SCREEN ON THE CRT

   The markup is live HTML the whole time — scene.js lays it onto the
   monitor's screen plane with a CSS transform, and clicking it flies
   the camera in until it has the viewport. Everything here is the page
   itself; the camera work all lives in scene.js.

   Signing in is the gate to the desktop: its chrome is inert and at
   opacity 0 until `signed-in` is on the body (see "THE SIGN-IN GATE"
   in style.css). The camera has already arrived by then and the canvas
   is faded out, so the hand-over is pure DOM — the overlay steps aside
   and the teal desktop behind it is what is left.
   ========================================== */

/* Long enough to read as a machine doing something, short enough not
   to be a wait. Skipped under reduced motion. */
const SIGN_IN_MS = 550;

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function signedIn() {
  return document.body.classList.contains('signed-in');
}

function signIn() {
  if (signedIn()) return;
  document.body.classList.add('signed-in');
  updateTaskbar();
}

function logOff() {
  if (!signedIn()) return;
  document.body.classList.remove('signed-in');
  Object.keys(WINDOWS).forEach(closeWindow);
  /* A new session opens centred again, rather than inheriting where the
     last one happened to leave things. */
  document.querySelectorAll('.window').forEach(w => {
    delete w.dataset.placed;
    w.style.height = '';
  });
  refillBin();
  const form = document.querySelector('.login-form');
  form?.querySelectorAll('button').forEach(b => { b.disabled = false; });
  const note = document.querySelector('.login-note');
  if (note) note.textContent = '';
  document.getElementById('login-user')?.focus({ preventScroll: true });
}

function initLoginScreen() {
  const form = document.querySelector('.login-form');
  const note = document.querySelector('.login-note');
  if (!form) return;

  form.addEventListener('submit', e => {
    e.preventDefault();
    if (signedIn()) return;
    const user = document.getElementById('login-user').value.trim() || 'user';
    note.textContent = `Loading personal settings for ${user}\u2026`;
    /* A second submit mid-wait would stack another timer. */
    form.querySelectorAll('button').forEach(b => { b.disabled = true; });
    if (prefersReducedMotion()) signIn();
    else setTimeout(signIn, SIGN_IN_MS);
  });
}

/* No WebGL: there is no monitor to click, so the login is shown flat
   over the viewport instead and the desktop is reached the same way.
   scene.js never unhid the overlay or wrote its sizes, hence both here
   (the rest is CSS — see "NO WEBGL" in style.css). */
function initWithoutScene() {
  document.body.classList.add('no-scene');
  const screen = document.getElementById('screen');
  if (screen) screen.hidden = false;
  document.getElementById('login-user')?.focus({ preventScroll: true });
}

/* Wired only once the scene is live, since the way back out is a camera
   move. */
function initScreenControls(scene) {
  const bar = document.getElementById('screen-back-bar');
  if (bar) bar.hidden = false;

  const back = () => scene.flyFromScreen();
  document.getElementById('screen-back')?.addEventListener('click', back);
  document.querySelector('[data-login-cancel]')?.addEventListener('click', back);
  document.querySelector('.login-dialog .title-bar-controls button')
    ?.addEventListener('click', back);

  /* Only while the login is what is on screen: signed in, Escape would
     fly the camera back out from under a desktop that is still up. */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !signedIn() &&
        document.body.classList.contains('screen-focused')) {
      back();
    }
  });
}

/* ==========================================
   INIT
   ========================================== */

document.addEventListener('DOMContentLoaded', () => {
  initDragging();
  initStartMenu();
  initWindowControls();
  initPointerKind();
  initDesktopIcons();
  initRecycleBin();

  /* A window positioned for a desktop viewport is off-stage once the
     viewport is a phone's — and crossing the PHONE breakpoint in either
     direction has to maximize or un-maximize what is open. (A window
     that is already maximized needs no clamping: it is 100% of #desktop
     in both axes and follows it on its own.) */
  window.addEventListener('resize', fitAllWindows);

  updateClock();
  setInterval(updateClock, 1000);

  initLoginScreen();

  /* Three.js is lazy-loaded so the page paints first. */
  const canvas = document.getElementById('scene');
  if (canvas) {
    import('./scene.js')
      .then(async scene => {
        /* The way to the login is the 3D monitor, so the overlay stays
           hidden unless the scene actually came up. */
        if (await scene.initScene(canvas)) initScreenControls(scene);
        else initWithoutScene();
      })
      .catch(initWithoutScene);
  } else {
    initWithoutScene();
  }
});
