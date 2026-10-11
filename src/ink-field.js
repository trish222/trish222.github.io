/**
 * Ink field — the paper this site is printed on.
 *
 * A domain-warped fBm height field drawn as topographic contours, with a second
 * contour set at a slightly different band count so the two interfere and
 * produce real moiré. Coverage is quantised through an ordered 8x8 Bayer matrix,
 * so the output is three flat inks and a speckle — no gradients, no textures.
 *
 * One fullscreen triangle, one noise field per pixel, no dependencies.
 * The pointer pushes the two contour plates out of register.
 */

const VS = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const FS_BODY = `
precision highp float;

uniform vec2  uRes;
uniform float uTime, uScale, uWarp, uBands, uBeat, uLineW, uPix;
uniform float uSep, uMassLo, uMassHi, uDeep, uGrain;
uniform float uEnvLo, uEnvHi, uClearX, uClearY, uHazeA;
uniform vec3  uPaper, uLine, uHaze, uInk;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }

float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i),            hash(i + vec2(1, 0)), u.x),
             mix(hash(i + vec2(0,1)), hash(i + vec2(1, 1)), u.x), u.y);
}

/* 5 octaves, each rotated so the value grid never shows through */
float fbm(vec2 p){
  float a = 0.5, s = 0.0;
  mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
  for (int i = 0; i < 5; i++){ s += a * vnoise(p); p = rot * p * 2.03; a *= 0.5; }
  return s;
}

/* the height field: fBm whose coordinates are warped by more fBm */
float field(vec2 p, float t){
  vec2 q = vec2(fbm(p + vec2(0.0, 1.70) + vec2(0.0, t * 0.05)),
                fbm(p + vec2(5.2, 1.30) - vec2(t * 0.04, 0.0)));
  return fbm(p + uWarp * q);
}

/* one contour set. Where the field is steep the line smears to grey, which the
   dither then breaks into dots — that grey is where the moiré lives. */
float contour(float v, float bands){
  float f = v * bands;
  float d = abs(fract(f) - 0.5);
#ifdef HAS_DERIV
  float w = max(fwidth(f) * 0.6, 0.012);
#else
  float w = 0.05;
#endif
  return 1.0 - smoothstep(uLineW - w, uLineW + w, d);
}

/* ordered 8x8 Bayer, computed rather than sampled.
   screen() biases the comparison so a coverage of exactly zero never lights
   the matrix's zero cell — otherwise blank paper wears a dot grid. */
float bayer2(vec2 a){ a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
#define bayer4(a) (bayer2(0.5 * (a)) * 0.25 + bayer2(a))
#define bayer8(a) (bayer4(0.5 * (a)) * 0.25 + bayer2(a))
float screen(float th, float x){ return step(th + 0.0079, x); }

void main(){
  /* Scale off the SHORT edge. Dividing by height alone gives a phone less
     than half a field unit of width, and the slow envelope below never varies
     across it — the sheet comes out blank. */
  vec2 uv   = gl_FragCoord.xy / min(uRes.x, uRes.y);
  vec2 cell = gl_FragCoord.xy / uPix;          // dither grid lives in screen space
  vec2 n    = gl_FragCoord.xy / uRes;          // 0..1 across the sheet
  float t   = uTime;

  vec2 p = uv * uScale + vec2(t * 0.055, t * 0.019);
  float v = field(p, t);

  /* The sheet is mostly blank paper. A slow envelope decides where any ink
     lands at all, and the composition mask keeps it off the title's quarter. */
  float raw = fbm(p * 0.72 + vec2(7.3, 2.1));

  /* Type always wins the sheet. On a wide one the ink takes the right; on a
     phone there is no right, so it takes the open band between the title and
     the spec rule instead. */
  float port = 1.0 - smoothstep(0.80, 1.20, uRes.x / uRes.y);
  float wide = smoothstep(uClearX, uClearX + 0.55, n.x)
             + smoothstep(uClearY, uClearY - 0.45, n.y) * 0.55;
  float tall = smoothstep(0.32, 0.45, n.y) * (1.0 - smoothstep(0.57, 0.70, n.y));
  float comp = clamp(mix(wide, tall, port), 0.0, 1.0);

  float env = smoothstep(mix(uEnvLo, uEnvLo - 0.09, port), uEnvHi, raw);
  float m = env * comp;

  float a = contour(v, uBands);
  float b = contour(v + uSep, uBands * uBeat);  // second plate, out of register

  /* Below the floor there is no ink at all. Without this the lowest Bayer
     threshold fires once per 8x8 cell across the whole sheet and the paper
     wears a regular dot grid instead of staying blank. */
  float cov  = smoothstep(0.10, 0.62, max(a, b * 0.72) * m);
  float mass = smoothstep(0.12, 0.75, smoothstep(uMassLo, uMassHi, v) * m);
  float core = smoothstep(0.10, 0.70, smoothstep(uDeep, uDeep + 0.08, v) * m);

  float th = bayer8(cell);
  vec3 col = uPaper;
  col = mix(col, uHaze, screen(th, mass * uHazeA));
  col = mix(col, uLine, screen(th, cov));
  col = mix(col, uInk,  screen(th, core * 0.8) * step(0.5, cov));

  /* paper speckle: a fixed proportion of cells knocked a shade darker */
  float g = hash(floor(gl_FragCoord.xy / uPix) + vec2(19.1, 7.7));
  col = mix(col, col * 0.955, screen(g, uGrain));

  gl_FragColor = vec4(col, 1.0);
}`;

