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
   Two words of wildly different length, both asked to run the full
   measure. Canobis is a narrow face — about 0.45em of advance per cap
   — so reaching that measure takes either a lot of stretch or a lot of
   point size, and TRISH, being three caps shorter than NGUYEN, would
   take a third more of whichever one you pick.

   Letting them share a point size is what makes the two lines look
   like two different fonts: one line comes out at 1.6x and the one
   under it at 1.1x, and a stretched stem is a heavier stem. So the
   shared quantity here is the STRETCH, not the size. Each line is set
   at whatever point size brings it to the margin at the one stretch
   both lines can afford, which is how a line of wood type gets
   justified: the shorter word is simply set larger.

   CSS transforms do not reserve layout space, so the fitter also hands
   each span the width its stretched glyph actually occupies. */

// Just under the measure. Canobis keeps its ink inside its advance, so
// this is honest margin rather than overshoot allowance — the name is
// the one thing here that has to stay readable, and it should not lose
// a stem to the edge of the sheet.
const BLEED = 0.972;

// Nothing narrows: a squeezed Canobis bowl stops reading as this face.
const MIN_STRETCH = 1.0;
/* And past about 1.75 it stops reading as this face in the other
   direction — the bowls flatten into lozenges. Between those two the
   point size is free to move, and does. */
const MAX_STRETCH = 1.75;

const emOf = (px, fontSize) => (fontSize > 0 ? px / fontSize : 0);

const fitWordmark = () => {
  const bleed = document.querySelector('.wm-bleed');
  if (!bleed) return;

  const measure = bleed.clientWidth * BLEED;
  if (!measure) return;

  const lines = Array.from(bleed.querySelectorAll('.wm-line'));
  if (!lines.length) return;

  /* ---- 1. what each line costs, in ems of its own type ---- */

  const plan = lines.map((line) => {
    const letters = Array.from(line.children);
    line.style.fontSize = '';
    letters.forEach((el) => { el.style.width = 'auto'; });

    const base = parseFloat(getComputedStyle(line).fontSize);
    const gap = parseFloat(getComputedStyle(line).columnGap) || 0;
    const advance = letters.reduce((sum, el) => sum + el.offsetWidth, 0);

    return {
      line,
      letters,
      base,
      // The budget is the size the stylesheet asked for. Solving for a
      // shared stretch moves the lines off it in both directions; what
      // is conserved is their total, so the stack keeps the height the
      // clamp was written to give it.
      advanceEm: emOf(advance, base),
      gapEm: emOf(gap * Math.max(letters.length - 1, 0), base),
      loaded: advance >= base * letters.length * 0.3,
    };
  });

  /* Canobis's narrowest cap is the I at 0.19em; everything else sits
     near 0.45em, so a real line averages well clear of 0.3em. Anything
     under that means the advances came from a face that has not
     arrived yet, and fitting against those produces a line several
     times too wide. Bail and let a later signal refit. */
  if (plan.some((p) => !p.letters.length || !p.loaded || !p.advanceEm)) return;

  /* ---- 2. the one stretch all the lines can afford ---- */

  // At stretch k a line needs measure / (advanceEm * k + gapEm) of
  // point size to reach the margin. That shrinks as k grows, so the
  // stack's total height falls monotonically in k and bisection finds
  // the gentlest stretch the height budget will take.
  const budget = plan.reduce((sum, p) => sum + p.base, 0);
  const sizesAt = (k) => plan.map((p) => measure / (p.advanceEm * k + p.gapEm));
  const totalAt = (k) => sizesAt(k).reduce((sum, v) => sum + v, 0);

  let k;
  if (totalAt(MIN_STRETCH) <= budget) {
    k = MIN_STRETCH;           // the measure is short enough to fill undistorted
  } else if (totalAt(MAX_STRETCH) >= budget) {
    /* A very wide sheet: even at the ceiling the type needed to reach
       both margins overruns the budget. The margins win — the name
       still bleeds, the stack is simply taller than the clamp asked. */
    k = MAX_STRETCH;
  } else {
    let lo = MIN_STRETCH;
    let hi = MAX_STRETCH;
    for (let i = 0; i < 28; i++) {
      const mid = (lo + hi) / 2;
      if (totalAt(mid) > budget) lo = mid; else hi = mid;
    }
    k = hi;
  }

  const sizes = sizesAt(k);

  /* ---- 3. set each line, then share out the hand-set ripple ---- */

  plan.forEach((p, li) => {
    const { line, letters } = p;
    line.style.fontSize = `${sizes[li]}px`;

    const gap = parseFloat(getComputedStyle(line).columnGap) || 0;
    const target = measure - gap * Math.max(letters.length - 1, 0);
    if (target <= 0) return;

    const natural = letters.map((el) => el.offsetWidth);
    const sx = letters.map(
      (el) => parseFloat(getComputedStyle(el).getPropertyValue('--sx')) || 1
    );

    const total = natural.reduce((sum, w, i) => sum + w * sx[i], 0);
    if (!total) return;

    /* The ripple is relative: it says which letters carry a little more
       of the line than their neighbours, not how wide any of them is.
       Renormalising it against the measure is what turns it into real
       widths, and nothing is allowed below its drawn width — whatever
       the floor costs is taken back off the letters still free. */
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
      const v = Math.min(Math.max(f[i], MIN_STRETCH), MAX_STRETCH);
      el.style.setProperty('--sxf', v.toFixed(4));
      el.style.width = `${natural[i] * v}px`;
    });
  });
};

const setupWordmark = () => {
  fitWordmark();

  /* Every advance the fitter measures comes from the wordmark face, so a
     fit computed against the fallback serif is simply wrong. `ready`
     alone is not enough — it can settle before the face has swapped in
     — so the exact face is requested by name and the fit is redone on
     each of the three signals. Refitting is idempotent. */
  if (document.fonts) {
    document.fonts.ready.then(fitWordmark);
    document.fonts.load('400 100px "Canobis Demo"').then(fitWordmark, () => {});
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
