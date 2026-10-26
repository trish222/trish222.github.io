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

   Local space: +Z is the front of the machine, origin on the floor.
   ========================================== */

/* --- Palette --------------------------------------------- */
const PLASTIC      = 0xded6c2;   // warm off-white
const PLASTIC_DARK = 0xb3ab97;   // recesses and the vent cavity
const KEY_CAP      = 0xe4ddcb;
const SCREEN_TEAL  = 0x0f6f6b;

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

/* Fine grain so the plastic is not glassy-smooth under the studio
   environment map — mapped into roughness and a very small bump. */
function grainTexture(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = 190 + Math.random() * 65;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = n;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 6);
  return track(t);
}

function plasticMaterial(grain, color = PLASTIC, roughness = 0.62) {
  return track(new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0,
    roughnessMap: grain,
    bumpMap: grain,
    bumpScale: 0.012,
    envMapIntensity: 0.8,
  }));
}

/* Teal screen with faint scanlines and a soft vignette. */
function screenTexture() {
  const w = 768, h = 576;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');

  ctx.fillStyle = `#${SCREEN_TEAL.toString(16).padStart(6, '0')}`;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1.5);

  const vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.78);
  vig.addColorStop(0, 'rgba(255,255,255,0.10)');
  vig.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return track(t);
}

/* A single broad diagonal reflection, as in crt-computer-big.webp. */
function glareTexture() {
  const s = 512;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  ctx.translate(s / 2, s / 2);
  ctx.rotate(-Math.PI / 5);
  const g = ctx.createLinearGradient(0, -s * 0.5, 0, s * 0.5);
  g.addColorStop(0.00, 'rgba(255,255,255,0)');
  g.addColorStop(0.30, 'rgba(255,255,255,0)');
  g.addColorStop(0.40, 'rgba(255,255,255,0.46)');
  g.addColorStop(0.52, 'rgba(255,255,255,0.52)');
  g.addColorStop(0.60, 'rgba(255,255,255,0.05)');
  g.addColorStop(1.00, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-s, -s, s * 2, s * 2);
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

function buildStand(body) {
  const g = new THREE.Group();

  const foot = new THREE.Mesh(
    track(new THREE.CylinderGeometry(2.05, 2.25, 0.3, 56)), body);
  foot.position.y = 0.15;

  const neck = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.95, 1.5, 0.95, 40)), body);
  neck.position.y = 0.62;

  for (const m of [foot, neck]) { m.castShadow = true; m.receiveShadow = true; }
  g.add(foot, neck);
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

