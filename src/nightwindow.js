import * as THREE from "three";

/* ==========================================
   THE WINDOW ON THE LEFT WALL

   A four-pane sash in a painted casing, with a night sky behind the
   glass and rain running down it. Its own module for the same reason
   the desk and the treehouse are: it is a self-contained object with
   its own origin on the surface it is fixed to, and it is the thing
   most likely to be re-tuned next — the night lighting pass still has
   to make this the room's light source rather than merely look like
   it (see "The moonlight" below).

   **Local space.** x is across the opening, 0 at its centre; y is up,
   **0 at the sill line** (the bottom of the opening); z = 0 is the
   wall's *inner* face, with the wall's thickness running back to
   -thickness. That is exactly the frame src/room.js builds a wall
   panel in, so room.js only has to place this group at the opening's
   centre and the two cannot disagree about which way the wall faces.

   **The opening is a real hole.** room.js cuts it out of the wall
   field with an ExtrudeGeometry hole and reads the size from
   `OPENING` below, so the two are one number rather than two. The
   glass then sits mid-thickness, which leaves a reveal on both sides —
   the room-side one is most of what says the wall has a thickness at
   all.

   Everything here is built from primitives in code, like the rest of
   the scene: boxes for the joinery, two planes for the glass and the
   rain, and two canvases drawn with 2D.
   ========================================== */

/* --- The opening -----------------------------------------
   Sized against what the wall has spare. The left wall runs 28 units
   along z and stands 19 tall; the wainscot's cap rail tops out at
   7.88 and the desk top is at 9, so a sill at 9.6 (where room.js puts
   it) clears both and the opening is the one large bright area above
   the desk's left end. 8 x 7 is about as big as it can be and still
   leave the wall reading as a wall rather than as a frame around a
   hole, and room.js keeps 3 clear of the back corner.

   The height is set by the **top of the frame**, not by the
   proportion: at 7.0 the head landed at NDC y 0.95 at home and 0.97 at
   the right clamp — in shot, but with 3% of the frame to spare, which
   is not a margin. 6.4 puts it at 0.88, and costs the panes nothing
   worth having (3.86 x 3.06 against 3.86 x 3.36). `_winshots.mjs`
   prints the figure on both viewports. */
const OPEN_W = 8.0;
const OPEN_H = 6.4;

/* What room.js cuts, and what it places this against. One source. */
export const OPENING = { w: OPEN_W, h: OPEN_H };

/* How far back from the inner face the glass sits. Mid-thickness on a
   0.6 wall, so the reveal reads from both inside and out. */
const GLASS_INSET = 0.33;

/* --- The joinery ------------------------------------------
   Casing (architrave) over the wall face, a sash frame and a pair of
   mullions inside the opening, a sill with ears, and an apron under
   it. The sill is the proudest part and the apron the shyest, which is
   the order a real window stands off a wall in. */
const CASE_W = 0.5; // architrave width
const CASE_OUT = 0.26; // how far it stands off the wall field
const SASH_W = 0.28; // the sash frame around the glass
const SASH_D = 0.14;
const MULL_W = 0.2; // the two bars that make four panes of one sheet
const SILL_T = 0.32;
const SILL_PROUD = 0.5; // how far the sill projects into the room
const SILL_EARS = 0.35; // and how far past the casing, each side
const APRON_H = 0.5;
const APRON_OUT = 0.16;

/* The joinery is a half-step lighter than room.js's TRIM (#40395c) and
   that is deliberate rather than an oversight: a window frame with a
   bright sky behind it tends to silhouette, and at this value the
   proud faces still pick up enough ambient for the casing, the sill
   and the mullions to read as separate pieces instead of one dark
   cut-out. The sash is darker than the casing — it is deeper into the
   reveal, where less reaches it. */
const CASE_PAINT = "#4a4269";
const SASH_PAINT = "#3b3556";

/* --- The night sky ---------------------------------------
   Drawn once into a canvas and used as an unlit `map`, so the sky does
   not dim with the room: it is the brightest thing in the picture and
   wants to stay that way. The two gradient stops are the ones the
   brief specifies — dark overhead, the city's own glow at the
   horizon. */
