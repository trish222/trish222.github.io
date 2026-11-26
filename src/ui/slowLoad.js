import { UI } from '../content/content.js';
import { pixelSvg } from './menuCursor.js';

const SLOW_LOAD_MS = 8000;

// On a slow connection the boot screen offers the plain-HTML page after SLOW_LOAD_MS. Loading goes on
// behind it; intro.js adds .loaded when the scene is up, which hides the line again (intro.css).
export function watchSlowLoad() {
  const boot = document.getElementById('boot');
  // The room's shared ▶ cursor is not running yet (it starts with the scene), so the link carries its own glyph.
  const arrow = Object.assign(document.createElement('span'), { className: 'boot-arrow' });
  arrow.setAttribute('aria-hidden', 'true');
  arrow.appendChild(pixelSvg());
  boot.querySelector('.boot-slow').replaceChildren(arrow, UI.slowLoad);
  setTimeout(() => boot.classList.add('slow'), SLOW_LOAD_MS);
}
