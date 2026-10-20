/* ==========================================
   HALFTONE WORDMARK
   Vanilla port of 21st.dev @kedhareswer/halftone-wordmark-footer (#37628),
   reworked from a footer into the hero.

   The wordmark is set enormous and printed as a field of dots. Each dot is
   sized by how much of the letter covers its cell, so the type keeps its
   edges at any scale. Move across it and the dots part around the pointer on
   springs, warming in colour as they are pushed off their place; click and a
   shock ring runs through the word.

   Colours are read from CSS custom properties on the root element, so the
   site's theme toggle drives the canvas too — call refresh() after a toggle.
   ========================================== */

/* ==========================================
   PURE HELPERS
   ========================================== */

/** Hex -> [r, g, b] in 0-255, or null for anything that isn't #rgb / #rrggbb. */
export const hwfHex = (hex) => {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

/** Dot radius for a cell coverage in [0, 1]: area-true, so tone stays even. */
export const hwfRadius = (coverage, gap) => {
  const c = coverage < 0 ? 0 : coverage > 1 ? 1 : coverage;
  return Math.sqrt(c) * gap * 0.56;
};

/**
 * One step of a dot's spring back to home, plus the push from a pointer at
 * (px, py) within radius r. Returns [x, y, vx, vy]. Away from the pointer a
 * displaced dot always heads home and comes to rest.
 */
export const hwfStep = (x, y, vx, vy, hx, hy, px, py, r) => {
  const dx = x - px;
  const dy = y - py;
  const d2 = dx * dx + dy * dy;
  if (r > 0 && d2 < r * r) {
    const d = Math.sqrt(d2) + 0.001;
    const f = (1 - d / r) * 2.6;
    vx += (dx / d) * f;
    vy += (dy / d) * f;
  }
  vx = (vx + (hx - x) * 0.05) * 0.84;
  vy = (vy + (hy - y) * 0.05) * 0.84;
  return [x + vx, y + vy, vx, vy];
};

/** How warm a dot is drawn: 0 at home, 1 once it is `span` px or more away. */
export const hwfWarmth = (x, y, hx, hy, span) => {
  const d = Math.hypot(x - hx, y - hy);
  return span > 0 ? Math.min(1, d / span) : 0;
};

/** Font size that sets `measured` (width at 100px) to fill `width` exactly. */
export const hwfFitSize = (measured, width) =>
  measured > 0 ? (width / measured) * 100 : 0;

/* ==========================================
   INIT
   ========================================== */

/**
 * Wire up the dot field on an existing .hwf-root element.
 * Returns { refresh, destroy } — refresh() re-reads the palette and re-lays
 * out, destroy() tears down every listener.
 */
export const initHalftoneWordmark = (root, options = {}) => {
  if (!root) return { refresh: () => {}, destroy: () => {} };
  const canvas = root.querySelector('canvas');
  if (!canvas) return { refresh: () => {}, destroy: () => {} };
  const ctx = canvas.getContext('2d');
  if (!ctx) return { refresh: () => {}, destroy: () => {} };

  const o = {
    wordmark: root.dataset.wordmark || 'wordmark',
    stack: [],        // lines to use instead of `wordmark` on narrow viewports
    stackBelow: 720,  // viewport width at or under which `stack` takes over
    lineGap: 0.10,    // gap between stacked lines, as a multiple of font size
    dotGap: 6,        // distance between dot centres, CSS px
    radius: 90,       // how far the pointer pushes, CSS px
    anchor: 'center', // 'center' floats the block, 'bottom' crops it on the bottom edge
    crop: 0.2,        // 'bottom' only: how much of the cap height hangs below the edge
    grain: 0.5,       // print grain over everything, 0-1
    interactive: true,
    fontWeight: 800,
    ...options,
  };

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let w = 0;
  let h = 0;
  let dpr = 1;
  let px = -1e5;
  let py = -1e5;
  let raf = 0;
  let visible = true;
  let awake = true;
  let ring = { x: 0, y: 0, t: -1 };
  // Flat array: x, y, vx, vy, hx, hy, r per dot.
  let dots = new Float32Array(0);
  let count = 0;
  let grainTile = null;
  let bg = '#121321';
  let ink = [248, 250, 252];
  let warm = [217, 70, 239];

  // The palette lives in CSS so the theme toggle owns it.
  const readPalette = () => {
    const cs = getComputedStyle(root);
    const pick = (name, fallback) => cs.getPropertyValue(name).trim() || fallback;
    bg = pick('--hwf-bg', '#121321');
    ink = hwfHex(pick('--hwf-ink', '#f8fafc')) || [248, 250, 252];
    warm = hwfHex(pick('--hwf-warm', '#d946ef')) || [217, 70, 239];
  };

  const fontFamily = () =>
    o.fontFamily || getComputedStyle(root).getPropertyValue('--hwf-display').trim() || 'sans-serif';

  const layout = () => {
    const rect = root.getBoundingClientRect();
    w = Math.max(1, Math.round(rect.width));
    h = Math.max(1, Math.round(rect.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);

    // Set the word on a 1x mask, each line at the size that fills the width.
    // A long name is unreadable squeezed onto one line on a phone, so narrow
    // viewports fall back to `stack` and get the lines at a real size.
    const mask = document.createElement('canvas');
    mask.width = w;
    mask.height = h;
    const m = mask.getContext('2d', { willReadFrequently: true });
    if (!m) return;
    const face = fontFamily();
    const words = o.stack.length > 1 && w <= o.stackBelow ? o.stack : [o.wordmark || ' '];
    const lines = words.map((word) => {
      m.font = o.fontWeight + ' 100px ' + face;
      const fit = hwfFitSize(m.measureText(word).width, w * 1.02);
      m.font = o.fontWeight + ' ' + fit + 'px ' + face;
      const box = m.measureText(word);
      return { word, fit, width: box.width, cap: box.actualBoundingBoxAscent || fit * 0.72 };
    });

    // Find the last line's baseline, then stack upward from it.
    const last = lines[lines.length - 1];
    let baseline;
    if (o.anchor === 'bottom') {
      // Hang part of the cap height below the bottom edge, so the word is cropped.
      baseline = h + last.cap * Math.max(0, Math.min(0.6, o.crop));
    } else {
      // Centre the block on cap height: every cap, plus a gap per line break.
      const block = lines.reduce(
        (sum, ln, i) => sum + ln.cap + (i > 0 ? ln.fit * o.lineGap : 0),
        0,
      );
      baseline = (h + block) / 2;
    }
    m.fillStyle = '#000';
    m.textBaseline = 'alphabetic';
    for (let i = lines.length - 1; i >= 0; i--) {
      m.font = o.fontWeight + ' ' + lines[i].fit + 'px ' + face;
      m.fillText(lines[i].word, (w - lines[i].width) / 2, baseline);
      // Clear this line's own cap, plus a hair, to set the one above it. Keying
      // off cap rather than font size keeps the leading tight for a line with
      // no ascenders ("nguyen") as well as one with them ("trish").
      if (i > 0) baseline -= lines[i].cap + lines[i].fit * o.lineGap;
    }
    const img = m.getImageData(0, 0, w, h).data;

    const gap = Math.max(3, o.dotGap);
    const cols = Math.ceil(w / gap);
    const rows = Math.ceil(h / gap);
    const tmp = [];
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        // Coverage: average alpha over a 3x3 sample of the cell.
        let sum = 0;
        for (let sy = 0; sy < 3; sy++) {
          for (let sx = 0; sx < 3; sx++) {
            const x = Math.min(w - 1, Math.floor(gx * gap + ((sx + 0.5) * gap) / 3));
            const y = Math.min(h - 1, Math.floor(gy * gap + ((sy + 0.5) * gap) / 3));
            sum += img[(y * w + x) * 4 + 3];
          }
        }
        const cov = sum / (9 * 255);
        if (cov < 0.06) continue;
        const hx = gx * gap + gap / 2;
        const hy = gy * gap + gap / 2;
        tmp.push(hx, hy, 0, 0, hx, hy, hwfRadius(cov, gap));
      }
    }
    dots = new Float32Array(tmp);
    count = tmp.length / 7;

    // A fixed tile of print grain, drawn once and laid over every frame.
    grainTile = document.createElement('canvas');
    grainTile.width = 256;
    grainTile.height = 256;
    const g = grainTile.getContext('2d');
    if (g) {
      const id = g.createImageData(256, 256);
      for (let i = 0; i < id.data.length; i += 4) {
        const v = Math.random() * 255;
        id.data[i] = id.data[i + 1] = id.data[i + 2] = v;
        id.data[i + 3] = Math.random() < 0.5 ? 0 : 255;
      }
      g.putImageData(id, 0, 0);
    }
    awake = true;
  };

  const draw = (now) => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const r = o.interactive && !reduced ? Math.max(0, o.radius) : 0;
    const ringAge = ring.t < 0 ? 1e9 : now - ring.t;
    const ringR = ringAge * 0.9;
    const inkCss = 'rgb(' + ink[0] + ',' + ink[1] + ',' + ink[2] + ')';
    let moving = false;

    for (let i = 0; i < count; i++) {
      const j = i * 7;
      let x = dots[j];
      let y = dots[j + 1];
      let vx = dots[j + 2];
      let vy = dots[j + 3];
      const hx = dots[j + 4];
      const hy = dots[j + 5];
      if (!reduced) {
        if (ringAge < 900) {
          const dx = hx - ring.x;
          const dy = hy - ring.y;
          const d = Math.sqrt(dx * dx + dy * dy) + 0.001;
          const band = 1 - Math.min(1, Math.abs(d - ringR) / 26);
          if (band > 0) {
            const f = band * 3.2 * (1 - ringAge / 900);
            vx += (dx / d) * f;
            vy += (dy / d) * f;
          }
        }
        const s = hwfStep(x, y, vx, vy, hx, hy, px, py, r);
        x = s[0];
        y = s[1];
        vx = s[2];
        vy = s[3];
        if (Math.abs(vx) + Math.abs(vy) > 0.02 || Math.abs(x - hx) + Math.abs(y - hy) > 0.05) moving = true;
        else {
          x = hx;
          y = hy;
          vx = 0;
          vy = 0;
        }
        dots[j] = x;
        dots[j + 1] = y;
        dots[j + 2] = vx;
        dots[j + 3] = vy;
      }
      const k = hwfWarmth(x, y, hx, hy, 28);
      ctx.fillStyle =
        k > 0.02
          ? 'rgb(' +
            Math.round(ink[0] + (warm[0] - ink[0]) * k) + ',' +
            Math.round(ink[1] + (warm[1] - ink[1]) * k) + ',' +
            Math.round(ink[2] + (warm[2] - ink[2]) * k) + ')'
          : inkCss;
      ctx.beginPath();
      ctx.arc(x, y, dots[j + 6], 0, 6.2832);
      ctx.fill();
    }

    if (grainTile && o.grain > 0) {
      ctx.globalAlpha = Math.min(1, o.grain) * 0.09;
      ctx.globalCompositeOperation = 'overlay';
      const pattern = ctx.createPattern(grainTile, 'repeat');
      if (pattern) {
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    // Sleep once everything is home and nothing is pushing.
    awake = moving || ringAge < 900 || px > -1e4;
  };

  const loop = (now) => {
    raf = 0;
    if (!visible) return;
    draw(now);
    if (awake) raf = requestAnimationFrame(loop);
  };

  const wake = () => {
    awake = true;
    if (!raf && visible) raf = requestAnimationFrame(loop);
  };

  const toLocal = (e) => {
    const b = canvas.getBoundingClientRect();
    return [e.clientX - b.left, e.clientY - b.top];
  };

  const onMove = (e) => {
    if (!o.interactive) return;
    const p = toLocal(e);
    px = p[0];
    py = p[1];
    wake();
  };

  const onLeave = () => {
    px = -1e5;
    py = -1e5;
    wake();
  };

  const onDown = (e) => {
    if (!o.interactive || reduced) return;
    if (e.target.closest('a,button')) return;
    const p = toLocal(e);
    ring = { x: p[0], y: p[1], t: performance.now() };
    wake();
  };

  readPalette();
  layout();
  draw(performance.now());
  wake();

  root.addEventListener('pointermove', onMove);
  root.addEventListener('pointerleave', onLeave);
  root.addEventListener('pointerdown', onDown);

  const ro = new ResizeObserver(() => {
    layout();
    wake();
  });
  ro.observe(root);

  const io = new IntersectionObserver((entries) => {
    visible = entries[0] ? entries[0].isIntersecting : true;
    if (visible) wake();
  });
  io.observe(root);

  // A web font that lands late re-sets the word in its real face.
  let alive = true;
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      if (!alive) return;
      layout();
      wake();
    });
  }

  const refresh = () => {
    readPalette();
    layout();
    wake();
  };

  const destroy = () => {
    alive = false;
    cancelAnimationFrame(raf);
    ro.disconnect();
    io.disconnect();
    root.removeEventListener('pointermove', onMove);
    root.removeEventListener('pointerleave', onLeave);
    root.removeEventListener('pointerdown', onDown);
  };

  return { refresh, destroy };
};
