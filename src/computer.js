import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/* ==========================================
   CRT COMPUTER

   Built entirely from primitives — no imported models. Shape and
   proportions follow design-references/crt-computer.png (front: thick
   bezel, recessed screen, button panel bottom right, green LED) and
   crt-computer-big.webp (deep tapered back, side vents, round stand).
   Facing direction follows crt-computer-full.jpeg: mostly front-on to
   the camera with a sliver of its right side showing.

   The realism beyond the silhouette comes from the things a real desk
   has and a clean render does not: a 101-key layout instead of a grid
   of identical caps, a mouse, cables with slack in them, a shell seam,
   two shades of plastic, and a screen that is showing something.

   Local space: +Z is the front of the machine, origin on the floor.
   ========================================== */

/* --- Palette --------------------------------------------- */
/* Warm off-white ABS, inspired by the cream PC references. The rear
   moulding and modifier keys retain a gentle tonal separation; shadowed
   cavities stay warm grey rather than yellow-brown. */
const PLASTIC      = 0xeee8dc;
const PLASTIC_BACK = 0xded8cc;
const PLASTIC_DARK = 0x948e82;
const KEY_WELL     = 0x716d63;
const KEY_CAP      = 0xf1ece2;
const KEY_MOD      = 0xded8cb;
const CABLE        = 0xa5a092;
const SCREEN_TEAL  = 0x0b7a76;
const SCREEN_INK   = '#1b47a3';  // the floor blue, reused on the screen
/* The tube and the light coming off it. The spill is the colour the
   brief names; the emissive is the same hue held well back, because it
   multiplies the drawn picture rather than replacing it — see the
   screen material for what full saturation did to the login bitmap. */
const SCREEN_SPILL = 0x5fe3d4;
const SCREEN_EMISSIVE = 0xb8f2ea;

/* --- Proportions ----------------------------------------- */
// Frontmost keyboard contact shadow in kit-local coordinates.
export const COMPUTER_FRONT_Z = 7.2;

export const MON_W = 6.0, MON_H = 6.5;
const BEZEL_D = 1.35;

/* Tall CRT shell with broad shoulders and a rounded tapered rear.
   The front face remains the datum; the tube sits half a unit behind it. */
const CASING_DEPTH = 1.55;
const BACK_D = 4.0, BACK_TAPER = 0.66;
const FUNNEL_W = MON_W * 0.99, FUNNEL_H = MON_H * 0.99;
const FUNNEL_FRONT_Z = BEZEL_D / 2 - CASING_DEPTH + 0.1;

export const SCREEN_W = 4.55, SCREEN_H = 3.50;
export const MON_Y = 4.50;       // centre height of the monitor body
export const OPEN_CY = 0.48;     // screen opening rides above centre

/* The black overscan border drawn around the picture, as a fraction of
   the screen either side (see `drawPicture`). The live HTML overlay is
   mapped onto the inner rectangle rather than the whole panel: the
   bezel lip overhangs the glass by enough to clip a sliver off the
   left edge at this camera, and sitting inside the overscan keeps the
   overlay clear of it. */
export const OVERSCAN = 0.035;

/* Square to the floor grid, so the bezel edges run parallel to the name
   text (which lies along +X) and the screen turns to face left. At the
   45-degree camera azimuth this gives the even three-quarter view of
   crt-computer-full.jpeg: front and one side both in play. */
export const FACING = THREE.MathUtils.degToRad(0);

const disposables = [];
function track(...xs) { disposables.push(...xs); return xs[0]; }

/* The renderer's max anisotropy, handed in by `buildComputer` the way
   `buildRoom` takes it. Defaulting to 1 keeps the module usable from
   the lamp lab, which has no renderer to ask. */
let maxAniso = 1;

/* **Every canvas texture in this module is built here**, so maximum
   anisotropic filtering is a property of the module rather than
   something each call site has to remember — `screenDisplay` was the
   only one that set it at all, at 8.

   It is the single biggest sharpness win on this machine, and it is
   not about resolution. The computer is seen at a three-quarter view,
   so the bezel face, the badge and the picture are all foreshortened
   hard along one axis; isotropic filtering picks the mip level off the
   *compressed* axis and hands back a texture one or two levels blurrier
   than it was drawn, along both axes. Anisotropic sampling takes the
   level from the long axis and makes up the difference with extra taps
   across the short one, which is what keeps the drawn detail — and the
   mip chain stays on, so the scanlines and the plastic grain still
   average cleanly instead of shimmering. */
function canvasTexture(c, srgb = false) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAniso;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  return track(t);
}

/* ==========================================
   MATERIALS
   ========================================== */

/* One noise field, two maps. Per-pixel grain for the moulding texture
   plus soft low-frequency blotches so the plastic ages unevenly rather
   than reading as one uniform surface.

   Both octaves have to be sized against how big the machine lands on
   screen, or they average away to a flat vinyl sheet. At 512px tiled
   twice across the shell a texel is roughly a device pixel, so the
   grain survives; a 10-cell lattice puts the blotches at about a tenth
   of a tile, which is large enough to read as uneven plastic rather
   than as more noise.

   **It stays at 512, and that was measured rather than assumed.** 1024
   tiled *once* was tried, for the sake of killing the 2x2 repeat — and
   it is not a sharpness change at all: what lands on a surface is
   `size * repeat`, for `RoundedBoxGeometry`'s per-face 0..1 UVs and for
   `ExtrudeGeometry`'s object-unit UVs alike, so the texel density is
   identical either way. What it does change is this per-texel loop,
   from 9.4ms to 45ms of main-thread work while the scene chunk builds,
   plus 8MB of texture memory. Paying 36ms and 8MB for a slightly less
   regular blotch field is the wrong trade; the crispness the shells
   actually gained came from `canvasTexture`'s anisotropy and from the
   bevels, neither of which costs anything here.

   Roughness alone was not enough: on a surface this matt the sheen
   barely moves, so the shell still read as one flat colour. The same
   field therefore also comes out as a near-white albedo map — a few
   percent of value swing — which is what actually makes the moulding
   look like plastic rather than paper. Driving both from one field is
   deliberate: on real plastic the duller patches are also the slightly
   darker ones. */
function plasticTextures(size = 512) {
  /* Low-frequency layer: value noise on a 10-cell lattice, bilinear. */
  const n = 10, cell = size / n;
  const lattice = Array.from({ length: (n + 1) * (n + 1) }, () => Math.random());
  const at = (i, j) => lattice[(j % n) * (n + 1) + (i % n)];
  const smooth = t => t * t * (3 - 2 * t);

  const mk = () => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    return [c, c.getContext('2d')];
  };
  const [rc, rctx] = mk();
  const [ac, actx] = mk();
  const rough = rctx.createImageData(size, size);
  const albedo = actx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = x / cell, fy = y / cell;
      const i = Math.floor(fx), j = Math.floor(fy);
      const tx = smooth(fx - i), ty = smooth(fy - j);
      const a = at(i, j) * (1 - tx) + at(i + 1, j) * tx;
      const b = at(i, j + 1) * (1 - tx) + at(i + 1, j + 1) * tx;
      const low = a * (1 - ty) + b * ty;
      const fine = Math.random();
      const k = (y * size + x) * 4;

      /* roughnessMap *multiplies* the material roughness, so this band
         is where the final number actually comes from: 196..256 is
         0.77..1.0, which against a 0.56 base puts the shells at about
         0.5 with a few hundredths of swing either side — matt plastic
         with a sheen that still moves across a panel. The old band
         started at 138 (0.54), which spread the same mean over
         0.37..0.69 and let the duller patches go visibly chalky. */
      const r = 196 + low * 36 + fine * 24;
      rough.data[k] = rough.data[k + 1] = rough.data[k + 2] = r;
      rough.data[k + 3] = 255;

      /* Narrow spread: map multiplies the material colour, so anything
         wider than a few percent reads as dirt rather than moulding. */
      const v = 244 + low * 7 + fine * 4;
      albedo.data[k] = albedo.data[k + 1] = albedo.data[k + 2] = v;
      albedo.data[k + 3] = 255;
    }
  }
  rctx.putImageData(rough, 0, 0);
  actx.putImageData(albedo, 0, 0);

  const wrap = (c, srgb) => {
    const t = canvasTexture(c, srgb);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 2);
    return t;
  };
  return { rough: wrap(rc, false), albedo: wrap(ac, true) };
}

