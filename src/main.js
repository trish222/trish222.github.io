/* ==========================================
   IMPORTS
   ========================================== */
import './style.css';
import { initHalftoneWordmark } from './halftone-wordmark.js';

/* ==========================================
   CONSTANTS
   ========================================== */
const html = document.documentElement;
const menuBtn = document.getElementById('menu-btn');
const mobileMenu = document.getElementById('mobile-menu');
const themeToggleBtn = document.getElementById('theme-toggle');
const folders = document.querySelectorAll(".folder-container");
const navLinks = document.getElementById('nav-links');
const navGlider = document.getElementById('nav-glider');
const paletteRow = document.getElementById('palette-row');
const paletteName = document.getElementById('palette-name');
const palettePicker = document.querySelector('.palette-picker');
const heroScript = document.querySelector('.hero-script');

// How wide the dot wordmark is drawn, as a multiple of the hero's width. The
// signature is then stretched to exactly this same width, so the two readings
// of the name line up. Raise it past 1 to let the word bleed off the edges.
const WORD_FIT = 1.02;

/* ==========================================
   PALETTES
   Each one is the whole page: `bg`, `text` and `accent` are written inline onto
   <html> as --color-page-bg / --color-page-text / --color-accent, which beats
   the rules in style.css, and `dark` drives the `dark` class so Tailwind's
   dark: utilities stay honest. `strip` is only what the swatch itself shows.
   ========================================== */
const PALETTES = [
  { id: 'noir',    name: 'Noir',      dark: true,  bg: '#121321', text: '#f8fafc', accent: '#d946ef',
    strip: ['#121321', '#d946ef', '#22d3ee'] },
  { id: 'paper',   name: 'Paper',     dark: false, bg: '#ffffff', text: '#0f172a', accent: '#22d3ee',
    strip: ['#ffffff', '#0f172a', '#22d3ee'] },
  { id: 'blossom', name: 'Blossom',   dark: false, bg: '#ffcfd2', text: '#553e4e', accent: '#e0479e',
    strip: ['#ffcfd2', '#ffafc5', '#e0479e', '#553e4e'] },
  { id: 'mauve',   name: 'Mauve',     dark: true,  bg: '#553e4e', text: '#ffcfd2', accent: '#ffafc5',
    strip: ['#553e4e', '#e0479e', '#ffafc5', '#ffcfd2'] },
  { id: 'fern',    name: 'Fern',      dark: true,  bg: '#1e2a20', text: '#e7efe4', accent: '#547854',
    strip: ['#1e2a20', '#547854', '#b9d2b1'] },
  { id: 'baltic',  name: 'Baltic',    dark: true,  bg: '#33658a', text: '#ffffff', accent: '#f6ae2d',
    strip: ['#33658a', '#86bbd8', '#f6ae2d', '#f26419'] },
  { id: 'sky',     name: 'Sky',       dark: false, bg: '#86bbd8', text: '#17262f', accent: '#f26419',
    strip: ['#86bbd8', '#758e4f', '#f6ae2d', '#f26419'] },
  { id: 'oak',     name: 'Pale Oak',  dark: false, bg: '#dac6b5', text: '#43352c', accent: '#a18276',
    strip: ['#a18276', '#dac6b5', '#f1d6b8', '#fbacbe'] },
  { id: 'blaze',   name: 'Blaze',     dark: true,  bg: '#1a1410', text: '#f6e7d8', accent: '#f26419',
    strip: ['#1a1410', '#f26419', '#f6ae2d'] },
];

const DEFAULT_PALETTE = PALETTES[0];
const hero = document.getElementById('hero');
let halftoneHero = null; // set once the hero dot field is wired up
let activePalette = null;  // set by applyPalette()

/* ==========================================
   FUNCTIONS
   ========================================== */
const paletteById = (id) => PALETTES.find((p) => p.id === id);

