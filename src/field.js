/* ==========================================
   HALFTONE FIELD

   A four-ink halftone screen, run as a fragment shader over one
   photograph. Each ink gets its own rotated screen the way a press
   would set them (15°/75°/0°/45°), its own plate offset, and its own
   separation off the source pixels. Moving the pointer pulls the
   plates out of register and turns the screens; at rest everything
   drifts slowly back.

   Source image: `public/bloom.jpg` — the photograph itself, never a
   drawn substitute. The screen only ever separates real pixels.

   Degrades twice: no WebGL falls back to a static 2D-canvas screen,
   and no canvas at all leaves the CSS ground showing.
   ========================================== */

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;


/* ==========================================
   THE AURA — a separate, much smaller pass.

   Four grounds clouded into each other. It is the only thing under the
   ink, so it has to be there every frame, but it carries nothing finer
   than a soft blob: run per-pixel at full size it cost about as much as
   the halftone itself. So it renders into a buffer a few hundred pixels
   across and the screen pass stretches it back up. Bilinear filtering
   over content this smooth is free of charge and indistinguishable.
   ========================================== */
const AURA_FRAG = `
precision highp float;

uniform vec2  uRes;      // the aura buffer, not the canvas
uniform float uAspect;   // the CANVAS aspect, so blobs stay round
uniform float uTime;
uniform vec2  uPointer;
uniform float uPaper;
uniform vec3  uAura1, uAura2, uAura3, uAura4;

/* The ground is not one flat colour, it is four clouded into each
   other, drifting slowly enough that the page reads as still. This is
   what the ink prints ON in both directions: the additive plates add
   their light to it, the subtractive plates take light out of it. So
   the ground moving moves the whole plate with it. */

/* No sin() here. The usual fract(sin(dot(...))) hash costs a
   transcendental per tap, and the aura takes ~30 taps per pixel per
   frame on top of the four texture reads the plates already do — it
   measured out at half the frame budget on its own. This one is three
   multiplies and two fracts. */
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i),               hash21(i + vec2(1.0, 0.0)), u.x),
             mix(hash21(i + vec2(0.0,1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
}

// Two octaves. This only feeds the domain warp, and a third octave
// moves boundaries by less than the softest edge on screen.
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 2; i++) {
    v += a * vnoise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

void main() {
  /* Top-down, to match the space the screen pass works in, and
     aspect-corrected so the blobs stay round on a wide viewport. */
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = frag / uRes;
  uv.y = 1.0 - uv.y;
  uv.x *= uAspect;

  float t = uTime * 0.02;

  /* Warp the sampling grid with more noise before reading it. Straight
     fbm gives soft but parallel bands; warping is what makes the
     boundaries fold back on themselves the way a dyed edge does. */
  vec2 q = vec2(fbm(uv * 2.2 + t),
                fbm(uv * 2.2 + vec2(4.7, 2.1) - t * 0.8));
  vec2 w = uv * 2.4 + q * 1.1 + uPointer * 0.08;

  /* One field per ground — four of them, weights rather than a chain of
     mixes. Mixing A into B into C into D averages four colours wherever
     they overlap, and the average of four hues is grey: that is exactly
     how an ombré turns to mud. Weighting lets each ground own the region
     where its own field runs highest, and the raised power sharpens that
     ownership so the hue survives the blend.

     The four have to be INDEPENDENT. Deriving one from the others — a
     sum, say — gives it the lowest variance of the four, so it wins
     almost everywhere and the whole field collapses onto that one
     colour. Hence four unrelated offsets and four unrelated scales.

     Plain value noise here, not fbm: the warp above already supplies the
     irregularity, the octaves would only add detail finer than the
     softest thing on screen, and this runs per pixel per frame. */
  vec4 k = vec4(
    vnoise(w            + vec2( 0.0,  0.0) + t * 0.6),
    vnoise(w * 1.37     + vec2( 5.2,  1.3) - t * 0.5),
    vnoise(w * 0.83     + vec2(-2.4,  6.1) + t * 0.4),
    vnoise(w * 1.11     + vec2( 9.3, -4.8) + t * 0.7)
  );
  k = pow(k, vec4(3.5));
  k /= max(dot(k, vec4(1.0)), 1e-4);

  vec3 col = uAura1 * k.x + uAura2 * k.y + uAura3 * k.z + uAura4 * k.w;

  /* A fall at the corners, so four clouds of equal weight still have a
     centre for the bloom to sit in. Deep on black, barely there on
     paper — the same multiply that reads as falloff against a dark
     ground just dirties a light one. */
  vec2 d = (vec2(uv.x / uAspect, uv.y) - vec2(0.5, 0.42)) * vec2(uAspect, 1.0);
  float edge = smoothstep(0.20, 1.00, length(d));
  gl_FragColor = vec4(col * mix(1.0 - edge * 0.42, 1.0 - edge * 0.10, uPaper), 1.0);
}
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
uniform sampler2D uAuraTex;  // the ground, rendered small and stretched
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

  // The amber plate exists for the anthers and the warm rim of a
  // petal. Left at full pull it covers the whole bloom and the pink
  // turns orange, so it is held back at the source as well.
  return vec4(ink.x, k, ink.y * 0.62, ink.z);
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

  /* The ground, read back off the low-resolution pass. frag is
     top-down and the framebuffer is bottom-up, hence the flip. */
  vec3 ground = texture2D(uAuraTex, vec2(frag.x / uRes.x, 1.0 - frag.y / uRes.y)).rgb;

  /* Ink on black adds light; ink on paper takes it away. */
  vec3 add = ground
    + uInkM * dM * 0.98
    + uInkA * dA * 0.58
    + uInkC * dC * 0.86
    + uInkR * dR * 0.42;

  vec3 sub = ground
    * mix(vec3(1.0), uInkM, dM * 0.80)
    * mix(vec3(1.0), uInkA, dA * 0.38)
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
    aura: [
      tok('--aura-1', '#0d1019'),
      tok('--aura-2', '#162e26'),
      tok('--aura-3', '#35240f'),
      tok('--aura-4', '#260e2c'),
    ],
    /* The plate's inks, not the interface's. See the note by
       --plate-magenta in the stylesheet for why they differ. */
    m: tok('--plate-magenta', '#e87aab'),
    r: tok('--plate-rose', '#b4637f'),
    a: tok('--plate-amber', '#dca97d'),
    c: tok('--plate-cyan', '#7bb3c4'),
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

/* ---------- source ---------- */

const SOURCES = ['bloom.jpg', 'bloom.png'];

/* The screen runs over the photograph or it does not run at all. There
   is deliberately no drawn substitute: a generated flower reads as an
   icon, and a field that quietly swaps one in hides the fact that
   `public/bloom.jpg` went missing. No photograph, no canvas — the CSS
   ground shows through instead. */
const loadSource = () =>
  new Promise((resolve) => {
    const tryNext = (i) => {
      if (i >= SOURCES.length) {
        resolve(null);
        return;
      }
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve({ image: img, w: img.naturalWidth, h: img.naturalHeight });
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

  /* The same four grounds, as plain radial washes. No noise and no
     warp — this path draws once and never again, so it only has to
     agree in colour, not in texture. */
  ctx.fillStyle = css(palette.aura[0]);
  ctx.fillRect(0, 0, W, H);
  [
    [0.22, 0.18, 0.62, palette.aura[1]],
    [0.82, 0.30, 0.66, palette.aura[2]],
    [0.68, 0.88, 0.58, palette.aura[3]],
    [0.30, 0.76, 0.72, palette.aura[1]],
  ].forEach(([x, y, r, col]) => {
    const g = ctx.createRadialGradient(x * W, y * H, 0, x * W, y * H, r * Math.max(W, H));
    g.addColorStop(0, css(col));
    g.addColorStop(1, css(col).replace('rgb(', 'rgba(').replace(')', ',0)'));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  });
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
  if (!src) {
    console.warn('[field] bloom.jpg not found — leaving the CSS ground.');
    canvas.remove();
    return null;
  }
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

  const link = (fragSource) => {
    const f = compile(gl.FRAGMENT_SHADER, fragSource);
    if (!f) return null;
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, f);
    gl.linkProgram(p);
    return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null;
  };

  const prog = link(FRAG);
  const auraProg = link(AURA_FRAG);
  if (!prog || !auraProg) return null;

  /* One fullscreen triangle, shared by both passes. The attribute lives
     at the same location in both because both use the same vertex
     shader, so it is bound once and never touched again. */
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  [prog, auraProg].forEach((p) => {
    const loc = gl.getAttribLocation(p, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  });

  gl.useProgram(prog);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, src.image);

  /* The aura's own target. LINEAR on both axes is the whole point: the
     buffer is a fraction of the canvas and the hardware does the
     smoothing on the way back up. */
  const auraTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, auraTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  const auraFbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, auraFbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, auraTex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  const U = (n) => gl.getUniformLocation(prog, n);
  const u = {
    res: U('uRes'), texRes: U('uTexRes'), time: U('uTime'), pointer: U('uPointer'),
    pitch: U('uPitch'), paper: U('uPaper'), spread: U('uSpread'),
    m: U('uInkM'), r: U('uInkR'), a: U('uInkA'), c: U('uInkC'), unmix: U('uUnmix'),
  };
  gl.uniform1i(U('uTex'), 0);
  gl.uniform1i(U('uAuraTex'), 1);
  gl.uniform2f(u.texRes, src.w, src.h);

  const AU = (n) => gl.getUniformLocation(auraProg, n);
  const au = {
    res: AU('uRes'), aspect: AU('uAspect'), time: AU('uTime'), pointer: AU('uPointer'),
    paper: AU('uPaper'),
    a1: AU('uAura1'), a2: AU('uAura2'), a3: AU('uAura3'), a4: AU('uAura4'),
  };

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, auraTex);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);

  /* Render at 1x, capped. The dots are 6px wide; nothing here wants a
     retina buffer, and the cap keeps big displays cheap. */
  let dotPitch = 6;
  let auraW = 1;
  let auraH = 1;

  /* The aura buffer holds a fixed pixel budget and takes the canvas's
     aspect, so the cost of the ground does not move with the viewport
     and the blobs stay the shape they were authored. ~40k pixels is
     roughly a thirtieth of the screen pass. */
  const AURA_BUDGET = 40000;

  const size = () => {
    const w = Math.min(window.innerWidth, 1800);
    const h = Math.min(window.innerHeight, 1400);
    canvas.width = w;
    canvas.height = h;
    dotPitch = w < 640 ? 4.4 : 6;

    const aspect = w / h;
    auraW = Math.max(32, Math.min(384, Math.round(Math.sqrt(AURA_BUDGET * aspect))));
    auraH = Math.max(32, Math.round(auraW / aspect));

    gl.bindTexture(gl.TEXTURE_2D, auraTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, auraW, auraH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindTexture(gl.TEXTURE_2D, tex);

    gl.useProgram(auraProg);
    gl.uniform2f(au.res, auraW, auraH);
    gl.uniform1f(au.aspect, aspect);

    gl.useProgram(prog);
    gl.uniform2f(u.res, w, h);
  };

  const pushPalette = () => {
    palette = readPalette();
    paper = !document.documentElement.classList.contains('dark');
    gl.useProgram(auraProg);
    gl.uniform3fv(au.a1, palette.aura[0]);
    gl.uniform3fv(au.a2, palette.aura[1]);
    gl.uniform3fv(au.a3, palette.aura[2]);
    gl.uniform3fv(au.a4, palette.aura[3]);
    gl.uniform1f(au.paper, paper ? 1 : 0);

    gl.useProgram(prog);
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

    const time = reduced.matches ? 0 : t;

    // pass 1 — the ground, into its small buffer
    gl.useProgram(auraProg);
    gl.bindFramebuffer(gl.FRAMEBUFFER, auraFbo);
    gl.viewport(0, 0, auraW, auraH);
    gl.uniform1f(au.time, time);
    gl.uniform2f(au.pointer, pointer.x, pointer.y);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // pass 2 — the four screens, over it, at full size
    gl.useProgram(prog);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform1f(u.time, time);
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
    state,
    refresh: () => {
      pushPalette();
      if (reduced.matches) render(performance.now());
    },
  };
}
