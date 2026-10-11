/* ==========================================
   HALFTONE FIELD

   A four-ink halftone screen, run as a fragment shader over one
   photograph. Each ink gets its own rotated screen the way a press
   would set them (15°/75°/0°/45°), its own plate offset, and its own
   separation off the source pixels. Moving the pointer pulls the
   plates out of register and turns the screens; at rest everything
   drifts slowly back.

   Source image: `public/bloom.jpg`. Until that file exists a bloom is
   painted offscreen and fed through the identical screen, so the page
   is never without its field and the pipeline is the same one the
   photograph will land in.

   Degrades twice: no WebGL falls back to a static 2D-canvas screen,
   and no canvas at all leaves the CSS ground showing.
   ========================================== */

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;

uniform sampler2D uTex;
uniform vec2  uRes;      // canvas size, device px
uniform vec2  uTexRes;   // source size, px
uniform float uTime;     // seconds
uniform vec2  uPointer;  // -1..1, eased
uniform float uPitch;    // dot pitch, device px
uniform float uPaper;    // 0 = ink on black, 1 = ink on paper
uniform float uSpread;   // plate misregistration, device px
uniform vec3  uGround;
uniform vec3  uInkM, uInkR, uInkA, uInkC;
uniform mat3  uUnmix;    // inverse of [magenta amber cyan], for the additive pull

vec2 rot2(vec2 v, float a) {
  float s = sin(a), c = cos(a);
  return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}

/* Cover-fit, so the bloom fills any viewport without distorting.
   Anchored above centre vertically: the flowers sit in the upper two
   thirds of the frame, and a centred crop on a landscape viewport
   throws them away and keeps the vase. */
vec2 coverUV(vec2 frag, vec2 plate) {
  float s = max(uRes.x / uTexRes.x, uRes.y / uTexRes.y);
  vec2 size = uTexRes * s;
  vec2 anchor = vec2(0.5, 0.32);
  return (frag + plate - anchor * (uRes - size)) / size;
}

/* One screen: a dot per cell whose area carries the ink coverage. */
float screenDot(vec2 frag, float angle, float cov) {
  vec2 cell = fract(rot2(frag, angle) / uPitch) - 0.5;
  float r = sqrt(clamp(cov, 0.0, 1.0)) * 0.80;
  float aa = 1.5 / uPitch;
  return smoothstep(r + aa, r - aa, length(cell));
}

/* Read one plate: sample the source where that plate sits, then take
   the ink's own coverage off the pixel.

   Two separations, because the two grounds are physically opposite.

   On black the inks ADD light, so each plate carries how much of its
   own ink the pixel emits: the colour is unmixed against the actual
   three ink primaries (uUnmix is the inverse of the matrix whose
   columns are magenta, amber and cyan). That keeps tone intact — a lit
   petal prints small dots, a shadowed one prints large. Keying on
   chroma alone is what flattens a photograph into a sticker.

   On paper the inks SUBTRACT, so that plate is an ordinary CMY pull.

   Both are masked by chroma, so the near-neutral wall a flower is
   photographed against carries no ink and falls back to the ground. */