/* `roughness` here is the figure *before* the map multiplies it; the
   band in `plasticTextures` means the surface lands at roughly 0.9 of
   whatever is passed. 0.56 is therefore a shell at about 0.5 — glossy
   enough that the new bevels have something to catch. */
function plasticMaterial(grain, color = PLASTIC, roughness = 0.56) {
  return track(new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0,
    map: grain.albedo,
    roughnessMap: grain.rough,
    bumpMap: grain.rough,
    bumpScale: 0.009,
    /* The HDRI is a big part of what was lifting the shell to within a
       shade of the cream floor; the machine takes less of it than the
       floor does. Lower again at 0.34: the HDRI is ambient from every
       direction, so it was filling the sides the key never reaches —
       the right flank and the funnel — and flattening the body. The
       floor keeps its own full-strength env, so the ground tone the
       lighting is calibrated against does not move. */
    envMapIntensity: 0.34,
  }));
}

/* ==========================================
   SCREEN

   A monitor that is switched on is the single biggest realism cue the
   scene was missing. The picture is a stylised desktop — teal ground, a
   window, a taskbar — drawn abstractly so it still reads at the ~250px
   the screen occupies on a 1440px viewport. Over it go the things that
   make a CRT a CRT: a black overscan border, scanlines, a faint
   aperture-grille stripe, and a vignette.

   There are two pictures: the idle desktop, and the one the machine puts
   up while the pointer is over it, which is the whole of the hover
   feedback. `greeting` is the only difference — the window's body shows
   it instead of the grey text rules — so the two composite over each
   other with nothing moving.
   ========================================== */
const SCREEN_GREETING = 'hello';

/* The picture is *authored* at 768x576 and *rasterised* at whatever
   `screenDisplay` asks for. Every figure in `drawPicture` and
   `compositePicture` below is in these design units; the context is
   scaled on the way in, so raising the texture resolution does not mean
   re-deriving a window border or a title bar — and the rules, borders
   and glyphs come out of the raster at the full new resolution rather
   than being drawn small and blown up. */
const PIC_W = 768, PIC_H = 576;

function drawPicture(w, h, greeting) {
  /* The picture is drawn sharp into an offscreen canvas, then composited
     through a blur. A CRT has no pixel grid to be sharp against, and a
     crisp bitmap on the glass is what makes a render look like a photo
     of a monitor with a screenshot pasted over it. */
  const ui = document.createElement('canvas');
  ui.width = w; ui.height = h;
  const u = ui.getContext('2d');
  u.scale(w / PIC_W, h / PIC_H);

  /* Overscan: the tube is bigger than the picture, so the edge is black.
     The margin is `OVERSCAN` rather than a repeated 0.035, because the
     live HTML overlay is mapped onto the rectangle inside it. */
  u.fillStyle = '#05100f';
  u.fillRect(0, 0, PIC_W, PIC_H);

  const m = Math.round(PIC_W * OVERSCAN);
  const iw = PIC_W - m * 2, ih = PIC_H - m * 2;
  u.save();
  u.beginPath();
  u.roundRect(m, m, iw, ih, 26);
  u.clip();

  u.fillStyle = `#${SCREEN_TEAL.toString(16).padStart(6, '0')}`;
  u.fillRect(m, m, iw, ih);

  const px = (fx, fy) => [m + fx * iw, m + fy * ih];

  /* Two desktop icons, top left. */
  for (let i = 0; i < 2; i++) {
    const [x, y] = px(0.045, 0.06 + i * 0.17);
    u.fillStyle = '#d9d2bd';
    u.fillRect(x, y, iw * 0.07, iw * 0.07);
    u.fillStyle = 'rgba(255,255,255,0.75)';
    u.fillRect(x - iw * 0.012, y + iw * 0.085, iw * 0.094, ih * 0.022);
  }

  /* A window: grey panel, navy title bar, white content with text rules. */
  const [wx, wy] = px(0.24, 0.17);
  const ww = iw * 0.62, wh = ih * 0.56;
  u.fillStyle = 'rgba(0,0,0,0.3)';
  u.fillRect(wx + 7, wy + 7, ww, wh);
  u.fillStyle = '#c0c0c0';
  u.fillRect(wx, wy, ww, wh);
  u.fillStyle = '#ffffff';
  u.fillRect(wx, wy, ww, 3);
  u.fillRect(wx, wy, 3, wh);
  u.fillStyle = '#6f6f6f';
  u.fillRect(wx, wy + wh - 3, ww, 3);
  u.fillRect(wx + ww - 3, wy, 3, wh);

  u.fillStyle = '#000080';
  u.fillRect(wx + 7, wy + 7, ww - 14, 30);
  u.fillStyle = 'rgba(255,255,255,0.9)';
  u.fillRect(wx + 16, wy + 18, ww * 0.34, 9);
  u.fillStyle = '#c0c0c0';
  for (let i = 0; i < 3; i++) u.fillRect(wx + ww - 32 - i * 26, wy + 12, 20, 20);

  const bx = wx + 12, by = wy + 46, bw = ww - 24, bh = wh - 58;
  u.fillStyle = '#ffffff';
  u.fillRect(bx, by, bw, bh);
  if (greeting) {
    /* The one typeset thing left in the 3D scene. It used to echo the
       floor's wordmark, which is why it is a serif at all; the floor
       is a plank diorama now and the rug's name is gone, so this is
       the whole reason Playfair is still preloaded. The face is
       resident because initScene awaits `loadScreenFont` before the
       computer is built — without that it silently sets in Georgia,
       and the fallback looks close enough to pass review. */
    u.fillStyle = SCREEN_INK;
    u.font = GREETING_FONT(Math.round(bh * 0.46));
    u.textAlign = 'center';
    u.textBaseline = 'middle';
    u.fillText(greeting, bx + bw / 2, by + bh / 2);
    u.textAlign = 'left';
  } else {
    u.fillStyle = '#9a9a9a';
    for (let i = 0; i < 5; i++) {
      u.fillRect(wx + 26, wy + 66 + i * 26, (ww - 70) * (i === 4 ? 0.45 : 0.86), 8);
    }
  }

  /* Taskbar. */
  const tb = ih * 0.1;
  u.fillStyle = '#c0c0c0';
  u.fillRect(m, m + ih - tb, iw, tb);
  u.fillStyle = '#ffffff';
  u.fillRect(m, m + ih - tb, iw, 3);
  u.fillStyle = '#9a9a9a';
  u.fillRect(m + 12, m + ih - tb + 10, iw * 0.14, tb - 20);
  u.fillRect(m + iw - 12 - iw * 0.1, m + ih - tb + 10, iw * 0.1, tb - 20);

  u.restore();
  return ui;
}

