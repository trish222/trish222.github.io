import { desktopEvents } from './session.js';
import * as roomScene from '../scene.js';
import { WINDOWS, resetWindows, openWindow, closeWindow, blurWindows, updateTaskbar, fitAllWindows, initDragging, initWindowControls } from './windows.js';

/* ==========================================
   WINDOW REGISTRY
   ========================================== */
/* Add a window by adding markup in index.html *and* an entry here. The
   `icon` is a basename in public/icons/ (see scripts/make-icons.mjs);
   an entry whose `#window-<id>` does not exist yet is simply skipped,
   which is what lets the desktop icons land before their windows do. */
function updateClock() {
  const el = document.getElementById('taskbar-clock');
  const now = new Date();
  const h = now.getHours();
  const m = String(now.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const text = `${(h % 12) || 12}:${m} ${ampm}`;
  // The display has minute precision. Avoid replacing its text node on
  // every one-second poll and invalidating the transformed desktop.
  if (el.textContent !== text) el.textContent = text;
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

  desktopEvents.on(startBtn, 'click', e => {
    e.stopPropagation();
    setStartMenu(startMenu.classList.contains('hidden'));
  });

  desktopEvents.on(document, 'click', () => setStartMenu(false));

  document.querySelectorAll('.start-menu-item[data-window]').forEach(item => {
    desktopEvents.on(item, 'click', () => {
      openWindow(item.dataset.window);
      setStartMenu(false);
    });
  });

  desktopEvents.on(document.getElementById('logoff-item'), 'click', () => {
    setStartMenu(false);
    logOff();
  });

  desktopEvents.on(document.getElementById('shutdown-item'), 'click', () => {
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
  desktopEvents.on(document, 'pointerdown', e => {
    lastPointerType = e.pointerType || 'mouse';
  }, true);
}

function initDesktopIcons() {
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
  desktopEvents.on(list, 'click', e => selectBinRow(e.target.closest('.bin-item')));
  desktopEvents.on(list, 'focusin', e => selectBinRow(e.target.closest('.bin-item')));

  desktopEvents.on(document.getElementById('bin-empty-btn'), 'click', () => {
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
  else desktopEvents.timeout(rise, LOG_OFF_MS);
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

  desktopEvents.on(form, 'submit', e => {
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
    else desktopEvents.timeout(go, SIGN_IN_MS);
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
  desktopEvents.on(document.getElementById('screen-back'), 'click', back);
  desktopEvents.on(document.querySelector('[data-login-cancel]'), 'click', back);
  desktopEvents.on(document.querySelector('.login-dialog .title-bar-controls button'), 'click', back);

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
  desktopEvents.on(document, 'keydown', e => {
    if (e.key !== 'Escape') return;
    if (dismissChrome()) return;
    if (document.body.classList.contains('screen-focused')) back();
  });
}

/* ==========================================
   INIT
   ========================================== */

let desktopGeneration = 0;

export function initDesktop() {
  disposeDesktop();
  const generation = ++desktopGeneration;
  desktopEvents.reset();
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
  desktopEvents.on(window, 'resize', fitAllWindows);

  updateClock();
  desktopEvents.interval(updateClock, 1000);

  initLoginScreen();

  /* Fetch the first-view scene with the entry, before DOM setup. */
  const canvas = document.getElementById('scene');
  if (canvas) {
    Promise.resolve(roomScene)
      .then(async scene => {
        if (generation !== desktopGeneration) return;
        /* The way to the login is the 3D monitor, so the overlay stays
           hidden unless the scene actually came up. */
        const ready = await scene.initScene(canvas);
        if (generation !== desktopGeneration) return;
        if (ready) {
          initScreenControls(scene);
        }
        else initWithoutScene();
      })
      /* A throw anywhere in the scene's build lands here and the page
         quietly becomes the no-WebGL fallback — which looks exactly
         like a machine without WebGL, and cost a long hunt once. The
         fallback still happens; it just says why first. */
      .catch((e) => { if (generation !== desktopGeneration) return; console.error('scene failed to start', e); roomScene.disposeScene(); initWithoutScene(); });
  } else {
    initWithoutScene();
  }
}

export function disposeDesktop() {
  desktopGeneration++;
  desktopEvents.dispose();
  resetWindows();
  roomScene.disposeScene();
  sceneApi = null;
  signingIn = false;
}