vec4 sep(vec2 frag, vec2 plate) {
  vec2 uv = clamp(coverUV(frag, plate), 0.0, 1.0);
  vec3 c = texture2D(uTex, uv).rgb;

  float mx = max(c.r, max(c.g, c.b));
  float mn = min(c.r, min(c.g, c.b));
  float chroma = mx - mn;
  float lum = dot(c, vec3(0.299, 0.587, 0.114));

  float punch = smoothstep(0.105, 0.34, chroma);

  // additive: how much of each ink's light this pixel gives off
  vec3 emit = clamp(uUnmix * c * 1.38, 0.0, 1.0);

  // subtractive: what each ink has to take away from the paper
  vec3 cmy = 1.0 - c;
  float key = min(cmy.r, min(cmy.g, cmy.b));
  vec3 pure = clamp(cmy - key, 0.0, 1.0);

  // x magenta, y amber, z cyan
  vec3 ink = mix(emit, vec3(pure.g, pure.b, pure.r), uPaper) * punch;

  // the key plate deepens the shaded side rather than printing flat
  float k = punch * smoothstep(0.78, 0.18, lum) * 0.85;

  return vec4(ink.x, k, ink.y, ink.z);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  frag.y = uRes.y - frag.y;

  float drift = uTime * 0.035;
  float turn  = uPointer.x * 0.22;

  /* Plate offsets: fixed directions, opened up by the pointer. */
  float push = uSpread * (0.35 + 0.65 * length(uPointer));
  vec2 pM = vec2( 1.0,  0.35) * push;
  vec2 pR = vec2(-0.75, 0.60) * push * 0.7;
  vec2 pA = vec2( 0.20, -1.0) * push * 0.85;
  vec2 pC = vec2(-1.0, -0.30) * push;

  float aM = radians(75.0) + drift + turn;
  float aR = radians(45.0) + drift * 0.8 + turn * 0.6;
  float aA = radians(0.0)  + drift * 1.2 + turn * 1.3;
  float aC = radians(15.0) + drift * 0.6 + turn * 0.9;

  float covM = sep(frag, pM).x;
  float covR = sep(frag, pR).y;
  float covA = sep(frag, pA).z;
  float covC = sep(frag, pC).w;

  float dM = screenDot(frag + pM, aM, covM);
  float dR = screenDot(frag + pR, aR, covR);
  float dA = screenDot(frag + pA, aA, covA);
  float dC = screenDot(frag + pC, aC, covC);

  /* Ink on black adds light; ink on paper takes it away. */
  vec3 add = uGround
    + uInkM * dM * 0.98
    + uInkA * dA * 0.78
    + uInkC * dC * 0.86
    + uInkR * dR * 0.42;

  vec3 sub = uGround
    * mix(vec3(1.0), uInkM, dM * 0.80)
    * mix(vec3(1.0), uInkA, dA * 0.55)
    * mix(vec3(1.0), uInkC, dC * 0.60)
    * mix(vec3(1.0), uInkR, dR * 0.45);

  gl_FragColor = vec4(mix(add, sub, uPaper), 1.0);
}
`;

/* ---------- palette, read off the stylesheet so CSS stays the source ---------- */

const hexToRgb = (hex) => {
  const h = hex.trim().replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

const readPalette = () => {
  const s = getComputedStyle(document.documentElement);
  const tok = (name, fallback) => hexToRgb(s.getPropertyValue(name) || fallback);
  return {
    ground: tok('--field-ground', '#07070a'),
    m: tok('--color-ink-magenta', '#ff2e93'),
    r: tok('--color-ink-rose', '#c0186b'),
    a: tok('--color-ink-amber', '#f79824'),
    c: tok('--color-ink-cyan', '#1fbde3'),
  };
};

/* Inverse of the matrix whose columns are the three additive inks.
   Multiplying a colour by it gives how much of each ink is needed to
   emit that colour, which is what keeps the halftone tonal instead of
   flattening every saturated area to full coverage.
   Returned column-major, the order GLSL's mat3 wants. */
const unmixMatrix = ({ m, a, c }) => {
  const [p, q, r] = [m[0], a[0], c[0]];
  const [u, v, w] = [m[1], a[1], c[1]];
  const [x, y, z] = [m[2], a[2], c[2]];

  const det = p * (v * z - w * y) - q * (u * z - w * x) + r * (u * y - v * x);
  if (Math.abs(det) < 1e-6) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const d = 1 / det;

  const row0 = [(v * z - w * y) * d, (r * y - q * z) * d, (q * w - r * v) * d];
  const row1 = [(w * x - u * z) * d, (p * z - r * x) * d, (r * u - p * w) * d];
  const row2 = [(u * y - v * x) * d, (q * x - p * y) * d, (p * v - q * u) * d];

  return [
    row0[0], row1[0], row2[0],
    row0[1], row1[1], row2[1],
    row0[2], row1[2], row2[2],
  ];
};

/* ---------- the stand-in bloom ----------
   Continuous tone on purpose: flat fills screen into solid slabs of ink
   and read as a sticker, so every petal carries its own shading,
   highlight and falloff and the dots come out varying in size. Still
   only a stand-in for `public/bloom.jpg`. */

const paintBloom = () => {
  const c = document.createElement('canvas');
  c.width = 780;
  c.height = 920;
  const x = c.getContext('2d');

  // wall: warm, graded, lit from the upper left
  const wall = x.createLinearGradient(80, 0, 700, 920);
  wall.addColorStop(0, '#f7f1e7');
  wall.addColorStop(1, '#d6ccbe');
  x.fillStyle = wall;
  x.fillRect(0, 0, 780, 920);

  // stems
  [[400, 920, 410, 430], [320, 920, 250, 420], [470, 920, 565, 395]].forEach(([ax, ay, bx, by]) => {
    const g = x.createLinearGradient(ax, ay, bx, by);
    g.addColorStop(0, '#445e2a');
    g.addColorStop(1, '#7c9d4e');
    x.strokeStyle = g;
    x.lineWidth = 12;
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(ax, ay);
    x.quadraticCurveTo((ax + bx) / 2 + 34, (ay + by) / 2, bx, by);
    x.stroke();
  });

  // leaves
  [[440, 700, 128, 36, -0.5], [336, 782, 112, 29, 0.62], [530, 630, 100, 27, -0.95]].forEach(
    ([lx, ly, rx, ry, rot]) => {
      x.save();
      x.translate(lx, ly);
      x.rotate(rot);
      const g = x.createLinearGradient(-rx, -ry, rx, ry);
      g.addColorStop(0, '#36511f');
      g.addColorStop(0.5, '#5f8435');
      g.addColorStop(1, '#2d471a');
      x.fillStyle = g;
      x.beginPath();
      x.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      x.fill();
      x.restore();
    }
  );

  // one petal: graded along its length and shaded by how it faces the light
  const petal = (cx, cy, len, wide, ang, shade) => {
    const dim = (v) => Math.max(0, Math.round(v * (1 - shade * 0.42)));
    x.save();
    x.translate(cx, cy);
    x.rotate(ang);

    const g = x.createLinearGradient(0, 0, len, 0);
    g.addColorStop(0.0, `rgb(${dim(243)},${dim(196)},${dim(214)})`);
    g.addColorStop(0.32, `rgb(${dim(228)},${dim(104)},${dim(162)})`);
    g.addColorStop(0.70, `rgb(${dim(201)},${dim(58)},${dim(130)})`);
    g.addColorStop(1.0, `rgb(${dim(236)},${dim(162)},${dim(190)})`);
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(0, 0);
    x.quadraticCurveTo(len * 0.45, -wide, len, 0);
    x.quadraticCurveTo(len * 0.45, wide, 0, 0);
    x.fill();

    // pale central vein — gives the screen something to grade across
    const v = x.createLinearGradient(0, 0, len, 0);
    v.addColorStop(0, 'rgba(255,240,230,0.5)');
    v.addColorStop(0.6, 'rgba(255,226,222,0.14)');
    v.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = v;
    x.beginPath();
    x.moveTo(0, 0);
    x.quadraticCurveTo(len * 0.5, -wide * 0.2, len, 0);
    x.quadraticCurveTo(len * 0.5, wide * 0.2, 0, 0);
    x.fill();
    x.restore();
  };

  const lily = (cx, cy, R, tilt, base) => {
    for (let i = 0; i < 6; i++) {
      const a = tilt + (i / 6) * Math.PI * 2;
      // petals turned away from the upper-left light sit darker
      const lit = 0.5 + 0.5 * Math.cos(a - Math.PI * 1.25);
      petal(cx, cy, R, R * 0.3, a, Math.min(1, base + (1 - lit) * 0.6));
    }

    const throat = x.createRadialGradient(cx, cy, 2, cx, cy, R * 0.42);
    throat.addColorStop(0, 'rgba(255,249,234,0.95)');
    throat.addColorStop(0.45, 'rgba(246,186,196,0.55)');
    throat.addColorStop(1, 'rgba(214,70,135,0)');
    x.fillStyle = throat;
    x.beginPath();
    x.arc(cx, cy, R * 0.42, 0, Math.PI * 2);
    x.fill();

    // filaments and anthers
    for (let i = 0; i < 6; i++) {
      const a = tilt + 0.42 + (i / 6) * Math.PI * 2;
      const ex = cx + Math.cos(a) * R * 0.56;
      const ey = cy + Math.sin(a) * R * 0.5 - R * 0.22;
      x.strokeStyle = 'rgba(228,220,170,0.9)';
      x.lineWidth = 3.4;
      x.beginPath();
      x.moveTo(cx, cy);
      x.quadraticCurveTo(cx + (ex - cx) * 0.5, cy + (ey - cy) * 0.35, ex, ey);
      x.stroke();

      x.save();
      x.translate(ex, ey);
      x.rotate(a);
      x.fillStyle = '#4a1326';
      x.beginPath();
      x.ellipse(0, 0, R * 0.075, R * 0.028, 0, 0, Math.PI * 2);
      x.fill();
      x.restore();
    }
  };

  lily(408, 250, 232, 0.18, 0.0);
  lily(250, 468, 206, 1.12, 0.2);
  lily(580, 408, 218, 2.28, 0.1);

  return c;
};

/* ---------- source ---------- */

const SOURCES = ['bloom.jpg', 'bloom.png'];

const loadSource = () =>
  new Promise((resolve) => {
    const tryNext = (i) => {
      if (i >= SOURCES.length) {
        const c = paintBloom();
        resolve({ image: c, w: c.width, h: c.height, real: false });
        return;
      }
      const img = new Image();
      img.decoding = 'async';
      img.onload = () =>
        resolve({ image: img, w: img.naturalWidth, h: img.naturalHeight, real: true });
      img.onerror = () => tryNext(i + 1);
      img.src = `${import.meta.env.BASE_URL}${SOURCES[i]}`;
    };
    tryNext(0);
  });

/* ---------- 2D fallback: one static screen, no loop ---------- */

const draw2d = (canvas, src, palette, paper) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const W = canvas.width;
  const H = canvas.height;
  const pitch = 7;

  const read = document.createElement('canvas');
  read.width = Math.max(1, Math.ceil(W / pitch));
  read.height = Math.max(1, Math.ceil(H / pitch));
  const rc = read.getContext('2d', { willReadFrequently: true });

  const s = Math.max(read.width / src.w, read.height / src.h);
  rc.drawImage(
    src.image,
    (read.width - src.w * s) / 2,
    (read.height - src.h * s) / 2,
    src.w * s,
    src.h * s
  );
  const data = rc.getImageData(0, 0, read.width, read.height).data;

  const css = (v) =>
    `rgb(${v.map((n) => Math.round(Math.min(1, Math.max(0, n)) * 255)).join(',')})`;

  ctx.fillStyle = css(palette.ground);
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = paper ? 'multiply' : 'lighter';

  const U = unmixMatrix(palette);
  const inks = [
    { col: palette.m, w: 0.98 },
    { col: palette.a, w: 0.78 },
    { col: palette.c, w: 0.86 },
  ];

  for (let y = 0; y < read.height; y++) {
    for (let x = 0; x < read.width; x++) {
      const i = (y * read.width + x) * 4;
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;

      // the same chroma key and the same unmix the shader uses
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      const t = Math.min(1, Math.max(0, (chroma - 0.105) / 0.235));
      const punch = t * t * (3 - 2 * t);
      if (punch <= 0.002) continue;

      const cov = [
        Math.min(1, Math.max(0, (U[0] * r + U[3] * g + U[6] * b) * 1.38)) * punch,
        Math.min(1, Math.max(0, (U[1] * r + U[4] * g + U[7] * b) * 1.38)) * punch,
        Math.min(1, Math.max(0, (U[2] * r + U[5] * g + U[8] * b) * 1.38)) * punch,
      ];

      inks.forEach((ink, k) => {
        const rad = Math.sqrt(cov[k]) * pitch * 0.5;
        if (rad < 0.25) return;
        ctx.fillStyle = css(ink.col.map((v) => v * ink.w));
        ctx.beginPath();
        ctx.arc(x * pitch + pitch / 2, y * pitch + pitch / 2, rad, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }
  ctx.globalCompositeOperation = 'source-over';
};

/* ---------- entry ---------- */

export async function initField(canvas) {
  if (!canvas) return null;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const src = await loadSource();
  let palette = readPalette();
  let paper = !document.documentElement.classList.contains('dark');

  const gl =
    canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' }) ||
    canvas.getContext('experimental-webgl', { antialias: false, alpha: false });

  /* -- no WebGL: one static screen on the 2D context -- */
  if (!gl) {
    const sizeFlat = () => {
      canvas.width = Math.min(window.innerWidth, 1600);
      canvas.height = Math.min(window.innerHeight, 1200);
      draw2d(canvas, src, palette, paper);
    };
    sizeFlat();
    window.addEventListener('resize', sizeFlat, { passive: true });
    return {
      sourceIsPhoto: src.real,
      refresh: () => {
        palette = readPalette();
        paper = !document.documentElement.classList.contains('dark');
        sizeFlat();
      },
    };
  }

  const compile = (type, source) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, source);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error('[field]', gl.getShaderInfoLog(sh));
      return null;
    }
    return sh;
  };

  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, src.image);

  const U = (n) => gl.getUniformLocation(prog, n);
  const u = {
    res: U('uRes'), texRes: U('uTexRes'), time: U('uTime'), pointer: U('uPointer'),
    pitch: U('uPitch'), paper: U('uPaper'), spread: U('uSpread'), ground: U('uGround'),
    m: U('uInkM'), r: U('uInkR'), a: U('uInkA'), c: U('uInkC'), unmix: U('uUnmix'),
  };
  gl.uniform1i(U('uTex'), 0);
  gl.uniform2f(u.texRes, src.w, src.h);

  /* Render at 1x, capped. The dots are 6px wide; nothing here wants a
     retina buffer, and the cap keeps big displays cheap. */
  let dotPitch = 6;
  const size = () => {
    const w = Math.min(window.innerWidth, 1800);
    const h = Math.min(window.innerHeight, 1400);
    canvas.width = w;
    canvas.height = h;
    dotPitch = w < 640 ? 4.4 : 6;
    gl.viewport(0, 0, w, h);
    gl.uniform2f(u.res, w, h);
  };

  const pushPalette = () => {
    palette = readPalette();
    paper = !document.documentElement.classList.contains('dark');
    gl.uniform3fv(u.ground, palette.ground);
    gl.uniform3fv(u.m, palette.m);
    gl.uniform3fv(u.r, palette.r);
    gl.uniform3fv(u.a, palette.a);
    gl.uniform3fv(u.c, palette.c);
    gl.uniform1f(u.paper, paper ? 1 : 0);
    gl.uniformMatrix3fv(u.unmix, false, new Float32Array(unmixMatrix(palette)));
  };

  size();
  pushPalette();

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const state = { angle: 75, pitchOut: dotPitch };
  let raf = 0;
  let t0 = performance.now();

  const render = (now) => {
    const t = (now - t0) / 1000;
    pointer.x += (pointer.tx - pointer.x) * 0.055;
    pointer.y += (pointer.ty - pointer.y) * 0.055;

    gl.uniform1f(u.time, reduced.matches ? 0 : t);
    gl.uniform2f(u.pointer, pointer.x, pointer.y);
    gl.uniform1f(u.pitch, dotPitch);
    gl.uniform1f(u.spread, reduced.matches ? 1.2 : 2.0 + 7.0 * Math.hypot(pointer.x, pointer.y));
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    state.angle = 75 + (reduced.matches ? 0 : (t * 0.035 + pointer.x * 0.22) * (180 / Math.PI));
    state.pitchOut = dotPitch;

    if (!reduced.matches) raf = requestAnimationFrame(render);
  };

  const start = () => {
    if (raf) return;
    t0 = performance.now();
    raf = requestAnimationFrame(render);
  };
  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };

  if (reduced.matches) render(performance.now());
  else start();

  window.addEventListener('resize', () => {
    size();
    if (reduced.matches) render(performance.now());
  }, { passive: true });

  if (!reduced.matches) {
    window.addEventListener('pointermove', (e) => {
      pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });

    window.addEventListener('pointerleave', () => {
      pointer.tx = 0;
      pointer.ty = 0;
    }, { passive: true });

    // Stop the loop whenever the field is off screen or the tab is hidden.
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), { threshold: 0 }).observe(
      canvas
    );
  }

  return {
    sourceIsPhoto: src.real,
    state,
    refresh: () => {
      pushPalette();
      if (reduced.matches) render(performance.now());
    },
  };
}