/* Everything that makes the sharp picture look like a tube.

   Unlike `drawPicture` this one cannot simply be scaled by the context:
   `ctx.filter` blur radii are not reliably transformed, so every figure
   here is multiplied by `S` explicitly instead. */
function compositePicture(ui, w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const S = w / PIC_W;

  /* Soft focus, then a wide low-alpha pass on top: phosphor bleeds into
     its neighbours, so bright areas halo rather than stopping dead.
     1.2 design px rather than 1.5: the picture is rasterised at twice
     the resolution it used to be, so a hair less bleed still leaves the
     glass with no pixel grid to be sharp against — which is the thing
     the blur is for — while letting the extra detail through. */
  ctx.filter = `blur(${1.2 * S}px)`;
  ctx.drawImage(ui, 0, 0, w, h);
  ctx.filter = `blur(${8 * S}px)`;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.34;
  ctx.drawImage(ui, 0, 0, w, h);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';

  /* Scanlines, and a fainter vertical grille under them. **Finer than
     they were — a 3.5 design-px pitch where it used to be 5** — which
     is only affordable because the raster is 2x and the filtering is
     anisotropic: at 576px with isotropic mips a finer pitch averaged
     away to a flat grey wash, which is what the old 5px was guarding
     against. The duty cycle is held at 40% dark, so the picture does
     not get darker as the lines get finer. */
  const pitch = 3.5 * S, line = 1.4 * S;
  ctx.fillStyle = 'rgba(0,0,0,0.26)';
  for (let y = 0; y < h; y += pitch) ctx.fillRect(0, y, w, line);
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  for (let x = 0; x < w; x += 3 * S) ctx.fillRect(x, 0, 1.05 * S, h);

  /* Phosphor bloom in the middle, falling off to a dark rim. */
  const vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.18, w / 2, h / 2, h * 0.8);
  vig.addColorStop(0, 'rgba(190,255,250,0.12)');
  vig.addColorStop(0.6, 'rgba(0,0,0,0.06)');
  vig.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  return c;
}

/* The live screen: both pictures composited into one canvas, mixed by
   `setMix`. Crossfading rather than swapping the map is what makes the
   greeting come up like a CRT settling instead of a hard cut. The
   overlapping parts of the two pictures are identical, so only the
   window's body actually changes. */
/* Playfair is declared in src/style.css and preloaded from index.html,
   so the fetch starts with the entry stylesheet rather than with this
   lazy chunk. The greeting is drawn with canvas 2D into a texture, so
   the face has to be resident before that draw — a canvas does not
   re-draw itself when a webfont arrives the way laid-out text does. */
const GREETING_FONT = (size) =>
  `500 ${size}px "Playfair Display", Georgia, serif`;

export async function loadScreenFont() {
  try {
    await document.fonts.load(GREETING_FONT(100));
  } catch {
    /* the serif stack is a fine fallback */
  }
}

function screenDisplay() {
  /* Twice the design resolution. The picture is ~250px across at the
     home framing, so this is not about the idle desktop — it is about
     the flight, where the same map carries a bitmap of the real page
     (`setStill`, drawn at `SCREEN_BASE_W`) and the glass fills a good
     share of the frame by the end of it. At 768 that bitmap was
     downsampled before it was ever drawn; at 1536 it arrives intact,
     and comfortably so since the box came down to 900. */
  const w = PIC_W * 2, h = PIC_H * 2;
  const idle = compositePicture(drawPicture(w, h, null), w, h);
  const greet = compositePicture(drawPicture(w, h, SCREEN_GREETING), w, h);

  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');

  const t = canvasTexture(c, true);

  /* While the camera is flying in, the picture is a bitmap of the real
     login screen rather than this abstract desktop — see `setStill`
     below. The mix is frozen for as long as that is up. */
  let still = null;
  let mix = 0;

  /* Redrawing the canvas and re-uploading the texture every frame is
     wasted work once the mix has settled. */
  let drawn = -1;
  const setMix = v => {
    mix = v;
    if (still || Math.abs(v - drawn) < 0.004) return;
    drawn = v;
    ctx.globalAlpha = 1;
    ctx.drawImage(idle, 0, 0);
    if (v > 0) {
      ctx.globalAlpha = Math.min(v, 1);
      ctx.drawImage(greet, 0, 0);
      ctx.globalAlpha = 1;
    }
    t.needsUpdate = true;
  };
  setMix(0);

  /* Put an arbitrary bitmap on the glass, framed by the same overscan
     `drawPicture` leaves and run through the same tube treatment, so it
     arrives with the blur, scanlines and vignette the rest of the
     picture has rather than as a crisp paste-up.

     This is what the fly-in shows. The alternative — the live HTML
     overlay, scaled by a CSS matrix — makes the browser re-rasterise a
     filtered subtree at a new scale every frame, which measured at
     ~45ms a frame on a phone-sized viewport. As a texture it costs one
     upload and the move holds 60fps. */
  const setStill = bitmap => {
    const ui = document.createElement('canvas');
    ui.width = w; ui.height = h;
    const u = ui.getContext('2d');
    u.fillStyle = '#05100f';
    u.fillRect(0, 0, w, h);
    const m = Math.round(w * OVERSCAN);
    u.drawImage(bitmap, m, Math.round(h * OVERSCAN), w - m * 2, h - Math.round(h * OVERSCAN) * 2);
    still = compositePicture(ui, w, h);
    ctx.globalAlpha = 1;
    ctx.drawImage(still, 0, 0);
    t.needsUpdate = true;
  };

  /* Back to the abstract desktop. `drawn` is invalidated so the frozen
     mix is actually redrawn rather than skipped as already current. */
  const clearStill = () => {
    if (!still) return;
    still = null;
    drawn = -1;
    setMix(mix);
  };

  return { texture: t, setMix, setStill, clearStill };
}

/* The reflection in the glass, as a window rather than a single smear:
   two soft panes with a mullion between them, plus a broad low sheen.
   Kept faint so the picture stays readable through it. */
function glareTexture() {
  /* Stays at 512: every mark on it is laid down through a 13px blur, so
     there is no detail here for a bigger raster to carry — only the
     oblique-angle softness, and `canvasTexture` fixes that for free. */
  const s = 512;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');

  const sheen = ctx.createLinearGradient(0, s, s, 0);
  sheen.addColorStop(0.00, 'rgba(255,255,255,0)');
  sheen.addColorStop(0.55, 'rgba(255,255,255,0.05)');
  sheen.addColorStop(0.78, 'rgba(255,255,255,0.14)');
  sheen.addColorStop(1.00, 'rgba(255,255,255,0.02)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, s, s);

  ctx.save();
  ctx.translate(s * 0.34, s * 0.3);
  ctx.rotate(-0.22);
  ctx.filter = `blur(${s * 0.0254}px)`;
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (const dx of [0, s * 0.19]) ctx.fillRect(dx, 0, s * 0.15, s * 0.3);
  ctx.restore();

  return canvasTexture(c, true);
}

/* Moulded-in badge on the bottom bezel. Our own model number, since no
   real brand may appear here. */
function badgeTexture() {
  /* 2x the raster, same design figures — the lettering is the smallest
     type in the 3D scene and the first thing a mip level eats. */
  const S = 2, w = 512, h = 96;
  const c = document.createElement('canvas');
  c.width = w * S; c.height = h * S;
  const ctx = c.getContext('2d');
  ctx.scale(S, S);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(92,83,64,0.74)';
  ctx.font = '600 44px Georgia, serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('TRISH', 8, h / 2 + 2);
  ctx.font = '400 32px Georgia, serif';
  ctx.fillStyle = 'rgba(92,83,64,0.52)';
  ctx.fillText('T-1500', 168, h / 2 + 3);
  return canvasTexture(c, true);
}

/* ==========================================
   GEOMETRY HELPERS
   ========================================== */

/* A rounded box whose cross-section shrinks toward the back — the CRT
   funnel. Done by pushing the vertices of a RoundedBoxGeometry rather
   than lathing, so the corner rounding survives the taper. */
function taperedBox(w, h, d, radius, taper) {
  const geo = new RoundedBoxGeometry(w, h, d, 4, radius);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const t = THREE.MathUtils.clamp((v.z + d / 2) / d, 0, 1);  // 0 back, 1 front
    // Broad tube shoulders, then a rounded, narrower rear cap.
    const shoulder = THREE.MathUtils.smoothstep(t, 0.0, 0.82);
    const k = THREE.MathUtils.lerp(taper, 1, shoulder);
    pos.setXY(i, v.x * k, v.y * k);
  }
  geo.computeVertexNormals();
  return track(geo);
}

