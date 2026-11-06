import * as THREE from "three";

/* ==========================================
   TONE MAPPING, AND THE VOID'S PRE-IMAGE

   The diorama floats in a flat #1C1A2A void, and that colour has to
   come out of the pipeline *exactly* — it is a large flat area, it is
   also what `--scene-void` paints into the strip the taskbar vacates
   during the fly-in, and a few levels of drift between the two shows
   as a seam.

   Tone mapping makes that non-trivial, and the reason is that the two
   render paths do not treat the background the same way:

   - **Fog needs nothing.** three's `fog_fragment` chunk is included
     *after* `tonemapping_fragment` and `colorspace_fragment`, and
     `refreshFogUniforms` uploads the colour through
     `getUnlitUniformColorSpace`. So a fully-fogged fragment resolves to
     exactly `fog.color` on both paths, tone mapping or not. (Checked
     against the 0.186 sources, not assumed — it is the kind of thing
     that could reasonably be the other way round.)

   - **The background clear does.** `WebGLBackground.setClear` also goes
     through `getUnlitUniformColorSpace`, which returns the *output*
     colour space when drawing straight to the canvas and
     *linear*-sRGB when drawing into a render target. So on the direct
     path (mobile, reduced motion) the clear is written to the canvas in
     sRGB and never tone mapped — exact for free. On the composer path
     (desktop) it lands in the HalfFloat buffer and `OutputPass` tone
     maps it along with everything else.

   Untreated, that is not a rounding error. #1C1A2A comes out as
   **#15152A under AgX** and **#0A0917 under ACES** — the plum goes
   almost black, and only on desktop.

   So the composer path's background is set to the colour that tone maps
   *to* #1C1A2A, and this module is what works it out. The operators are
   ported from `tonemapping_pars_fragment.glsl.js` verbatim and the
   inverse is solved numerically, rather than either being hard-coded,
   because the pre-image moves with the operator **and with the
   exposure** — a baked constant would go quietly stale the first time
   the night lighting wants a different exposure. It is one Newton solve
   at startup and nothing per frame.

   `_roomshots.mjs` verifies the result against a real `readPixels` of
   the void and prints the error in 0-255 units, which is what makes the
   ports trustworthy rather than merely plausible.
   ========================================== */

/* GLSL `mat3(a, b, c)` takes **columns**, so M*v = a*v.x + b*v.y + c*v.z.
   The three source comments ("transposed from source") are saying the
   same thing. Getting this backwards is the one transcription error
   that would still look roughly right at a glance. */
const mul = (cols, v) => [
  cols[0][0] * v[0] + cols[1][0] * v[1] + cols[2][0] * v[2],
  cols[0][1] * v[0] + cols[1][1] * v[1] + cols[2][1] * v[2],
  cols[0][2] * v[0] + cols[1][2] * v[1] + cols[2][2] * v[2],
];

const saturate = (v) => v.map((c) => (c < 0 ? 0 : c > 1 ? 1 : c));

/* --- ACESFilmicToneMapping ------------------------------- */
const ACES_IN = [
  [0.59719, 0.0760, 0.02840],
  [0.35458, 0.90834, 0.13383],
  [0.04823, 0.01566, 0.83777],
];
const ACES_OUT = [
  [1.60475, -0.10208, -0.00327],
  [-0.53108, 1.10813, -0.07276],
  [-0.07367, -0.00605, 1.07602],
];

function acesFilmic(v, exposure) {
  /* The 1/0.6 is three's own subjective scale for a brighter viewing
     environment — see their #19621. It is part of the operator. */
  let c = mul(ACES_IN, v.map((x) => (x * exposure) / 0.6));
  c = c.map(
    (x) =>
      (x * (x + 0.0245786) - 0.000090537) /
      (x * (0.983729 * x + 0.432951) + 0.238081),
  );
  return saturate(mul(ACES_OUT, c));
}

/* --- AgXToneMapping ------------------------------------- */
const SRGB_TO_REC2020 = [
  [0.6274, 0.0691, 0.0164],
  [0.3293, 0.9195, 0.0880],
  [0.0433, 0.0113, 0.8956],
];
const REC2020_TO_SRGB = [
  [1.6605, -0.1246, -0.0182],
  [-0.5876, 1.1329, -0.1006],
  [-0.0728, -0.0083, 1.1187],
];
const AGX_INSET = [
  [0.856627153315983, 0.137318972929847, 0.11189821299995],
  [0.0951212405381588, 0.761241990602591, 0.0767994186031903],
  [0.0482516061458583, 0.101439036467562, 0.811302368396859],
];
const AGX_OUTSET = [
  [1.1271005818144368, -0.1413297634984383, -0.14132976349843826],
  [-0.11060664309660323, 1.157823702216272, -0.11060664309660294],
  [-0.016493938717834573, -0.016493938717834257, 1.2519364065950405],
];
const AGX_MIN_EV = -12.47393;
const AGX_MAX_EV = 4.026069;

/* The sigmoid is a polynomial fit in three, not the real AgX curve.
   Porting the fit rather than the ideal is the point: what has to be
   inverted is what the shader actually runs. */
