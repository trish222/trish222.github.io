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
const hero = document.getElementById('hero');
let halftoneHero = null; // set once the hero dot field is wired up

/* ==========================================
   FUNCTIONS
   ========================================== */
const setThemeClassFromStorage = () => {
  // Default is dark (you already set <html class="dark"> in HTML)
  // But if storage says light, remove dark.
  const stored = localStorage.getItem("theme");
  if (stored === "light") html.classList.remove("dark");
  if (stored === "dark") html.classList.add("dark");
};

const toggleTheme = () => {
    html.classList.toggle('dark');
    const isDark = html.classList.contains('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    // the dot field paints from CSS vars, so it has to be told to re-read them
    if (halftoneHero) halftoneHero.refresh();
};

// Mobile menu state helpers
const openMobileMenu = () => {
  if (!mobileMenu) return;
  mobileMenu.classList.remove("invisible", "opacity-0", "scale-95");
  mobileMenu.classList.add("visible", "opacity-100", "scale-100");
  if (menuBtn) menuBtn.setAttribute("aria-expanded", "true");
};

const closeMobileMenu = () => {
  if (!mobileMenu) return;
  mobileMenu.classList.add("invisible", "opacity-0", "scale-95");
  mobileMenu.classList.remove("visible", "opacity-100", "scale-100");
  if (menuBtn) menuBtn.setAttribute("aria-expanded", "false");
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
    dotGap: 6,
    radius: 110,
  });
};

/* ==========================================
   INITIALIZATION (run once on load)
   ========================================== */
setThemeClassFromStorage();
setupGlowOnScroll();
setupNavGlider();
setupHalftoneHero();

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

window.addEventListener('resize', fitHeroToFirstScreen);

// the nav grows when Montserrat lands, so the hero has to be re-measured after
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(fitHeroToFirstScreen);
}
