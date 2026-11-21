import { UI } from '../content/content.js';
import { firstVisit } from '../ui/visit.js';

const FINISH_MS = 900; // the bar tops out and the boot screen fades before the screen shows
const SKIP_KEYS = new Set(['Enter', ' ', 'Escape']);

// The boot screen covers the page while scene.glb downloads (its bar is the download). Then the
// camera waits at the screen behind "click me" until pressed; a returning visitor flies straight
// out. Once loaded, a click, Enter, Space or Escape skips the rest of the boot screen.
export function createIntro({ reducedMotion }) {
  const boot = document.getElementById('boot');
  const bar = boot?.querySelector('.boot-bar');
  const screen = document.getElementById('intro-screen');
  const cta = document.getElementById('intro-cta');
  let timer = 0, skip = null;

  function setProgress(f) {
    bar?.style.setProperty('--p', f.toFixed(3));
    bar?.setAttribute('aria-valuenow', String(Math.round(f * 100)));
  }

  function stopSkip() {
    clearTimeout(timer);
    if (skip) for (const type of ['pointerdown', 'keydown']) window.removeEventListener(type, skip, true);
    skip = null;
  }

  return {
    // Downloading is the first 90%; the rest is decoding and the first frame.
    onProgress(e) {
      if (e.lengthComputable) setProgress(0.9 * e.loaded / e.total);
      else bar?.classList.add('indeterminate');
    },

    // `wait`: hold at the screen; otherwise the boot screen just goes (review URLs start at the desk).
    start({ wait, flyOut }) {
      setProgress(1);
      if (!wait) return boot?.remove();
      document.body.classList.add('intro');
      cta.textContent = UI.introCta;
      // The whole picture is the button (the CTA's click, and so Enter/Space, bubbles here).
      // Not on to #screen, whose own click handler would fly straight back in.
      screen.onclick = (e) => { e.stopPropagation(); flyOut(); };
      const finish = () => {
        stopSkip();
        boot?.classList.add('gone');
        if (!firstVisit) return flyOut();
        document.body.classList.add('intro-ready');
        cta.focus({ preventScroll: true });
      };
      skip = (e) => {
        if (e.type === 'keydown' && !SKIP_KEYS.has(e.key)) return;
        e.preventDefault();
        e.stopPropagation();
        finish();
      };
      for (const type of ['pointerdown', 'keydown']) window.addEventListener(type, skip, true);
      boot?.classList.add('done');
      timer = setTimeout(finish, reducedMotion() ? 0 : FINISH_MS);
    },

    // Called as the camera leaves the screen, by whatever started it ("click me", Escape, the room).
    end() { document.body.classList.remove('intro', 'intro-ready'); },

    // Without a scene (no WebGL, or it failed) the boot screen must not stay up.
    dispose() { stopSkip(); boot?.remove(); this.end(); },
  };
}
