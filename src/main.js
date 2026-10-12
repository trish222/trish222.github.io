/* ==========================================
   IMPORTS
   ========================================== */
import './style.css';
import { initField } from './field.js';

/* ==========================================
   CONSTANTS
   ========================================== */
const html = document.documentElement;
const menuBtn = document.getElementById('menu-btn');
const mobileMenu = document.getElementById('mobile-menu');
const themeToggleBtn = document.getElementById('theme-toggle');
const readout = document.getElementById('readout');
const navLinks = Array.from(document.querySelectorAll('#nav-list a[href^="#"]'));

let field = null;

/* ==========================================
   FUNCTIONS
   ========================================== */

// Default is the black plate (<html class="dark">); storage can override.
const syncThemeButton = () => {
  const dark = html.classList.contains('dark');
  themeToggleBtn?.setAttribute('aria-pressed', String(dark));
  themeToggleBtn?.setAttribute(
    'aria-label',
    dark ? 'Switch to the paper plate' : 'Switch to the black plate'
  );
};

const toggleTheme = () => {
  html.classList.toggle('dark');
  localStorage.setItem('theme', html.classList.contains('dark') ? 'dark' : 'light');
  syncThemeButton();
  // The inks are read off the stylesheet, so the field has to re-read them.
  field?.refresh();
};

/* ---------- mobile menu ---------- */

const openMenu = () => {
  mobileMenu?.classList.remove('invisible', 'opacity-0');
  mobileMenu?.classList.add('flex', 'opacity-100');
  menuBtn?.setAttribute('aria-expanded', 'true');
};

const closeMenu = () => {
  mobileMenu?.classList.add('invisible', 'opacity-0');
  mobileMenu?.classList.remove('flex', 'opacity-100');
  menuBtn?.setAttribute('aria-expanded', 'false');
};

const toggleMenu = () => (mobileMenu?.classList.contains('invisible') ? openMenu() : closeMenu());

/* ---------- the wordmark ----------
   CSS transforms do not reserve layout space, so a letter stretched
   to 1.6x simply sits on top of its neighbour. The fitter measures
   each glyph's real advance, renormalises the hand-set widths so the
   line overruns the sheet by a fixed amount at any viewport, and
   gives every span the width its stretched glyph actually occupies. */

// Just under the measure. A glyph's ink runs past its advance at this
// scale, so the line fills the sheet without the outer letters losing
// a stem to the edge — the name is the one thing here that has to stay
// readable.
const BLEED = 0.972;
const MIN_STRETCH = 1.05;
const MAX_STRETCH = 2.6;

const fitWordmark = () => {
  const bleed = document.querySelector('.wm-bleed');
  if (!bleed) return;

  const target = bleed.clientWidth * BLEED;
  if (!target) return;

  bleed.querySelectorAll('.wm-line').forEach((line) => {
    const letters = Array.from(line.children);
    if (!letters.length) return;

    line.style.fontSize = '';
    letters.forEach((el) => { el.style.width = 'auto'; });

    const sx = letters.map(
      (el) => parseFloat(getComputedStyle(el).getPropertyValue('--sx')) || 1
    );
    let natural = letters.map((el) => el.offsetWidth);

    /* A cap in this face is never narrower than a third of its point
       size. Anything smaller means the advances came from a font that
       has not arrived yet, and fitting against those produces a line
       several times too wide. Bail and let a later signal refit. */
    const fontSize = parseFloat(getComputedStyle(line).fontSize);
    if (natural.reduce((a, b) => a + b, 0) < fontSize * letters.length * 0.3) return;

    /* With nothing allowed to narrow, a long line can no longer be made
       to fit by redistributing width — the whole line has to come down
       in size. This is what keeps the name inside a phone. */
    const floorWidth = natural.reduce((sum, w) => sum + w, 0) * MIN_STRETCH;
    if (floorWidth > target) {
      const size = parseFloat(getComputedStyle(line).fontSize);
      line.style.fontSize = `${size * (target / floorWidth)}px`;
      natural = letters.map((el) => el.offsetWidth);
    }

    const total = natural.reduce((sum, w, i) => sum + w * sx[i], 0);
    if (!total) return;

    /* A Didone's hairlines are the first thing to go when a glyph is
       squeezed, and an N whose verticals have thinned out reads as a
       diagonal. So nothing here narrows below its drawn width: letters
       only ever stretch, and whatever width the floor costs is taken
       back off the ones still free to widen. */
    let f = sx.map((v) => v * (target / total));

    for (let pass = 0; pass < 5; pass++) {
      const locked = f.map((v) => v <= MIN_STRETCH);
      const lockedW = natural.reduce((sum, w, i) => sum + (locked[i] ? w * MIN_STRETCH : 0), 0);
      const freeW = natural.reduce((sum, w, i) => sum + (locked[i] ? 0 : w * f[i]), 0);
      if (freeW <= 0) break;

      const adj = (target - lockedW) / freeW;
      const next = f.map((v, i) => (locked[i] ? MIN_STRETCH : v * adj));
      const settled = next.every((v, i) => Math.abs(v - f[i]) < 1e-4);
      f = next;
      if (settled) break;
    }

    letters.forEach((el, i) => {
      const v = Math.min(f[i], MAX_STRETCH);
      el.style.setProperty('--sxf', v.toFixed(4));
      el.style.width = `${natural[i] * v}px`;
    });
  });
};