/* The taper factor at a given distance behind the funnel's front face.
   Nothing on the funnel's surface can be placed by a written-down
   figure: shorten the funnel and the same inset lands on a narrower,
   steeper part of it, which leaves a vent panel floating off the
   flank. `t` runs 0 at the back to 1 at the front, as in taperedBox. */
function funnelK(inset) {
  return THREE.MathUtils.lerp(BACK_TAPER, 1,
    THREE.MathUtils.smoothstep(1 - inset / BACK_D, 0, 0.82));
}

/* Rounded rectangle as a Shape, so the bezel can be extruded with a
   real hole in it — a solid box plus a dark panel cannot give a recess,
   the panel just covers the screen. */
function roundedRect(w, h, r, cx = 0, cy = 0) {
  const sh = new THREE.Shape();
  const x = cx - w / 2, y = cy - h / 2;
  sh.moveTo(x + r, y);
  sh.lineTo(x + w - r, y);
  sh.quadraticCurveTo(x + w, y, x + w, y + r);
  sh.lineTo(x + w, y + h - r);
  sh.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  sh.lineTo(x + r, y + h);
  sh.quadraticCurveTo(x, y + h, x, y + h - r);
  sh.lineTo(x, y + r);
  sh.quadraticCurveTo(x, y, x + r, y);
  return sh;
}

/* Gently domed panel for the screen and its glass. */
function domedPanel(w, h, bulge, seg = 40) {
  const geo = new THREE.PlaneGeometry(w, h, seg, seg);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / (w / 2);
    const y = pos.getY(i) / (h / 2);
    pos.setZ(i, bulge * (1 - x * x) * (1 - y * y));
  }
  geo.computeVertexNormals();
  return track(geo);
}

/* A real sloped reveal between the front aperture and the flat tube.
   Matched rounded contours keep it inexpensive and clear of the HTML's
   inner overscan rectangle at every supported camera angle. */
function screenReveal(w, h) {
  const outer = roundedRect(w, h, 0.26).getPoints(8);
  const inner = roundedRect(SCREEN_W + 0.04, SCREEN_H + 0.04, 0.18).getPoints(8);
  const positions = [], indices = [];
  for (let i = 0; i < outer.length; i++) {
    positions.push(outer[i].x, outer[i].y, BEZEL_D / 2 - 0.065);
    positions.push(inner[i].x, inner[i].y, BEZEL_D / 2 - 0.515);
    if (i < outer.length - 1) {
      const k = i * 2;
      indices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  // Shared material maps need UVs even on this small shadowed surround.
  const uv = [];
  for (let i = 0; i < positions.length; i += 3) uv.push(positions[i] / w + 0.5, positions[i + 1] / h + 0.5);
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return track(geo);
}

function turnedProfile(points, segments = 48) {
  return track(new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segments));
}

/* Keycap: rounded box drawn in slightly toward the top, so the caps
   have the moulded taper real ones do instead of reading as tiles.

   **The corner radius is 0.014, down from 0.035.** On a 0.206 cap the
   old figure rounded away a sixth of the face from each side, which
   left the whole top as curvature and nothing for the moon to catch;
   at 0.014 the cap has a flat plateau with a small crisp chamfer round
   it, and the chamfer takes a thin highlight along the back edge of
   every row. Three segments rather than two, so the chamfer does not
   facet now that it is small enough to see. */
function keycapGeo(w, d, h = 0.15, r = 0.014) {
  const geo = new RoundedBoxGeometry(w, h, d, 3, r);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const t = THREE.MathUtils.clamp((v.y + h / 2) / h, 0, 1);
    const k = THREE.MathUtils.lerp(1, 0.84, t);
    pos.setXYZ(i, v.x * k, v.y, v.z * k);
  }
  geo.computeVertexNormals();
  return track(geo);
}

/* A cable with slack in it. Catmull-Rom through hand-placed points,
   because the interesting part of a cable is where it is *not* taut. */
