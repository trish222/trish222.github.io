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
const PLASTIC      = 0xcec4ab;   // front shell, warm off-white — kept clear of the cream floor
const PLASTIC_BACK = 0xc0b69c;   // rear shell: moulded separately, so it reads cooler
const PLASTIC_DARK = 0x938b78;   // recesses, vent cavities, seams
const KEY_CAP      = 0xd8d0bb;
const KEY_MOD      = 0xc2b9a1;   // the wide keys are a shade darker, as they usually are
const CABLE        = 0x978d78;   // darker than the shells, or it reads as a scratch on the floor
const SCREEN_TEAL  = 0x0b7a76;
const SCREEN_INK   = '#1b47a3';  // the floor blue, reused on the screen

/* --- Proportions ----------------------------------------- */
const MON_W = 6.4, MON_H = 5.4, BEZEL_D = 1.35;
const BACK_D = 4.2, BACK_TAPER = 0.42;
const SCREEN_W = 5.1, SCREEN_H = 3.9;
const MON_Y = 3.85;              // centre height of the monitor body
const OPEN_CY = 0.26;            // screen opening rides above centre

/* Square to the floor grid, so the bezel edges run parallel to the name
   text (which lies along +X) and the screen turns to face left. At the
   45-degree camera azimuth this gives the even three-quarter view of
   crt-computer-full.jpeg: front and one side both in play. */
export const FACING = THREE.MathUtils.degToRad(0);

const disposables = [];
function track(...xs) { disposables.push(...xs); return xs[0]; }

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

      /* Wide spread: roughnessMap multiplies the material roughness, so
         the contrast here is what breaks the sheen up across a panel. */
      const r = 138 + low * 66 + fine * 54;
      rough.data[k] = rough.data[k + 1] = rough.data[k + 2] = r;
      rough.data[k + 3] = 255;

      /* Narrow spread: map multiplies the material colour, so anything
         wider than a few percent reads as dirt rather than moulding. */
      const v = 232 + low * 17 + fine * 6;
      albedo.data[k] = albedo.data[k + 1] = albedo.data[k + 2] = v;
      albedo.data[k + 3] = 255;
    }
  }
  rctx.putImageData(rough, 0, 0);
  actx.putImageData(albedo, 0, 0);

  const wrap = (c, srgb) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 2);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return track(t);
  };
  return { rough: wrap(rc, false), albedo: wrap(ac, true) };
}