const agxContrast = (x) => {
  const x2 = x * x;
  const x4 = x2 * x2;
  return (
    15.5 * x4 * x2 -
    40.14 * x4 * x +
    31.96 * x4 -
    6.868 * x2 * x +
    0.4298 * x2 +
    0.1191 * x -
    0.00232
  );
};

function agx(v, exposure) {
  let c = mul(SRGB_TO_REC2020, v.map((x) => x * exposure));
  c = mul(AGX_INSET, c);
  c = c.map((x) => Math.log2(Math.max(x, 1e-10)));
  c = c.map((x) => (x - AGX_MIN_EV) / (AGX_MAX_EV - AGX_MIN_EV));
  c = saturate(c).map(agxContrast);
  c = mul(AGX_OUTSET, c);
  c = c.map((x) => Math.pow(Math.max(0, x), 2.2));
  return saturate(mul(REC2020_TO_SRGB, c));
}

const OPERATORS = new Map([
  [THREE.AgXToneMapping, agx],
  [THREE.ACESFilmicToneMapping, acesFilmic],
  [THREE.LinearToneMapping, (v, e) => saturate(v.map((x) => x * e))],
  [THREE.ReinhardToneMapping, (v, e) =>
    saturate(v.map((x) => (x * e) / (1 + x * e)))],
]);

/* 3D Newton with a numerical Jacobian. The operators couple the
   channels through their matrices, so a per-channel bisection — the
   obvious thing to reach for — cannot invert them. Dark values are
   well inside the smooth part of both curves and this converges in a
   handful of steps. */
function newton(f, target) {
  const x = target.slice();
  for (let it = 0; it < 64; it++) {
    const F = f(x).map((v, i) => v - target[i]);
    if (Math.max(Math.abs(F[0]), Math.abs(F[1]), Math.abs(F[2])) < 1e-12) {
      return x;
    }
    /* Jacobian by forward differences, then solve J·d = -F. */
    const A = [
      [0, 0, 0, -F[0]],
      [0, 0, 0, -F[1]],
      [0, 0, 0, -F[2]],
    ];
    for (let j = 0; j < 3; j++) {
      const h = Math.max(1e-7, Math.abs(x[j]) * 1e-5);
      const xp = x.slice();
      xp[j] += h;
      const Fp = f(xp).map((v, i) => v - target[i]);
      for (let i = 0; i < 3; i++) A[i][j] = (Fp[i] - F[i]) / h;
    }
    for (let i = 0; i < 3; i++) {
      let p = i;
      for (let k = i + 1; k < 3; k++) {
        if (Math.abs(A[k][i]) > Math.abs(A[p][i])) p = k;
      }
      const t = A[i];
      A[i] = A[p];
      A[p] = t;
      /* Singular: the target is off the end of the curve (clamped), so
         there is no pre-image. Caller falls back to the raw colour. */
      if (Math.abs(A[i][i]) < 1e-14) return null;
      for (let k = i + 1; k < 3; k++) {
        const m = A[k][i] / A[i][i];
        for (let j = i; j < 4; j++) A[k][j] -= m * A[i][j];
      }
    }
    const d = [0, 0, 0];
    for (let i = 2; i >= 0; i--) {
      let s = A[i][3];
      for (let j = i + 1; j < 3; j++) s -= A[i][j] * d[j];
      d[i] = s / A[i][i];
    }
    for (let i = 0; i < 3; i++) x[i] += d[i];
  }
  return x;
}

const scratch = { r: 0, g: 0, b: 0 };

/* The colour to hand three so that, after `toneMapping` at `exposure`,
   the pipeline emits `color` exactly. Returns a new THREE.Color.

   Falls back to `color` itself whenever there is nothing to undo (no
   tone mapping, an operator this module does not model) or the solve
   does not land — a slightly-off void is a far better failure than a
   throw during scene init. */
export function tonemapPreimage(color, toneMapping, exposure = 1) {
  const out = new THREE.Color();
  const f = OPERATORS.get(toneMapping);
  color.getRGB(scratch, THREE.LinearSRGBColorSpace);
  const target = [scratch.r, scratch.g, scratch.b];
  if (!f) return out.copy(color);
  const pre = newton((v) => f(v, exposure), target);
  if (!pre || pre.some((v) => !Number.isFinite(v) || v < 0)) {
    return out.copy(color);
  }
  return out.setRGB(pre[0], pre[1], pre[2], THREE.LinearSRGBColorSpace);
}

/* What the pipeline *would* emit for `color` if nothing undid the tone
   mapping. Only used by the review scripts, to show the error the
   pre-image is there to remove. */
export function tonemapForward(color, toneMapping, exposure = 1) {
  const f = OPERATORS.get(toneMapping);
  const out = new THREE.Color();
  color.getRGB(scratch, THREE.LinearSRGBColorSpace);
  if (!f) return out.copy(color);
  const v = f([scratch.r, scratch.g, scratch.b], exposure);
  return out.setRGB(v[0], v[1], v[2], THREE.LinearSRGBColorSpace);
}

export const TONE_MAPPINGS = {
  none: THREE.NoToneMapping,
  linear: THREE.LinearToneMapping,
  reinhard: THREE.ReinhardToneMapping,
  aces: THREE.ACESFilmicToneMapping,
  agx: THREE.AgXToneMapping,
  neutral: THREE.NeutralToneMapping,
};
