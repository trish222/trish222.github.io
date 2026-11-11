import './style.css';
import * as roomScene from './scene.js';

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

function getWin(id) {
  return document.getElementById(`window-${id}`);
}

function winId(el) {
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
/* The height arm is a phone held sideways — 844x390, where a window
   has no more room than it does upright. `pointer: coarse` keeps a
   short *laptop* window out of it, which matters because that viewport
   still shows the desktop inside the monitor at the machine's own
   900px and wants the machine's own chrome. `isHandheld` in scene.js
   and "THE PHONE'S DESKTOP" in style.css are the same test; keep the
   three in step. */
const PHONE = window.matchMedia('(max-width: 560px), (max-height: 520px) and (pointer: coarse)');

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

    titlebar.addEventListener('pointermove', e => {
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

/* Closes whatever is open *on* the desktop, topmost first, and says
   whether it closed anything. Escape asks this before it does
   anything of its own: in 98 the key dismissed the menu you had open,
   and only once there was nothing left to dismiss did it mean "get me
   out of here".

   The Start menu is the whole list today, because it is the only
   chrome with an open/closed state of its own — the windows are not
   modal and Escape never closed one in 98 either, and the two real
   dialogs (Empty Recycle Bin, Shut Down) are native `confirm()`s the
   browser takes the key for before this handler ever runs. Anything
   added with a dismissible state belongs here, above the Start menu
   if it opens over it. */
/* The menu's three states in one place: the panel, the button it hangs
   off, and `menu-open` on the body.

   That last one is a contract with the scene. A press on the room
   around the screen flies the camera back out (see `canLeaveScreen` in
   scene.js), and the first click after opening a menu has to be the
   one that closes the menu — the same rule Escape follows below, and
   the one 98 followed. The class is how scene.js knows without
   knowing what a Start menu is. */
function setStartMenu(open) {
  document.getElementById('start-menu')?.classList.toggle('hidden', !open);
  document.getElementById('start-button')?.classList.toggle('active', open);
  document.body.classList.toggle('menu-open', open);
}

function dismissChrome() {
  const menu = document.getElementById('start-menu');
  if (menu && !menu.classList.contains('hidden')) {
    setStartMenu(false);
    return true;
  }
  return false;
}

function initStartMenu() {
  const startBtn  = document.getElementById('start-button');
  const startMenu = document.getElementById('start-menu');

  startBtn.addEventListener('click', e => {
    e.stopPropagation();
    setStartMenu(startMenu.classList.contains('hidden'));
  });

  document.addEventListener('click', () => setStartMenu(false));

  document.querySelectorAll('.start-menu-item[data-window]').forEach(item => {
    item.addEventListener('click', () => {
      openWindow(item.dataset.window);
      setStartMenu(false);
    });
  });

  document.getElementById('logoff-item')?.addEventListener('click', () => {
    setStartMenu(false);
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
   the camera in until the bezel frames it. Everything here is the page
   itself; the camera work all lives in scene.js.

   Signing in is the gate to the desktop, and on a desktop viewport it
   is a **pure DOM hand-over**: the camera does not move. The desktop
   is on the same glass, inside the same transformed box, so the pose
   the flight parked at is already the pose it wants — `signed-in` on
   the body crosses it over the login and the monitor stays in shot
   around it for the length of the session (see "THE SIGN-IN GATE" in
   style.css).

   **On a phone there is a camera move in front of that**, because the
   arrival crops the glass there and a 900px desktop mapped onto a
   third of a panel is not a desktop. `scene.diveToDesktop` pushes in
   the rest of the way until the glass covers the viewport (~0.9s, the
   login's bitmap on the tube throughout) and calls back; the page then
   leaves the glass and the hand-over is the same one, to a desktop
   laid out for the phone. The call is unconditional — the scene
   decides whether there is a move to make, and calls back either way,
   so there is one path here rather than two.
   ========================================== */

/* Long enough to read as a machine doing something, short enough not
   to be a wait: the note goes up, the drive thinks about it, the
   desktop fades in. It also buys the login still a redraw in idle
   time (see `refreshLoginStill`) before the phone's push-in starts
   using it. Skipped under reduced motion, where the fade is 0.18s and
   a beat in front of it would be most of the interaction. */
const SIGN_IN_MS = 550;

/* And the beat on the way out, which is shorter because nothing is
   loading: it is the desktop's fade-to-login finishing before the
   camera starts pulling back from it, and the login's bitmap being
   rasterised for the move in the same window. */
const LOG_OFF_MS = 300;

/* The scene module once it is up, or null on the no-WebGL path — where
   there is no monitor, no camera and nothing to move, and the sign-in
   is the DOM hand-over on its own. */
let sceneApi = null;

/* True from the submit to the hand-over. The buttons are disabled over
   that window, but Enter in the username field submits the form again
   and would stack a second sign-in onto the beat already running. */
let signingIn = false;

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function signedIn() {
  return document.body.classList.contains('signed-in');
}

function signIn() {
  signingIn = false;
  if (signedIn()) return;
  document.body.classList.add('signed-in');
  /* After the class, because what it does depends on it: on a narrow
     viewport the desktop leaves the glass, and the overlay's transform
     has to come off for that. */
  sceneApi?.syncDesktopOverlay();
  /* The windows are laid out against #desktop, which is the box inside
     the glass — and until the sign-in it is a box nobody has measured.
     Re-fit whatever was left open from a previous session. */
  fitAllWindows();
  updateTaskbar();
}

function logOff() {
  if (!signedIn()) return;
  document.body.classList.remove('signed-in');
  /* The DOM half runs now rather than on any move's completion: the
     desktop has to be gone, and the login back, before the camera
     starts pulling away from it. On a desktop viewport that is the
     whole of it — the camera never left the login's framing, so there
     is only the overlay to re-sync.

     On a phone the page is full-screen and the camera is a move in
     front of the bezel framing, so the reverse of that move follows,
     one beat behind: long enough for the desktop to have crossfaded
     back to the login and for the login's bitmap to have been
     rasterised for the trip. `riseFromDesktop` is a no-op wherever
     there was no push-in, so this is one path, not two. */
  sceneApi?.syncDesktopOverlay();
  sceneApi?.refreshLoginStill();
  const rise = () => sceneApi?.riseFromDesktop();
  if (prefersReducedMotion()) rise();
  else setTimeout(rise, LOG_OFF_MS);
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
    if (signedIn() || signingIn) return;
    signingIn = true;
    const user = document.getElementById('login-user').value.trim() || 'user';
    note.textContent = `Loading personal settings for ${user}\u2026`;
    /* A second submit mid-wait would stack another timer. */
    form.querySelectorAll('button').forEach(b => { b.disabled = true; });
    /* The bitmap on the glass carries the dialog as it was *before*
       that note: it is redrawn on `input`, and a submit is not one.
       Ask for a fresh one now so it lands in idle time during the beat
       below rather than on the first frame of the phone's move. */
    sceneApi?.refreshLoginStill();
    /* The scene owns the reduced-motion decision for the move it may
       be about to make — it has the still and the render loop — and
       calls back either way. */
    const go = () => {
      if (sceneApi) sceneApi.diveToDesktop(signIn);
      else signIn();
    };
    if (prefersReducedMotion()) go();
    else setTimeout(go, SIGN_IN_MS);
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
  sceneApi = scene;
  const bar = document.getElementById('screen-back-bar');
  if (bar) bar.hidden = false;

  const back = () => scene.flyFromScreen();
  document.getElementById('screen-back')?.addEventListener('click', back);
  document.querySelector('[data-login-cancel]')?.addEventListener('click', back);
  document.querySelector('.login-dialog .title-bar-controls button')
    ?.addEventListener('click', back);

  /* Escape leaves the monitor — the keyboard's version of clicking the
     room around it, and the same move either way, signed in or not.
     The session is not what it unwinds: the desktop stays signed in
     with its windows where they were, and pressing the monitor again
     comes back to it. Ending a session is Start > Log Off, which is a
     thing you mean rather than a thing you escape.

     What has the first claim on the key is anything already open *on*
     the desktop: a menu closes before the page it is over goes
     anywhere. That is `dismissChrome`, and it reports whether it took
     the press. */
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (dismissChrome()) return;
    if (document.body.classList.contains('screen-focused')) back();
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

  /* Fetch the first-view scene with the entry, before DOM setup. */
  const canvas = document.getElementById('scene');
  if (canvas) {
    Promise.resolve(roomScene)
      .then(async scene => {
        /* The way to the login is the 3D monitor, so the overlay stays
           hidden unless the scene actually came up. */
        if (await scene.initScene(canvas)) {
          initScreenControls(scene);
        }
        else initWithoutScene();
      })
      /* A throw anywhere in the scene's build lands here and the page
         quietly becomes the no-WebGL fallback — which looks exactly
         like a machine without WebGL, and cost a long hunt once. The
         fallback still happens; it just says why first. */
      .catch((e) => { console.error('scene failed to start', e); initWithoutScene(); });
  } else {
    initWithoutScene();
  }
});
