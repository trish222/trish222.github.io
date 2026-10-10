import './style.css';
import { initDitherClouds } from './dither-clouds.js';

const html = document.documentElement;
const heroSection = document.getElementById('hero');
const bubbleNavContainer = document.querySelector('.bubble-nav-container');
const bubbleField = document.getElementById('bubble-field');

const sectionData = [
  { id: 'about', label: 'About', emoji: '👋' },
  { id: 'projects', label: 'Projects', emoji: '💼' },
  { id: 'skills', label: 'Skills', emoji: '⚡' },
  { id: 'experience', label: 'Experience', emoji: '🚀' },
  { id: 'contact', label: 'Contact', emoji: '✉️' },
];

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = () => window.innerWidth < 768;

// ============================================================================
// THEME TOGGLE
// ============================================================================

const themeToggleBtn = document.getElementById('theme-toggle');
const setThemeClassFromStorage = () => {
  const stored = localStorage.getItem('theme');
  if (stored === 'light') html.classList.remove('dark');
  if (stored === 'dark') html.classList.add('dark');
};

const toggleTheme = () => {
  html.classList.toggle('dark');
  const isDark = html.classList.contains('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
};

if (themeToggleBtn) {
  themeToggleBtn.addEventListener('click', toggleTheme);
}

setThemeClassFromStorage();

// ============================================================================
// MOBILE MENU
// ============================================================================

const menuBtn = document.getElementById('menu-btn');
const mobileMenu = document.getElementById('mobile-menu');

const toggleMobileMenu = () => {
  if (!mobileMenu) return;
  const isOpen = mobileMenu.classList.contains('visible');
  if (isOpen) {
    mobileMenu.classList.add('invisible', 'opacity-0', 'max-h-0');
    mobileMenu.classList.remove('visible', 'opacity-100', 'max-h-96');
  } else {
    mobileMenu.classList.remove('invisible', 'opacity-0', 'max-h-0');
    mobileMenu.classList.add('visible', 'opacity-100', 'max-h-96');
  }
};

if (menuBtn && mobileMenu) {
  menuBtn.addEventListener('click', toggleMobileMenu);
  document.addEventListener('click', (e) => {
    const isOpen = mobileMenu.classList.contains('visible');
    if (isOpen && !mobileMenu.contains(e.target) && !menuBtn.contains(e.target)) {
      toggleMobileMenu();
    }
  });
  mobileMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', toggleMobileMenu);
  });
}

// ============================================================================
// BACK TO TOP
// ============================================================================

const backToTopBtn = document.getElementById('back-to-top');
if (backToTopBtn) {
  backToTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  window.addEventListener('scroll', () => {
    if (window.scrollY > 400) {
      backToTopBtn.classList.remove('opacity-0', 'pointer-events-none');
      backToTopBtn.classList.add('opacity-100');
    } else {
      backToTopBtn.classList.add('opacity-0', 'pointer-events-none');
      backToTopBtn.classList.remove('opacity-100');
    }
  });
}

// ============================================================================
// ANIMATED BACKGROUND BUBBLES
// ============================================================================

class AnimatedBubbleField {
  constructor(container) {
    this.container = container;
    this.bubbles = [];
    this.init();
  }

  init() {
    // Create floating bubbles with varied sizes and animation delays
    const bubbleCount = prefersReducedMotion ? 0 : 8;

    for (let i = 0; i < bubbleCount; i++) {
      const size = Math.random() * 80 + 30; // 30-110px
      const delay = Math.random() * 5; // 0-5s stagger
      const xPos = Math.random() * 100; // Random horizontal start
      const duration = Math.random() * 8 + 12; // 12-20s duration

      const bubble = document.createElement('div');
      bubble.className = 'bubble-bg';
      bubble.style.width = size + 'px';
      bubble.style.height = Math.round(size * 0.88) + 'px';  // squashed droplet
      bubble.style.left = xPos + '%';
      bubble.style.bottom = '-120px';
      bubble.style.animation = `bubble-float-up ${duration}s linear ${delay}s infinite`;

      this.container.appendChild(bubble);
      this.bubbles.push(bubble);
    }
  }
}

if (bubbleField) {
  new AnimatedBubbleField(bubbleField);
}

// ============================================================================
// BUBBLE NAVIGATION (pre-positioned in HTML)
// ============================================================================

if (bubbleNavContainer) {
  const navBubbles = bubbleNavContainer.querySelectorAll('[data-section]');

  navBubbles.forEach((bubble) => {
    bubble.addEventListener('click', () => {
      const sectionId = bubble.getAttribute('data-section');
      const targetSection = document.getElementById(sectionId);
      if (targetSection) {
        targetSection.scrollIntoView({ behavior: 'smooth' });
      }
    });

    bubble.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const sectionId = bubble.getAttribute('data-section');
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
          targetSection.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  });
}

// ============================================================================
// DITHERED CLOUD BACKGROUND
// ============================================================================

const cloudCanvas = document.getElementById('cloud-bg');
if (cloudCanvas) initDitherClouds(cloudCanvas);

// ============================================================================
// HERO HEIGHT
// The nav occupies normal flow, so the hero must subtract its height or the
// bottom of the hero (and the bubble row with it) falls below the fold.
// ============================================================================

const navEl = document.querySelector('nav');
if (navEl) {
  const syncNavHeight = () =>
    html.style.setProperty('--nav-h', `${Math.round(navEl.offsetHeight)}px`);
  syncNavHeight();
  new ResizeObserver(syncNavHeight).observe(navEl);
}