const SKY_TOP = "#141a33";
const SKY_HORIZON = "#2b3560";
const SKY_FAR = "#1a2040"; // the back rank of buildings, hazed by the glow
const SKY_NEAR = "#0d1026"; // the front rank, nearly black
const LIT_WINDOW = "#ffd9a0";
const MOON = "#eef2ff";
/* In pane UV, from the bottom-left of the glass. Two things put it
   here. The mullions cross at exactly (0.5, 0.5), so a centred moon
   would be quartered by them — this sits whole inside one pane. And
   it is in the **upper-right** pane rather than the upper-left,
   because that is the half that survives a portrait viewport: the
   pane's +u runs toward world -z, which is screen *right* at this
   azimuth, and a phone frame crops this wall from the left (the
   window's own NDC box starts at -1.31 there). On the left-hand pane
   the moon was cut off on a phone and whole on a desktop. */
const MOON_UV = [0.7, 0.74];
const MOON_R = 0.075; // as a share of the pane's width

const SKY_TEX_W = 512;

/* --- The rain --------------------------------------------
   One extra draw call over the pane: streaks are computed in the
   fragment shader from the pane's own coordinates, so there is no
   geometry, no texture and no per-frame upload beyond a single float.

   Injected into a MeshBasicMaterial through `onBeforeCompile` rather
   than written as a ShaderMaterial, and that is not a style
   preference. A raw ShaderMaterial gets none of three's fragment
   epilogue — no `tonemapping_fragment`, no `colorspace_fragment`, no
   fog — and this scene has an operator on one render path and
   `OutputPass` doing the same job on the other (see src/tonemap.js).
   The rain would have come out a different colour on desktop than on
   mobile, and unfogged on both. Patching a built-in material keeps all
   of that, and `opacity` stays the plain uniform the wall cutaway in
   room.js writes — so the rain fades with the wall it is set in
   without the fade code knowing it exists.

   Two layers, because rain has depth: a near one with fat fast
   streaks and a far one with thin slow ones. Both are in *cell*
   units — a column count across the pane and a run count up it — so
   the widths below are resolution-independent and the pane can be
   resized without re-tuning them. */
const RAIN = {
  near: { cols: 11.0, rows: 1.9, speed: 1.0, gain: 0.85 },
  far: { cols: 23.0, rows: 3.4, speed: 0.62, gain: 0.45 },
};
const RAIN_COLOUR = "#aab7dd"; // moonlight caught on water, not white
const RAIN_ALPHA = 0.55; // peak alpha of a streak's core
const RAIN_SPEED = 0.55; // cell-runs per second at `speed` 1

/* **Reduced motion.** There are two halves to this and only the first
   is load-bearing: scene.js runs no render loop at all under
   `prefers-reduced-motion`, so nothing ever calls `tickRain` and the
   glass is simply frozen — which is why the shader is written to look
   like rain at uTime 0 rather than resolving into one (each column
   carries its own phase offset, so the opening frame is already a
   scatter). The second half is this factor, which applies if a loop
   ever does run under reduced motion: a crawl rather than a stop, so
   the glass still reads as wet without anything streaking across it.
   `window.__rain()` reports which of the two is in force. */
const RAIN_SLOW = 0.12;

/* --- State ----------------------------------------------- */
let disposables = [];
/* Shared with the compiled program, so advancing time is one float
   write and no uniform plumbing. Kept at module scope because
   `onBeforeCompile` may run again — a tone-mapping switch changes
   three's program cache key — and must hand back the same object. */
const rainTime = { value: 0 };
let rainSpeed = RAIN_SPEED;
let rainReduced = false;

function track(x) {
  disposables.push(x);
  return x;
}

/* Deterministic, so the skyline and the stars are the same on every
   load. A city that rearranges itself on refresh cannot be
   art-directed. */