function plasticMaterial(grain, color = PLASTIC, roughness = 0.68) {
  return track(new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0,
    map: grain.albedo,
    roughnessMap: grain.rough,
    bumpMap: grain.rough,
    bumpScale: 0.022,
    /* The HDRI is a big part of what was lifting the shell to within a
       shade of the cream floor; the machine takes less of it than the
       floor does. */
    envMapIntensity: 0.5,
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

function drawPicture(w, h, greeting) {
  /* The picture is drawn sharp into an offscreen canvas, then composited
     through a blur. A CRT has no pixel grid to be sharp against, and a
     crisp bitmap on the glass is what makes a render look like a photo
     of a monitor with a screenshot pasted over it. */
  const ui = document.createElement('canvas');
  ui.width = w; ui.height = h;
  const u = ui.getContext('2d');

  /* Overscan: the tube is bigger than the picture, so the edge is black. */
  u.fillStyle = '#05100f';
  u.fillRect(0, 0, w, h);

  const m = Math.round(w * 0.035);
  const iw = w - m * 2, ih = h - m * 2;
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
    /* Same type as the floor, so the screen reads as part of the scene.
       The webfont is already resident — initScene awaits it before the
       computer is built. */
    u.fillStyle = SCREEN_INK;
    u.font = `500 ${Math.round(bh * 0.46)}px "Playfair Display", Georgia, serif`;
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

/* Everything that makes the sharp picture look like a tube. */
function compositePicture(ui, w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');

  /* Soft focus, then a wide low-alpha pass on top: phosphor bleeds into
     its neighbours, so bright areas halo rather than stopping dead. */
  ctx.filter = 'blur(1.5px)';
  ctx.drawImage(ui, 0, 0);
  ctx.filter = 'blur(9px)';
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.34;
  ctx.drawImage(ui, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';

  /* Scanlines coarse enough to survive being drawn at ~200px across, and
     a fainter vertical grille under them. */
  ctx.fillStyle = 'rgba(0,0,0,0.26)';
  for (let y = 0; y < h; y += 5) ctx.fillRect(0, y, w, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  for (let x = 0; x < w; x += 4) ctx.fillRect(x, 0, 1.4, h);

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
function screenDisplay() {
  const w = 768, h = 576;
  const idle = compositePicture(drawPicture(w, h, null), w, h);
  const greet = compositePicture(drawPicture(w, h, SCREEN_GREETING), w, h);

  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');

  const t = track(new THREE.CanvasTexture(c));
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;

  /* Redrawing the canvas and re-uploading the texture every frame is
     wasted work once the mix has settled. */
  let drawn = -1;
  const setMix = v => {
    if (Math.abs(v - drawn) < 0.004) return;
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

  return { texture: t, setMix };
}

/* The reflection in the glass, as a window rather than a single smear:
   two soft panes with a mullion between them, plus a broad low sheen.
   Kept faint so the picture stays readable through it. */
function glareTexture() {
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
  ctx.filter = 'blur(13px)';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (const dx of [0, s * 0.19]) ctx.fillRect(dx, 0, s * 0.15, s * 0.3);
  ctx.restore();

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return track(t);
}

/* Moulded-in badge on the bottom bezel. Our own model number, since no
   real brand may appear here. */
function badgeTexture() {
  const w = 512, h = 96;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(96,88,72,0.72)';
  ctx.font = '600 44px Georgia, serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('TRISH', 8, h / 2 + 2);
  ctx.font = '400 32px Georgia, serif';
  ctx.fillStyle = 'rgba(96,88,72,0.5)';
  ctx.fillText('T-1500', 168, h / 2 + 3);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return track(t);
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
    const k = THREE.MathUtils.lerp(taper, 1, t);
    pos.setXY(i, v.x * k, v.y * k);
  }
  geo.computeVertexNormals();
  return track(geo);
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

/* Keycap: rounded box drawn in slightly toward the top, so the caps
   have the moulded taper real ones do instead of reading as tiles. */
function keycapGeo(w, d, h = 0.15, r = 0.035) {
  const geo = new RoundedBoxGeometry(w, h, d, 2, r);
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

/* Radial falloff used for the contact shadows. */
function contactShadowTexture() {
  const s = 256;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0.00, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.45, 'rgba(0,0,0,0.28)');
  g.addColorStop(1.00, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return track(new THREE.CanvasTexture(c));
}

/* ==========================================
   PARTS
   ========================================== */

function buildStand(body, dark) {
  const g = new THREE.Group();

  const foot = new THREE.Mesh(
    track(new THREE.CylinderGeometry(2.05, 2.25, 0.3, 56)), body);
  foot.position.y = 0.15;

  /* A moulded step on top of the foot, so the base is not one slab. */
  const step = new THREE.Mesh(
    track(new THREE.CylinderGeometry(1.74, 1.9, 0.14, 48)), body);
  step.position.y = 0.36;

  const neck = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.95, 1.5, 0.78, 40)), body);
  neck.position.y = 0.78;

  /* Dark swivel collar where the neck meets the monitor — the joint is
     the detail that makes a tilt-and-swivel base read as a mechanism. */
  const collar = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.88, 0.88, 0.16, 40)), dark);
  collar.position.y = 1.2;

  for (const m of [foot, step, neck, collar]) { m.castShadow = true; m.receiveShadow = true; }
  g.add(foot, step, neck, collar);
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
  const g = new THREE.Group();
  g.position.y = MON_Y;

  /* Deep tapered funnel behind the bezel. */
  const back = new THREE.Mesh(
    taperedBox(MON_W * 0.88, MON_H * 0.86, BACK_D, 0.45, BACK_TAPER), backBody);
  back.position.z = -BACK_D / 2 - BEZEL_D / 2 + 0.1;
  back.castShadow = true;
  back.receiveShadow = true;
  g.add(back);

  /* Thick bezel, extruded as a frame with a rounded opening. The
     opening sits above centre so the bottom bezel is the deepest, which
     is where the button panel and LED live in crt-computer.png. */
  const openW = SCREEN_W + 0.3, openH = SCREEN_H + 0.3;
  const face = roundedRect(MON_W, MON_H, 0.34);
  face.holes.push(roundedRect(openW, openH, 0.26, 0, OPEN_CY));
  const bezelGeo = track(new THREE.ExtrudeGeometry(face, {
    depth: BEZEL_D - 0.1,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelSegments: 2,
    curveSegments: 8,
  }));
  bezelGeo.translate(0, 0, -(BEZEL_D - 0.1) / 2);
  const bezel = new THREE.Mesh(bezelGeo, body);
  bezel.castShadow = true;
  bezel.receiveShadow = true;
  g.add(bezel);

  /* The seam where the front shell clips onto the rear one. A thin dark
     frame standing a hair proud of the bezel wall, so it reads as a
     groove running right around the case. Injection-moulded plastic
     always has this line and a solid shell never does. */
  const seamShape = roundedRect(MON_W + 0.014, MON_H + 0.014, 0.346);
  seamShape.holes.push(roundedRect(MON_W - 0.1, MON_H - 0.1, 0.3));
  const seamGeo = track(new THREE.ExtrudeGeometry(seamShape, {
    depth: 0.06, bevelEnabled: false, curveSegments: 8,
  }));
  seamGeo.translate(0, 0, -0.03);
  const seam = new THREE.Mesh(seamGeo, dark);
  seam.position.z = -0.31;
  g.add(seam);

  /* Dark backing panel behind the opening, closing off the recess. */
  const well = new THREE.Mesh(
    track(new THREE.BoxGeometry(openW + 0.5, openH + 0.5, 0.12)), dark);
  well.position.set(0, OPEN_CY, BEZEL_D / 2 - 0.42);
  well.receiveShadow = true;
  g.add(well);

  /* The picture itself — emissive, so it reads as a lit CRT. */
  const display = screenDisplay();
  const screenMat = track(new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: 0xffffff,
    emissiveMap: display.texture,
    emissiveIntensity: 1.25,
    roughness: 0.9,
    metalness: 0,
  }));
  const screen = new THREE.Mesh(domedPanel(SCREEN_W, SCREEN_H, 0.1), screenMat);
  screen.position.set(0, OPEN_CY, BEZEL_D / 2 - 0.3);
  g.add(screen);

  /* A lit tube spills light onto its own bezel. Small range and no
     shadow, so it only warms the plastic right around the opening. */
  const screenGlow = new THREE.PointLight(0x8ee8e0, 2.1, 5.5, 2);
  screenGlow.position.set(0, OPEN_CY, BEZEL_D / 2 + 0.55);
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
  glass.position.set(0, OPEN_CY, BEZEL_D / 2 - 0.19);
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
  glare.position.set(0, OPEN_CY, BEZEL_D / 2 - 0.17);
  g.add(glare);

  /* Button panel, bottom right of the bezel face. */
  const panelW = 1.5, panelH = 0.46;
  const panelX = MON_W / 2 - panelW / 2 - 0.42;
  const panelY = -MON_H / 2 + 0.52;
  const panel = new THREE.Mesh(
    track(new RoundedBoxGeometry(panelW, panelH, 0.12, 3, 0.05)), dark);
  panel.position.set(panelX, panelY, BEZEL_D / 2 - 0.05);
  g.add(panel);

  const btnGeo = track(new RoundedBoxGeometry(0.2, 0.2, 0.1, 2, 0.04));
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(btnGeo, body);
    b.position.set(panelX - panelW / 2 + 0.28 + i * 0.32, panelY, BEZEL_D / 2 + 0.02);
    b.castShadow = true;
    g.add(b);
  }

  /* Chunkier power button to the left of the panel. */
  const power = new THREE.Mesh(
    track(new RoundedBoxGeometry(0.42, 0.3, 0.14, 3, 0.06)), body);
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

  /* Side vents on the funnel, as in crt-computer-big.webp. */
  const ventT = 0.78;                                   // how far forward on the funnel
  const ventK = THREE.MathUtils.lerp(BACK_TAPER, 1, ventT);
  const ventX = (MON_W * 0.88 / 2) * ventK - 0.02;
  const ventZ = back.position.z - BACK_D / 2 + BACK_D * ventT;
  for (const side of [-1, 1]) {
    const v = buildVents(backBody, dark, 1.5, 2.2, 11);
    v.rotation.y = side * Math.PI / 2;
    v.position.set(side * ventX, 0.2, ventZ);
    g.add(v);
  }

  /* And a vent strip across the top of the funnel. */
  const top = buildVents(backBody, dark, 2.6, 1.3, 8);
  top.rotation.x = -Math.PI / 2;
  top.position.set(0, MON_H * 0.86 * 0.5 - 0.5, -BEZEL_D / 2 - 1.5);
  g.add(top);

  return { group: g, screenMat, screenGlow, setScreen: display.setMix };
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