// The one place a palette is actually applied.
const applyPalette = (palette, persist = true) => {
  html.style.setProperty('--color-page-bg', palette.bg);
  html.style.setProperty('--color-page-text', palette.text);
  html.style.setProperty('--color-accent', palette.accent);
  html.classList.toggle('dark', palette.dark);
  activePalette = palette;

  if (persist) {
    localStorage.setItem('palette', palette.id);
    // What the inline <head> script replays before first paint, so a reload
    // doesn't flash the default palette. Kept as plain values so that script
    // never needs a copy of this table.
    localStorage.setItem('palette-vars', JSON.stringify({
      dark: palette.dark, bg: palette.bg, text: palette.text, accent: palette.accent,
    }));
    // legacy key, still read by the head script as a fallback
    localStorage.setItem('theme', palette.dark ? 'dark' : 'light');
  }

  if (paletteRow) {
    paletteRow.querySelectorAll('.swatch').forEach((btn) => {
      const on = btn.dataset.palette === palette.id;
      btn.setAttribute('aria-checked', String(on));
      btn.tabIndex = on ? 0 : -1;
    });
  }
  if (paletteName) paletteName.textContent = palette.name;

  // the dot field paints from CSS vars, so it has to be told to re-read them
  if (halftoneHero) halftoneHero.refresh();
};

const setPaletteFromStorage = () => {
  const stored = paletteById(localStorage.getItem('palette'));
  if (stored) return applyPalette(stored, false);
  // nothing stored: honour the old light/dark key, then fall back to the default
  const legacy = localStorage.getItem('theme');
  applyPalette(legacy === 'light' ? paletteById('paper') : DEFAULT_PALETTE, false);
};

// The sun/moon button is a shortcut between the two neutral palettes. Any other
// palette already carries its own light/dark side, so this just crosses over.
const toggleTheme = () => {
  applyPalette(activePalette.dark ? paletteById('paper') : DEFAULT_PALETTE);
};

// Mobile menu state helpers
const openMobileMenu = () => {
  if (!mobileMenu) return;
  mobileMenu.classList.remove("invisible", "opacity-0", "scale-95");
  mobileMenu.classList.add("visible", "opacity-100", "scale-100");
  if (menuBtn) menuBtn.setAttribute("aria-expanded", "true");
  // the sheet drops exactly where the swatches sit, so they step aside
  if (palettePicker) palettePicker.classList.add("is-hidden");
};

const closeMobileMenu = () => {
  if (!mobileMenu) return;
  mobileMenu.classList.add("invisible", "opacity-0", "scale-95");
  mobileMenu.classList.remove("visible", "opacity-100", "scale-100");
  if (menuBtn) menuBtn.setAttribute("aria-expanded", "false");
  if (palettePicker) palettePicker.classList.remove("is-hidden");
};

const toggleMobileMenu = () => {
  if (!mobileMenu) return;
  const isOpen = mobileMenu.classList.contains("visible");
  if (isOpen) closeMobileMenu();
  else openMobileMenu();
};

// Glow-on-scroll setup
const setupGlowOnScroll = () => {
  if (!folders.length) return;

  // Accessibility: reduce motion
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    folders.forEach((el) => el.classList.add("is-active"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        // Glow only while visible
        if (entry.isIntersecting) entry.target.classList.add("is-active");
        else entry.target.classList.remove("is-active");
      });
    },
    { threshold: 0.35 }
  );

  folders.forEach((el) => observer.observe(el));
};

// The palette picker: one square per entry in PALETTES, each painted with its
// own colours as hard-stop bands so the square reads as a palette strip.
const setupPaletteRow = () => {
  if (!paletteRow) return;

  PALETTES.forEach((palette) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'swatch';
    btn.dataset.palette = palette.id;
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', 'false');
    btn.setAttribute('aria-label', palette.name + ' colour theme');
    btn.title = palette.name;
    btn.tabIndex = -1;

    // vertical hard-stop bands, like the palette strips this came from
    const step = 100 / palette.strip.length;
    const stops = palette.strip
      .map((c, i) => c + ' ' + (i * step) + '% ' + ((i + 1) * step) + '%')
      .join(', ');
    btn.style.setProperty('--strip', 'linear-gradient(90deg, ' + stops + ')');

    btn.addEventListener('click', () => applyPalette(palette));
    // hovering previews the name without committing to the palette
    btn.addEventListener('pointerenter', () => {
      if (paletteName) paletteName.textContent = palette.name;
    });
    btn.addEventListener('focus', () => {
      if (paletteName) paletteName.textContent = palette.name;
    });
    paletteRow.appendChild(btn);
  });

  // leaving the row puts the active palette's name back
  paletteRow.addEventListener('pointerleave', () => {
    if (paletteName && activePalette) paletteName.textContent = activePalette.name;
  });

  // arrow keys move between swatches, as a radiogroup should
  paletteRow.addEventListener('keydown', (e) => {
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    const dir = keys[e.key];
    if (!dir) return;
    e.preventDefault();
    const btns = [...paletteRow.querySelectorAll('.swatch')];
    const i = btns.indexOf(document.activeElement);
    const next = btns[(i + dir + btns.length) % btns.length];
    next.focus();
    applyPalette(paletteById(next.dataset.palette));
  });
};

