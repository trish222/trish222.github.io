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
const folders = document.querySelectorAll(".folder-container");


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
};

// Mobile menu state helpers
const openMobileMenu = () => {
  if (!mobileMenu) return;
  mobileMenu.classList.remove("invisible", "opacity-0", "scale-95");
  mobileMenu.classList.add("visible", "opacity-100", "scale-100");
};

const closeMobileMenu = () => {
  if (!mobileMenu) return;
  mobileMenu.classList.add("invisible", "opacity-0", "scale-95");
  mobileMenu.classList.remove("visible", "opacity-100", "scale-100");
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

/* ==========================================
   INITIALIZATION (run once on load)
   ========================================== */
setThemeClassFromStorage();
setupGlowOnScroll();

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
}

if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', toggleTheme);
}