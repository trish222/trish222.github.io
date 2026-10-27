import './style.css';

/* ==========================================
   WINDOW REGISTRY
   ========================================== */
const WINDOWS = {
  about:    { title: 'About Me', icon: '👤' },
  projects: { title: 'Projects', icon: '📁' },
  skills:   { title: 'Skills',   icon: '⚙️' },
  contact:  { title: 'Contact',  icon: '✉️' },
};

let zCounter = 100;
let activeWindow = null;
let dragState = null;

/* ==========================================
   WINDOW MANAGEMENT
   ========================================== */

function getWin(id) {
  return document.getElementById(`window-${id}`);
}

function focusWindow(id) {
  document.querySelectorAll('.window').forEach(w => {
    w.classList.remove('active');
    w.classList.add('inactive');
  });

  const win = getWin(id);
  if (!win) return;

  win.style.zIndex = ++zCounter;
  win.classList.add('active');
  win.classList.remove('inactive', 'minimized', 'hidden');
  activeWindow = id;
  updateTaskbar();
}

function openWindow(id) {
  const win = getWin(id);
  if (!win) return;
  win.classList.remove('hidden', 'minimized');
  focusWindow(id);
}

function closeWindow(id) {
  const win = getWin(id);
  if (!win) return;
  win.classList.add('hidden');
  if (activeWindow === id) activeWindow = null;
  updateTaskbar();
}

function minimizeWindow(id) {
  const win = getWin(id);
  if (!win) return;
  win.classList.add('minimized');
  if (activeWindow === id) activeWindow = null;
  updateTaskbar();
}

function toggleWindow(id) {
  const win = getWin(id);
  if (!win) return;

  if (win.classList.contains('hidden') || win.classList.contains('minimized')) {
    openWindow(id);
  } else if (activeWindow === id) {
    minimizeWindow(id);
  } else {
    focusWindow(id);
  }
}

/* ==========================================
   TASKBAR
   ========================================== */

function updateTaskbar() {
  const container = document.getElementById('taskbar-windows');
  container.innerHTML = '';

  Object.entries(WINDOWS).forEach(([id, info]) => {
    const win = getWin(id);
    if (!win || win.classList.contains('hidden')) return;

    const btn = document.createElement('button');
    btn.className = 'taskbar-item';
    if (activeWindow === id && !win.classList.contains('minimized')) {
      btn.classList.add('pressed');
    }
    btn.textContent = `${info.icon} ${info.title}`;
    btn.addEventListener('click', () => toggleWindow(id));
    container.appendChild(btn);
  });
}

/* ==========================================
   CLOCK
   ========================================== */

function updateClock() {
  const el = document.getElementById('taskbar-clock');
  const now = new Date();
  const h = now.getHours();
  const m = String(now.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  el.textContent = `${(h % 12) || 12}:${m} ${ampm}`;
}

/* ==========================================
   DRAG
   ========================================== */

function initDragging() {
  document.querySelectorAll('[data-drag]').forEach(titlebar => {
    const winId = titlebar.dataset.drag;
    const win = document.getElementById(winId);

    titlebar.addEventListener('mousedown', e => {
      if (e.target.classList.contains('win-btn')) return;
      if (win.dataset.maximized === 'true') return;

      focusWindow(winId.replace('window-', ''));

      const rect = win.getBoundingClientRect();
      dragState = {
        win,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
      };
      e.preventDefault();
    });
  });

  document.addEventListener('mousemove', e => {
    if (!dragState) return;
    const { win, offsetX, offsetY } = dragState;
    const x = Math.max(0, Math.min(e.clientX - offsetX, window.innerWidth - win.offsetWidth));
    const y = Math.max(0, Math.min(e.clientY - offsetY, window.innerHeight - 40 - win.offsetHeight));
    win.style.left = `${x}px`;
    win.style.top  = `${y}px`;
  });

  document.addEventListener('mouseup', () => { dragState = null; });
}

/* ==========================================
   MAXIMIZE / RESTORE
   ========================================== */

function toggleMaximize(id) {
  const win = getWin(id);
  if (!win) return;

  if (win.dataset.maximized === 'true') {
    win.style.top    = win.dataset.prevTop;
    win.style.left   = win.dataset.prevLeft;
    win.style.width  = win.dataset.prevWidth;
    win.style.height = '';
    win.dataset.maximized = 'false';
  } else {
    win.dataset.prevTop   = win.style.top;
    win.dataset.prevLeft  = win.style.left;
    win.dataset.prevWidth = win.style.width;
    win.style.top    = '0';
    win.style.left   = '0';
    win.style.width  = '100%';
    win.style.height = 'calc(100vh - 40px)';
    win.dataset.maximized = 'true';
  }
}

/* ==========================================
   WINDOW CONTROLS
   ========================================== */

function initWindowControls() {
  document.querySelectorAll('.close-btn').forEach(btn => {
    btn.addEventListener('click', () => closeWindow(btn.dataset.target));
  });

  document.querySelectorAll('.minimize-btn').forEach(btn => {
    btn.addEventListener('click', () => minimizeWindow(btn.dataset.target));
  });

  document.querySelectorAll('.maximize-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleMaximize(btn.dataset.target));
  });

  // Focus window on click
  document.querySelectorAll('.window').forEach(win => {
    win.addEventListener('mousedown', () => {
      focusWindow(win.id.replace('window-', ''));
    });
  });
}