const setupWordmark = () => {
  fitWordmark();

  /* Every advance the fitter measures comes from the display face, so a
     fit computed against the fallback serif is simply wrong. `ready`
     alone is not enough — it can settle before the face has swapped in
     — so the exact face is requested by name and the fit is redone on
     each of the three signals. Refitting is idempotent. */
  if (document.fonts) {
    document.fonts.ready.then(fitWordmark);
    document.fonts.load('900 100px "Bodoni Moda"').then(fitWordmark, () => {});
    document.fonts.addEventListener?.('loadingdone', fitWordmark);
  }
  window.addEventListener('load', fitWordmark);

  let pending = 0;
  let last = window.innerWidth;
  window.addEventListener('resize', () => {
    if (window.innerWidth === last) return; // ignore mobile URL-bar height changes
    last = window.innerWidth;
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(fitWordmark);
  }, { passive: true });
};

/* ---------- scroll spy ---------- */

// Marks the section the reader is actually in, so the rail stays a map
// rather than a list of five equal links.
const setupScrollSpy = () => {
  const targets = navLinks
    .map((a) => document.querySelector(a.getAttribute('href')))
    .filter(Boolean);
  if (!targets.length) return;

  const mark = (id) =>
    navLinks.forEach((a) =>
      a.setAttribute('aria-current', String(a.getAttribute('href') === `#${id}`))
    );

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible) mark(visible.target.id);
    },
    { rootMargin: '-45% 0px -50% 0px', threshold: 0 }
  );

  targets.forEach((t) => observer.observe(t));
};

/* ---------- the readout ----------
   The screen's own angle and dot pitch, read off the running shader.
   It is there to prove the field is computed rather than a picture. */
const setupReadout = () => {
  if (!readout || !field?.state) {
    readout?.remove();
    return;
  }

  const tick = () => {
    const deg = ((field.state.angle % 360) + 360) % 360;
    readout.textContent = `screen ${deg.toFixed(1)}° · ${field.state.pitchOut.toFixed(1)}px`;
  };

  tick();
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    setInterval(tick, 120);
  }
};

/* ==========================================
   INITIALIZATION
   ========================================== */
syncThemeButton();
setupWordmark();
setupScrollSpy();

initField(document.getElementById('field')).then((f) => {
  field = f;
  setupReadout();
});

/* ==========================================
   EVENT LISTENERS
   ========================================== */
themeToggleBtn?.addEventListener('click', toggleTheme);

if (menuBtn && mobileMenu) {
  menuBtn.addEventListener('click', toggleMenu);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !mobileMenu.classList.contains('invisible')) {
      closeMenu();
      menuBtn.focus();
    }
  });

  document.addEventListener('click', (e) => {
    if (mobileMenu.classList.contains('invisible')) return;
    if (!mobileMenu.contains(e.target) && !menuBtn.contains(e.target)) closeMenu();
  });

  mobileMenu.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
}