export const DEFAULTS = {
  scale:   1.42,   // field size: lower = larger forms
  warp:    0.78,   // domain-warp strength; this is what makes it billow
  bands:   16.0,   // contour count across the field's range
  beat:    1.115,  // second plate's band ratio — the moiré period
  lineW:   0.095,  // half-width of a contour, in band units
  dot:     2,      // dither cell, CSS px
  envLo:   0.44,   // below this the sheet stays blank paper
  envHi:   0.72,
  clearX:  0.26,   // ink fades in to the right of this fraction of the sheet
  clearY:  0.92,   // ...and in toward the bottom
  massLo:  0.50,
  massHi:  0.80,
  hazeA:   0.44,
  deep:    0.84,
  grain:   0.030,
  drift:   0.028,  // field units per second
  sepMax:  0.013,  // how far the pointer can push the plates apart
  paper:  [0.925, 0.933, 0.941],
  line:   [0.106, 0.208, 0.839],
  haze:   [0.776, 0.843, 0.918],
  ink:    [0.043, 0.051, 0.067],
};

export function initInkField(canvas, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false });
  if (!gl) return null;                       // CSS keeps a flat paper fallback

  const deriv = gl.getExtension('OES_standard_derivatives');
  const FS = (deriv ? '#extension GL_OES_standard_derivatives : enable\n#define HAS_DERIV 1\n' : '')
           + FS_BODY;

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) return null;
    return s;
  };
  const vs = compile(gl.VERTEX_SHADER, VS);
  const fs = compile(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) return null;

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const U = (n) => gl.getUniformLocation(prog, n);
  const u = {
    res: U('uRes'),   time: U('uTime'),  scale: U('uScale'), warp: U('uWarp'),
    bands: U('uBands'), beat: U('uBeat'), lineW: U('uLineW'), pix: U('uPix'),
    sep: U('uSep'), massLo: U('uMassLo'), massHi: U('uMassHi'), deep: U('uDeep'),
    grain: U('uGrain'), paper: U('uPaper'), line: U('uLine'), haze: U('uHaze'),
    ink: U('uInk'), envLo: U('uEnvLo'), envHi: U('uEnvHi'),
    clearX: U('uClearX'), clearY: U('uClearY'), hazeA: U('uHazeA'),
  };

  let dpr = 1;

  function applyOptions() {
    gl.uniform1f(u.scale, o.scale);   gl.uniform1f(u.warp, o.warp);
    gl.uniform1f(u.bands, o.bands);   gl.uniform1f(u.beat, o.beat);
    gl.uniform1f(u.lineW, o.lineW);   gl.uniform1f(u.pix, Math.max(1, o.dot * dpr));
    gl.uniform1f(u.massLo, o.massLo); gl.uniform1f(u.massHi, o.massHi);
    gl.uniform1f(u.deep, o.deep);     gl.uniform1f(u.grain, o.grain);
    gl.uniform1f(u.envLo, o.envLo);   gl.uniform1f(u.envHi, o.envHi);
    gl.uniform1f(u.clearX, o.clearX); gl.uniform1f(u.clearY, o.clearY);
    gl.uniform1f(u.hazeA, o.hazeA);
    gl.uniform3fv(u.paper, o.paper);  gl.uniform3fv(u.line, o.line);
    gl.uniform3fv(u.haze, o.haze);    gl.uniform3fv(u.ink, o.ink);
  }

  function resize() {
    // cap the backing store: this is a full-bleed fragment-heavy shader
    const raw = Math.min(devicePixelRatio || 1, 2);
    const wCss = Math.max(1, canvas.clientWidth);
    const hCss = Math.max(1, canvas.clientHeight);
    dpr = Math.min(raw, 2600 / wCss);
    const w = Math.max(1, Math.round(wCss * dpr));
    const h = Math.max(1, Math.round(hCss * dpr));
    if (canvas.width === w && canvas.height === h) return;
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
    gl.uniform2f(u.res, w, h);
    gl.uniform1f(u.pix, Math.max(1, o.dot * dpr));
  }

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let t = 0, sep = 0, sepTarget = 0, last = performance.now(), raf = 0, visible = true;

  function draw() {
    gl.uniform1f(u.time, t);
    gl.uniform1f(u.sep, sep);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    t += dt * o.drift;
    sep += (sepTarget - sep) * Math.min(1, dt * 4);
    resize();
    draw();
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (raf || !visible || reduced.matches) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() { cancelAnimationFrame(raf); raf = 0; }

  applyOptions();
  resize();
  draw();                                     // static frame covers reduced-motion

  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) start(); else stop();
  });
  io.observe(canvas);

  const onVis    = () => (document.hidden ? stop() : start());
  const onResize = () => { resize(); if (!raf) draw(); };
  const onReduce = () => (reduced.matches ? stop() : start());
  document.addEventListener('visibilitychange', onVis);
  addEventListener('resize', onResize);
  reduced.addEventListener('change', onReduce);

  start();

  return {
    start, stop,
    /** -1..1 — how far out of register the two contour plates sit. */
    setRegistration(n) { sepTarget = Math.max(-1, Math.min(1, n)) * o.sepMax; },
    /** Live values for the on-page readout. */
    read() { return { t, sep, running: raf !== 0 }; },
    set(next) { Object.assign(o, next); applyOptions(); if (!raf) draw(); },
    destroy() {
      stop();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      removeEventListener('resize', onResize);
      reduced.removeEventListener('change', onReduce);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