/* ==========================================
   START MENU
   ========================================== */

function initStartMenu() {
  const startBtn  = document.getElementById('start-button');
  const startMenu = document.getElementById('start-menu');

  startBtn.addEventListener('click', e => {
    e.stopPropagation();
    startMenu.classList.toggle('hidden');
    startBtn.classList.toggle('active', !startMenu.classList.contains('hidden'));
  });

  document.addEventListener('click', () => {
    startMenu.classList.add('hidden');
    startBtn.classList.remove('active');
  });

  document.querySelectorAll('.start-menu-item[data-window]').forEach(item => {
    item.addEventListener('click', () => {
      openWindow(item.dataset.window);
      startMenu.classList.add('hidden');
      startBtn.classList.remove('active');
    });
  });

  document.getElementById('shutdown-item')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to shut down?')) {
      document.body.style.background = 'black';
      document.body.innerHTML = '<div style="color:white;font-family:monospace;padding:40px;font-size:14px;">It is now safe to turn off your computer.</div>';
    }
  });
}

/* ==========================================
   DESKTOP ICONS  (double-click to open)
   ========================================== */

function initDesktopIcons() {
  document.querySelectorAll('.desktop-icon').forEach(icon => {
    let clicks = 0;
    let timer  = null;

    icon.addEventListener('click', e => {
      e.stopPropagation();
      clicks++;
      icon.classList.add('selected');

      if (clicks === 1) {
        timer = setTimeout(() => { clicks = 0; }, 400);
      } else {
        clearTimeout(timer);
        clicks = 0;
        openWindow(icon.dataset.window);
      }
    });
  });

  document.getElementById('desktop').addEventListener('click', e => {
    if (!e.target.closest('.desktop-icon')) {
      document.querySelectorAll('.desktop-icon').forEach(i => i.classList.remove('selected'));
    }
  });
}

/* ==========================================
   THE LOGIN SCREEN ON THE CRT

   The markup is live HTML the whole time — scene.js lays it onto the
   monitor's screen plane with a CSS transform, and clicking it flies
   the camera in until it has the viewport. Everything here is the page
   itself; the camera work all lives in scene.js.
   ========================================== */

function initLoginScreen() {
  const form = document.querySelector('.login-form');
  const note = document.querySelector('.login-note');
  if (!form) return;

  form.addEventListener('submit', e => {
    e.preventDefault();
    const user = document.getElementById('login-user').value.trim() || 'user';
    note.textContent = `Welcome, ${user}. Nothing to log on to — this is a portfolio.`;
  });
}

/* Wired only once the scene is live, since the way back out is a camera
   move. */
function initScreenControls(scene) {
  const bar = document.getElementById('screen-back-bar');
  if (bar) bar.hidden = false;

  const back = () => scene.flyFromScreen();
  document.getElementById('screen-back')?.addEventListener('click', back);
  document.querySelector('[data-login-cancel]')?.addEventListener('click', back);
  document.querySelector('.login-dialog .title-bar-controls button')
    ?.addEventListener('click', back);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.body.classList.contains('screen-focused')) {
      back();
    }
  });
}

/* ==========================================
   INIT
   ========================================== */

document.addEventListener('DOMContentLoaded', () => {
  initDragging();
  initStartMenu();
  initWindowControls();
  initDesktopIcons();

  updateClock();
  setInterval(updateClock, 1000);

  // Open the About window on load
  openWindow('about');

  initLoginScreen();

  /* Three.js is lazy-loaded so the desktop paints first. */
  const canvas = document.getElementById('scene');
  if (canvas) {
    import('./scene.js')
      .then(async scene => {
        /* The login screen is only reachable through the 3D monitor, so
           it stays hidden unless the scene actually came up. */
        if (await scene.initScene(canvas)) initScreenControls(scene);
      })
      .catch(() => { /* no backdrop; the flat teal desktop stands in */ });
  }
});
