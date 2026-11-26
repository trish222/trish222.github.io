import { UI } from '../content/content.js';
import { firstVisit } from '../ui/visit.js';
import { installScreenFx } from '../overlay/crtFx.js';
import { arrivalFill } from './camera.js';

// screen_plane's width/height in scene.glb. The boot screen sits where the GLB will put #screen at
// cam_screen before the GLB exists; tests/intro.mjs fails if the two differ by more than a pixel.
const SCREEN_ASPECT = 1.32301;
const PHASE_A = 0.8; // of the bar: scene.glb (download), then the rest (phase B)
const FADE_MS = 450; // #boot.gone's transition
const BLINK_S = 1.1; // .boot-cursor's
const FILL = '#b7f0b0';
const STRIPE_PX = 13;

// Where an element sits in the boot box, in uv (offsets ignore the overlay's transform).
function uvRect(el, root) {
  let x = 0, y = 0;
  for (let n = el; n && n !== root; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
  const { offsetWidth: w, offsetHeight: h } = root;
  return [x / w, y / h, el.offsetWidth / w, el.offsetHeight / h];
}

// The boot screen is on the tube from the first frame: zoomed in, its bar the scene's download
// (phase A). Then the camera flies out while the bar finishes on the monitor through the CRT shader
// (phase B: fonts and the desktop's icons), and "click me" replaces it there on a first visit; a
// returning visitor gets the normal screen instead. `onFill` hands the shader the live bar or cursor.
export function createIntro({ boxWidth, mobile, reducedMotion, onFill, enter }) {
  const screen = document.getElementById('screen');
  const boot = document.getElementById('boot');
  boot.querySelector('#boot-copyright').textContent = UI.copyright;
  const bar = boot.querySelector('.boot-bar');
  const fill = bar.querySelector('span');
  const page = document.getElementById('screen-page');
  let progress = 0, state = 'loading', place = 'screen', snapshot = null, timer = 0;

  function setProgress(f) {
    progress = Math.max(progress, Math.min(f, 1)); // never backwards
    bar.style.setProperty('--p', progress.toFixed(3));
    bar.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
    const [x, y, w, h] = uvRect(fill, boot);
    onFill([x, y, w * progress, h], { color: FILL, stripe: STRIPE_PX / boot.offsetWidth });
  }

  // Before the scene can project it, the box goes where the arrival will put it: centred, straight on.
  function placeBox() {
    const height = boxWidth / SCREEN_ASPECT, vw = innerWidth, vh = innerHeight;
    const k = vh * arrivalFill(SCREEN_ASPECT, vw / vh, mobile()) / height;
    screen.style.width = `${boxWidth}px`;
    screen.style.height = `${height}px`;
    screen.style.transform = `matrix(${k}, 0, 0, ${k}, ${(vw - k * boxWidth) / 2}, ${(vh - k * height) / 2})`;
  }
  placeBox();
  installScreenFx(screen, boxWidth, boxWidth / SCREEN_ASPECT);
  screen.style.setProperty('--zoom', '1');
  screen.hidden = false;
  page.inert = true; // the login under the boot screen takes no focus or typing
  document.body.classList.add('intro');
  addEventListener('resize', placeBox);

  function onKey(e) {
    if ((e.key !== 'Enter' && e.key !== ' ') || (document.activeElement && document.activeElement !== document.body)) return;
    e.preventDefault();
    enter();
  }

  async function showCta() {
    state = 'ready';
    boot.querySelector('#intro-cta span').textContent = UI.introCta;
    boot.classList.add('ready');
    await snapshot.draw();
    if (state !== 'ready') return;
    onFill(uvRect(boot.querySelector('.boot-cursor'), boot), { color: FILL, blink: reducedMotion() ? 0 : BLINK_S });
    addEventListener('keydown', onKey);
    document.body.classList.add('intro-ready');
  }

  function end() {
    state = 'done';
    removeEventListener('keydown', onKey);
    document.body.classList.remove('intro', 'intro-ready');
    page.inert = false;
    onFill(null);
    boot.classList.add('gone');
    const hide = () => { boot.hidden = true; snapshot?.invalidate(); };
    if (place === 'screen' && !reducedMotion()) timer = setTimeout(hide, FADE_MS);
    else hide();
  }

  // Phase B over (or the camera parked): show what comes next where the camera now is.
  function settle() {
    if (state !== 'loaded') return;
    if (place === 'screen') end();
    else if (place === 'desk') firstVisit ? showCta() : end();
  }

  return {
    onProgress(e) { if (e.lengthComputable) setProgress(PHASE_A * e.loaded / e.total); },

    // The scene is up and projecting #screen itself. `wait`: play the intro from the screen;
    // otherwise (review URLs) the boot screen just goes and the camera starts at the desk.
    async start({ wait, still, flyOut }) {
      removeEventListener('resize', placeBox);
      snapshot = still;
      if (!wait) { place = 'desk'; return end(); }
      setProgress(PHASE_A);
      await snapshot.draw(); // the glass hands over to the still, so it must show the boot screen first
      if (state === 'done') return;
      place = 'flying';
      flyOut();
      const tasks = [...[...document.fonts].map((f) => f.load()), ...[...screen.querySelectorAll('img')].map((i) => i.decode())];
      let done = 0;
      await Promise.all(tasks.map((t) => t.catch(() => {}).then(() => setProgress(PHASE_A + (1 - PHASE_A) * ++done / tasks.length))));
      if (state !== 'loading') return;
      state = 'loaded';
      settle();
    },

    // From scene.js as the camera parks: at the screen (arrive) or at the desk (depart).
    at(where) {
      place = where;
      if (where === 'desk') document.body.classList.remove('intro');
      if (state === 'ready' && where === 'screen') end();
      else settle();
    },

    // Without a scene (no WebGL, or it failed) the boot screen must not stay up.
    dispose() {
      state = 'done';
      clearTimeout(timer);
      removeEventListener('resize', placeBox);
      removeEventListener('keydown', onKey);
      document.body.classList.remove('intro', 'intro-ready');
      page.inert = false;
      boot.hidden = true;
    },
  };
}