function buildKeyboard(body, dark, keyMat, modMat) {
  const g = new THREE.Group();
  g.position.set(0.1, 0.22, 4.9);
  g.rotation.x = -0.05;
  /* Nobody squares a keyboard to the monitor. Two degrees is enough to
     read as set down rather than placed. */
  g.rotation.y = 0.032;

  const W = 6.9, D = 2.6, H = 0.44;
  const shell = new THREE.Mesh(taperedBox(W, H, D, 0.1, 0.82), body);
  shell.castShadow = true;
  shell.receiveShadow = true;
  g.add(shell);

  const fieldW = KB_COLS * KU;
  const fieldD = (KB_ROWS + KB_FN_GAP) * KU;
  const x0 = -fieldW / 2;
  const z0 = -fieldD / 2 + 0.12;       // field sits a touch forward of centre
  const topY = H / 2;

  /* Recessed well under the caps, so the gaps between keys read dark
     instead of showing the same plastic as the shell. */
  const well = new THREE.Mesh(
    track(new THREE.BoxGeometry(fieldW + 0.14, 0.08, fieldD + 0.14)), dark);
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
  const geo = new RoundedBoxGeometry(W, H, D, 4, 0.2);
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
    track(new THREE.BoxGeometry(0.035, 0.06, 0.62)), dark);
  slot.position.set(0, H * 0.75, -D / 2 + 0.33);
  g.add(slot);

  return g;
}