function buildMonitor(body, dark) {
  const g = new THREE.Group();
  g.position.y = MON_Y;

  /* Deep tapered funnel behind the bezel. */
  const back = new THREE.Mesh(
    taperedBox(MON_W * 0.88, MON_H * 0.86, BACK_D, 0.45, BACK_TAPER), body);
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

  /* Dark backing panel behind the opening, closing off the recess. */
  const well = new THREE.Mesh(
    track(new THREE.BoxGeometry(openW + 0.5, openH + 0.5, 0.12)), dark);
  well.position.set(0, OPEN_CY, BEZEL_D / 2 - 0.42);
  well.receiveShadow = true;
  g.add(well);

  /* The picture itself — emissive, so it reads as a lit CRT. */
  const screenMat = track(new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: 0xffffff,
    emissiveMap: screenTexture(),
    emissiveIntensity: 1.25,
    roughness: 0.9,
    metalness: 0,
  }));
  const screen = new THREE.Mesh(domedPanel(SCREEN_W, SCREEN_H, 0.1), screenMat);
  screen.position.set(0, OPEN_CY, BEZEL_D / 2 - 0.3);
  g.add(screen);

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

  /* One broad diagonal highlight across the glass. */
  const glare = new THREE.Mesh(domedPanel(SCREEN_W, SCREEN_H, 0.13),
    track(new THREE.MeshBasicMaterial({
      map: glareTexture(),
      transparent: true,
      opacity: 0.3,
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

  /* Side vents on the funnel, as in crt-computer-big.webp. */
  const ventT = 0.78;                                   // how far forward on the funnel
  const ventK = THREE.MathUtils.lerp(BACK_TAPER, 1, ventT);
  const ventX = (MON_W * 0.88 / 2) * ventK - 0.02;
  const ventZ = back.position.z - BACK_D / 2 + BACK_D * ventT;
  for (const side of [-1, 1]) {
    const v = buildVents(body, dark, 1.5, 2.2, 11);
    v.rotation.y = side * Math.PI / 2;
    v.position.set(side * ventX, 0.2, ventZ);
    g.add(v);
  }

  /* And a vent strip across the top of the funnel. */
  const top = buildVents(body, dark, 2.6, 1.3, 8);
  top.rotation.x = -Math.PI / 2;
  top.position.set(0, MON_H * 0.86 * 0.5 - 0.5, -BEZEL_D / 2 - 1.5);
  g.add(top);

  return { group: g, screenMat };
}

function buildKeyboard(body, keyMat) {
  const g = new THREE.Group();
  g.position.set(0.1, 0.22, 4.9);
  g.rotation.x = -0.05;

  const W = 6.6, D = 2.5, H = 0.44;
  const shell = new THREE.Mesh(taperedBox(W, H, D, 0.1, 0.82), body);
  shell.castShadow = true;
  shell.receiveShadow = true;
  g.add(shell);

  /* Key field: five rows plus a wider bar at the front. */
  const cols = 15, rows = 5;
  const kw = 0.33, kd = 0.3;
  const keys = new THREE.InstancedMesh(
    track(new RoundedBoxGeometry(kw, 0.1, kd, 2, 0.035)), keyMat, cols * rows + 1);
  keys.castShadow = true;
  keys.receiveShadow = true;

  const m = new THREE.Matrix4();
  let i = 0;
  const x0 = -(cols - 1) * (kw + 0.055) / 2;
  const z0 = -(rows - 1) * (kd + 0.055) / 2 - 0.12;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      m.makeTranslation(
        x0 + c * (kw + 0.055) + r * 0.04,
        H / 2 + 0.03,
        z0 + r * (kd + 0.055),
      );
      keys.setMatrixAt(i++, m);
    }
  }
  m.makeTranslation(0, H / 2 + 0.03, z0 + rows * (kd + 0.055));
  m.scale(new THREE.Vector3(14, 1, 1));
  keys.setMatrixAt(i++, m);
  keys.count = i;
  g.add(keys);

  return g;
}

/* ==========================================
   ASSEMBLY
   ========================================== */

export function buildComputer() {
  const grain = grainTexture();
  const body = plasticMaterial(grain);
  const dark = plasticMaterial(grain, PLASTIC_DARK, 0.78);
  const keyMat = plasticMaterial(grain, KEY_CAP, 0.66);

  const root = new THREE.Group();
  root.rotation.y = FACING;

  /* Everything that moves on hover goes in `lift`; the contact shadows
     stay on `root` so they keep sitting on the floor. Parenting them to
     the lifted group floats them off the ground as a visible blob. */
  const lift = new THREE.Group();
  const monitor = buildMonitor(body, dark);
  lift.add(buildStand(body), monitor.group, buildKeyboard(body, keyMat));
  root.add(lift);

  /* Contact shadows: the directional light alone leaves the base and the
     keyboard looking like they hover, so ground them with a soft blob. */
  const shadowTex = contactShadowTexture();
  const quad = track(new THREE.PlaneGeometry(1, 1));
  for (const [x, z, sx, sz, o] of [[0, 0, 6.2, 6.2, 1], [0.1, 4.9, 8.4, 4.6, 0.8]]) {
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

  return { root, lift, screenMat: monitor.screenMat };
}

export function disposeComputer() {
  disposables.forEach(d => d.dispose());
  disposables.length = 0;
}
