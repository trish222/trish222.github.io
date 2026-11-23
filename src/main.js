import './style.css';
import './ui/ux.css';
import './ui/intro.css';
import { hasWebGL } from './config/experience.js';

// ?lofi is the plain-HTML portfolio: the room, its scene and its models are never started, and without
// WebGL the scene's code is never fetched. Otherwise both chunks load in parallel, not one after the other.
const lofi = new URLSearchParams(location.search).has('lofi');
const desktop = lofi ? null : import('./desktop/desktop.js');
const scene = lofi || !hasWebGL() ? null : import('./scene.js');
document.addEventListener('DOMContentLoaded', () => {
  if (lofi) import('./lofi/lofi.js').then(({ showLofi }) => showLofi());
  else desktop.then(({ initDesktop }) => initDesktop(scene));
}, { once: true });

if (import.meta.hot) import.meta.hot.dispose(() => desktop?.then(({ disposeDesktop }) => disposeDesktop()));
