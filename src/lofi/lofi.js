import './lofi.css';
import { CONTENT, UI } from '../content/content.js';
import { esc, renderers } from '../desktop/windowContent.js';

// The plain-HTML portfolio: the same content as the screen's windows, in the same Win98 chrome, as one
// scrolling page. No canvas, no models; reached from the room's lo-fi link (?lofi) and used when WebGL is missing.
const ICONS = { about: 'about-me', projects: 'projects', resume: 'resume', contact: 'contact', credits: 'document' };

const section = ([id, title]) => `<section class="window" id="lofi-${id}" aria-labelledby="lofi-${id}-title">
  <div class="window-titlebar"><h2 class="window-title" id="lofi-${id}-title"><img src="/icons/${ICONS[id]}.png" width="16" height="16" alt="">${esc(title)}</h2></div>
  <div class="window-body">${renderers[id](CONTENT)}</div>
</section>`;

export function showLofi() {
  if (document.getElementById('lofi')) return;
  document.getElementById('boot')?.remove(); // its black page background would win over the desktop's teal
  const page = Object.assign(document.createElement('div'), { id: 'lofi', className: 'ui98' });
  page.innerHTML = `<header class="lofi-bar">
  <h1>${esc(CONTENT.owner.name)}</h1>
  <nav aria-label="Sections">${UI.menuItems.map(([id, text]) => `<a href="#lofi-${id}">${esc(text)}</a>`).join('')}</nav>
  <a class="lofi-3d" href="${esc(location.pathname)}">${esc(UI.lofiBack)}</a>
</header>
<main>${UI.menuItems.map(section).join('')}</main>
<footer class="lofi-foot">${esc(UI.copyright)}</footer>`;
  document.body.append(page);
  document.body.classList.add('lofi');
  document.title = CONTENT.owner.name;
}