function rand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/* ==========================================
   THE SKY

   Gradient, stars, moon, two ranks of skyline, then a sheen over the
   lot. The sheen is what makes it glass rather than a hole: a faint
   diagonal band of reflected room, drawn into the same texture so it
   costs nothing.
   ========================================== */
function drawSky() {
  const w = SKY_TEX_W;
  const h = Math.round((w * OPEN_H) / OPEN_W);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  const rnd = rand(0x5c1d);

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, SKY_TOP);
  grad.addColorStop(1, SKY_HORIZON);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  /* Stars, thinned toward the horizon where the city's glow washes
     them out, and kept off the moon's halo so it stays the one bright
     thing up there. */
  const mx = MOON_UV[0] * w;
  const my = (1 - MOON_UV[1]) * h;
  const mr = MOON_R * w;
  for (let i = 0; i < 90; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const fade = 1 - y / h; // 1 overhead, 0 at the horizon
    if (rnd() > fade * 0.9 + 0.1) continue;
    if (Math.hypot(x - mx, y - my) < mr * 3.2) continue;
    ctx.globalAlpha = 0.12 + rnd() * 0.45 * fade;
    ctx.fillStyle = "#dde6ff";
    const r = 0.5 + rnd() * 0.7;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  /* The moon: a halo, the disc, and three soft maria so it is a body
     rather than a dot. The halo is wide and weak — it is standing in
     for the scatter that makes a moon legible through glass. */
  const halo = ctx.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 4.4);
  halo.addColorStop(0, "rgba(186,203,247,0.34)");
  halo.addColorStop(0.45, "rgba(168,186,236,0.11)");
  halo.addColorStop(1, "rgba(168,186,236,0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(mx, my, mr * 4.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = MOON;
  ctx.beginPath();
  ctx.arc(mx, my, mr, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = "#9aa6c8";
  for (const [dx, dy, dr] of [
    [-0.3, -0.22, 0.34],
    [0.26, 0.1, 0.26],
    [-0.08, 0.36, 0.2],
  ]) {
    ctx.beginPath();
    ctx.arc(mx + dx * mr, my + dy * mr, dr * mr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  /* --- the skyline ---
     Two ranks. The far one is lighter and shorter — distance reads as
     haze against the horizon glow, not as scale — and the near one is
     nearly black and carries the lit windows. Both are run as a walk
     across the pane so the roofline is uneven without any of it being
     placed by hand. */
  const rank = (colour, baseline, lo, hi, step, windows, seed) => {
    const r = rand(seed);
    ctx.fillStyle = colour;
    let x = -step * r();
    while (x < w) {
      const bw = step * (0.55 + r() * 0.9);
      const bh = h * (lo + r() * (hi - lo));
      const top = baseline - bh;
      ctx.fillStyle = colour;
      ctx.fillRect(Math.round(x), Math.round(top), Math.ceil(bw), Math.ceil(bh + 2));
      /* A water tank or a lift overrun on some of the taller ones —
         one rectangle, and it is most of what makes a block read as a
         building rather than a bar on a chart. */
      if (bh > h * (lo + (hi - lo) * 0.6) && r() > 0.45) {
        const tw = bw * (0.18 + r() * 0.16);
        const th = bh * (0.1 + r() * 0.1);
        ctx.fillRect(Math.round(x + bw * 0.2), Math.round(top - th), Math.ceil(tw), Math.ceil(th + 1));
      }
      if (windows) {
        /* A few lit windows, on a grid inside the block so they read
           as floors. Deliberately sparse — it is well after midnight
           in here. */
        const cols = Math.max(1, Math.floor(bw / (step * 0.22)));
        const rows = Math.max(1, Math.floor(bh / (h * 0.045)));
        const ww = Math.max(1, (bw / cols) * 0.42);
        const wh = Math.max(1, (bh / rows) * 0.34);
        for (let i = 0; i < cols; i++) {
          for (let j = 0; j < rows; j++) {
            if (r() > 0.11) continue;
            ctx.globalAlpha = 0.5 + r() * 0.5;
            ctx.fillStyle = LIT_WINDOW;
            ctx.fillRect(
              x + (bw / cols) * (i + 0.3),
              top + (bh / rows) * (j + 0.35),
              ww,
              wh,
            );
          }
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = colour;
      }
      x += bw;
    }
  };

  rank(SKY_FAR, h * 0.995, 0.07, 0.2, w * 0.1, false, 0x31b7);
  rank(SKY_NEAR, h + 1, 0.1, 0.34, w * 0.14, true, 0x8f23);

  /* Glass. A single wide diagonal band of the room reflected back,
     brightest at the top-left, plus a hairline along the top of each
     pane where the sheet catches. Very low alpha: past about 0.1 it
     stops reading as a reflection and starts reading as a smear on
     the texture. */
  const sheen = ctx.createLinearGradient(0, h, w * 0.75, 0);
  sheen.addColorStop(0, "rgba(255,255,255,0)");
  sheen.addColorStop(0.62, "rgba(214,224,255,0.055)");
  sheen.addColorStop(0.78, "rgba(214,224,255,0.085)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, w, h);

  const tex = track(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/* ==========================================
   THE RAIN SHADER

   `rainLayer` is one pass of streaks. The pane is divided into
   `cols` columns and `rows` runs; each column gets its own fall speed
   and lane from a hash of its index, and each (column, run) cell
   either carries a streak or does not. So the whole layer is two
   hashes and a pair of smoothsteps per fragment, with no loop and no
   texture read.

   Falling: a feature sits at constant `g.y + uTime * v`, so as time
   advances its `g.y` decreases — down the pane, which is what the
   plane's local +Y being up makes correct.
   ========================================== */
function rainChunk() {
  const layer = (k) => `rainLayer(vRainUv, ${RAIN[k].cols.toFixed(1)}, ${RAIN[k].rows.toFixed(1)}, ${RAIN[k].speed.toFixed(2)}, ${k === "near" ? "1.0" : "5.0"}) * ${RAIN[k].gain.toFixed(2)}`;
  return `
	float rainStreaks = clamp(${layer("near")} + ${layer("far")}, 0.0, 1.0);
	diffuseColor.a *= rainStreaks * ${RAIN_ALPHA.toFixed(3)};
`;
}

const RAIN_HEAD = /* glsl */ `
uniform float uTime;
varying vec2 vRainUv;

float rainHash(vec2 p) {
	return fract(sin(dot(p, vec2(41.37, 289.13))) * 43758.5453);
}

float rainLayer(vec2 uv, float cols, float rows, float speed, float seed) {
	vec2 g = uv * vec2(cols, rows);
	float col = floor(g.x);
	float fx = fract(g.x);
	/* Per-column: how fast this file of drops falls, and which lane of
	   its column it runs down. */
	float h = rainHash(vec2(col, seed));
	float v = speed * (0.65 + 0.7 * h);
	float lane = 0.18 + 0.64 * rainHash(vec2(col, seed + 3.0));
	float y = g.y + uTime * v + h * 13.0;
	float cell = floor(y);
	float fy = fract(y);
	/* Per-cell: whether there is a drop at all, and how long it is. */
	float r = rainHash(vec2(col, cell + seed * 7.0));
	float on = step(0.42, r);
	float len = 0.18 + 0.30 * r;
	float wide = 0.055 + 0.03 * r;
	/* The lean is what stops the streaks reading as a comb: a drop
	   drifts across its lane as it falls. */
	float dx = abs(fx - lane - fy * 0.09);
	float body = smoothstep(wide, 0.0, dx)
		* smoothstep(len, 0.0, fy)
		* smoothstep(0.0, 0.015, fy);
	return body * on;
}
`;

function rainMaterial() {
  const m = track(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(RAIN_COLOUR),
      transparent: true,
      /* The streaks lie on the glass and nothing is ever drawn in
         front of them *within* the pane, so writing depth would only
         risk occluding the mullions on a sort flip. */
      depthWrite: false,
      opacity: 1,
      side: THREE.FrontSide,
    }),
  );
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = rainTime;
    shader.vertexShader =
      `varying vec2 vRainUv;\n` +
      shader.vertexShader.replace(
        "#include <begin_vertex>",
        /* The pane's own coordinates, off `position` rather than off
           `uv` — a MeshBasicMaterial with no maps on it does not
           declare the uv attribute, and asking for one by setting
           USE_UV would pull in machinery nothing here uses. The two
           divisors are the plane's size, so this is the 0..1 box `uv`
           would have given. */
        `#include <begin_vertex>
	vRainUv = position.xy / vec2(${OPEN_W.toFixed(4)}, ${OPEN_H.toFixed(4)}) + 0.5;`,
      );
    shader.fragmentShader =
      RAIN_HEAD +
      shader.fragmentShader.replace(
        /* `diffuseColor.a` already carries `opacity`, which is what
           room.js's cutaway writes — so the rain fades out with its
           wall for free. Everything after this point in the built-in
           shader (tone mapping, the colour-space conversion, fog) is
           left alone, which is the whole reason this is a patched
           material rather than a ShaderMaterial. */
        "#include <alphamap_fragment>",
        `#include <alphamap_fragment>\n${rainChunk()}`,
      );
  };
  return m;
}

/* ==========================================
   BUILD
   ========================================== */
export function buildNightWindow({
  noise = null,
  thickness = 0.6,
  anisotropy = 1,
  reduced = false,
} = {}) {
  const group = new THREE.Group();
  group.name = "wall-window";
  rainReduced = !!reduced;
  rainSpeed = RAIN_SPEED * (rainReduced ? RAIN_SLOW : 1);
  rainTime.value = 0;

  /* The joinery takes the wall's own noise map so the paint does not
     read as a flat fill beside a wall that is not one. `map`
     multiplies `color`, so one near-white field tints every part from
     its own base colour — the same trick room.js plays across the
     wainscot and the trim. Each part tiles it at its own rate so the
     lattice does not line up across a mitre. */
  const paint = (colour, tiles) => {
    const m = track(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(colour),
        roughness: 0.78,
        metalness: 0,
        /* Always transparent, never toggled — see room.js: the flag
           changes how three sorts the object, so the cutaway moves
           `opacity` and nothing else. */
        transparent: true,
        opacity: 1,
      }),
    );
    if (noise) {
      m.map = track(noise.clone());
      m.map.needsUpdate = true;
      m.map.repeat.set(tiles[0], tiles[1]);
      m.map.anisotropy = anisotropy;
    }
    return m;
  };

  const casing = paint(CASE_PAINT, [1 / 3, 1 / 3]);
  const sash = paint(SASH_PAINT, [1 / 2, 1 / 2]);
  const materials = [casing, sash];

  const box = (w, h, d, x, y, z, mat) => {
    const mesh = new THREE.Mesh(track(new THREE.BoxGeometry(w, h, d)), mat);
    mesh.position.set(x, y, z);
    /* **The joinery casts, and it is the reason the pool reads as a
       window rather than as a rectangle of light.** The moon is aimed
       through this opening and the wall around it casts (see
       room.js), so the sash and the two mullions stripe the beam into
       four panes on the floor and the desk. The glass and the rain do
       not cast — a transparent caster in a VSM map is an opaque one,
       and they would have filled the hole straight back in. */
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  const hw = OPEN_W / 2;

  /* --- the glass ---
     Unlit, so it keeps its brightness while the room sits three stops
     down. It is the one surface here that is meant to look like a
     light source. */
  const glass = new THREE.Mesh(
    track(new THREE.PlaneGeometry(OPEN_W, OPEN_H)),
    track(
      new THREE.MeshBasicMaterial({
        map: drawSky(),
        transparent: true,
        opacity: 1,
      }),
    ),
  );
  glass.material.map.anisotropy = anisotropy;
  glass.name = "window-glass";
  glass.position.set(0, OPEN_H / 2, -GLASS_INSET);
  glass.castShadow = glass.receiveShadow = false;
  group.add(glass);
  materials.push(glass.material);

  /* --- the rain ---
     A hair in front of the glass and a hair behind the sash, so the
     streaks are on the sheet and the bars are in front of them. */
  const rain = new THREE.Mesh(
    track(new THREE.PlaneGeometry(OPEN_W, OPEN_H)),
    rainMaterial(),
  );
  rain.name = "window-rain";
  rain.position.set(0, OPEN_H / 2, -GLASS_INSET + 0.02);
  rain.castShadow = rain.receiveShadow = false;
  group.add(rain);
  materials.push(rain.material);

  /* --- the sash, and the two bars that make four panes ---
     One sheet of sky with bars over it, rather than four panes: that
     is both how a four-pane sash is actually glazed and what keeps the
     skyline continuous across the mullion instead of stepping at it. */
  const sashZ = -GLASS_INSET + 0.02 + SASH_D / 2 + 0.01;
  box(OPEN_W, SASH_W, SASH_D, 0, SASH_W / 2, sashZ, sash);
  box(OPEN_W, SASH_W, SASH_D, 0, OPEN_H - SASH_W / 2, sashZ, sash);
  box(SASH_W, OPEN_H, SASH_D, -hw + SASH_W / 2, OPEN_H / 2, sashZ, sash);
  box(SASH_W, OPEN_H, SASH_D, hw - SASH_W / 2, OPEN_H / 2, sashZ, sash);
  box(MULL_W, OPEN_H, SASH_D, 0, OPEN_H / 2, sashZ, sash);
  box(OPEN_W, MULL_W, SASH_D, 0, OPEN_H / 2, sashZ, sash);

  /* --- the casing ---
     Head and two jambs over the wall face; the sill does the bottom. */
  const caseZ = CASE_OUT / 2;
  box(CASE_W, OPEN_H + CASE_W, CASE_OUT, -hw - CASE_W / 2, (OPEN_H + CASE_W) / 2, caseZ, casing);
  box(CASE_W, OPEN_H + CASE_W, CASE_OUT, hw + CASE_W / 2, (OPEN_H + CASE_W) / 2, caseZ, casing);
  box(OPEN_W + 2 * CASE_W, CASE_W, CASE_OUT, 0, OPEN_H + CASE_W / 2, caseZ, casing);

  /* --- the sill, and the apron under it ---
     The sill runs the full thickness of the wall and out past it, so
     it closes the bottom of the reveal as well as projecting — at the
     flat end of the orbit leash (2 degrees above the floor) the
     underside of this is the part of the window the camera can nearly
     see, and a sill that stopped at the wall face would show the
     opening's bottom edge as a gap. */
  const sillW = OPEN_W + 2 * CASE_W + 2 * SILL_EARS;
  box(sillW, SILL_T, thickness + SILL_PROUD, 0, -SILL_T / 2, (SILL_PROUD - thickness) / 2, casing);
  box(OPEN_W + CASE_W, APRON_H, APRON_OUT, 0, -SILL_T - APRON_H / 2, APRON_OUT / 2, casing);

  return { group, materials };
}

/* ==========================================
   THE RAIN, PER FRAME

   One float write. Called from scene.js's loop, which does not run
   under reduced motion — see RAIN_SLOW above for what that means and
   what the factor is still for.
   ========================================== */
export function tickRain(dt) {
  rainTime.value += dt * rainSpeed;
  /* Wrapped, so the value never grows large enough for a float to
     lose the fractional precision the streak phases are made of. The
     period is one cell-run, which every layer's `fract` is already
     periodic in. */
  if (rainTime.value > 4096) rainTime.value -= 4096;
}

/* Where the rain stands, for the review scripts and for tuning it on
   a live page. A speed in cell-runs per second, or no argument to
   just report. */
export function rainState(speed) {
  if (speed !== undefined) rainSpeed = speed;
  return {
    time: Number(rainTime.value.toFixed(3)),
    speed: Number(rainSpeed.toFixed(4)),
    reduced: rainReduced,
    layers: RAIN,
  };
}

export function disposeNightWindow() {
  disposables.forEach((d) => d.dispose());
  disposables = [];
  rainTime.value = 0;
  rainSpeed = RAIN_SPEED;
  rainReduced = false;
}
