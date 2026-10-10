/**
 * Dithered drifting clouds — animated 2-color background.
 *
 * fBm noise rendered through an ordered Bayer dither, with the whole field
 * drifting like weather. One fullscreen WebGL triangle; no textures, no deps.
 * See dither.md for the full write-up.
 */

const VS = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;

const FS = `
precision highp float;
uniform vec2  uRes, uWindDir;
uniform float uTime, uGTime, uScale, uPix, uContrast, uBias, uWarp;
uniform float uEvolve, uParallax, uStretch;
uniform float uGrassOn, uGrassDither, uGStyle, uHorizon, uBladeH, uBladeW,
              uBladeDens, uLean, uSway, uFade;
uniform vec3  uPaper, uInk, uGrassInk;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i),           hash(i+vec2(1,0)), u.x),
             mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);
}
float fbm(vec2 p){
  float a = 0.5, s = 0.0;
  mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);   // rotate octaves: kills grid artifacts
  for(int i=0;i<6;i++){ s += a*vnoise(p); p = rot*p*2.03; a *= 0.5; }
  return s;
}

/* ordered 8x8 Bayer, computed rather than sampled */
float bayer2(vec2 a){ a = floor(a); return fract(a.x/2.0 + a.y*a.y*0.75); }
#define bayer4(a) (bayer2(0.5*(a))*0.25 + bayer2(a))
#define bayer8(a) (bayer4(0.5*(a))*0.25 + bayer2(a))

/* ---------- sky ---------- */
float layer(vec2 uv, float scale, float speed, float t, vec2 seed){
  mat2 shear = mat2(uWindDir.x, uWindDir.y, -uWindDir.y, uWindDir.x);
  vec2 l = shear * uv;
  l.x /= uStretch;                                 // stretch banks along the wind
  vec2 p = l * scale + seed;
  p.x -= t * speed * scale;                        // the actual travel
  // warp field rides ALONG with the clouds, so shapes keep their identity
  vec2 q = vec2(fbm(p + vec2(0.0, 1.7) + vec2(0.0, t*uEvolve*0.05)),
                fbm(p + vec2(5.2, 1.3) - vec2(t*uEvolve*0.04, 0.0)));
  return fbm(p + uWarp*q);
}

/* ---------- grass (optional) ----------
   Each blade is a tapered, curved shape evaluated as a 2D distance field.
   Blades sit in jittered cells; we test the 5 nearest so leaners resolve. */
float bladeField(vec2 uv, float baseY, float dens, float hgt,
                 float wid, float leanAmt, float swayAmt, float t, float seed){
  float cover = 0.0;
  float aa = 1.2 / uRes.y;
  float ci = floor(uv.x * dens);
  for (int k = -2; k <= 2; k++) {
    float cell = ci + float(k);
    float r1 = hash(vec2(cell, seed));
    float r2 = hash(vec2(cell, seed + 7.0));
    float r3 = hash(vec2(cell, seed + 13.0));
    float rootX = (cell + 0.15 + 0.7*r1) / dens;
    float h     = hgt * (0.55 + 0.75*r2);
    float lean  = (r3*2.0 - 1.0) * leanAmt
                + sin(t*1.1 + cell*0.9 + r1*6.28) * swayAmt;
    float y = uv.y - baseY;
    if (y >= 0.0 && y <= h) {
      float f  = y / h;
      float cx = rootX + lean * f * f;             // parabolic bend
      float hw = wid * (1.0 - f) * (1.0 - 0.35*f); // taper to a point
      cover = max(cover, 1.0 - smoothstep(hw - aa, hw + aa, abs(uv.x - cx)));
    }
  }
  return cover;
}

float grassDensity(vec2 uv, float t){
  float base = uHorizon;
  if (uGStyle < 0.5) {
    // layered meadow: back rows are partly opaque, so dither reads them lighter
    float back  = bladeField(uv, base,       uBladeDens*2.1, uBladeH*0.45,
                             uBladeW*0.55, uLean*0.5, uSway*0.4,  t,  3.0) * 0.55;
    float mid   = bladeField(uv, base-0.022, uBladeDens*1.35, uBladeH*0.72,
                             uBladeW*0.8,  uLean*0.8, uSway*0.7,  t, 17.0) * 0.80;
    float front = bladeField(uv, base-0.055, uBladeDens,      uBladeH,
                             uBladeW,      uLean,     uSway,     t, 41.0);
    float turf  = bladeField(uv, base-0.09,  uBladeDens*3.2,  uBladeH*0.30,
                             uBladeW*0.7,  uLean*0.3, uSway*0.25, t, 59.0);
    float g = max(max(back, mid), max(front, turf));
    float ground = smoothstep(base + 0.015, base - 0.075, uv.y);  // soft, not a slab
    return max(g, ground);
  }
  if (uGStyle < 1.5) {
    float e = base + (fbm(vec2(uv.x*2.3 + t*0.05, 9.0)) - 0.5) * uBladeH * 2.2;
    return clamp((e - uv.y) / uFade, 0.0, 1.0);
  }
  float d = base - uv.y;
  if (d <= 0.0) return 0.0;
  float persp = pow(clamp(d / max(base, 0.001), 0.0, 1.0), 0.45);
  float tex   = fbm(vec2(uv.x * (3.0 + 40.0*persp), uv.y * 60.0 + t*0.1));
  return clamp(persp * 1.15 + (tex - 0.5) * 0.55 * (1.0 - persp*0.6), 0.0, 1.0);
}

void main(){
  vec2 uv   = gl_FragCoord.xy / uRes.y;            // aspect-correct
  vec2 cell = gl_FragCoord.xy / uPix;              // dither grid: SCREEN space

  float a = layer(uv, uScale,      1.00, uTime, vec2(0.0));
  float b = layer(uv, uScale*0.55, 0.42, uTime, vec2(31.4, 11.2));
  float v = mix(a, max(a, b*0.96), uParallax);
  v = smoothstep(0.5 - uContrast, 0.5 + uContrast, v) + uBias;

  vec3 col = mix(uPaper, uInk, step(bayer8(cell), v));

  if (uGrassOn > 0.5) {
    float gd = grassDensity(uv, uGTime);
    // offset the matrix so grass dither doesn't phase-lock with the sky
    float gi = uGrassDither > 0.5 ? step(bayer8(cell + vec2(37.0, 11.0)), gd)
                                  : step(0.5, gd);
    col = mix(col, uGrassInk, gi);
  }

  gl_FragColor = vec4(col, 1.0);
}`;

