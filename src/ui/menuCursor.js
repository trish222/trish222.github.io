// One shared RPG-style ▶ cursor for the desk's clickable text (the corner menu and the two bottom
// links, marked data-cursor). It rests left of whichever entry is hovered,
// keyboard-focused or pressed, glides between entries, and fades out when none is. The glyph is a
// 5x10 pixel grid (X = filled) so it never depends on the font. The same glyph, turned down, marks the
// lamp, computer and floppies on the desk (buildDownArrow).
const RIGHT = ['X....', 'XX...', 'XXX..', 'XXXX.', 'XXXXX', 'XXXXX', 'XXXX.', 'XXX..', 'XX...', 'X....'];
const SVG = 'http://www.w3.org/2000/svg';
const ENTRY = '[data-cursor]';

// The same arrow turned to point down (rows and columns swapped): the pointer over lamp, computer and floppies.
const DOWN = [...RIGHT[0]].map((_, column) => RIGHT.map((row) => row[column]).join(''));

// A crisp one-path SVG, one grid cell per user unit, painted in currentColor.
export function pixelSvg(rows = RIGHT) {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', `0 0 ${rows[0].length} ${rows.length}`);
  svg.setAttribute('shape-rendering', 'crispEdges');
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('d', rows.flatMap((row, y) => [...row.matchAll(/X+/g)].map((m) => `M${m.index} ${y}h${m[0].length}v1h-${m[0].length}z`)).join(''));
  svg.appendChild(path);
  return svg;
}

export function buildDownArrow() {
  const arrow = document.createElement('span');
  arrow.className = 'desk-arrow';
  arrow.setAttribute('aria-hidden', 'true');
  arrow.appendChild(pixelSvg(DOWN));
  return arrow;
}

export function buildCursor() {
  const cursor = document.createElement('span');
  cursor.className = 'ux-cursor';
  cursor.setAttribute('aria-hidden', 'true');
  cursor.appendChild(pixelSvg());
  return cursor;
}

export function initMenuCursor(events) {
  const cursor = document.body.appendChild(buildCursor());
  const hide = () => cursor.classList.remove('is-on');
  const show = (entry) => {
    // From hidden, jump to the entry instead of gliding across from wherever it last was.
    const jump = !cursor.classList.contains('is-on');
    if (jump) cursor.classList.add('is-jump');
    const at = entry.getBoundingClientRect();
    cursor.style.fontSize = getComputedStyle(entry).fontSize; // the cursor's em is the entry's text
    cursor.style.transform = `translate(${at.left}px, ${at.top + at.height / 2}px)`;
    if (jump) { cursor.offsetWidth; cursor.classList.remove('is-jump'); }
    cursor.classList.add('is-on');
  };
  const entryOf = (node) => node?.closest?.(ENTRY);
  const leaving = (e) => entryOf(e.target) && !entryOf(e.relatedTarget);
  events.on(document, 'pointerover', (e) => { const entry = entryOf(e.target); if (entry) show(entry); });
  events.on(document, 'pointerdown', (e) => { const entry = entryOf(e.target); if (entry) show(entry); });
  events.on(document, 'pointerout', (e) => { if (leaving(e)) hide(); });
  // A touch has no hover: its cursor lasts as long as the press.
  events.on(document, 'pointerup', (e) => { if (e.pointerType === 'touch') hide(); });
  events.on(document, 'pointercancel', hide);
  // Mouse clicks focus an entry without :focus-visible; only keyboard focus moves the cursor.
  events.on(document, 'focusin', (e) => { const entry = entryOf(e.target); if (entry?.matches(':focus-visible')) show(entry); });
  events.on(document, 'focusout', (e) => { if (leaving(e)) hide(); });
  events.on(window, 'resize', hide);
  return { hide };
}
