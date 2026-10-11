import './style.css';
import './themes.css';
import { initInkField } from './ink-field.js';

const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const fine = matchMedia('(hover: hover) and (pointer: fine)');

/* ===========================================================================
   THE INK FIELD
   =========================================================================== */

const field = initInkField(document.getElementById('ink-field'));

/* ===========================================================================
   PALETTE TRIALS
   A trial rig for choosing the ink set. The palettes themselves live in
   themes.css — one block of four inks each — so this only has to name them,
   put the attribute on <html>, and re-pour the same four colours into the
   shader, which has no cascade to read them from.
   =========================================================================== */

const THEMES = [
  'press', 'riso', 'oxide', 'ledger', 'amber', 'graphite', 'plum',
  'noir', 'blueprint', 'phosphor', 'violet', 'ember',
];
const STORE = 'trish:theme';

/* The shader wants 0..1 triples. Measuring a real element rather than parsing
   the token means color-mix() and keywords resolve too, and it stays correct
   if a palette ever stops being plain hex. It sits on <body> so it reads the
   ROOT theme — a swatch button carries its own. */
const meter = document.createElement('span');
meter.setAttribute('aria-hidden', 'true');
meter.style.cssText = 'position:absolute;width:0;height:0;visibility:hidden';
document.body.append(meter);

function rgb(expr) {
  meter.style.color = '';
  meter.style.color = expr;
  const n = getComputedStyle(meter).color.match(/[\d.]+/g);
  return n ? [n[0] / 255, n[1] / 255, n[2] / 255] : [0, 0, 0];
}

const themeColor = document.querySelector('meta[name="theme-color"]');
const colorScheme = document.querySelector('meta[name="color-scheme"]');
const probe = document.getElementById('probe');

let current = THEMES[0];

function applyTheme(name, { persist = true } = {}) {
  current = THEMES.includes(name) ? name : THEMES[0];
  root.dataset.theme = current;

  /* the shader's four inks are the page's four inks */
  field?.set({
    paper: rgb('var(--paper)'),
    line:  rgb('var(--blue)'),
    haze:  rgb('var(--haze)'),
    ink:   rgb('var(--ink)'),
  });

  /* browser chrome: the address bar and form controls are part of the sheet */
  meter.style.color = 'var(--paper)';
  if (themeColor) themeColor.content = getComputedStyle(meter).color;
  if (colorScheme) colorScheme.content = getComputedStyle(root).colorScheme || 'light';

  probe?.querySelectorAll('.swatch').forEach((b) => {
    const on = b.dataset.theme === current;
    b.setAttribute('aria-pressed', String(on));
    /* the strip overflows on a phone, so keyboard cycling has to bring the
       selected swatch back into the band */
    if (on) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });

  if (persist) { try { localStorage.setItem(STORE, current); } catch {} }
}

if (probe) {
  probe.hidden = false;
  root.classList.add('has-probe');   /* html, not body: scroll-padding reads it */

  const label = document.createElement('p');
  label.className = 'mono probe-label';
  label.textContent = 'Ink set';

  const set = document.createElement('div');
  set.className = 'probe-set';
  set.setAttribute('role', 'group');
  set.setAttribute('aria-label', 'Colour theme');

  THEMES.forEach((name) => {
    const b = document.createElement('button');
    b.className = 'swatch';
    /* the attribute is what paints it: themes.css matches [data-theme] on any
       element, so the button inherits the palette it stands for */
    b.dataset.theme = name;
    b.dataset.name = name;
    b.type = 'button';
    b.setAttribute('aria-pressed', 'false');
    b.setAttribute('aria-label', `Theme: ${name}`);
    b.addEventListener('click', () => applyTheme(name));
    set.append(b);
  });

  const hint = document.createElement('p');
  hint.className = 'mono probe-hint';
  hint.innerHTML = '<kbd>T</kbd> next <span aria-hidden="true">·</span> <kbd>\u21e7T</kbd> back';

  probe.append(label, set, hint);

  addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() !== 't' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest('input, textarea, select, [contenteditable]')) return;
    const i = THEMES.indexOf(current);
    const step = e.shiftKey ? -1 : 1;
    applyTheme(THEMES[(i + step + THEMES.length) % THEMES.length]);
  });
}

