import './style.css';

/* ==========================================
   CONSTANTS
   ========================================== */
const menuBtn = document.getElementById('menu-btn');
const mobileMenu = document.getElementById('mobile-menu');
const html = document.documentElement;
const themeToggleBtn = document.getElementById('theme-toggle');

/* ==========================================
   FUNCTIONS
   ========================================== */

const toggleTheme = () => {
    html.classList.toggle('dark');
    const isDark = html.classList.contains('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
};

/* ==========================================
   EVENT LISTENERS
   ========================================== */

if (menuBtn && mobileMenu) {
    menuBtn.addEventListener('click', () => {
        // toggle the 'off' classes
        mobileMenu.classList.toggle('invisible');
        mobileMenu.classList.toggle('opacity-0');
        mobileMenu.classList.toggle('scale-95');
        
        // toggle the 'on' classes
        mobileMenu.classList.toggle('visible');
        mobileMenu.classList.toggle('opacity-100');
        mobileMenu.classList.toggle('scale-100');
    });
    
}

if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', toggleTheme);
}