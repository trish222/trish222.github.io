import { CONTENT, CREDITS } from '../content/content.js';

// The Win98 theme's window bodies, filled from src/content/content.js. The chrome (title bars,
// menus, status bars) stays in index.html; only what is said about Trish comes from content.
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const link = ({ text, href }) => `<a href="${esc(href)}"${href.startsWith('http') ? ' target="_blank" rel="noopener noreferrer"' : ''}>${esc(text)}</a>`;
const list = (items, render) => items.map(render).join('');

const about = ({ owner, about: lines }) => `<div class="about-content">
  <div class="profile-section">
    <div class="profile-pic">${esc(owner.avatar)}</div>
    <div class="profile-info"><h1>${esc(owner.name)}</h1><p class="tagline">${esc(owner.title)}</p></div>
  </div>
  <div class="divider-raised"></div>
  ${list(lines, (line, i) => `<p${i ? ' style="margin-top:6px;"' : ''}>${esc(line)}</p>`)}
  <p class="about-credits"><button type="button" class="link-button" data-open-window="credits">Credits</button></p>
</div>`;

const projects = ({ projects: items }) => `<div class="file-explorer">${list(items, (p) => `
  <div class="project-card" data-project="${esc(p.id)}">
    <div class="project-icon">${esc(p.icon)}</div>
    <div class="project-info">
      <strong>${esc(p.title)}</strong>
      <p>${esc(p.description)}</p>
      <div class="project-tags">${list(p.tags, (t) => `<span class="tag">${esc(t)}</span>`)}</div>
    </div>
  </div>`)}</div>`;

const contact = ({ contact: items }) => `<div class="contact-content">
  ${list(items, (c) => `<div class="contact-item"><span class="contact-label">${esc(c.label)}:</span>${link(c)}</div>`)}
  <div class="divider-raised" style="margin:10px 0;"></div>
  <p style="font-weight:bold; margin-bottom:6px;">Send a Message:</p>
  <div class="form-field"><label>Name:</label><input type="text" class="win-input" placeholder="Your name"></div>
  <div class="form-field"><label>Message:</label><textarea class="win-input" rows="3" placeholder="Your message..."></textarea></div>
  <button class="win-button">Send</button>
</div>`;

const entry = (e) => `<div class="resume-entry">
  <p class="resume-line"><strong>${esc(e.what)}</strong><span class="resume-when">${esc(e.when)}</span></p>
  <p class="resume-where">${esc(e.where)}</p>
  ${list(e.notes ?? [], (n) => `<p class="resume-skills">${esc(n)}</p>`)}
  ${e.bullets ? `<ul>${list(e.bullets, (b) => `<li>${esc(b)}</li>`)}</ul>` : ''}
</div>`;

const credit = (c) => `<li>${link({ text: c.title, href: c.href })} by ${esc(c.author)} <span class="credit-license">(${esc(c.license)})</span></li>`;

const credits = () => `<div class="credits-content">
  <p>Inspired by ${CREDITS.inspiredBy.map(link).join(' and ')} (not affiliated).</p>
  <h2>3D models</h2><ul>${list(CREDITS.assets, credit)}</ul>
  <h2>Fonts</h2><ul>${list(CREDITS.fonts, credit)}</ul>
  <p class="credits-built">${esc(CREDITS.builtWith)}</p>
</div>`;

const resume = ({ owner, resume: r }) => `<article class="resume">
  <header class="resume-head">
    <h1>${esc(owner.name)}</h1>
    ${list(r.links, (row) => `<p class="resume-meta">${row.map(link).join(' &middot; ')}</p>`)}
  </header>
  <section class="resume-section"><h2>Education</h2>${list(r.education, entry)}</section>
  <section class="resume-section"><h2>Skills</h2>
    ${list(r.skills, ([label, text]) => `<p class="resume-skills"><strong>${esc(label)}:</strong> ${esc(text)}</p>`)}
  </section>
  <section class="resume-section"><h2>Experience</h2>${list(r.experience, entry)}</section>
  <section class="resume-section"><h2>Activities</h2>${list(r.activities, entry)}</section>
</article>`;

export const renderers = { about, projects, contact, resume, credits };

export function renderWindowContent() {
  const content = CONTENT;
  for (const [id, render] of Object.entries(renderers)) {
    const body = document.querySelector(`#window-${id} .window-body`);
    if (body) body.innerHTML = render(content);
  }
  const count = document.querySelector('#window-projects .window-statusbar span');
  if (count) count.textContent = `${content.projects.length} objects`;
  const sidebar = document.querySelector('.start-menu-sidebar span');
  if (sidebar) sidebar.textContent = content.owner.name;
}