export const DEFAULTS = {
  // sky
  wind:     0.0004,          // units/sec of travel
  angle:    21,              // degrees; never leave at 0
  evolve:   1.05,            // internal morph rate, independent of travel
  parallax: 0.30,
  stretch:  1.25,
  scale:    3.20,            // cloud size (lower = bigger clouds)
  dot:      1,               // DEVICE px — must be an integer
  contrast: 0.34,
  bias:     0.09,            // overall ink coverage
  warp:     0.85,
  paper:    [1.00, 1.00, 1.00],
  ink:      [0.42, 0.58, 0.83],
  // grass (off)
  grass:        false,
  grassStyle:   'blades',    // 'blades' | 'soft' | 'persp'
  grassDither:  true,
  grassInk:     null,        // null = same as `ink`
  horizon:   0.17,
  bladeH:    0.115,
  bladeW:    0.0035,
  bladeDens: 54,
  lean:      0.044,
  sway:      0.012,
  fade:      0.06,
};

const STYLES = { blades: 0, soft: 1, persp: 2 };

export function initDitherClouds(canvas, opts = {}) {
  const o  = { ...DEFAULTS, ...opts };
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
  if (!gl) return null;                     // caller keeps a CSS fallback

  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = n => gl.getUniformLocation(prog, n);
  const u = {
    res:U('uRes'), time:U('uTime'), gtime:U('uGTime'), dir:U('uWindDir'),
    scale:U('uScale'), pix:U('uPix'), con:U('uContrast'), bias:U('uBias'),
    warp:U('uWarp'), evo:U('uEvolve'), par:U('uParallax'), str:U('uStretch'),
    paper:U('uPaper'), ink:U('uInk'), gink:U('uGrassInk'),
    gon:U('uGrassOn'), gdith:U('uGrassDither'), gstyle:U('uGStyle'),
    hor:U('uHorizon'), bh:U('uBladeH'), bw:U('uBladeW'), bden:U('uBladeDens'),
    lean:U('uLean'), sway:U('uSway'), fade:U('uFade'),
  };

  function applyOptions() {
    const ang = o.angle * Math.PI / 180;
    gl.uniform2f(u.dir, Math.cos(ang), Math.sin(ang));
    gl.uniform3fv(u.paper, o.paper);
    gl.uniform3fv(u.ink,   o.ink);
    gl.uniform3fv(u.gink,  o.grassInk || o.ink);
    gl.uniform1f(u.scale, o.scale);    gl.uniform1f(u.pix,  o.dot);
    gl.uniform1f(u.con,   o.contrast); gl.uniform1f(u.bias, o.bias);
    gl.uniform1f(u.warp,  o.warp);     gl.uniform1f(u.evo,  o.evolve);
    gl.uniform1f(u.par,   o.parallax); gl.uniform1f(u.str,  o.stretch);
    gl.uniform1f(u.gon,   o.grass ? 1 : 0);
    gl.uniform1f(u.gdith, o.grassDither ? 1 : 0);
    gl.uniform1f(u.gstyle, STYLES[o.grassStyle] ?? 0);
    gl.uniform1f(u.hor,  o.horizon); gl.uniform1f(u.bh,   o.bladeH);
    gl.uniform1f(u.bw,   o.bladeW);  gl.uniform1f(u.bden, o.bladeDens);
    gl.uniform1f(u.lean, o.lean);    gl.uniform1f(u.sway, o.sway);
    gl.uniform1f(u.fade, o.fade);
  }
  applyOptions();

  function resize() {
    const dpr = Math.min(devicePixelRatio, 2);
    const w = Math.max(1, Math.round(canvas.clientWidth  * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width === w && canvas.height === h) return;
    canvas.width = w; canvas.height = h;
    gl.viewport(0, 0, w, h);
    gl.uniform2f(u.res, w, h);
  }

  function draw(t) {
    gl.uniform1f(u.time,  t);
    gl.uniform1f(u.gtime, performance.now() / 1000);  // sway has its own clock
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let t = 0, last = performance.now(), raf = 0, visible = true;

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    t += dt * o.wind * 40;
    resize(); draw(t);
    raf = requestAnimationFrame(frame);
  }
  function start() {
    if (raf || !visible || reduced.matches) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() { cancelAnimationFrame(raf); raf = 0; }

  resize(); draw(t);                 // static frame covers reduced-motion

  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    visible ? start() : stop();
  });
  io.observe(canvas);

  const onVis    = () => (document.hidden ? stop() : start());
  const onResize = () => { resize(); if (!raf) draw(t); };
  const onReduce = () => (reduced.matches ? stop() : start());
  document.addEventListener('visibilitychange', onVis);
  addEventListener('resize', onResize);
  reduced.addEventListener('change', onReduce);

  start();

  return {
    stop, start,
    /** Live-update any option (e.g. colors on theme change). */
    set(next) { Object.assign(o, next); applyOptions(); if (!raf) draw(t); },
    destroy() {
      stop(); io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      removeEventListener('resize', onResize);
      reduced.removeEventListener('change', onReduce);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
