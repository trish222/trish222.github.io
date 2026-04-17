import './style.css';

/* ==========================================
   CONSTANTS
   ========================================== */
const popup       = document.getElementById('popup');
const popupClosed = document.getElementById('popup-closed');
const statusText  = document.getElementById('status-text');

const SECTION_LABELS = {
  home:       'TRISH_NGUYEN.EXE',
  about:      'TRISH_NGUYEN.EXE — ABOUT',
  experience: 'TRISH_NGUYEN.EXE — EXPERIENCE',
  projects:   'TRISH_NGUYEN.EXE — PROJECTS',
  skills:     'TRISH_NGUYEN.EXE — SKILLS',
  contact:    'TRISH_NGUYEN.EXE — CONTACT',
};

const STATUS_MESSAGES = {
  home:       'SYSTEM READY ●',
  about:      'LOADING ABOUT.DAT...',
  experience: 'LOADING EXPERIENCE.DAT...',
  projects:   'LOADING PROJECTS.DAT...',
  skills:     'LOADING SKILLS.DAT...',
  contact:    'LOADING CONTACT.DAT...',
};

/* ==========================================
   SCREEN NAVIGATION
   ========================================== */

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

  const screen = document.getElementById(`screen-${id}`);
  if (screen) screen.classList.add('active');

  document.getElementById('popup-title-text').textContent =
    SECTION_LABELS[id] ?? SECTION_LABELS.home;

  setStatus(STATUS_MESSAGES[id] ?? STATUS_MESSAGES.home);
}

function setStatus(msg, duration = 1200) {
  statusText.textContent = msg;
  if (msg !== STATUS_MESSAGES.home) {
    setTimeout(() => {
      statusText.textContent = STATUS_MESSAGES.home;
    }, duration);
  }
}

/* ==========================================
   NAV TILES
   ========================================== */

document.querySelectorAll('.nav-tile').forEach(btn => {
  btn.addEventListener('click', () => showScreen(btn.dataset.section));
});

document.querySelectorAll('.back-btn').forEach(btn => {
  btn.addEventListener('click', () => showScreen('home'));
});

/* ==========================================
   WINDOW CONTROLS
   ========================================== */

document.getElementById('btn-close').addEventListener('click', () => {
  popup.style.display = 'none';
  popupClosed.classList.add('visible');
});

document.getElementById('reopen-btn')?.addEventListener('click', () => {
  popup.style.display = 'flex';
  popupClosed.classList.remove('visible');
  showScreen('home');
});

let maximized = false;
let prevStyle  = {};

document.getElementById('btn-maximize').addEventListener('click', () => {
  if (!maximized) {
    prevStyle = { width: popup.style.width, maxWidth: popup.style.maxWidth };
    popup.style.width    = '100vw';
    popup.style.maxWidth = '100vw';
    popup.style.position = 'fixed';
    popup.style.top      = '0';
    popup.style.left     = '0';
    popup.style.transform = 'none';
    maximized = true;
  } else {
    popup.style.width    = prevStyle.width    || '';
    popup.style.maxWidth = prevStyle.maxWidth || '';
    popup.style.position = '';
    popup.style.top      = '';
    popup.style.left     = '';
    popup.style.transform = '';
    maximized = false;
  }
});

let minimized = false;
const popupBody    = document.getElementById('popup-body');
const popupMenubar = document.getElementById('popup-menubar');
const popupStatus  = document.getElementById('popup-statusbar');

document.getElementById('btn-minimize').addEventListener('click', () => {
  minimized = !minimized;
  popupBody.style.display    = minimized ? 'none' : '';
  popupMenubar.style.display = minimized ? 'none' : '';
  popupStatus.style.display  = minimized ? 'none' : '';
});

/* ==========================================
   DRAG
   ========================================== */

let dragState = null;

document.getElementById('popup-titlebar').addEventListener('mousedown', e => {
  if (e.target.classList.contains('ctrl-btn') || maximized) return;

  const rect = popup.getBoundingClientRect();
  dragState = {
    startX: e.clientX - rect.left,
    startY: e.clientY - rect.top,
  };

  // Switch from flex centering to absolute position
  popup.style.position  = 'fixed';
  popup.style.transform = 'none';
  popup.style.left      = `${rect.left}px`;
  popup.style.top       = `${rect.top}px`;
  popup.style.margin    = '0';

  e.preventDefault();
});

document.addEventListener('mousemove', e => {
  if (!dragState) return;
  popup.style.left = `${e.clientX - dragState.startX}px`;
  popup.style.top  = `${e.clientY - dragState.startY}px`;
});

document.addEventListener('mouseup', () => { dragState = null; });

/* ==========================================
   CLOCK
   ========================================== */

function updateClock() {
  const el = document.getElementById('status-clock');
  if (!el) return;
  const now  = new Date();
  const h    = now.getHours();
  const m    = String(now.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  el.textContent = `${(h % 12) || 12}:${m} ${ampm}`;
}

updateClock();
setInterval(updateClock, 1000);