function cable(points, radius, mat) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const m = new THREE.Mesh(
    track(new THREE.TubeGeometry(curve, 72, radius, 7, false)), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/* Radial falloff used for the contact shadows. `stops` is what makes
   the pair: the broad blob is the ambient shade a body throws on the
   surface under it, and a second, much tighter one goes inside it for
   the contact itself — the near-black line right where the foot and the
   keyboard's bottom edge actually touch the walnut. One gradient cannot
   be both, and the contact is the half that says the thing is resting
   on the desk rather than hovering a few millimetres over it. */
function contactShadowTexture(stops) {
  const s = 256;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  for (const [at, a] of stops) g.addColorStop(at, `rgba(0,0,0,${a})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return canvasTexture(c);
}
const CONTACT_SOFT = [[0.00, 0.5], [0.45, 0.26], [1.00, 0]];
/* Flat to 0.78 and then gone. A radial gradient has its darkest part
   in the middle, which is under the body and invisible; what has to be
   dark is the *rim*, so the core blob is scaled a little wider than the
   thing it sits under and holds full strength right out to the edge of
   it. The same reasoning as `baseShadeTexture`. */
const CONTACT_CORE = [[0.00, 0.56], [0.78, 0.5], [1.00, 0]];

/* Occlusion inside the screen recess. The bezel lip overhangs the glass
   by a hair, and the key light's shadow map is stretched across the
   whole floor — a lip that small never lands on a texel of it. So the
   lip's shadow is painted on instead: a soft frame, heaviest down the
   left and across the top where the lip stands between the glass and
   the key, lighter all round for the occlusion any recess has. */
function recessShadowTexture() {
  const s = 256;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(s, s);
  const ramp = (d, reach) => (d >= reach ? 0 : (1 - d / reach) ** 1.8);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const u = x / (s - 1), v = y / (s - 1); // v = 0 is the top edge
      const all = Math.max(ramp(u, 0.2), ramp(1 - u, 0.2),
                           ramp(v, 0.2), ramp(1 - v, 0.2));
      /* Deeper than it was (0.24/0.52/0.44). The plastic is a warmer,
         lighter beige now, so the recess needed more to stay a shade
         darker than the bezel around it rather than level with it. */
      const a = Math.max(0.30 * all,           // the recess, all four sides
                         0.57 * ramp(u, 0.13), // left wall: away from the key
                         0.49 * ramp(v, 0.11)); // under the top lip
      const k = (y * s + x) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = 0;
      img.data[k + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvasTexture(c);
}

/* Falloff for the shade the monitor drops on the flat top faces of its
   own base. Flatter than the contact-shadow gradient: the stand is a
   stack of discs, so only a narrow ring of each one is ever visible and
   a falloff that has faded by then leaves the rims looking lit. */
function baseShadeTexture() {
  const s = 256; // 128 banded visibly once it was stretched over the foot
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0.00, 'rgba(0,0,0,0.45)');
  g.addColorStop(0.72, 'rgba(0,0,0,0.35)');
  g.addColorStop(1.00, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return canvasTexture(c);
}

/* Vertical falloff for the sleeve of shade under the monitor: dark at
   the top, gone by the bottom. */
function sleeveShadowTexture() {
  const h = 64;
  const c = document.createElement('canvas');
  c.width = 4; c.height = h;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0.00, 'rgba(0,0,0,0.46)');
  g.addColorStop(0.50, 'rgba(0,0,0,0.15)');
  g.addColorStop(1.00, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, h);
  return canvasTexture(c);
}

/* ==========================================
   PARTS
   ========================================== */

function buildStand(body, dark) {
  const g = new THREE.Group();

  const foot = new THREE.Mesh(
    turnedProfile([[0, -0.15], [2.12, -0.15], [2.22, -0.12], [2.25, -0.07],
      [2.23, 0.02], [2.12, 0.12], [2.05, 0.15], [0, 0.15]]), body);
  foot.position.y = 0.15;
  foot.scale.set(0.9, 1, 0.9);

  /* A moulded step on top of the foot, so the base is not one slab. */
  const step = new THREE.Mesh(
    turnedProfile([[0, -0.07], [1.85, -0.07], [1.9, -0.04],
      [1.86, 0.01], [1.77, 0.065], [1.74, 0.07], [0, 0.07]]), body);
  step.position.y = 0.36;
  step.scale.set(0.9, 1, 0.9);

  const neck = new THREE.Mesh(
    track(new THREE.CylinderGeometry(1.18, 1.55, 0.86, 40)), body);
  neck.position.set(0, 0.80, -0.28);

  /* Dark swivel collar where the neck meets the monitor — the joint is
     the detail that makes a tilt-and-swivel base read as a mechanism. */
  const collar = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.88, 0.88, 0.16, 40)), dark);
  collar.position.set(0, 1.18, -0.28);

  for (const m of [foot, step, neck, collar]) { m.castShadow = true; m.receiveShadow = true; }
  g.add(foot, step, neck, collar);
  // The swivel collar supports a saddle under the tube's center of mass,
  // rather than appearing to touch only the front edge of the housing.
  const saddle = new THREE.Mesh(
    track(new RoundedBoxGeometry(2.8, 0.38, 2.7, 4, 0.16)), body);
  saddle.position.set(0, 1.21, -0.72);
  saddle.castShadow = true;
  saddle.receiveShadow = true;
  g.add(saddle);

  /* The monitor closes the light out of the joint it sits on, but the
     gap is a few centimetres and the key's shadow map covers the whole
     floor, so none of that occlusion survives. Paint it on: a sleeve of
     shade down the neck, darkest under the collar. */
  const sleeve = new THREE.Mesh(
    track(new THREE.CylinderGeometry(1.19, 1.57, 0.84, 40, 1, true)),
    track(new THREE.MeshBasicMaterial({
      map: sleeveShadowTexture(), transparent: true, depthWrite: false,
    })));
  sleeve.position.set(0, 0.80, -0.28);
  g.add(sleeve);

  /* Same again for the top faces of the foot and the step, which look
     straight up into the underside of the monitor and should be the
     darkest plastic on the machine rather than the brightest. */
  const shade = baseShadeTexture();
  for (const [y, r, o] of [[0.3015, 2.06 * 0.9, 0.85], [0.4315, 1.76 * 0.9, 1]]) {
    const disc = new THREE.Mesh(track(new THREE.CircleGeometry(r, 48)),
      track(new THREE.MeshBasicMaterial({
        map: shade, transparent: true, depthWrite: false, opacity: o,
      })));
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = y;
    g.add(disc);
  }

  return g;
}

/* Rows of slats over a dark cavity: the gaps read as the vent slots. */
function buildVents(body, dark, w, h, count, slatDepth = 0.06) {
  const g = new THREE.Group();

  const cavity = new THREE.Mesh(
    track(new THREE.BoxGeometry(w, h, 0.05)), dark);
  g.add(cavity);

  const pitch = h / count;
  const slat = new THREE.InstancedMesh(
    track(new THREE.BoxGeometry(w, pitch * 0.42, slatDepth)), body, count);
  slat.castShadow = true;
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    m.makeTranslation(0, -h / 2 + pitch * (i + 0.5), 0.03);
    slat.setMatrixAt(i, m);
  }
  g.add(slat);
  return g;
}

function buildMonitor(body, backBody, dark) {
  // Share existing grain textures; soften the relief on the monitor only
  // so the broad moulded panels catch continuous edge highlights.
  body = track(body.clone());
  body.roughness = 0.62;
  body.bumpScale = 0.006;
  backBody = track(backBody.clone());
  backBody.bumpScale = 0.008;
  const g = new THREE.Group();
  g.position.y = MON_Y;

  /* Deep tapered funnel behind the bezel. */
  const back = new THREE.Mesh(
    taperedBox(FUNNEL_W, FUNNEL_H, BACK_D, 0.44, BACK_TAPER), backBody);
  back.position.z = FUNNEL_FRONT_Z - BACK_D / 2;
  back.castShadow = true;
  back.receiveShadow = true;
  g.add(back);

  /* Thick bezel, extruded as a frame with a rounded opening. The
     opening sits above centre so the bottom bezel is the deepest, which
     is where the button panel and LED live in crt-computer.png. */
  const openW = SCREEN_W + 0.46, openH = SCREEN_H + 0.46;
  const face = roundedRect(MON_W, MON_H, 0.48);
  face.holes.push(roundedRect(openW, openH, 0.26, 0, OPEN_CY));
  /* A broad five-step moulded edge wraps the new rounded profile.
     Extrusion runs back from the front-face datum around a real aperture. */
  const bezelGeo = track(new THREE.ExtrudeGeometry(face, {
    depth: CASING_DEPTH - 0.28,
    bevelEnabled: true,
    bevelThickness: 0.14,
    bevelSize: 0.13,
    bevelSegments: 5,
    curveSegments: 14,
  }));
  bezelGeo.translate(0, 0, BEZEL_D / 2 - CASING_DEPTH + 0.14);
  const bezel = new THREE.Mesh(bezelGeo, body);
  bezel.castShadow = true;
  bezel.receiveShadow = true;
  g.add(bezel);

  /* The seam where the front shell clips onto the rear one. A thin dark
     frame standing a hair proud of the bezel wall, so it reads as a
     groove running right around the case. Injection-moulded plastic
     always has this line and a solid shell never does. */
  const seamShape = roundedRect(MON_W + 0.014, MON_H + 0.014, 0.48);
  seamShape.holes.push(roundedRect(MON_W - 0.1, MON_H - 0.1, 0.43));
  const seamGeo = track(new THREE.ExtrudeGeometry(seamShape, {
    depth: 0.06, bevelEnabled: false, curveSegments: 14,
  }));
  seamGeo.translate(0, 0, -0.03);
  const seam = new THREE.Mesh(seamGeo, dark);
  seam.position.z = BEZEL_D / 2 - CASING_DEPTH + 0.15;
  g.add(seam);

  /* Dark backing panel behind the opening, closing off the recess. */
  const well = new THREE.Mesh(
    track(new THREE.BoxGeometry(openW + 0.5, openH + 0.5, 0.12)), dark);
  well.position.set(0, OPEN_CY, BEZEL_D / 2 - 0.62);
  well.receiveShadow = true;
  g.add(well);
  const reveal = new THREE.Mesh(screenReveal(openW + 0.15, openH + 0.15), backBody);
  reveal.position.y = OPEN_CY;
  reveal.castShadow = true;
  reveal.receiveShadow = true;
  g.add(reveal);

  /* The picture itself — emissive, so it reads as a lit CRT.

     **The emissive is a teal now, not white.** It multiplies the
     drawn picture, so what this does is pull every phosphor on the
     tube toward the same hue as the light spilling off it — which is
     what a CRT in a dark room actually looks like, and what makes the
     tube and its spill read as one source rather than two.

     It is a *pale* teal rather than the point light's own #5FE3D4,
     and that was measured against the fly-in rather than chosen by
     eye. The same map carries the bitmap of the real login screen for
     the length of the flight (see `setStill`), and at full saturation
     the dialog, its title bar and its text all went teal — a
     monochrome terminal, three seconds before the live HTML arrives
     in full colour. At this value the picture keeps its own hues and
     the whole tube still reads teal. */
  const display = screenDisplay();
  const screenMat = track(new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: SCREEN_EMISSIVE,
    emissiveMap: display.texture,
    /* Up from 1.25: the tube is one of three lights in the room now
       rather than a bright object in a lit one, so it has to hold its
       own against a 2048-texel moon. */
    emissiveIntensity: 1.9,
    roughness: 0.9,
    metalness: 0,
  }));
  // The HTML homography describes a plane. Keep the physical image flat
  // too; the separate glass/reflection layers supply the CRT curvature.
  const screen = new THREE.Mesh(track(new THREE.PlaneGeometry(SCREEN_W, SCREEN_H)), screenMat);
  screen.name = 'crt-interactive-plane';
  screen.position.set(0, OPEN_CY, BEZEL_D / 2 - 0.5);
  g.add(screen);

  /* **The tube's own light, which now has to reach the keyboard.**
     It used to warm the plastic around the opening and nothing else —
     2.1 over a 5.5 range at `decay` 2, which put the keyboard, 5.2
     units away, past the cutoff entirely. In a night room lit by three
     sources that is the single most valuable thing it could be doing:
     a teal wash across the keys and the walnut in front of them is
     what says the screen is on.

     Three figures, and two of them are deliberately unphysical:

     - **`decay` is 1.25, not 2.** A tube is a 5x4-unit area source and
       this is a point; inverse-square from a point put 75x more light
       on the bezel than on the keyboard, so the bezel blew out long
       before the keys saw anything. At 1.25 that ratio is about 8:1,
       which is roughly what the real area source would give.
     - **The range is 11**, which is short where it matters: measured
       from here it dies about a unit before the desk's +x edge (9.75
       from the machine's own axis) and never reaches the floor or
       either wall. It does just graze the treehouse, which is correct
       — it stands on the same desk, two units nearer than the edge.
     - **It sits 0.9 in front of the glass**, on the screen's own axis
       rather than below it. Dropping it toward the desk lit the keys
       harder but made the bezel glow asymmetric, and the bezel already
       has `recessShadowTexture` describing where its lip shades the
       picture — two accounts of the same thing, disagreeing.

     `intensity` is written here for the benefit of anything that reads
     the light before the first frame; scene.js owns the running value
     (SCREEN_GLOW times the picture's brightness) and writes it at
     build and on every tick. */
  const screenGlow = new THREE.PointLight(SCREEN_SPILL, 8.5, 11, 1.25);
  screenGlow.position.set(0, OPEN_CY, BEZEL_D / 2 + 0.9);
  g.add(screenGlow);

  /* Slightly curved glass in front of it, picking up the environment. */
  const glass = new THREE.Mesh(domedPanel(SCREEN_W + 0.1, SCREEN_H + 0.1, 0.13),
    track(new THREE.MeshPhysicalMaterial({
      color: 0x0a0d0d,
      roughness: 0.07,
      metalness: 0,
      transparent: true,
      opacity: 0.16,
      envMapIntensity: 0.7,
    })));
  glass.position.set(0, OPEN_CY, BEZEL_D / 2 - 0.39);
  g.add(glass);

  /* The room reflected in the glass. */
  const glare = new THREE.Mesh(domedPanel(SCREEN_W, SCREEN_H, 0.13),
    track(new THREE.MeshBasicMaterial({
      map: glareTexture(),
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })));
  glare.position.set(0, OPEN_CY, BEZEL_D / 2 - 0.37);
  g.add(glare);

  /* The bezel lip's shadow on the picture, in front of the glare so it
     darkens the reflection with everything else — see
     recessShadowTexture. */
  const recess = new THREE.Mesh(domedPanel(openW, openH, 0.13),
    track(new THREE.MeshBasicMaterial({
      map: recessShadowTexture(), transparent: true, depthWrite: false,
    })));
  recess.position.set(0, OPEN_CY, BEZEL_D / 2 - 0.355);
  g.add(recess);

  /* Button panel, bottom right of the bezel face. */
  const panelW = 1.5, panelH = 0.46;
  const panelX = MON_W / 2 - panelW / 2 - 0.42;
  const panelY = -MON_H / 2 + 0.68;
  /* The panel and the three control bodies below all keep their size
     and their position; only the corner radii come down — 0.05 to 0.02,
     0.04 to 0.016, 0.06 to 0.022 — because at the old figures a 0.2
     button was two-fifths curvature and shaded as a bead rather than a
     moulded cap. */
  const panel = new THREE.Mesh(
    track(new RoundedBoxGeometry(panelW, panelH, 0.12, 3, 0.02)), dark);
  panel.position.set(panelX, panelY, BEZEL_D / 2 - 0.05);
  g.add(panel);

  const btnGeo = track(new RoundedBoxGeometry(0.2, 0.2, 0.1, 3, 0.016));
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(btnGeo, body);
    b.position.set(panelX - panelW / 2 + 0.28 + i * 0.32, panelY, BEZEL_D / 2 + 0.02);
    b.castShadow = true;
    g.add(b);
  }

  /* Chunkier power button to the left of the panel. */
  const power = new THREE.Mesh(
    track(new RoundedBoxGeometry(0.42, 0.3, 0.14, 3, 0.022)), body);
  power.position.set(-MON_W / 2 + 0.75, panelY, BEZEL_D / 2 + 0.02);
  power.castShadow = true;
  g.add(power);

  /* Power LED. */
  const led = new THREE.Mesh(
    track(new THREE.SphereGeometry(0.075, 20, 16)),
    track(new THREE.MeshStandardMaterial({
      color: 0x0a2a10,
      emissive: 0x53ff7a,
      emissiveIntensity: 2.4,
      roughness: 0.3,
    })));
  led.position.set(-MON_W / 2 + 1.3, panelY, BEZEL_D / 2 + 0.03);
  g.add(led);

  /* Badge between the LED and the button panel. */
  const badge = new THREE.Mesh(
    track(new THREE.PlaneGeometry(1.35, 0.25)),
    track(new THREE.MeshStandardMaterial({
      map: badgeTexture(), transparent: true, roughness: 0.8, metalness: 0,
    })));
  badge.position.set(-0.55, panelY + 0.02, BEZEL_D / 2 + 0.015);
  g.add(badge);

  /* Side vents on the funnel, as in crt-computer-big.webp.

     A vent panel is flat and the flank it sits on slopes, so the two
     can only agree over a limited run of z — and how far off the panel
     ends up is set by the slope, which steepens as the funnel is
     shortened. So the panel's **depth is a share of BACK_D** rather
     than a fixed 1.5: a 35% shorter back carries a proportionally
     shorter grille and the slats sit as flush as they ever did. Its x
     still comes off the taper at its own depth. Only `VENT_GAP` is
     absolute, and it is measuring against something that does not
     move — the bezel's rear wall, which the panel's front edge has to
     stay behind. */
  const VENT_GAP = 0.17;
  const ventD = BACK_D * 0.357;
  const ventInset = VENT_GAP + ventD / 2;
  const ventK = funnelK(ventInset);
  const ventX = (FUNNEL_W / 2) * ventK - 0.02;
  const ventZ = FUNNEL_FRONT_Z - ventInset;
  for (const side of [-1, 1]) {
    const v = buildVents(backBody, dark, ventD, 2.2, 11);
    v.rotation.y = side * Math.PI / 2;
    v.position.set(side * ventX, 0.2, ventZ);
    g.add(v);
  }

  /* And a vent strip across the top of the funnel, placed the same way.
     Both of its figures were proportional to the old depth already —
     the taper factor they land on comes out at the 0.779 they were
     tuned against — so the strip lies on the top surface at the same
     place on it as before. The slat count comes down with the depth
     instead of the pitch: 8 slats in 0.85 is a 0.04 slat, which is
     under a pixel at this camera once foreshortened. */
  const topD = BACK_D * 0.31;
  const topInset = BACK_D * 0.381;
  const top = buildVents(backBody, dark, 2.6, topD, 5);
  top.rotation.x = -Math.PI / 2;
  top.position.set(0, FUNNEL_H / 2 * funnelK(topInset) + 0.014,
    FUNNEL_FRONT_Z - topInset);
  g.add(top);

  return {
    group: g, screen, screenMat, screenGlow,
    setScreen: display.setMix,
    setStill: display.setStill,
    clearStill: display.clearStill,
  };
}

/* ==========================================
   KEYBOARD

   A 101-key layout rather than a 15x5 grid: the thing that gives a
   keyboard away at a glance is the ragged right edge of the alpha
   block, the stepped modifiers, and the two clusters off to the side.
   Laid out in key units (1u = one pitch) and converted at the end.
   ========================================== */

const KU = 0.253;          // key pitch, world units
const KGAP = 0.047;        // gap between caps
const KB_FN_GAP = 0.4;     // extra space under the function row, in u
const KB_COLS = 23.2;      // full width of the key field, in u
const KB_ROWS = 6;

function keyLayout() {
  const keys = [];
  /* r is the top row the cap sits on; w/d are in key units. */
  const push = (x, r, w = 1, d = 1) => keys.push({ x: x + w / 2, r, w, d });

  const MAIN = [
    [1, { g: 1 }, 1, 1, 1, 1, { g: 0.5 }, 1, 1, 1, 1, { g: 0.5 }, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2],
    [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5],
    [1.75, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.25],
    [2.25, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.75],
    [1.5, 1.25, 1.25, 6.25, 1.25, 1.25, 1.25, 1],
  ];
  MAIN.forEach((row, r) => {
    let x = 0;
    for (const seg of row) {
      if (typeof seg === 'object') { x += seg.g; continue; }
      push(x, r, seg);
      x += seg;
    }
  });

  /* Navigation cluster, then the arrows in their inverted T. */
  const NAV = 15.6;
  for (const r of [0, 1, 2]) for (let c = 0; c < 3; c++) push(NAV + c, r);
  push(NAV + 1, 4);
  for (let c = 0; c < 3; c++) push(NAV + c, 5);

  /* Numpad: tall + and Enter on the right column, double-width zero. */
  const NUM = 19.2;
  for (let c = 0; c < 4; c++) push(NUM + c, 1);
  for (let c = 0; c < 3; c++) push(NUM + c, 2);
  push(NUM + 3, 2, 1, 2);
  for (let c = 0; c < 3; c++) push(NUM + c, 3);
  for (let c = 0; c < 3; c++) push(NUM + c, 4);
  push(NUM + 3, 4, 1, 2);
  push(NUM + 0, 5, 2);
  push(NUM + 2, 5);

  return keys;
}

function buildKeyboard(body, wellMat, keyMat, modMat) {
  const g = new THREE.Group();
  g.position.set(0.1, 0.22, 4.9);
  g.rotation.x = -0.05;
  /* Nobody squares a keyboard to the monitor. Two degrees is enough to
     read as set down rather than placed. */
  g.rotation.y = 0.032;

  /* Corner radius 0.06 rather than 0.1: on a 0.44-deep case the old
     figure rounded away most of the side wall, so the long top edge —
     the one edge of this keyboard the moon actually rakes — had no
     arris to catch. */
  const W = 6.9, D = 2.6, H = 0.44;
  const shell = new THREE.Mesh(taperedBox(W, H, D, 0.06, 0.82), body);
  shell.castShadow = true;
  shell.receiveShadow = true;
  g.add(shell);

  const fieldW = KB_COLS * KU;
  const fieldD = (KB_ROWS + KB_FN_GAP) * KU;
  const x0 = -fieldW / 2;
  const z0 = -fieldD / 2 + 0.12;       // field sits a touch forward of centre
  const topY = H / 2;

  /* Recessed well under the caps, so the gaps between keys read dark
     instead of showing the same plastic as the shell. It is `KEY_WELL`
     rather than `PLASTIC_DARK` now — the gaps are the one place on the
     machine with plastic on all four sides of them and nothing but the
     tube's own spill reaching in, so they should be the darkest beige
     here, not the same shade as the vent cavities. */
  const well = new THREE.Mesh(
    track(new THREE.BoxGeometry(fieldW + 0.14, 0.08, fieldD + 0.14)), wellMat);
  well.position.set(0, topY - 0.01, z0 + fieldD / 2);
  well.receiveShadow = true;
  g.add(well);

  const keys = keyLayout();
  const capY = topY + 0.1;
  const place = k => {
    const zc = (k.r + k.d / 2) * KU + (k.r >= 1 ? KB_FN_GAP * KU : 0);
    return [x0 + k.x * KU, capY, z0 + zc];
  };

  /* One instanced mesh carries the ~90 single-unit caps; the wide and
     tall ones get their own geometry so the corner radius is not
     stretched along with them. */
  const unit = keys.filter(k => k.w === 1 && k.d === 1);
  const inst = new THREE.InstancedMesh(
    keycapGeo(KU - KGAP, KU - KGAP), keyMat, unit.length);
  inst.castShadow = true;
  inst.receiveShadow = true;
  const m = new THREE.Matrix4();
  unit.forEach((k, i) => {
    const [x, y, z] = place(k);
    inst.setMatrixAt(i, m.makeTranslation(x, y, z));
  });
  g.add(inst);

  for (const k of keys) {
    if (k.w === 1 && k.d === 1) continue;
    const cap = new THREE.Mesh(
      keycapGeo(k.w * KU - KGAP, k.d * KU - KGAP), modMat);
    cap.position.set(...place(k));
    cap.castShadow = true;
    cap.receiveShadow = true;
    g.add(cap);
  }

  /* Status LEDs over the numpad, in the back margin. */
  const ledGeo = track(new THREE.CylinderGeometry(0.038, 0.038, 0.03, 16));
  const ledMat = track(new THREE.MeshStandardMaterial({
    color: 0x0a2a10, emissive: 0x53ff7a, emissiveIntensity: 1.6, roughness: 0.35,
  }));
  for (let i = 0; i < 3; i++) {
    const l = new THREE.Mesh(ledGeo, ledMat);
    l.position.set(x0 + (19.6 + i * 1.2) * KU, topY + 0.02, z0 - 0.2);
    g.add(l);
  }

  return g;
}

/* ==========================================
   MOUSE
   ========================================== */
function buildMouse(body, dark) {
  const g = new THREE.Group();
  const W = 0.95, H = 0.52, D = 1.5;

  /* Narrows and drops toward the front (-Z, the cable end) while the
     base stays flat on the floor. */
  /* 5 segments on the same 0.2 radius: the shell of a mouse *is* a
     curve, so this one gets resolution rather than a chamfer. */
  const geo = new RoundedBoxGeometry(W, H, D, 5, 0.2);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const t = THREE.MathUtils.clamp((v.z + D / 2) / D, 0, 1);
    pos.setXYZ(i,
      v.x * THREE.MathUtils.lerp(0.78, 1, t),
      -H / 2 + (v.y + H / 2) * THREE.MathUtils.lerp(0.6, 1, t),
      v.z);
  }
  geo.computeVertexNormals();
  track(geo);

  const shell = new THREE.Mesh(geo, body);
  shell.position.y = H / 2;
  shell.castShadow = true;
  shell.receiveShadow = true;
  g.add(shell);

  /* The split between the two buttons. A thin dark slot is all it takes
     at this size — modelled buttons would not read any differently. */
  const slot = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.026, 0.07, 0.62)), dark);
  slot.position.set(0, H * 0.75, -D / 2 + 0.33);
  g.add(slot);

  return g;
}

/* ==========================================
   ASSEMBLY
   ========================================== */

/* `anisotropy` is the renderer's maximum, handed in by scene.js the
   same way `buildRoom` takes it — see `canvasTexture`. */
export function buildComputer(anisotropy = 1) {
  maxAniso = anisotropy;
  const grain = plasticTextures();
  /* The roughnesses below are all pre-map figures; the band in
     `plasticTextures` takes about a tenth off each. The recessed tones
     are the rough end on purpose — a cavity scatters, and a matt
     surface in shadow stays dark instead of picking up a sheen that
     would undo the point of its being a recess. */
  const body = plasticMaterial(grain);
  const backBody = plasticMaterial(grain, PLASTIC_BACK, 0.58);
  const dark = plasticMaterial(grain, PLASTIC_DARK, 0.62);
  const keyWell = plasticMaterial(grain, KEY_WELL, 0.72);
  const keyMat = plasticMaterial(grain, KEY_CAP, 0.54);
  const modMat = plasticMaterial(grain, KEY_MOD, 0.56);
  const cableMat = plasticMaterial(grain, CABLE, 0.66);

  const root = new THREE.Group();
  root.rotation.y = FACING;

  /* Everything that moves on hover goes in `lift`; the contact shadows
     stay on `root` so they keep sitting on the floor. Parenting them to
     the lifted group floats them off the ground as a visible blob. */
  const lift = new THREE.Group();
  const monitor = buildMonitor(body, backBody, dark);

  const mouse = buildMouse(body, dark);
  mouse.position.set(4.6, 0, 4.55);
  mouse.rotation.y = -0.2;

  lift.add(
    buildStand(body, dark),
    monitor.group,
    buildKeyboard(body, keyWell, keyMat, modMat),
    mouse,
  );

  /* Cables. A desk with no cords on it is the giveaway that a scene was
     modelled rather than photographed, so the keyboard and mouse both
     run into the base of the stand. They ride on `lift` with the things
     they plug into, and sag to just clear the floor. */
  /* At this camera the floor directly behind a body is hidden by it, so
     each run has to break out sideways before it is worth drawing: the
     keyboard cord swings left of the keyboard and the mouse cord
     crosses the open floor. */
  lift.add(
    cable([[-2.1, 0.28, 3.52], [-2.52, 0.09, 2.92], [-2.34, 0.08, 2.24],
           [-1.6, 0.08, 1.7], [-0.6, 0.08, 1.3]], 0.052, cableMat),
    cable([[4.5, 0.19, 3.83], [4.1, 0.08, 3.2], [3.3, 0.07, 2.6],
           [2.4, 0.08, 2.1], [1.5, 0.1, 1.6]], 0.046, cableMat),
  );
  root.add(lift);

  /* Contact shadows: the directional light alone leaves the base and the
     keyboard looking like they hover, so ground them with a soft blob —
     **and now a tight one inside it for the contact itself.** The broad
     blob is ambient shade, which falls off over a couple of units and
     therefore says "something is above this" rather than "this is
     touching". The pair is what reads as weight on the walnut.

     **Every broad footprint is exactly the one it was, and every core
     sits strictly inside one**, so the union of these quads has not
     moved. That is deliberate and it is not cosmetic: these quads are
     children of `root`, so `pickTarget` raycasts them and
     `Box3.setFromObject(computer.root)` measures them — a blob one unit
     wider is one unit more desk that counts as a press on the machine.

     The cores sit 4mm higher than the broad blobs. Coplanar would
     z-fight; both are black and `depthWrite` is off, so which draws
     first makes no difference to the result. */
  const quad = track(new THREE.PlaneGeometry(1, 1));
  const soft = contactShadowTexture(CONTACT_SOFT);
  const core = contactShadowTexture(CONTACT_CORE);
  for (const [tex, y, x, z, sx, sz, o] of [
    /* the stand's foot (radius 2.25), the keyboard (6.9 x 2.6), the mouse */
    [soft, 0.012, 0, 0, 6.2, 6.2, 0.8],
    [core, 0.016, 0, 0, 5.2, 5.2, 0.85],
    [soft, 0.012, 0.1, 4.9, 8.4, 4.6, 0.62],
    [core, 0.016, 0.1, 4.9, 7.5, 3.2, 0.8],
    [soft, 0.012, 4.6, 4.55, 2.2, 2.6, 0.55],
    [core, 0.016, 4.6, 4.55, 1.9, 2.4, 0.7],
  ]) {
    const mat = track(new THREE.MeshBasicMaterial({
      map: tex, transparent: true, depthWrite: false, opacity: o,
    }));
    const m = new THREE.Mesh(quad, mat);
    m.rotation.x = -Math.PI / 2;
    m.scale.set(sx, sz, 1);
    m.position.set(x, y, z);
    m.renderOrder = -1;
    root.add(m);
  }

  return {
    root, lift,
    /* The picture plane, so scene.js can project its corners and lay the
       live login screen over it. */
    screen: monitor.screen,
    screenAnchor: monitor.screen,
    projectionSurface: { mesh: monitor.screen, width: SCREEN_W, height: SCREEN_H, overscan: OVERSCAN },
    screenMat: monitor.screenMat,
    screenGlow: monitor.screenGlow,
    setScreen: monitor.setScreen,
    /* The fly-in puts a bitmap of the real login on the glass for the
       length of the move; see screenDisplay. */
    setStill: monitor.setStill,
    clearStill: monitor.clearStill,
  };
}

export function disposeComputer() {
  disposables.forEach(d => d.dispose());
  disposables.length = 0;
}