/* ==========================================
   ASSEMBLY
   ========================================== */

export function buildComputer() {
  const grain = plasticTextures();
  const body = plasticMaterial(grain);
  const backBody = plasticMaterial(grain, PLASTIC_BACK, 0.68);
  const dark = plasticMaterial(grain, PLASTIC_DARK, 0.78);
  const keyMat = plasticMaterial(grain, KEY_CAP, 0.66);
  const modMat = plasticMaterial(grain, KEY_MOD, 0.68);
  const cableMat = plasticMaterial(grain, CABLE, 0.72);

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
    buildKeyboard(body, dark, keyMat, modMat),
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
     keyboard looking like they hover, so ground them with a soft blob. */
  const shadowTex = contactShadowTexture();
  const quad = track(new THREE.PlaneGeometry(1, 1));
  for (const [x, z, sx, sz, o] of [
    [0, 0, 6.2, 6.2, 1],
    [0.1, 4.9, 8.4, 4.6, 0.8],
    [4.6, 4.55, 2.2, 2.6, 0.7],
  ]) {
    const mat = track(new THREE.MeshBasicMaterial({
      map: shadowTex, transparent: true, depthWrite: false, opacity: o,
    }));
    const s = new THREE.Mesh(quad, mat);
    s.rotation.x = -Math.PI / 2;
    s.scale.set(sx, sz, 1);
    s.position.set(x, 0.012, z);
    s.renderOrder = -1;
    root.add(s);
  }

  return {
    root, lift,
    screenMat: monitor.screenMat,
    screenGlow: monitor.screenGlow,
    setScreen: monitor.setScreen,
  };
}

export function disposeComputer() {
  disposables.forEach(d => d.dispose());
  disposables.length = 0;
}
