import './style.css';
import './ui/ux.css';
import './ui/intro.css';
import { initDesktop, disposeDesktop } from './desktop/desktop.js';

document.addEventListener('DOMContentLoaded', initDesktop, { once: true });

if (import.meta.hot) import.meta.hot.dispose(disposeDesktop);
