/* ==========================================
   IMPORTS
   ========================================== */
import './style.css';

/* ==========================================
   CONSTANTS
   ========================================== */
const html = document.documentElement;
const menuBtn = document.getElementById('menu-btn');
const mobileMenu = document.getElementById('mobile-menu');
const themeToggleBtn = document.getElementById('theme-toggle');
const backToTopBtn = document.getElementById('back-to-top');
const header = document.querySelector('header');

/* ==========================================
   FUNCTIONS
   ========================================== */
const setThemeClassFromStorage = () => {
  // Default is dark (<html class="dark"> in the markup); storage can override.
  const stored = localStorage.getItem('theme');
  if (stored === 'light') html.classList.remove('dark');
  if (stored === 'dark') html.classList.add('dark');
};

const toggleTheme = () => {
  html.classList.toggle('dark');
  localStorage.setItem('theme', html.classList.contains('dark') ? 'dark' : 'light');
};

// Mobile menu state helpers
const openMobileMenu = () => {
  if (!mobileMenu) return;
  mobileMenu.classList.remove('invisible', 'opacity-0', 'scale-95');
  mobileMenu.classList.add('flex', 'opacity-100', 'scale-100');
  menuBtn?.setAttribute('aria-expanded', 'true');
};

const closeMobileMenu = () => {
  if (!mobileMenu) return;
  mobileMenu.classList.add('invisible', 'opacity-0', 'scale-95');
  mobileMenu.classList.remove('flex', 'opacity-100', 'scale-100');
  menuBtn?.setAttribute('aria-expanded', 'false');
};

const toggleMobileMenu = () => {
  if (!mobileMenu) return;
  if (mobileMenu.classList.contains('invisible')) openMobileMenu();
  else closeMobileMenu();
};

// Back-to-top only earns its place once you are past the first screen.
const setupBackToTop = () => {
  if (!backToTopBtn || !header) return;

  backToTopBtn.classList.add('invisible', 'opacity-0', 'transition-opacity', 'duration-200');

  const observer = new IntersectionObserver(
    ([entry]) => {
      backToTopBtn.classList.toggle('invisible', entry.isIntersecting);
      backToTopBtn.classList.toggle('opacity-0', entry.isIntersecting);
    },
    { threshold: 0 }
  );

  observer.observe(document.getElementById('hero') ?? header);
};

/* ==========================================
   INITIALIZATION (run once on load)
   ========================================== */
setThemeClassFromStorage();
setupBackToTop();

/* ==========================================
   EVENT LISTENERS
   ========================================== */
if (menuBtn && mobileMenu) {
  menuBtn.addEventListener('click', toggleMobileMenu);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMobileMenu();
  });

  document.addEventListener('click', (e) => {
    if (mobileMenu.classList.contains('invisible')) return;
    if (!mobileMenu.contains(e.target) && !menuBtn.contains(e.target)) closeMobileMenu();
  });

  mobileMenu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', closeMobileMenu);
  });
}

themeToggleBtn?.addEventListener('click', toggleTheme);

backToTopBtn?.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
