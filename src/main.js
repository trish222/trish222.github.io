import './style.css';
import { initInkField } from './ink-field.js';

const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const fine = matchMedia('(hover: hover) and (pointer: fine)');

/* ===========================================================================
   THE INK FIELD
   =========================================================================== */

const field = initInkField(document.getElementById('ink-field'));

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