let saved = null;
try { saved = localStorage.getItem(STORE); } catch {}
applyTheme(saved || THEMES[0], { persist: false });

/* ===========================================================================
   REGISTRATION
   The one authored gesture: three ink plates land out of register, converge,
   and from then on drift with the pointer. Everything that moves on this page
   is this same idea at a different amplitude.
   =========================================================================== */

const BOOT_MS = 1100;

requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    root.classList.remove('booting');
    setTimeout(() => root.style.setProperty('--reg-dur', '420ms'), BOOT_MS);
  });
});

if (fine.matches && !reduced.matches) {
  let rx = 0, ry = 0, queued = false;

  const commit = () => {
    queued = false;
    root.style.setProperty('--reg-x', `${rx.toFixed(2)}px`);
    root.style.setProperty('--reg-y', `${ry.toFixed(2)}px`);
    field?.setRegistration(rx / 16);
  };

  addEventListener('pointermove', (e) => {
    // -1..1 from the centre of the viewport, scaled to a plate's worth of slip
    rx = ((e.clientX / innerWidth) * 2 - 1) * 16;
    ry = ((e.clientY / innerHeight) * 2 - 1) * 9;
    if (!queued) { queued = true; requestAnimationFrame(commit); }
  }, { passive: true });
}

/* ===========================================================================
   FIELD READOUT
   Proof that the background is computed. Throttled to 6/sec so it reads as an
   instrument rather than a flicker.
   =========================================================================== */

const outT = document.getElementById('readout-t');
const outS = document.getElementById('readout-s');

if (field && outT && outS && !reduced.matches) {
  const tick = () => {
    const { t, sep } = field.read();
    outT.textContent = t.toFixed(4);
    outS.textContent = (sep >= 0 ? '+' : '−') + Math.abs(sep).toFixed(3);
  };
  tick();
  setInterval(() => { if (!document.hidden) tick(); }, 166);
} else if (outT && outS) {
  outT.textContent = '0.0000';
  outS.textContent = '+0.000';
}

/* ===========================================================================
   PHONE SHEET
   =========================================================================== */

const menuBtn = document.getElementById('menu-btn');
const sheet = document.getElementById('sheet');

if (menuBtn && sheet) {
  const setSheet = (open) => {
    sheet.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.querySelector('.rail-menu-word').textContent = open ? 'Close' : 'Index';
    document.body.style.overflow = open ? 'hidden' : '';
  };

  menuBtn.addEventListener('click', () => setSheet(sheet.hidden));
  sheet.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setSheet(false)));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sheet.hidden) setSheet(false); });
  matchMedia('(min-width: 761px)').addEventListener('change', (e) => { if (e.matches) setSheet(false); });
}

/* ===========================================================================
   SECTION ARRIVAL + CURRENT SECTION
   =========================================================================== */

const revealTargets = document.querySelectorAll(
  '.band .rule, .band .head, .band .lede, .two-col, .ledger, .plates, .matrix, .mailto, .elsewhere, .work-aside'
);
revealTargets.forEach((el) => el.classList.add('reveal'));

if (!reduced.matches && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
  revealTargets.forEach((el) => io.observe(el));
} else {
  revealTargets.forEach((el) => el.classList.add('is-in'));
}

const railLinks = [...document.querySelectorAll('.rail-nav a')];
const sections = railLinks
  .map((a) => document.querySelector(a.getAttribute('href')))
  .filter(Boolean);

if (sections.length) {
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const i = sections.indexOf(entry.target);
      railLinks.forEach((a, n) =>
        n === i ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current'));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach((s) => spy.observe(s));
}

/* ===========================================================================
   BACK TO TOP
   =========================================================================== */

const toTop = document.getElementById('totop');
if (toTop) {
  const hero = document.getElementById('top');
  const io = new IntersectionObserver(
    ([e]) => toTop.classList.toggle('is-on', !e.isIntersecting),
    { threshold: 0 }
  );
  if (hero) io.observe(hero);
}

/* ===========================================================================
   COLOPHON YEAR
   =========================================================================== */

const year = document.getElementById('year');
if (year) year.textContent = String(new Date().getFullYear());