// The highlight behind the nav links is a single element, moved and resized to
// whichever link the pointer is on, so it slides between them instead of
// fading in place. Measured from live layout, so font loading can't skew it.
const setupNavGlider = () => {
  if (!navLinks || !navGlider) return;

  const moveTo = (link) => {
    const parent = link.parentElement; // the <li>, which is what the row lays out
    navGlider.style.width = parent.offsetWidth + 'px';
    navGlider.style.transform = 'translateX(' + parent.offsetLeft + 'px)';
    navGlider.style.opacity = '1';
  };

  const hide = () => { navGlider.style.opacity = '0'; };

  navLinks.querySelectorAll('a').forEach((link) => {
    link.addEventListener('pointerenter', () => moveTo(link));
    link.addEventListener('focus', () => moveTo(link));
    link.addEventListener('blur', hide);
  });

  navLinks.addEventListener('pointerleave', hide);
};

// Stretch the Ballet signature to the same width the dot wordmark is drawn at.
// Measured rather than guessed: the script's natural width depends on the font
// actually being loaded, so this runs again after document.fonts.ready.
const fitSignature = () => {
  if (!heroScript || !hero) return;
  // offsetWidth is the laid-out width, which the transform doesn't touch
  const natural = heroScript.offsetWidth;
  if (!natural) return;
  const target = hero.clientWidth * WORD_FIT;
  heroScript.style.setProperty('--sig-stretch', (target / natural).toFixed(3));
};

// Size the hero to whatever is left of the first screen. Done here rather than
// in CSS because the height of everything above it isn't a constant we can
// subtract. Measuring the hero's own offset covers the nav and anything else
// that lands above it. The dot field watches the hero with a ResizeObserver,
// so it re-sets the word on its own once the height changes.
const fitHeroToFirstScreen = () => {
  if (!hero) return;
  const top = hero.getBoundingClientRect().top + window.scrollY;
  hero.style.height = Math.max(320, window.innerHeight - top) + 'px';
};

// Hero wordmark (interactive canvas dot field)
const setupHalftoneHero = () => {
  if (!hero) return;
  fitHeroToFirstScreen();
  halftoneHero = initHalftoneWordmark(hero, {
    fontWeight: 900,              // Montserrat Black prints the heaviest dots
    stack: ['TRISH', 'NGUYEN'],   // phones get the name on two lines instead
    fit: WORD_FIT,
    dotGap: 6,
    radius: 110,
  });
};

/* ==========================================
   INITIALIZATION (run once on load)
   ========================================== */
setupPaletteRow();
setPaletteFromStorage();
setupGlowOnScroll();
setupNavGlider();
setupHalftoneHero();
fitSignature();

/* ==========================================
   EVENT LISTENERS
   ========================================== */

if (menuBtn && mobileMenu) {
  menuBtn.addEventListener("click", toggleMobileMenu);

  // close menu on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMobileMenu();
  });

  // close menu if you click outside it
  document.addEventListener("click", (e) => {
    if (!mobileMenu.classList.contains("visible")) return;

    const clickedInsideMenu = mobileMenu.contains(e.target);
    const clickedMenuBtn = menuBtn.contains(e.target);

    if (!clickedInsideMenu && !clickedMenuBtn) closeMobileMenu();
  });

  // close the menu when menu option is clicked
  mobileMenu.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      closeMobileMenu();
    })
  })
}


if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', toggleTheme);
}

window.addEventListener('resize', () => {
  fitHeroToFirstScreen();
  fitSignature();
});

// the nav grows when Montserrat lands, so the hero has to be re-measured after
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => {
    fitHeroToFirstScreen();
    fitSignature();   // Ballet's real width is only known once it has landed
  });
}
