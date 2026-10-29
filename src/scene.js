import * as THREE from "three";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
/* gsap-core, not the "gsap" entry: every tween here targets a plain
   object and the DOM writes happen by hand in onUpdate, so CSSPlugin
   and the default-eases bundle it drags in are dead weight. Saves
   ~10 kB gzipped off the lazy scene chunk. */
import { gsap } from "gsap/gsap-core";
import {
  buildComputer,
  disposeComputer,
  FACING,
  MON_W,
  MON_H,
  MON_Y,
  SCREEN_W,
  SCREEN_H,
  OVERSCAN,
} from "./computer.js";
import { buildDesk, disposeDesk, DESK_TOP_Y } from "./desk.js";
/* The brick-built cherry blossom treehouse standing on the desk. Its
   own module for the same reason the desk is: it is a self-contained
   object with its own origin on the surface it stands on. */
import { buildTreehouse, disposeTreehouse } from "./treehouse.js";
/* The ground is its own module — colour, size, fog and the wordmark
   drawn across it all live there, so it can be swapped whole without
   touching the camera. */
import {
  buildFloor,
  buildFog,
  CREAM,
  disposeFloor,
  fitFloor,
  FLOOR_SIZE,
  loadFloorFont,
  setFogRange,
} from "./floor.js";
/* Playfair is declared in src/style.css and preloaded from index.html,
   so the fetch starts with the entry stylesheet rather than waiting for
   this chunk to load. Nothing to import here — just await it below. */

/* ==========================================
   ISOMETRIC INTRO SCENE

   Owns one <canvas id="scene">. The only module that imports three
   besides computer.js, desk.js and floor.js.

   Camera: perspective on a narrow FOV, 20° down / 37° around — see
   design-references/isometric-angle.webp. It was orthographic; see
   "Perspective, and what replaced the frustum" below for what the
   switch cost and what it bought.
   Floor: src/floor.js. Everything about what the ground *is* — its
   colour, its size, the fog that ends it, the name repeated across it
   after design-references/floor-text.png — lives there; this module
   only tells it what frame it is being seen in.
   A single low directional light rakes a long soft shadow across the
   letters.
   ========================================== */

/* --- Camera ----------------------------------------------
   Elevation follows the axis tripod in the CAD screenshot the angle was
   specified from: there the ground axes fall about 18-19° below the
   horizon either side of a vertical z. For an orthographic camera at a
   symmetric 45° azimuth that screen slope is atan(sin(elevation)), so
   18.9° on screen is 20° of elevation — a much flatter read than the
   35° this started at. That derivation is the orthographic limit, and
   it is still what these two numbers mean: a narrow FOV reproduces it
   closely at the target and diverges either side of it, which is the
   whole point of the change below.

   The azimuth is then swung 8° off that symmetry, toward the side the
   screen faces (the machine's glass looks down world +Z, and the camera
   sits in the +X/+Z octant, so a *smaller* azimuth walks it round
   towards the front). The ground axes are no longer mirror images — +X
   flattens to ~11.7° below the horizon while +Z steepens to ~24° — but
   the monitor turns out of its even three-quarter view and shows more
   picture, which is the point. Keep it slight: past ~30° the side vents
   go out of shot and the view stops reading as isometric. */
const ELEVATION = THREE.MathUtils.degToRad(20);
const AZIMUTH = THREE.MathUtils.degToRad(37);

/* --- Perspective, and what replaced the frustum -----------
   The camera is a PerspectiveCamera on a narrow vertical FOV. It used
   to be orthographic, and the flat end of the orbit leash is why it is
   not: an orthographic projection has no vanishing point, so dropping
   to 2° above the floor gave a flat elevation — the desk's parallel
   edges still parallel, the drawer fronts the same size at both ends,
   and no depth in the room at all.

   A narrow FOV is the whole trick. Everything in this file is still
   specified as a **frustum height at the target** — world units of
   vertical view at whatever the camera is looking at — which is
   exactly what the orthographic frustum was. The camera is then stood
   far enough back that a cone of FOV degrees subtends that height:

       dist = frustum / (2 * tan(fov / 2))

   so FRUSTUM, FRUSTUM_MOBILE, `monitorFrustum`, `screenFrustum` and
   the fly-in's log-space zoom curve all keep their old values and
   their old meanings, and nothing about the floor's type sizing had to
   change — `fitFloor` is handed the frustum at the target, and that is
   still the number it was. What stops being a constant is the
   *distance*: `CAM_DIST` is gone, and the radius is derived from the
   framing rather than chosen. At 20° the establishing shot stands 68
   units out where the orthographic one stood at 60.

   Narrower is more isometric, and the trade is legible across the
   subject: the desk spans about ±12 units of view depth, so its near
   and far ends differ in size by ~1.30x at 15°, ~1.43x at 20° and
   ~1.57x at 25°. `window.__fov(deg)` switches it on a live page, which
   is what `_persp.mjs` shoots the candidates with.

   Three things that were true only of the orthographic camera are now
   wrong. All three are handled where they live rather than here:

   - **The screen overlay is a homography, not an affine matrix.** The
     image of a plane under a pinhole camera keystones, so three
     projected corners no longer determine the transform. See
     `updateScreenOverlay`.
   - **`near` is positive again.** A perspective frustum is a pyramid
     in front of the eye, so the flat view's bottom edge is floor some
     40 units *ahead* of the camera rather than behind it — the entire
     reason the orthographic near plane had to be negative is gone. See
     `buildCamera`.
   - **A low view has a horizon**, which an orthographic one cannot.
     The fog already hides it: the floor is fully fogged to the
     background colour well before it, so ground and backdrop meet with
     no line between them. That the fog is in `CREAM` was load-bearing
     before and is more so now — see `buildFog` in src/floor.js, whose
     range is an offset from the camera's distance for the same reason
     CAM_DIST is gone. */
const FOV_DEFAULT = 20;
let fov = FOV_DEFAULT;
let tanHalfFov = Math.tan(THREE.MathUtils.degToRad(fov) / 2);

/* The distance that frames `frustum` world units of vertical view at
   the target. This one equation is what the whole conversion rests on:
   every framing in this file is still written as a frustum height, and
   this is where one becomes a pose. */
function distFor(frustum) {
  return frustum / (2 * tanHalfFov);
}
/* World units of vertical view. These went up with the desk: the
   machine used to stand on the floor, so the frame only had to hold
   6.5 units of monitor; it now stands on a 9-unit desk, and the
   assembly reaches ~20.6 units from the desk's near-bottom corner to
   the top of the tube. At 24 that fills about five-sixths of the frame
   height, which leaves the near foot clear of the bottom edge without
   stranding the desk in floor. It is the only camera constant the desk moved — the two
   angles, the distance and the whole leash are untouched, so the home
   framing is the same shot further back.

   The floor wordmark does not need re-tuning for this: LINE_FILL sizes
   the type as a share of the *viewport*, and FILL_DEPTH sets the row
   count as a share of the visible floor depth, so both scale with the
   frustum and the type lands at the same size in the frame as before. */
const FRUSTUM = 24;
/* Portrait deliberately crops the desk's ends rather than framing the
   whole of it: fitting a 19-unit desk across a 390px frame would need a
   frustum near 50 and leave the CRT a tenth of the picture. 37 is the
   point at which the far pedestal's drawer front is still in shot, and
   is as far as this should go — every unit of it costs the machine,
   which is the thing the visitor has to find and press. */
const FRUSTUM_MOBILE = 37;
/* Both of those are scaled by one knob, so the establishing shot can be
   pulled back without the two viewports drifting apart. 1.10 is a
   deliberate 10% of air added around the furniture: the desk and the
   machine keep their proportions and their place in the frame and
   simply sit in more room. It is the only thing that moves — the two
   angles, the leash and the fly-in's destination are all expressed
   somewhere this does not reach, so the shot pulls back and nothing
   else changes. Note it multiplies the *frustum*, not the distance:
   under a perspective camera those are the same zoom only because
   distFor derives one from the other. */
const HOME_ZOOM = 1.1;
const MOBILE_BP = 760;

/* How the two floor axes land on screen at this camera angle. The text
   runs along world +X and the rows stack along world +Z, so both are
   foreshortened diagonals — that is what sells the type as lying on the
   ground rather than floating over it. Off the symmetric azimuth the two
   no longer match: the baselines lie flatter and the stack climbs more
   steeply, so type size comes down a touch and the row count goes up.
   Both fall out of these two numbers, so nothing needs hand-retuning.

   These are the *orthographic* foreshortening factors, and they stay
   that way deliberately. Under a perspective camera the screen extent
   per world unit varies with depth, so there is no single pair of
   numbers; these are the pair that holds at the target, which is where
   the type the floor draws is being sized to sit. A narrow FOV keeps
   the error small, and the alternative — re-deriving them per row —
   would mean redrawing the floor texture whenever the camera moved. */
const PROJ_X = Math.cos(AZIMUTH); // screen x per unit along +X, at the target
const PROJ_Z = Math.sin(ELEVATION) * Math.sin(AZIMUTH); // screen y per unit along +Z

/* --- Where the machine is set down ------------------------
   The computer is modelled with its origin on its own ground plane and
   its kit laid out forward of that, so the group is not centred on the
   origin and has to be shifted back to sit square on the desk.

   These two are **measured, not estimated** — `window.__fit("computer")`
   reports the group's world box, and the figures below are its local z
   extents. That matters: an estimate of -3 for the back put the CRT's
   funnel over the back edge of the desk, which nothing at the home
   framing showed and the first side view made obvious. The front
   figure likewise is not the keyboard's front edge (6.2) but the front
   of its painted contact shadow, which is a quad lying on the desk and
   would otherwise hang off it in mid-air. */
const KIT_Z_MIN = -4.77;   // the back of the funnel
const KIT_Z_MAX = 7.2;     // the front of the keyboard's contact shadow
const COMPUTER_Z = -(KIT_Z_MIN + KIT_Z_MAX) / 2;

/* --- Where the treehouse is set down ---------------------
   On the desk to the **right of the monitor as the home view sees
   it**, which is +X: the camera sits in the +X/+Z octant, so screen
   right is desk right (the same convention desk.js states for its
   pedestals).

   Both figures are set against what is already on that half of the
   desk. The mouse's painted contact shadow runs x 3.5..5.7 over
   z 2.0..4.6 and its cord crosses x 1.5..4.5 over z 0.4..2.6, so the
   base's 1.64-unit radius has to clear both: at (6.9, -2.1) it reaches
   z = -0.46 against the cord's 0.4 and never gets near the mouse's x
   at all.

   The depth is the less obvious half. Screen x is roughly
   `0.8x - 0.6z` at this azimuth and depth toward the camera is
   `0.57x + 0.75z`, so a model placed level with the monitor would sit
   screen-right of it *and in front of it* — the canopy would cross the
   bezel. Pushing it back to z = -2.1 trades a little of that screen
   separation for 1.6 units of depth behind the glass, and
   `window.__fit("treehouse", "computer")` is how the pair was checked
   rather than the screenshot. */
const TREEHOUSE_X = 6.9;
const TREEHOUSE_Z = -2.1;
/* Turned to put the house's front — the door, the porch — toward the
   viewer, and its windowed flank into the light, without facing dead
   on. AZIMUTH is the yaw at which the model's +Z looks straight down
   the lens, so the offset *is* the three-quarter angle: at 0.50 rad
   the front sits 29 degrees off the camera and the +X side 61, which
   is the same read the machine gets. The first pass was 0.14 and was
   effectively a front elevation — the flank, and with it the round
   window, was edge-on. */
const TREEHOUSE_FACING = AZIMUTH - 0.50;

/* Lighting once the HDRI is in play — see the note on the PI factor below. */
const ENV_INTENSITY = 0.7;
const AMBIENT_WITH_ENV = 0.5;
const HEMI_WITH_ENV = 0.3;

const GTAO_BLEND = 1.0; // deep enough that the creases actually darken
/* How far past the furniture the AO is allowed to reach. See
   buildComposer: everything outside this box is taken to be unoccluded,
   which on open floor it is. Wide enough that the fade lands well clear
   of the desk's feet and their contact shadows. */
const GTAO_BOX_MARGIN = 8;
const HOVER_RATE = 7; // hover easing, per second
/* Base intensity of the point light spilling off the screen onto its own
   bezel; the loop scales it with the picture brightness. */
const SCREEN_GLOW = 2.1;

/* Capped at 1.5 rather than 2: the scene is shaded through GTAO on a
   full-screen composite, so cost goes with the square of this number,
   and on a 2x display the difference between 1.5 and 2 is not visible
   on matt plastic and a blurred tube. */
const MAX_DPR = 1.5;

/* ==========================================
   LOOKING AROUND

   OrbitControls (three/addons, MIT) on a short leash. The visitor can
   swing the establishing shot a little either way to see round the
   machine, and it eases back to the home isometric pose on its own
   once they stop. The point is to let the room be looked at, not to
   hand the camera over: there is no pan, no wheel zoom, and both
   angles are clamped either side of home rather than being free.

   Three things keep this fitting the rest of the file rather than
   fighting it:

   - **`applyFly(0)` is still the definition of home.** The controls
     are seeded from the pose it produces and the limits are offsets
     from the angles it produced, so moving ELEVATION or AZIMUTH moves
     the leash with them and there is nothing to restate.
   - **The controls own the camera only at `fly.value === 0`.** The
     moment the flight starts they are switched off and `applyFly` has
     the pose back. Everything downstream of the camera — the overlay
     matrix, the spline, the frustum — is untouched.
   - **The input surface is the canvas**, not a new overlay. It is
     `pointer-events: none` for the whole of the rest of the site's
     life so the Win95 chrome stays clickable, and it only takes
     events while `orbit-live` is on the body: before the sign-in,
     with the camera parked at the establishing shot, which is exactly
     the window in which there is no chrome to click. The live login
     on the glass stands aside for the same stretch (see the CSS), so a
     drag that starts over the picture rotates like any other.
   ========================================== */
/* Azimuth, either side of the **monitor's front** — not either side of
   home. The screen looks down the machine's local +Z and the machine is
   turned by FACING, so a camera dead in front of the glass sits at
   azimuth FACING; the leash is that angle ± this.

   Anchoring it to the machine rather than to the camera is what makes
   it asymmetric: home is 37° round from the front, so the swing is
   -127° one way and +53° the other. That is deliberate. The home pose
   is unchanged and is still where the walk home goes — what moved is
   only how far either side of it the visitor may get, and the far side
   of the machine is simply further away than the near one.

   At the clamps themselves the glass is exactly edge-on, which is what
   FACE_MIN below is now actually for. */
const ORBIT_SWING = THREE.MathUtils.degToRad(90);
/* Elevation is still measured off home, and is still asymmetric — but
   the flat end now goes all the way down to **2° above the floor**, so
   the visitor can drop to the desk's own height and look at the screen
   and the drawer fronts square on. Home is 20°, so this is 18° of drop
   against 10° of rise.

   Flatter used to be the expensive direction, and the reason is worth
   keeping — though the perspective camera has changed what it costs.
   Under the orthographic one the frame read `frustum / sin(elevation)`
   of floor depth, about 690 world units on a desktop frame at 2° and
   1060 on a portrait one, against the 70 the establishing shot sees;
   under a perspective one the frame reaches the *horizon* instead, and
   what used to be a very long floor is now a fade into the backdrop
   that the fog was already doing. Of the three things that had to grow
   for the flat view, two are now belt-and-braces and the third has
   reversed:

   - **FLOOR_SIZE** (see src/floor.js) — 1700, so the plane's own edge
     is off-frame at the flattest view on the deepest viewport, with the
     fog dissolving its far reaches into the background either way.
   - **The camera's near plane**, which is *positive again*. Under the
     orthographic camera the view volume was a box and the bottom of
     the frame at 2° was ground *behind* the eye — 270 units of it on a
     portrait viewport — which a positive near plane clipped away. A
     perspective frustum is a pyramid in front of the eye: the bottom
     edge of the flat frame is now floor about 40 units ahead, and
     there is no ground behind the camera in shot anywhere on the
     leash. See `buildCamera`.
   - **The camera's far plane**, which still reaches the far edge of
     the plane rather than the old 160-unit one — though everything
     past the fog's far end is already the background colour, so it is
     the fog and not this that decides where the ground stops.

   The key light's shadow box did *not* need to grow, which is not
   obvious: a shadow map lives in the light's space, and the light has
   not moved. See the measurement where the box is set up. */
const ORBIT_DOWN = THREE.MathUtils.degToRad(18); // flatter than home
const ORBIT_UP = THREE.MathUtils.degToRad(10); // steeper than home
/* Weighted rather than sticky: the drag keeps gliding for a few frames
   after the pointer stops. */
const ORBIT_DAMPING = 0.075;
/* Under 1 so the swing is not twitchy. OrbitControls scales a drag by
   viewport *height*, so at 0.55 the full 180° takes about 0.57 of the
   frame's height dragged sideways — half the width of a 16:9 desktop
   frame, a comfortable single gesture. At the library default it is
   half that, which on a leash this wide is a flick straight into the
   clamp. */
const ORBIT_SPEED = 0.55;

/* Quiet before the camera takes itself home, and how long that takes. */
const IDLE_MS = 3000;
const RETURN_S = 1.1;
const RETURN_EASE = "power2.inOut";
/* Walking home as the first half of a click — brisker than the idle
   return, because there is a flight waiting behind it. */
const RETURN_FAST_S = 0.45;
/* How far off home still counts as home, so a stray pixel of drag does
   not schedule a tween with nothing to do. */
const ORBIT_EPS = THREE.MathUtils.degToRad(0.2);

/* A press is a click if the pointer stayed inside this many CSS px of
   where it went down; past that it was a drag, and the camera has
   already moved in answer to it. */
const CLICK_SLOP = 5;
/* Quiet after the last orbit change before the camera counts as at
   rest again — see `cameraMoving`. Two or three frames: long enough to
   cover the gaps between damping updates, short enough that the CRT
   variables resolve exactly the moment the glide ends. */
const ORBIT_SETTLE_MS = 120;

/* Where the flight starts from when the visitor has swung the camera
   off home. "current" refits the spline's first knot to wherever they
   left it, so the flight begins on the click; "home" walks the camera
   back first and then runs the art-directed arc untouched. Switchable
   at runtime through window.__flyFrom for comparing the two. */
const FLY_FROM = "current";

/* Below this much of the screen's own normal pointing at the camera,
   the live HTML comes off the glass. Two reasons, and the leash above
   reaches both:

   - **Past 90° the plane is seen from behind**, and a back-facing plane
     projects to a *mirrored* quad: the matrix would fold the login
     inside out rather than hide it.
   - **Well before that it stops being a picture.** cos(80°) is 0.17, so
     at this threshold the glass is drawn about a fifth of its square-on
     width — a 240px panel down to 40 — and the box behind it is still
     1200px being blurred and gradient-filled to produce that sliver.
     The 3D texture underneath carries the same tube at the same angle,
     and at a sliver's width the two are indistinguishable.

   It is the angle off the glass's own normal, so elevation counts
   toward it as well as azimuth — at the +10° rise the azimuth cutoff
   comes in a degree or so earlier, which is correct. Under the
   perspective camera it is measured against the line of sight *to the
   glass* rather than the camera's axis; see `screenFacing`. */
const FACE_MIN = 0.17; // ~80° off the normal

/* ==========================================
   FLYING INTO THE SCREEN

   One parameter, `fly.value`: 0 is the isometric establishing shot, 1
   is the screen filling the viewport. `applyFly` derives the whole
   pose — position, look-at target and frustum — from it, so a resize
   mid-flight re-derives the framing instead of losing it, and
   `applyFly(0)` reproduces the original isometric shot exactly. That
   is still the only definition of it.

   What drives that parameter is a single paused GSAP timeline, built
   once by `buildFlyTimeline`. Playing it flies in; `reverse()` flies
   out along the identical eased curve, which is what makes the back
   animation the exact reverse rather than a second implementation of
   the same move.

   Position and target follow a CatmullRomCurve3 through four poses
   instead of the old two-phase turn-then-zoom blend. The phases used
   to overlap by a tenth of the run to disguise their hand-over; a
   single C1-continuous spline has no hand-over to disguise. The knots
   are *sampled off the old two-phase path*, so the arc it was
   art-directed into — the swing round to head-on after
   design-references/crt-computer.png, then the push-in — is preserved
   rather than re-invented.

   The frustum rides the same spline, in log space, and under the
   perspective camera it drives the *radius* — the frustum height is
   still how a framing is specified, and `distFor` turns it into a
   distance. Log space is what keeps the push-in even: the arrival is an
   eighth of the establishing shot's frustum, so lerping it linearly
   reads as a lurch either way round.
   ========================================== */
const FLY_S = 1.6; // seconds, the whole camera move
/* The canvas-out / page-in crossfade, overlapping the tail of the
   camera move so the arrival settles instead of popping. */
const FADE_S = 0.3;
const FLY_EASE = "power3.inOut";
const FADE_EASE = "power1.inOut";
/* How much the page is scaled down at the start of that crossfade.
   Slight on purpose: enough to read as settling, not as a zoom. */
const FADE_SCALE = 0.015;

/* Where the four spline knots are taken from along the old two-phase
   path. 0 and 1 are the two framings that must land exactly; the middle
   two are the arc's shape — 0.3 is mid-swing and 0.55 is where the turn
   used to finish, head-on and framing the whole monitor. */
const FLY_KNOTS = [0, 0.3, 0.55, 1];
/* Catmull-Rom tension. Below 0.5 the curve slackens into a gentler bow
   through the knots, which is the whole point of using a spline here;
   at 0.5 (the three default) it tracks the old path almost exactly. */
const FLY_TENSION = 0.42;

const TURN_END = 0.55; // of the legacy path: camera is head-on by here
const ZOOM_START = 0.45; // ...and the push-in has already started
/* The head-on framing the turn settles into, as a multiple of the
   monitor's own size — a little room around the case. */
const MONITOR_FRAME = 1.12;

/* The live HTML on the glass is a DOM box of this width, mapped onto
   the screen plane with a CSS matrix. Big enough that the dialog is
   near its natural size once the page fills a desktop viewport, so the
   arrival does not read as a blown-up screenshot. */
const SCREEN_BASE_W = 1200;
/* Mapped inside the picture's black overscan border: the bezel lip
   overhangs the glass by more than the opening's clearance, so at the
   isometric camera it clips a sliver off the left edge of the panel.
   Sitting inside the overscan keeps the overlay clear of it. */
const SCREEN_INNER = 1 - 2 * OVERSCAN;
const SCREEN_BASE_H = (SCREEN_BASE_W * SCREEN_H) / SCREEN_W;

/* Steps the CRT blur and scanline pitch are snapped to while the camera
   is moving — see updateScreenOverlay. Absolute, in the box's own
   pixels, and deliberately coarse: over a flight the blur sweeps about
   0-4.5px and the pitch 8-15px, so these give nine levels and four
   rather than the ~90 distinct values a frame-by-frame value produces. */
const BLUR_STEP = 0.5;
const SCAN_STEP = 2;

let renderer = null;
let canvasEl = null;
let scene = null;
let gtaoPass = null;
let screenEl = null;
/* value: 0 isometric, 1 arrived. dir: -1 / 0 / +1 while moving. */
let fly = { value: 0, dir: 0 };
let camera = null;
let composer = null;
let computer = null;
let desk = null;
let treehouse = null;
let envMap = null;
let hover = { target: 0, value: 0 };
let fillLights = null;
let onPointerMove = null;
let frame = null;
let disposables = [];
let onResize = null;
let onVisibility = null;
let onScreenInput = null;
/* Last value written to --scene-fade, so a repeat is not rewritten. */
let sceneFade = -1;

/* --- Looking around ------------------------------------- */
let controls = null;
/* The pose applyFly(0) produced, in the controls' own terms. Filled in
   by initOrbit; the leash and the walk home are both expressed against
   it, so nothing here restates ELEVATION or AZIMUTH. */
/* radius is filled in by initOrbit from the pose applyFly(0) produced.
   There is no constant to seed it with any more: under perspective the
   distance is derived from the framing, so it differs between the two
   viewports and moves with the FOV. */
const orbitHome = { theta: 0, phi: 0, radius: 0 };
const orbitSpherical = new THREE.Spherical();
let orbitTween = null; // the walk home, while one is running
let orbitDragging = false;
/* performance.now() of the last release; 0 once the timer has fired or
   while there is nothing to time. */
let orbitIdleAt = 0;
let orbitChangedAt = -Infinity;
let orbitDirty = false; // the camera moved and the overlay has not caught up
let onCanvasDown = null;
let onCanvasUp = null;
let onCanvasCancel = null;
/* The press being tracked for the click-or-drag decision. */
let press = { id: -1, x: 0, y: 0, hit: false };
let flyFrom = FLY_FROM;
/* Which pose the spline's first knot sits at. Null is the isometric
   establishing shot — the definition of home. A pair of orbit angles
   when the flight started from somewhere the visitor had swung the
   camera to; only the position on the sphere differs there, so a resize
   mid-flight still re-derives the target and the frustum from the
   viewport rather than carrying a stale copy of them. */
let flyStart = null;
/* The two reasons the live HTML comes off the glass, kept apart so
   neither can clear the other's hiding — see syncScreenVisibility. */
let stillHidden = false;
let screenAway = false;
let screenHidden = ""; // last value written to the overlay's visibility
/* Dev-only stats.js panel; null in a production build — see src/perf.js. */
let perf = null;

/* WebGL may be absent (old browser, blocklisted driver, or _review.mjs
   stubbing getContext). Caller falls back to the plain CSS desktop. */
function supportsWebGL() {
  try {
    const probe = document.createElement("canvas");
    return !!(probe.getContext("webgl2") || probe.getContext("webgl"));
  } catch {
    return false;
  }
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function isMobile() {
  return window.innerWidth < MOBILE_BP;
}

/* How much wider than the authored framing the establishing shot is
   taken. 1 is FRUSTUM / FRUSTUM_MOBILE exactly; above that the camera
   stands further back and the furniture keeps the same share of the
   frame on both viewports, so the extra view is margin around the
   desk rather than a recentring. `window.__zoom(f)` switches it on a
   live page — see setHomeZoom. */
let homeZoom = HOME_ZOOM;

function frustumFor() {
  return (isMobile() ? FRUSTUM_MOBILE : FRUSTUM) * homeZoom;
}

/* The establishing shot's distance — whatever frames the home frustum
   on this viewport at the current FOV. It is also the orbit's radius,
   and what the fog's range is offset from.

   Note it is viewport-dependent, which the orthographic CAM_DIST was
   not: a portrait frame wants FRUSTUM_MOBILE, so the camera stands
   half again as far back there. */
function camDist() {
  return distFor(frustumFor());
}

/* What the floor needs to know about the frame it is being seen in.
   The two foreshortening factors are the camera's, not the floor's, so
   they are handed over rather than recomputed there — which is what
   keeps src/floor.js free of any knowledge of the camera. */
function floorView(width, height) {
  return {
    frustum: frustumFor(),
    aspect: width / height,
    projX: PROJ_X,
    projZ: PROJ_Z,
    mobile: isMobile(),
  };
}

function buildScene() {
  const s = new THREE.Scene();
  s.background = new THREE.Color(CREAM);
  /* The floor's own fade-out, in the floor's own colour — which is also
     the background's, so the plane dissolves into the backdrop instead
     of ending at an edge. With this and FLOOR_SIZE together there is no
     floor edge and no horizon line anywhere on the orbit leash. */
  s.fog = buildFog(camDist());

  s.add(buildFloor(renderer.capabilities.getMaxAnisotropy()));

  /* The desk, and the machine standing on it. The computer is built in
     its own local space with the origin on *its* ground plane, so the
     whole group simply rises by the height of the desk top — including
     the contact-shadow blobs under the stand, the keyboard and the
     mouse, which then land on the wood rather than on the floor. */
  desk = buildDesk();
  desk.root.name = "desk";
  s.add(desk.root);

  computer = buildComputer();
  computer.root.name = "computer";
  computer.root.position.set(0, DESK_TOP_Y, COMPUTER_Z);
  s.add(computer.root);

  /* The treehouse, likewise built with its origin on the surface it
     stands on, so it only has to be lifted by the desk's height. */
  treehouse = buildTreehouse();
  treehouse.root.name = "treehouse";
  treehouse.root.position.set(TREEHOUSE_X, DESK_TOP_Y, TREEHOUSE_Z);
  treehouse.root.rotation.y = TREEHOUSE_FACING;
  /* Its falling petals are the only moving thing in the room, and the
     only thing stepping them is the render loop below — which reduced
     motion never starts. Hidden here rather than at that early return,
     so the one static frame is drawn without them instead of being
     drawn with them and then redrawn. */
  treehouse.drift.group.visible = !prefersReducedMotion();
  s.add(treehouse.root);

  /* One low directional light — the shallow angle is what stretches the
     shadow out long and diagonal across the letters.
     Intensities look ~3x high because three's physical lighting divides
     them by PI; tuned so lit cream lands on CREAM and the shadow sits at
     ~0.72 of it, matching the reference. */
  const key = new THREE.DirectionalLight(0xfffaf2, 4.4);
  key.position.set(-30, 8, 14); // ~13° above the floor, raking from upper left
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = 3; // VSM blur width
  key.shadow.blurSamples = 16;
  key.shadow.bias = 0; // VSM wants no depth bias
  key.shadow.normalBias = 0.02;
  /* The box has to bound the caster set **and the shadow it throws**,
     and the measurement is worth writing down because the number this
     was first set against was the wrong one.

     The box is in the *light's* space, and the light never moves. So
     dropping the camera to 2° does not reach for its edges, however
     much more floor comes into frame: what the box has to cover is the
     desk, the machine, and where they land on the ground along the
     light direction — nothing camera-dependent at all. Measured against
     the two world boxes, that union occupies **±9.7 of light-space
     lateral and 21 to 123 of light-space depth**. At ±80 / 1..220 the
     box already clears it by about 8x laterally, so the flat view did
     not need it widened, and widening it anyway is not free: it spreads
     the same 2048² map over more ground, and the drawer-front contacts
     are already at the resolution where a 0.03-unit step was enough to
     produce acne (see desk.js).

     Outside the box three's shadow lookup returns "lit" rather than
     clamping the map's border, so the far reaches of the 1700-unit
     plane simply have no shadow — which is correct, because no shadow
     reaches them. There is no edge to see. */
  const cam = key.shadow.camera;
  cam.left = -80;
  cam.right = 80;
  cam.top = 80;
  cam.bottom = -80;
  cam.near = 1;
  cam.far = 220;
  cam.updateProjectionMatrix();
  s.add(key, key.target);

  /* Soft fill — keeps the shadowed cream warm rather than grey, while
     staying low enough that the shadow reads as a distinct wedge. */
  const ambient = new THREE.AmbientLight(0xffffff, 1.5);
  const hemi = new THREE.HemisphereLight(0xfcfcfd, 0xc6c8cc, 0.76);
  s.add(ambient, hemi);
  fillLights = { ambient, hemi };

  return s;
}

/* ==========================================
   CAMERA

   The key framings are still specified as an orbit — a point to look
   at, an azimuth, an elevation and a frustum height — rather than as
   hard-coded positions, which is what lets the isometric shot and the
   head-on close-up be the same four numbers at two values of a single
   parameter. `samplePose` below is where that lives.

   The camera does not *travel* on an orbit, though: the flight
   interpolates a spline fitted through those poses. See applyFly.

   Under the perspective camera the frustum height in that quadruple is
   what sets the *distance* rather than the projection — see `distFor`
   above — so a "pose" is still four numbers and still means the same
   framing. What changed is that the four knots no longer sit at one
   radius: the orthographic path was a constant-radius arc with the
   zoom carried separately, and the zoom is now the radius.
   ========================================== */
/* The projection is only the FOV and the aspect now. The zoom is not
   in here any more — it is the camera's distance, which applyFly sets —
   so this no longer takes a frustum height. Where a framing still has
   to become a pose it goes through `distFor`. */
function applyCameraSize(cam, width, height) {
  cam.aspect = width / height;
  cam.fov = fov;
  cam.updateProjectionMatrix();
}

/* The establishing shot's pivot — and the orbit's. It sits at the
   middle of the desk in plan and a little over a third of the way up
   the assembly, which is what centres desk-plus-machine in the frame;
   at the old (0,0,0) the whole thing now sat in the top half of it with
   bare floor underneath. */
const ISO_TARGET = new THREE.Vector3(0, 7.05, 0);
/* The whole monitor, square to the camera — the turn's resting place.
   MON_Y is in the machine's own space, which now starts at the desk
   top, and COMPUTER_Z is where the machine was set down on it. */
const MONITOR_TARGET = new THREE.Vector3(0, DESK_TOP_Y + MON_Y, COMPUTER_Z);
/* Filled in from the screen mesh once the machine is built. */
const SCREEN_TARGET = new THREE.Vector3();
const flyTarget = new THREE.Vector3();
/* The frustum applyFly last worked out, so the arrival log reports what
   the camera actually did rather than restating the constants. There are
   no angles to report any more — the camera rides a spline, not an
   orbit. */
const flyPose = { frustum: FRUSTUM, dist: 0 };

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
/* The cubic the legacy two-phase path was shaped with. Only the knot
   sampling uses it now; the run itself is eased by GSAP's power3.inOut,
   which is the same curve. */
const easeInOut = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const lerp = THREE.MathUtils.lerp;

/* Frustum height that frames the whole monitor head-on. */
function monitorFrustum(aspect) {
  return Math.max(MON_H * MONITOR_FRAME, (MON_W * MONITOR_FRAME) / aspect);
}

/* ...and the one at which the picture covers the viewport. `min`, not
   `max`: the screen is 4:3-ish and the viewport rarely is, so covering
   means cropping the other axis rather than letterboxing it.

   Both of these are unchanged by the perspective camera, and that is
   the point of specifying framings as frustum heights: the relationship
   between a height at the target, the aspect and what fills the frame
   is the same for either projection. Only the step from a height to a
   camera position is new. */
function screenFrustum(aspect) {
  return Math.min(
    SCREEN_H * SCREEN_INNER,
    (SCREEN_W * SCREEN_INNER) / aspect,
  );
}

/* The two-phase turn-then-zoom path the fly-in used to run on. It is no
   longer what the camera follows — it is sampled at FLY_KNOTS to build
   the spline that replaced it, which is how the arc that was
   art-directed here survives the rebuild.

   The position is no longer aspect-independent, and that is the one
   thing the perspective camera changed in here. The frustum is worked
   out first and the distance comes off it, because under perspective
   the zoom *is* the radius: where the orthographic path was a
   constant-radius arc around a moving target with the zoom carried
   separately, this one spirals in. The angles and the target are
   untouched, so the arc the knots describe is still the one that was
   art-directed here — only its radius profile is new, and it has to
   be. */
const legacyPose = { position: new THREE.Vector3(), target: new THREE.Vector3(), frustum: 0 };

function samplePose(p, aspect) {
  const turn = easeInOut(clamp01(p / TURN_END));
  const zoom = easeInOut(clamp01((p - ZOOM_START) / (1 - ZOOM_START)));

  legacyPose.target.lerpVectors(ISO_TARGET, MONITOR_TARGET, turn);
  legacyPose.target.lerp(SCREEN_TARGET, zoom);
  const azimuth = AZIMUTH * (1 - turn);
  const elevation = ELEVATION * (1 - turn);
  legacyPose.frustum = Math.exp(
    lerp(
      lerp(Math.log(frustumFor()), Math.log(monitorFrustum(aspect)), turn),
      Math.log(screenFrustum(aspect)),
      zoom,
    ),
  );
  const dist = distFor(legacyPose.frustum);
  legacyPose.position.set(
    legacyPose.target.x + dist * Math.cos(elevation) * Math.sin(azimuth),
    legacyPose.target.y + dist * Math.sin(elevation),
    legacyPose.target.z + dist * Math.cos(elevation) * Math.cos(azimuth),
  );
  return legacyPose;
}

/* The spline the camera actually flies. Three curves sharing one
   uniform parameterisation, so position, target and zoom stay locked to
   each other at every point of the run — sampling them at the same u is
   what makes them move "together" rather than as three tweens that
   happen to have the same duration.

   The frustum is a curve too, carrying log(height) in x: reusing
   three's Catmull-Rom for it guarantees it is parameterised identically
   to the other two, where a separate scalar easing would drift. Under
   the perspective camera it is no longer read as a projection — see
   applyFly, which takes the *direction* from the position curve and the
   *radius* from this one.

   Rebuilt on resize, because the frustum knots depend on the aspect —
   and so, now, do the position knots. */
let flyPath = null;

function buildFlyPath(width, height) {
  const aspect = width / height;
  const positions = [];
  const targets = [];
  const frustums = [];
  for (const k of FLY_KNOTS) {
    const pose = samplePose(k, aspect);
    positions.push(pose.position.clone());
    targets.push(pose.target.clone());
    frustums.push(new THREE.Vector3(Math.log(pose.frustum), 0, 0));
  }
  /* The flight may have been started from an orbited pose rather than
     from home. Only the camera's place on the sphere differs there —
     pan is off, so the target is still ISO_TARGET, and the frustum is
     still the establishing shot's — so this is the one knot that
     moves, and the rest of the curve (and every resize) is unchanged. */
  if (flyStart) {
    orbitSpherical.set(orbitHome.radius, flyStart.phi, flyStart.theta);
    positions[0].setFromSpherical(orbitSpherical).add(targets[0]);
  }
  const curve = (pts) =>
    new THREE.CatmullRomCurve3(pts, false, "catmullrom", FLY_TENSION);
  flyPath = {
    position: curve(positions),
    target: curve(targets),
    frustum: curve(frustums),
    /* The endpoints have to land exactly whatever the spline does, and
       the zoom must not overshoot — a frustum that dips below the final
       height and comes back reads as a bounce. */
    fMin: Math.min(frustums[0].x, frustums[3].x),
    fMax: Math.max(frustums[0].x, frustums[3].x),
  };
}

const flyPoint = new THREE.Vector3();
/* The camera's offset from the target, and a throwaway for reading the
   log-frustum curve — which used to borrow flyPoint, back when the
   position it held had already been copied into the camera by then. */
const flyOffset = new THREE.Vector3();
const flyScratch = new THREE.Vector3();

/* The single source of truth for where the camera is. Linear in p — the
   easing lives on the GSAP timeline, so `__flyTo(0.5)` is the
   geometric middle of the move rather than the temporal one.
   p = 0 reproduces buildCamera's original isometric pose exactly. */
function applyFly(p, width, height) {
  if (!flyPath) buildFlyPath(width, height);
  const u = clamp01(p);

  flyPath.position.getPoint(u, flyPoint);
  flyPath.target.getPoint(u, flyTarget);

  const f = Math.exp(
    THREE.MathUtils.clamp(
      flyPath.frustum.getPoint(u, flyScratch).x,
      flyPath.fMin,
      flyPath.fMax,
    ),
  );
  /* **Direction off the position spline, radius off the zoom curve.**
     The split is what keeps both halves of the art direction intact
     under perspective. The spline still decides where the camera
     swings to — its angular path through the knots is the one that was
     art-directed — while the clamped log-space curve still decides how
     close it is, which is now the same statement as how big the
     picture is. Left to the spline alone, a radius that dipped past
     the arrival and came back would read as exactly the bounce that
     clamp exists to prevent.

     The two agree exactly at both endpoints, because each knot's
     position was placed at distFor(its own frustum) — so the
     establishing shot and the arrival are still the framings they were
     specified as, and applyFly(0) is still the only definition of
     home. */
  const dist = distFor(f);
  flyOffset.copy(flyPoint).sub(flyTarget);
  const len = flyOffset.length() || 1;
  camera.position.copy(flyTarget).addScaledVector(flyOffset, dist / len);
  camera.lookAt(flyTarget);
  camera.updateMatrixWorld();

  applyCameraSize(camera, width, height);
  flyPose.frustum = f;
  flyPose.dist = dist;

  /* GTAO's radius is in world units, tuned against the isometric
     framing. Six times closer in it is no longer sampling creases, so
     it fades out rather than blotching the bezel. */
  if (gtaoPass) gtaoPass.blendIntensity = GTAO_BLEND * (1 - clamp01(p / 0.3));
  return f;
}

/* Position, orientation and aspect all come from applyFly; the clip
   planes are set here and only move with the FOV.

   **`near` is positive again**, and the note it replaces is worth
   keeping in mind because it was the subtlest thing about the
   orthographic camera. There the view volume was a box and `near` was
   just where its front face sat along the view axis, so nothing stopped
   it being *behind* the eye — and at the flat end of the leash it had
   to be, because the bottom of the frame was 270 units of floor behind
   the camera. A perspective frustum is a pyramid in front of the eye.
   There is no ground behind the camera in shot at any point of the
   leash, and the flat view's bottom edge is floor about 40 units ahead.

   What `near` has to clear instead is the closest the camera ever gets
   to anything, which is the arrival: distFor(screenFrustum) is ~6.7
   units in front of the glass at a 25° FOV and ~11 at 15°, so half a
   unit is a wide margin. `far` reaches the far edge of the floor plane
   from the furthest the camera ever stands — a portrait viewport at the
   narrowest FOV worth shooting.

   Depth is distributed hyperbolically now rather than linearly, so the
   figure that matters is `near` and not the span: at 0.5 against a
   ~1090 far, precision at the establishing shot's ~70 units is ~6e-4 of
   a world unit, which is nothing against GTAO's 1.15-unit radius. The
   floor is a lone plane with nothing coplanar to fight, so the ~0.09 of
   a unit out at its far edge costs nothing either. */
const CAM_NEAR = 0.5;

/* Derived from the live FOV, because the distance is: at 20° the
   deepest viewport stands 105 units out and at 15° it is 140, and
   `window.__fov` can move it either way. Re-asserted by `setFov` for
   that reason. */
function camFar() {
  return FLOOR_SIZE / 2 + distFor(FRUSTUM_MOBILE * homeZoom) + 100;
}

function buildCamera() {
  return new THREE.PerspectiveCamera(fov, 1, CAM_NEAR, camFar());
}

/* ==========================================
   LOOKING AROUND — the implementation

   See the constants above for what this is and why it is shaped this
   way. The short version: OrbitControls own the camera at
   `fly.value === 0` and nowhere else.
   ========================================== */

/* The controls are the camera's owner only at the establishing shot,
   and only while the login is still what the visitor is looking at.
   Both halves matter: the flight disables them on its way in, and
   signing out leaves the camera parked at the screen until the back
   button flies it out. */
function orbitAllowed() {
  return (
    !!controls &&
    controls.enabled &&
    fly.value === 0 &&
    !document.body.classList.contains("signed-in")
  );
}

/* True while the camera is in motion for any reason: the flight, a
   drag, the damping glide after one, or the walk home.
   updateScreenOverlay snaps the two expensive CRT variables while it
   is — the cost is a raster per distinct value, and an orbit changes
   the screen's on-screen scale just as a flight does. */
function cameraMoving() {
  return (
    fly.dir !== 0 ||
    orbitDragging ||
    !!orbitTween ||
    performance.now() - orbitChangedAt < ORBIT_SETTLE_MS
  );
}

/* Poses the camera from a pair of orbit angles around the controls'
   target. The radius never changes, and under perspective that is
   load-bearing rather than incidental: the distance *is* the framing
   now, so holding it fixed is what makes the leash a rotation instead
   of a rotation plus a zoom. (Under the orthographic camera the
   distance along the view axis made no difference to the picture at
   all, which is why `enableZoom = false` used to be a matter of taste.)
   camera.up is +Y and the controls are not re-basing it, so a plain
   spherical is exactly what OrbitControls would compute. */
function setOrbitAngles(theta, phi) {
  orbitSpherical.set(orbitHome.radius, phi, theta);
  camera.position.setFromSpherical(orbitSpherical).add(controls.target);
  camera.lookAt(controls.target);
  camera.updateMatrixWorld();
  orbitDirty = true;
}

function orbitOffHome() {
  if (!controls) return false;
  return (
    Math.abs(controls.getAzimuthalAngle() - orbitHome.theta) > ORBIT_EPS ||
    Math.abs(controls.getPolarAngle() - orbitHome.phi) > ORBIT_EPS
  );
}

function killReturn() {
  orbitTween?.kill();
  orbitTween = null;
}

/* Finishes the damping glide now rather than over the next frames. One
   undamped update() applies what is left of the flick and clears it,
   which is what OrbitControls' own damping would have arrived at
   anyway — just not spread out.

   Anything that *takes* the camera somewhere has to do this first, or
   the residue keeps being applied underneath and the move lands short
   of where it was aimed. On a machine holding 60fps the residue three
   seconds after a release is ~1e-10 and this is a no-op; it only shows
   on a renderer slow enough that the glide has barely been spent. */
function spendGlide() {
  const damped = controls.enableDamping;
  controls.enableDamping = false;
  controls.update();
  controls.enableDamping = damped;
}

/* The walk home. Eased with a definite end rather than an exponential
   approach, so the camera is demonstrably back at applyFly(0) instead
   of asymptotically near it — which matters, because that pose is what
   the fly-in's first knot is measured from.

   It writes the camera directly and `controls.update()` stands down for
   the duration (see tickOrbit): update() derives its angles from the
   camera position every call, so there is nothing to keep in sync and
   nothing to fight. The next drag kills it — see the `start` handler. */
function returnHome(duration = RETURN_S, onDone = null) {
  killReturn();
  /* `from` is read *after* this, so the tween starts from the pose the
     glide actually leaves rather than jumping on its first frame. */
  spendGlide();
  const from = {
    theta: controls.getAzimuthalAngle(),
    phi: controls.getPolarAngle(),
  };
  orbitTween = gsap.to(from, {
    theta: orbitHome.theta,
    phi: orbitHome.phi,
    duration,
    ease: RETURN_EASE,
    onUpdate: () => setOrbitAngles(from.theta, from.phi),
    onComplete: () => {
      orbitTween = null;
      setOrbitAngles(orbitHome.theta, orbitHome.phi);
      onDone?.();
    },
  });
}

function setOrbitEnabled(on) {
  if (!controls) return;
  controls.enabled = on;
  document.body.classList.toggle("orbit-live", on);
  if (on) {
    orbitIdleAt = performance.now();
  } else {
    killReturn();
    orbitDragging = false;
    orbitIdleAt = 0;
    press.id = -1;
    if (canvasEl) canvasEl.style.cursor = "";
  }
}

/* Called once a frame from the render loop. Reduced motion has no loop
   — see initScene — so none of this runs there: no damping to advance
   (it is switched off) and, by request, no walk home either. The
   `change` handler covers drawing in that case. */
function tickOrbit(dt) {
  if (!orbitAllowed()) return;
  /* Damping glides on for a few frames after the pointer stops, which
     is the whole of the "weighted" feel; that needs update() every
     frame, not just on input. */
  if (!orbitTween) controls.update(dt);

  if (!orbitDragging && !orbitTween && orbitIdleAt &&
      performance.now() - orbitIdleAt > IDLE_MS) {
    orbitIdleAt = 0;
    if (orbitOffHome()) returnHome();
  }

  if (orbitDirty) {
    orbitDirty = false;
    camera.updateMatrixWorld();
    updateScreenOverlay();
  }
}

/* Is the point under this event on the machine? The whole machine, not
   just the glass: it is the same target hover already highlights, and
   on a phone the monitor alone is a small thing to hit. */
const pickNdc = new THREE.Vector2();
const pickRay = new THREE.Raycaster();

function pickMachine(e) {
  if (!computer || !canvasEl || !camera) return false;
  const r = canvasEl.getBoundingClientRect();
  if (!r.width || !r.height) return false;
  pickNdc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  pickNdc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  pickRay.setFromCamera(pickNdc, camera);
  return pickRay.intersectObject(computer.root, true).length > 0;
}

/* The click-or-rotate decision. A press that travelled more than
   CLICK_SLOP was a drag, and the camera has already answered it by
   turning; only a press that stayed put is a click. Both halves are
   recorded on the way down, because by the time the pointer comes up
   the camera has moved and the raycast would be asking about a
   different frame. */
function initCanvasPress(canvas) {
  onCanvasDown = (e) => {
    press.id = -1;
    if (!orbitAllowed() || !e.isPrimary) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, hit: pickMachine(e) };
  };
  /* OrbitControls captures the pointer on this same element, so the up
     still arrives here however far outside the canvas the drag went. */
  onCanvasUp = (e) => {
    if (e.pointerId !== press.id) return;
    const moved = Math.hypot(e.clientX - press.x, e.clientY - press.y);
    const hit = press.hit;
    press.id = -1;
    if (hit && moved <= CLICK_SLOP && orbitAllowed()) enterScreen();
  };
  onCanvasCancel = () => {
    press.id = -1;
  };
  canvas.addEventListener("pointerdown", onCanvasDown);
  canvas.addEventListener("pointerup", onCanvasUp);
  canvas.addEventListener("pointercancel", onCanvasCancel);
}

/* The way in, from wherever the camera happens to be. */
function enterScreen() {
  if (flyFrom === "home" && orbitOffHome()) {
    /* Off before the walk, so the leash cannot be grabbed again
       half-way through it. */
    setOrbitEnabled(false);
    returnHome(RETURN_FAST_S, flyToScreen);
    return;
  }
  flyToScreen();
}

function initOrbit() {
  controls = new OrbitControls(camera, canvasEl);
  controls.target.copy(ISO_TARGET);
  /* **Resync the controls' own spherical before anything reads it.**
     OrbitControls' constructor ends with an `update()`, and that ran
     with `target` still at its default origin — so the cached spherical
     it left behind is the camera's angles measured about (0,0,0), not
     about ISO_TARGET. `getPolarAngle()` returns that cache rather than
     re-deriving, so without this line `orbitHome.phi` below is seeded
     6° steeper than the pose applyFly(0) actually produced, and then
     the first idle walk home quietly takes the camera *to* that wrong
     pose three seconds after the page loads — carrying the whole
     elevation leash with it.

     It has to happen here and not later: every number in this function
     is read off the controls, and the limits are offsets from them. */
  controls.update();
  controls.enablePan = false;
  /* No wheel zoom: the framing is the fly-in's business, and a
     scrolled-in establishing shot has nothing behind it. Under
     perspective this also pins the radius, which is the same statement
     — see setOrbitAngles. With zoom off OrbitControls returns from the
     wheel handler before it would preventDefault, so the page is left
     to scroll as it likes. */
  controls.enableZoom = false;
  controls.rotateSpeed = ORBIT_SPEED;
  /* Inertia is precisely what a reduced-motion visitor has asked not
     to be given: the camera should stop when their pointer does. They
     keep the rotation — that is theirs to drive — and lose the glide
     and the walk home. With damping off, the controls' own handlers
     call update() themselves, so there is nothing for the render loop
     to do, which is just as well: there isn't one. */
  controls.enableDamping = !prefersReducedMotion();
  controls.dampingFactor = ORBIT_DAMPING;

  /* Home is whatever applyFly(0) just produced, and nothing here moves
     it: it is the opening framing, and it is where the walk home goes.
     The *elevation* leash is still expressed against it, so it follows
     ELEVATION; the azimuth leash is not — see ORBIT_SWING. */
  orbitHome.theta = controls.getAzimuthalAngle();
  orbitHome.phi = controls.getPolarAngle();
  orbitHome.radius = camera.position.distanceTo(controls.target);
  /* Around the machine's front, not around home — see ORBIT_SWING.
     orbitHome.theta sits inside the range rather than in the middle of
     it, which is the whole point. */
  controls.minAzimuthAngle = FACING - ORBIT_SWING;
  controls.maxAzimuthAngle = FACING + ORBIT_SWING;
  controls.minPolarAngle = orbitHome.phi - ORBIT_UP;
  controls.maxPolarAngle = orbitHome.phi + ORBIT_DOWN;

  controls.addEventListener("start", () => {
    orbitDragging = true;
    killReturn();
    orbitIdleAt = 0;
  });
  controls.addEventListener("end", () => {
    orbitDragging = false;
    orbitIdleAt = performance.now();
  });
  controls.addEventListener("change", () => {
    orbitChangedAt = performance.now();
    orbitDirty = true;
    /* The hint has done its job the first time the camera actually
       turns. On `start` rather than here it would also be dismissed by
       a press that turned out to be a click, which is not a visitor
       who has found the gesture. */
    document.body.classList.add("orbit-used");
    /* Reduced motion renders a single frame and keeps no loop, so the
       draw has to happen here or the rotation is invisible. */
    if (!frame) {
      orbitDirty = false;
      camera.updateMatrixWorld();
      updateScreenOverlay();
      render();
    }
  });

  document.getElementById("orbit-hint")?.removeAttribute("hidden");
  setOrbitEnabled(true);
}

/* ==========================================
   RE-FRAMING THE ESTABLISHING SHOT

   Two debug handles share one body. `window.__fov(deg)` switches the
   field of view, which is how the candidate angles got compared
   without three builds (`_persp.mjs`); `window.__zoom(f)` scales the
   home frustum, which is how HOME_ZOOM got picked (`_zoomshots.mjs`).

   The camera comes back to home in both cases. A swing in progress is
   therefore lost, which is the right trade for a debug handle: the
   alternative is reseeding the leash from a pose measured at the old
   radius, and the leash's elevation limits are offsets from home's
   polar angle.
   ========================================== */
function setFov(deg) {
  if (!camera || !canvasEl) return;
  fov = THREE.MathUtils.clamp(Number(deg) || FOV_DEFAULT, 5, 80);
  tanHalfFov = Math.tan(THREE.MathUtils.degToRad(fov) / 2);
  reframeHome();
}

/* Scales the establishing shot's frustum and re-derives everything
   downstream — `window.__zoom(f)`, which is how the candidates for
   HOME_ZOOM get compared on one page rather than one build each. See
   `_zoomshots.mjs`.

   It reaches one thing setFov does not: the floor. The FOV does not
   change `frustumFor()`, so the wordmark's size and row count stay put
   across a setFov; this *is* that number, so the type has to be laid
   out again or it keeps the size it had at the old framing. */
function setHomeZoom(f) {
  if (!camera || !canvasEl) return;
  homeZoom = THREE.MathUtils.clamp(Number(f) || HOME_ZOOM, 0.5, 3);
  reframeHome();
}

/* The shared re-derive. Everything below the FOV and the home frustum
   has to be rebuilt, and the list is longer than it looks because both
   of them set the camera's *distance*: the far plane, the fog (whose
   range is an offset from that distance), every knot of the fly-in
   spline, the floor's type, and the orbit's radius and home pose. */
function reframeHome() {
  const width = canvasEl.clientWidth;
  const height = canvasEl.clientHeight;
  camera.near = CAM_NEAR;
  camera.far = camFar();
  setFogRange(scene.fog, camDist());
  /* The stored start pose was a pair of angles at the old radius, and
     the path is about to be rebuilt from home anyway. */
  flyStart = null;
  buildFlyPath(width, height);
  applyFly(fly.value, width, height);

  if (controls) {
    killReturn();
    orbitIdleAt = 0;
    controls.target.copy(ISO_TARGET);
    /* Same resync initOrbit needs, and for the same reason: the cached
       spherical still describes wherever the camera was before
       applyFly re-posed it. Here the clamps have to come off to do it,
       because `update()` applies them and the ones in force are the
       stale pair about to be replaced — left in place they drag the
       camera to the edge of the *old* leash and that becomes the new
       home. */
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI;
    spendGlide();
    orbitHome.theta = controls.getAzimuthalAngle();
    orbitHome.phi = controls.getPolarAngle();
    orbitHome.radius = camera.position.distanceTo(controls.target);
    controls.minPolarAngle = orbitHome.phi - ORBIT_UP;
    controls.maxPolarAngle = orbitHome.phi + ORBIT_DOWN;
  }
  fitFloor(floorView(width, height));
  updateScreenOverlay();
  render();
}

/* ==========================================
   THE LIVE PAGE ON THE GLASS

   #screen is a DOM box that gets laid onto the screen plane with a CSS
   transform every frame. The camera is a pinhole, so the image of that
   plane is a **homography**: the quad keystones, and the three
   projected corners that used to determine the transform exactly no
   longer do. All four are projected and the 3x3 that maps the box onto
   them is solved in closed form, then written as a `matrix3d` carrying
   the perspective row.

   It still collapses to the old affine matrix wherever the quad is a
   parallelogram, and `quadTransform` takes that branch deliberately
   rather than letting the w row sit at floating-point noise — because
   the arrival is exactly that case. Head-on and centred is the one
   framing where the perspective camera and the orthographic one agree,
   so the transform at rest on the login is the same string this wrote
   before, down to the digits.
   ========================================== */
const screenCorner = new THREE.Vector3();
const cornerView = new THREE.Vector3();
/* Four corners now, not three: top-left, top-right, bottom-right,
   bottom-left, which is the winding `quadTransform` expects. */
const QUAD = [
  [0, 0],
  [0, 0],
  [0, 0],
  [0, 0],
];

/* Projects a corner of the screen plane into CSS pixels. False if it is
   not in front of the eye: `project()` divides by w, and a corner at or
   behind the camera comes back as a large finite number rather than as
   an error — which would be a transform, just not a sane one. Nothing
   on the leash puts the glass that close (the camera is never nearer
   than distFor(screenFrustum), and FACE_MIN has stood the overlay down
   long before the plane could reach the eye), but the check is two
   lines and the failure mode is a login smeared across the viewport. */
function projectCorner(x, y, width, height, out) {
  screenCorner.set(x, y, 0).applyMatrix4(computer.screen.matrixWorld);
  /* View-space depth, before the projection divides by it. */
  cornerView.copy(screenCorner).applyMatrix4(camera.matrixWorldInverse);
  if (-cornerView.z <= camera.near) return false;
  screenCorner.project(camera);
  out[0] = (screenCorner.x * 0.5 + 0.5) * width;
  out[1] = (-screenCorner.y * 0.5 + 0.5) * height;
  return true;
}

/* How squarely the glass is turned toward the camera: 1 head-on, 0
   edge-on, negative seen from behind.

   This is the line of sight *to the glass* — the camera's position
   against the screen's own centre. Under the orthographic camera it was
   the camera's view direction instead, and had to be: every point of an
   orthographic frame is viewed along the same axis, so the position
   vector would have been the wrong question. With a pinhole the two
   differ by up to half the FOV, and it is the ray that actually reaches
   the glass that decides whether the glass is edge-on. */
const screenNormal = new THREE.Vector3();
const viewDir = new THREE.Vector3();

function screenFacing() {
  screenNormal.set(0, 0, 1).transformDirection(computer.screen.matrixWorld);
  viewDir.copy(SCREEN_TARGET).sub(camera.position).normalize();
  return -screenNormal.dot(viewDir);
}

/* The 3x3 that maps the overlay box onto the projected quad, as a CSS
   transform. Closed form rather than an 8x8 solve: for a *rectangular*
   source the unknowns separate, which is Heckbert's construction for
   the unit square in "Fundamentals of Texture Mapping and Image
   Warping" — the two in-plane columns are then divided by the box's own
   size to take it from the unit square to pixels.

   CSS matrix3d is column-major and the box is flat in z, so the only
   entries that do anything are the two in-plane columns and the w row:

       x' = a*X + b*Y + e     y' = c*X + d*Y + f     w = g*X + h*Y + 1

   Returns null if the quad has collapsed to a line, which `FACE_MIN`
   reaches first in practice. */
function quadTransform(boxW, boxH) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = QUAD;
  /* How far the quad is from being a parallelogram, in pixels. */
  const sx = x0 - x1 + x2 - x3;
  const sy = y0 - y1 + y2 - y3;
  const span = Math.abs(x1 - x0) + Math.abs(y3 - y0) + 1;

  /* Affine while the keystone is under a hundredth of a pixel across
     the whole box — the head-on framings, the arrival among them. Not
     an optimisation: it is what keeps those writing the exact 2D
     `matrix()` they wrote before the camera changed, rather than one
     with a w row of rounding noise. */
  if (Math.abs(sx) + Math.abs(sy) < span * 1e-5) {
    const a = (x1 - x0) / boxW;
    const c = (y1 - y0) / boxW;
    const b = (x3 - x0) / boxH;
    const d = (y3 - y0) / boxH;
    return `matrix(${a},${c},${b},${d},${x0},${y0})`;
  }

  const dx1 = x1 - x2;
  const dy1 = y1 - y2;
  const dx2 = x3 - x2;
  const dy2 = y3 - y2;
  const den = dx1 * dy2 - dy1 * dx2;
  if (!den) return null;
  const g = (sx * dy2 - dx2 * sy) / den;
  const h = (dx1 * sy - sx * dy1) / den;
  const a = (x1 - x0 + g * x1) / boxW;
  const c = (y1 - y0 + g * y1) / boxW;
  const b = (x3 - x0 + h * x3) / boxH;
  const d = (y3 - y0 + h * y3) / boxH;
  return (
    `matrix3d(${a},${c},0,${g / boxW},` +
    `${b},${d},0,${h / boxH},` +
    `0,0,1,0,` +
    `${x0},${y0},0,1)`
  );
}

/* The live HTML comes off the glass for two unrelated reasons — the
   still has it during a flight, and the geometry can turn it away from
   the camera — so both are tracked and neither clears the other.
   `visibility`, not opacity: an element at opacity 0 is still painted,
   and painting this one is the whole cost worth avoiding. */
function syncScreenVisibility() {
  if (!screenEl) return;
  const v = stillHidden || screenAway ? "hidden" : "";
  if (v === screenHidden) return; // don't invalidate style for a repeat
  screenHidden = v;
  screenEl.style.visibility = v;
}

function updateScreenOverlay() {
  if (!screenEl || !camera || !computer) return;
  const width = canvasEl.clientWidth;
  const height = canvasEl.clientHeight;
  if (!width || !height) return;

  /* Seen from behind, a plane projects to a mirrored quad: the matrix
     below would fold the login inside out rather than hide it. Inside
     the current orbit leash the glass never turns that far — this is
     what keeps widening ORBIT_SWING from being able to break it. */
  screenAway = screenFacing() < FACE_MIN;
  syncScreenVisibility();
  if (screenAway) return;

  const hw = (SCREEN_W * SCREEN_INNER) / 2;
  const hh = (SCREEN_H * SCREEN_INNER) / 2;
  const front =
    projectCorner(-hw, hh, width, height, QUAD[0]) &&
    projectCorner(hw, hh, width, height, QUAD[1]) &&
    projectCorner(hw, -hh, width, height, QUAD[2]) &&
    projectCorner(-hw, -hh, width, height, QUAD[3]);
  const transform = front ? quadTransform(SCREEN_BASE_W, SCREEN_BASE_H) : null;
  if (!transform) {
    /* A corner behind the eye, or a quad collapsed to a line. There is
       no transform to write, so stand the overlay down exactly as the
       edge-on case does and leave the 3D texture showing the tube — it
       carries the same picture at the same angle. */
    screenAway = true;
    syncScreenVisibility();
    return;
  }
  screenEl.style.transform = transform;

  /* Scanline pitch and CRT softness are authored in the box's own
     pixels but want to be constant in *device* pixels, so both are
     divided by however much the transform is currently shrinking it.
     The top edge is what that is measured off — under a homography the
     scale varies across the box, and the top edge is the same proxy the
     affine matrix's first basis vector was.
     Clamped: at the isometric framing the box is five times smaller
     than it draws, and an unclamped pitch would out-run the picture. */
  const scale =
    Math.hypot(QUAD[1][0] - QUAD[0][0], QUAD[1][1] - QUAD[0][1]) /
      SCREEN_BASE_W || 1;
  const set = (k, v) => screenEl.style.setProperty(k, v);
  set("--zoom", fly.value.toFixed(4));

  /* --scan and --blur are the expensive two: they feed a blur filter
     and three repeating gradients, so every distinct value costs a
     fresh raster of the whole box — which by the end of a flight is the
     whole viewport. --zoom only drives opacity on a promoted layer,
     which the compositor does for free, so that one stays per-frame.

     Snapping the other two to a coarse grid while the camera moves
     turns ~90 rasters over a 1.6s flight into about a dozen, and the
     steps are not visible under the motion — the CRT softness is
     fading out across the same window. At rest they resolve exactly,
     which is where stepping *would* show. */
  const snap = (v, step) => Math.round(v / step) * step;
  let scan = Math.max(8, 3 / scale);
  let blur = (0.9 / scale) * (1 - fly.value);
  if (cameraMoving()) {
    scan = snap(scan, SCAN_STEP);
    blur = snap(blur, BLUR_STEP);
  }
  set("--scan", `${scan.toFixed(2)}px`);
  set("--blur", `${blur.toFixed(2)}px`);
}

/* ==========================================
   ENVIRONMENT MAP

   "Studio Small 09" by Sergej Majboroda, Poly Haven, CC0 — downsampled
   to 256x128 (see public/env/LICENSE.txt). It is only ever read through
   PMREM as a blurred reflection, so the small size costs nothing
   visually and saves ~1.4 MB. Loaded after the first frame: the scene
   stands up fine without it, it just looks flatter.
   ========================================== */
async function loadEnvironment() {
  try {
    const url = `${import.meta.env.BASE_URL}env/studio-small-09-256.hdr`;
    const hdr = await new HDRLoader().loadAsync(url);
    const pmrem = new THREE.PMREMGenerator(renderer);
    envMap = pmrem.fromEquirectangular(hdr).texture;
    scene.environment = envMap;
    /* The HDRI is now the ambient source, so the flat fills have to come
       down or the cream blows out and the shadow stops reading. */
    scene.environmentIntensity = ENV_INTENSITY;
    fillLights.ambient.intensity = AMBIENT_WITH_ENV;
    fillLights.hemi.intensity = HEMI_WITH_ENV;
    hdr.dispose();
    pmrem.dispose();
    return true;
  } catch (e) {
    console.warn("env map failed:", e);
    return false; // plain lighting; the scene still reads
  }
}

/* ==========================================
   AMBIENT OCCLUSION

   GTAO through an EffectComposer, desktop only — it is the single most
   expensive thing here and a phone does not need it. OutputPass takes
   over the colour-space conversion the renderer would otherwise do.
   ========================================== */
function buildComposer(width, height) {
  const c = new EffectComposer(renderer);
  c.addPass(new RenderPass(scene, camera));

  const gtao = new GTAOPass(scene, camera, width, height);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = GTAO_BLEND;
  /* **The AO is bounded to the furniture, and the perspective camera is
     why.** GTAO decides occlusion by stepping `radius` world units
     along the screen and asking whether what it lands on is within
     `thickness` of where the surface should be. On a plane seen at a
     grazing angle that test answers yes to the plane itself, so the
     floor shades itself — and a perspective camera at the flat end of
     the leash sees the floor run all the way to a horizon, which an
     orthographic one never did. The result was a band of false
     occlusion across the haze above the desk, ending in a hard line
     where the plane's far edge stopped supplying it: ~10% down against
     a background it is supposed to dissolve into.

     Outside this box the shader takes AO to be 1 over a `radius`-wide
     fade and then stops sampling altogether. That is not a
     compromise — open floor *is* unoccluded, and the AO was only ever
     paying for the creases on the desk and the machine. The box is
     their world bounds plus GTAO_BOX_MARGIN, so the fade lands on bare
     ground well clear of the feet. */
  const clip = new THREE.Box3().setFromObject(desk.root);
  clip.union(new THREE.Box3().setFromObject(computer.root));
  clip.union(new THREE.Box3().setFromObject(treehouse.root));
  clip.expandByScalar(GTAO_BOX_MARGIN);
  gtao.setSceneClipBox(clip);
  gtao.updateGtaoMaterial({
    radius: 1.15, // world units — keep it to creases, not the whole floor
    distanceExponent: 1.4,
    thickness: 1.0,
    scale: 1.15, // deeper than neutral; past ~1.35 the noise shows on the bezel
    samples: 24, // 12 is not enough once the scale is up
  });
  c.addPass(gtao);
  c.addPass(new OutputPass());
  gtaoPass = gtao;
  return c;
}

/* ==========================================
   HOVER, AND THE CURSOR

   One raycast per pointer move, feeding two things: the screen's
   hover brightness, and what the cursor says the canvas will do with
   a press — the machine is a click, the room around it is a drag.

   Tracked on the window rather than the canvas even though the canvas
   now takes events, because it only takes them while `orbit-live` is
   on the body; a move over the chrome has to be able to turn the
   hover off. Events over a window or the taskbar are ignored — those
   are in front of the scene.
   ========================================== */
function initPointer(canvas) {
  onPointerMove = (e) => {
    /* Once the camera is on its way in, the picture is the live page
       rather than the texture, and the hover feedback has nothing left
       to say. */
    if (fly.value > 0 || !orbitAllowed()) {
      hover.target = 0;
      return;
    }
    if (e.target?.closest?.(".window, #taskbar, #start-menu")) {
      hover.target = 0;
      return;
    }
    const on = pickMachine(e);
    hover.target = on ? 1 : 0;
    canvas.style.cursor = orbitDragging ? "grabbing" : on ? "pointer" : "grab";
  };
  window.addEventListener("pointermove", onPointerMove, { passive: true });
}

/* ==========================================
   THE FLY-IN

   Click the glass and the camera leaves the establishing shot, swings
   round to face the screen and pushes in until the page on it has the
   viewport; the canvas then fades out and what is left is ordinary
   HTML, which it was all along. The back button runs the same
   parameter the other way.

   `screen-active` is on the body for the whole trip (the desktop
   chrome stands down), `screen-zooming` only while the camera is
   moving, `screen-focused` once it has arrived.
   ========================================== */
function render() {
  if (composer) composer.render();
  else renderer.render(scene, camera);
}

function setFly(p) {
  fly.value = p;
  applyFly(p, canvasEl.clientWidth, canvasEl.clientHeight);
  updateScreenOverlay();
  /* The 40px strip the taskbar vacates carries the floor colour while
     there is still floor in shot, and the desktop teal once the picture
     has the frame. That hand-over tracks the *zoom*, not the crossfade:
     the floor is out of shot well before the canvas starts to dissolve,
     and mixing on the crossfade instead leaves a visibly lighter band
     under a screen that has already gone teal.

     The hand-over is held until late in the zoom: at the half-way point
     the floor still fills the bottom of the frame, and a strip already
     part-way to teal reads as a light band under it. By p = 0.95 the
     picture covers the canvas edge to edge and the strip has to match
     it. Snapped to 5% so most frames rewrite the same string and cost
     no style invalidation at all. */
  const step = Math.round(clamp01((p - 0.7) / 0.25) * 20) / 20;
  if (step !== sceneFade) {
    sceneFade = step;
    document.body.style.setProperty("--scene-fade", step.toFixed(2));
  }
}

/* Where the camera ends up, so the framing can be tuned by hand. The
   frustum height is still what the arrival is *specified* as; the
   distance beside it is what that works out to at this FOV, and is the
   number the projection actually uses. */
function logArrival() {
  const round = (v) => Math.round(v * 1000) / 1000;
  console.log("[scene] arrived at the screen", {
    position: camera.position.toArray().map(round),
    target: flyTarget.toArray().map(round),
    frustumHeight: round(flyPose.frustum),
    fov,
    dist: round(flyPose.dist),
  });
}

function arrive() {
  fly.dir = 0;
  /* Already off on the way in; this is the reduced-motion jump, which
     gets here without passing through flyToScreen's tween. */
  setOrbitEnabled(false);
  document.body.classList.remove("screen-zooming");
  document.body.classList.add("screen-focused");
  /* Snap both parameters to the endpoint. GSAP lands on it exactly, but
     this is also the path reduced motion and a mid-flight reversal take,
     and the live HTML has to come back to an untransformed page. */
  applyFade(1);
  showStill(false);
  hover.target = 0;
  document.getElementById("login-user")?.focus({ preventScroll: true });
  logArrival();
}

function depart() {
  fly.dir = 0;
  document.body.classList.remove("screen-active", "screen-zooming");
  applyFade(0);
  showStill(false);
  /* The flight out ended on whatever pose it started from, which may
     have been an orbited one. Put the home knot back, so the next
     flight and the next resize are both measured from the establishing
     shot again; the camera itself stays where the flight left it, and
     the idle walk home brings it in. */
  if (flyStart) {
    flyStart = null;
    if (canvasEl) buildFlyPath(canvasEl.clientWidth, canvasEl.clientHeight);
  }
  setOrbitEnabled(true);
  /* The form may have been typed into while it was up, so the bitmap is
     stale for the next flight. */
  stillDirty = true;
  refreshStill();
}

/* ==========================================
   THE CROSSFADE

   The camera arriving and the page taking over used to be sequential:
   the frustum finished, `screen-focused` went on, and *then* a 0.5s CSS
   transition faded the canvas. That gap is the pop. Now it is a tween
   on the same timeline, overlapping the last FADE_S of the move, and
   `fade` carries all three of its parts so they cannot drift:

   - the canvas dissolves (it is still drawing the monitor the page is
     mapped onto, so this is the actual hand-over),
   - the page scales the last FADE_SCALE up to its resting size, so it
     settles into the frame rather than snapping to it,
   - and `--page-fade` crosses the body from the floor grey the taskbar
     strip shows during the flight to the desktop teal behind the login.
   ========================================== */
function applyFade(v) {
  if (canvasEl) canvasEl.style.opacity = `${1 - v}`;
  document.body.style.setProperty("--page-fade", v.toFixed(4));
  if (!screenEl) return;
  screenEl.style.setProperty("--settle", (1 - FADE_SCALE * (1 - v)).toFixed(5));
  /* visibility, not just the opacity the stylesheet derives from
     --page-fade: an element at opacity 0 is still painted, and painting
     this one is the whole cost the still exists to avoid. Hidden for
     the body of the move, revealed for the crossfade.

     Conditioned on the flight actually being in progress, because
     `depart` ends at fade 0 and the overlay has to be clickable again
     at the establishing shot — hiding it unconditionally leaves the
     monitor dead to a second click. `depart` removes the class before
     it calls this, which is what makes the test come out right there. */
  const flying = document.body.classList.contains("screen-active");
  stillHidden = v === 0 && flying;
  syncScreenVisibility();
}

/* ==========================================
   THE STILL

   During the move the glass shows a bitmap of the login rather than the
   live subtree. The live one is only ~40 nodes, so this is not about
   layout — it is about raster. `#screen-page` carries a blur filter and
   `.crt-fx` three gradients, and the matrix rescales the box every
   frame; the compositor cannot reuse a raster across a scale change, so
   the browser re-blurred and re-drew those gradients once per frame
   over an area that by the end of the move is the whole viewport. That
   measured at ~57ms a frame flying out on a phone-sized window. One
   immutable <img> costs a texture upload, once.

   Drawn through an SVG <foreignObject>, which is the only way to get
   the browser's own layout of real HTML into a canvas. Two things it
   needs:

   - every stylesheet inlined, since the SVG renders as an image with no
     access to the parent document or the network. Collected from
     document.styleSheets rather than imported, so it keeps working
     whatever Vite does to the CSS between dev and build.
   - the design tokens copied onto the wrapper as inline custom
     properties. They are declared on `:root`, which inside the SVG is
     the <svg> element rather than the <html> the selector expects.

   Fonts cannot be fetched from inside the image either, so the dialog
   renders in the local fallback of `--font`. It is correct for the
   login, which asks for a UI font and not Playfair.

   Browsers may refuse to draw a foreignObject image into a canvas, and
   some older ones get it wrong rather than refusing. Every failure path
   leaves `stillCanvas` null, and the move then shows the abstract
   desktop picture the glass carries at rest — the login then arrives
   with the crossfade instead of being there throughout. Different,
   still smooth, never broken.
   ========================================== */
let stillCanvas = null;
let stillDirty = true;
let stillPending = false;

function collectStyles() {
  let css = "";
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) css += `${rule.cssText}\n`;
    } catch {
      /* A sheet we are not allowed to read. There are none on this
         origin, but a browser extension can inject one. */
    }
  }
  return css;
}

function collectTokens() {
  const computed = getComputedStyle(document.documentElement);
  let out = "";
  for (const name of computed) {
    if (name.startsWith("--")) out += `${name}:${computed.getPropertyValue(name)};`;
  }
  return out;
}

/* The contents of a <foreignObject> are parsed as XML, and neither half
   of what goes in there is XML-well-formed as authored: the login
   markup has bare void elements (`<input ...>`), and the stylesheets
   carry 98.css's icons as inline `data:` SVG, so the CSS text itself is
   full of raw `<` and `&`. Hand-concatenating the strings produces a
   document the parser rejects outright, and the only symptom is an
   image that never decodes.

   So the subtree is assembled as real DOM and handed to XMLSerializer,
   which closes the void elements and escapes the CSS text for us. */
function buildStillMarkup(w, h) {
  const page = document.getElementById("screen-page");
  if (!page) return null;

  const wrap = document.createElement("div");
  wrap.setAttribute(
    "style",
    `${collectTokens()}` +
      /* #screen-page is inset:0, so it needs a positioned parent — in
         here there is no #screen to resolve against. */
      `position:relative;width:${w}px;height:${h}px;overflow:hidden;` +
      /* The three variables that live on #screen rather than on :root,
         so the copied tokens do not carry them. The bitmap is drawn
         crisp and unscaled; the blur and the settle scale are applied
         to the <img> at display time, where they can keep tracking the
         camera. */
      `--blur:0px;--hover:0;--settle:1`,
  );

  const style = document.createElement("style");
  /* textContent, not innerHTML: the serializer escapes it on the way
     out and the XML parser hands the CSS back verbatim. */
  style.textContent = collectStyles();
  wrap.append(style, page.cloneNode(true));

  /* serializeToString puts the XHTML namespace on the div itself. */
  const inner = new XMLSerializer().serializeToString(wrap);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<foreignObject width="100%" height="100%">${inner}</foreignObject>` +
    `</svg>`
  );
}

async function drawStill() {
  const w = Math.round(SCREEN_BASE_W);
  const h = Math.round(SCREEN_BASE_H);
  try {
    /* Inside the try, all of it: assembling the markup walks every
       stylesheet in the document and runs XMLSerializer over the
       result, and a throw out there would be an unhandled rejection
       rather than the graceful fallback below. */
    const svg = buildStillMarkup(w, h);
    if (!svg) return false;

    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    /* Throws on a tainted canvas, which is the one failure mode that
       would otherwise only surface later as a WebGL security error on
       texture upload. Cheaper to find out here. */
    canvas.toDataURL("image/png");
    stillCanvas = canvas;
    stillDirty = false;
    return true;
  } catch (err) {
    /* Every exit here is survivable — showStill() will not switch the
       class on without a bitmap, and the move runs on the live subtree
       exactly as it used to. Worth knowing about while developing,
       though, because the only other symptom is the old frame rate. */
    if (import.meta.env.DEV) {
      console.warn("[scene] could not rasterise the login still", err);
    }
    stillCanvas = null;
    return false;
  }
}

/* Kept off the click: redrawing takes a few milliseconds, which is a
   visible hitch if it lands on the first frame of the move. Prepared
   once the scene is up and refreshed when the form changes, so by the
   time anyone clicks the bitmap is already decoded. */
function refreshStill() {
  if (stillPending || !stillDirty) return;
  stillPending = true;
  const run = () => {
    stillPending = false;
    drawStill();
  };
  if (window.requestIdleCallback) requestIdleCallback(run, { timeout: 2000 });
  else setTimeout(run, 0);
}

/* The hand-over between the texture and the live subtree. Both show the
   same login at the same place, so the crossfade between them has
   nothing to give away — which is exactly why the canvas can dissolve
   over the last FADE_S without a seam. */
function showStill(on) {
  if (!computer) return;
  if (on) {
    if (stillCanvas) computer.setStill(stillCanvas);
  } else {
    computer.clearStill();
  }
}

/* ==========================================
   THE TIMELINE

   One paused GSAP timeline, built once. `play()` flies in and
   `reverse()` flies out along the identical eased curve — the back
   animation is the forward one run backwards, not a second
   implementation, so it cannot drift out of agreement.

   Both tweens sit on the same proxy object and are read in `onUpdate`,
   rather than GSAP writing camera properties directly. That is
   deliberate: `applyFly` has to stay the only thing that poses the
   camera, because the curved path means position is sampled off a
   spline rather than interpolated between two values, and because a
   resize mid-flight re-derives the framing from `fly.value`. GSAP owns
   the *timing*; `applyFly` owns the *pose*.
   ========================================== */
let flyTl = null;
const flyState = { p: 0, fade: 0 };

function buildFlyTimeline() {
  /* GSAP's default lag smoothing (500ms threshold, counted as 33ms)
     protects the *animation* at the cost of wall-clock time: on a
     machine rendering at 0.5fps it stretched this 1.6s flight to over
     half a minute. The old hand-rolled loop capped each step at 250ms
     instead, on the reasoning that a machine which cannot hold 4fps
     should arrive promptly rather than be made to sit through a long
     flight. Same numbers, same reasoning. */
  gsap.ticker.lagSmoothing(250, 250);

  flyTl = gsap
    .timeline({
      paused: true,
      onComplete: arrive,
      onReverseComplete: depart,
    })
    .to(
      flyState,
      {
        p: 1,
        duration: FLY_S,
        ease: FLY_EASE,
        onUpdate: () => setFly(flyState.p),
      },
      0,
    )
    .to(
      flyState,
      {
        fade: 1,
        duration: FADE_S,
        ease: FADE_EASE,
        onUpdate: () => applyFade(flyState.fade),
      },
      FLY_S - FADE_S,
    );
}

/* Reduced motion gets the destination, not the journey. */
function jumpFly(to) {
  flyTl?.pause();
  flyState.p = to;
  flyState.fade = to;
  setFly(to);
  applyFade(to);
  if (to === 1) {
    document.body.classList.add("screen-active");
    render();
    arrive();
  } else {
    document.body.classList.remove("screen-focused");
    render();
    depart();
  }
}

export function flyToScreen() {
  if (!screenEl || fly.value === 1 || (flyTl && flyTl.isActive() && flyTl.reversed() === false)) return;
  /* The camera is applyFly's again from here to `depart`. */
  setOrbitEnabled(false);
  /* Started from an orbited pose, the curve's first knot moves to it,
     so the flight begins where the visitor left the camera instead of
     snapping home first. In "home" mode enterScreen has already walked
     it back, so there is nothing off home to fit. */
  if (controls && flyFrom === "current" && orbitOffHome()) {
    flyStart = {
      theta: controls.getAzimuthalAngle(),
      phi: controls.getPolarAngle(),
    };
    buildFlyPath(canvasEl.clientWidth, canvasEl.clientHeight);
  }
  document.body.classList.add("screen-active", "screen-zooming");
  if (prefersReducedMotion()) return jumpFly(1);
  showStill(true);
  fly.dir = 1;
  flyTl.play();
}

export function flyFromScreen() {
  if (!screenEl || fly.value === 0 || (flyTl && flyTl.isActive() && flyTl.reversed())) return;
  document.body.classList.remove("screen-focused");
  if (prefersReducedMotion()) return jumpFly(0);
  document.body.classList.add("screen-zooming");
  showStill(true);
  fly.dir = -1;
  flyTl.reverse();
}

function onScreenClick(e) {
  /* Once the page has the viewport the clicks belong to the form. */
  if (fly.value > 0) return;
  e.preventDefault();
  flyToScreen();
}

function initScreenOverlay() {
  screenEl = document.getElementById("screen");
  if (!screenEl) return;
  /* Sized from JS rather than CSS so the box's aspect is exactly
     SCREEN_W / SCREEN_H — offsetHeight rounds to whole pixels, and the
     matrix is derived from these two numbers. */
  screenEl.style.width = `${SCREEN_BASE_W}px`;
  screenEl.style.height = `${SCREEN_BASE_H}px`;
  screenEl.hidden = false;
  screenEl.addEventListener("click", onScreenClick);

  /* Typing in the login invalidates the bitmap, so mark it and redraw in
     idle time rather than on the next click. */
  onScreenInput = () => {
    stillDirty = true;
    refreshStill();
  };
  screenEl.addEventListener("input", onScreenInput);
  refreshStill();

  updateScreenOverlay();
}

/* ==========================================
   LIFECYCLE
   ========================================== */
export async function initScene(canvas) {
  if (!canvas || !supportsWebGL()) return false;

  canvasEl = canvas;
  const { clientWidth: w, clientHeight: h } = canvas;

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_DPR));
  renderer.setSize(w, h, false);
  renderer.shadowMap.enabled = true;
  /* PCFSoftShadowMap was removed in three 0.186 and silently degrades to
     hard PCF. VSM is the remaining soft option. */
  renderer.shadowMap.type = THREE.VSMShadowMap;
  /* Nothing in this scene ever casts a different shadow: the light is
     fixed and the machine does not move (`lift` exists but nothing
     animates it any more — see computer.js). So the map is rendered
     once and then frozen, instead of re-rendering a 2048² VSM depth
     pass with 16 blur samples on every frame of the fly-in.

     `needsUpdate` is set rather than cleared — three renders the map on
     the next frame and clears the flag itself. If anything is ever
     animated back into the scene, this is what has to be reverted. */
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;

  /* The floor's type is drawn with canvas 2D, so the webfont has to be
     resident before the first paint or it silently falls back to
     Georgia. The floor module owns both the load and the measurement. */
  await loadFloorFont();


  scene = buildScene();
  camera = buildCamera();
  /* The machine never moves, so one update pins the screen plane's
     world matrix for the overlay projection and for SCREEN_TARGET. */
  scene.updateMatrixWorld(true);
  computer.screen.getWorldPosition(SCREEN_TARGET);
  applyFly(0, w, h);
  fitFloor(floorView(w, h));
  /* Re-asserted now that the scene (and the key light's shadow camera)
     actually exists. `autoUpdate` is off, so this is the one pass that
     ever renders the map: anything that changes a caster or the shadow
     camera has to set it again. */
  renderer.shadowMap.needsUpdate = true;

  if (!isMobile() && !prefersReducedMotion()) {
    try {
      composer = buildComposer(w, h);
    } catch {
      composer = null; // fall back to a straight render
    }
  }

  /* Handles for the visual-review scripts. `__flyTo` parks the camera
     at a point of the fly-in and draws it, which is how the head-on
     framing gets tuned without trying to catch it mid-animation. */
  window.__scene = scene;
  window.__composer = composer;
  window.__stillReady = () => !!stillCanvas;
  /* Where the furniture lands in the frame, in NDC — ±1 is the edge.
     This is the knob FRUSTUM and ISO_TARGET are set against: "does the
     desk fit" is a question about eight projected corners, not
     something to judge off a screenshot. `_deskfit.mjs` is the pass
     that reads it on both viewports. */
  window.__fit = (...names) => {
    const box = new THREE.Box3();
    for (const n of names.length ? names : ["desk", "computer"]) {
      const o = scene.getObjectByName(n);
      if (o) box.union(new THREE.Box3().setFromObject(o));
    }
    const v = new THREE.Vector3();
    const out = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
    for (const x of [box.min.x, box.max.x])
      for (const y of [box.min.y, box.max.y])
        for (const z of [box.min.z, box.max.z]) {
          v.set(x, y, z).project(camera);
          out.x0 = Math.min(out.x0, v.x);
          out.x1 = Math.max(out.x1, v.x);
          out.y0 = Math.min(out.y0, v.y);
          out.y1 = Math.max(out.y1, v.y);
        }
    return { world: [box.min.toArray(), box.max.toArray()], ndc: out };
  };
  /* Parks or reads the orbit, for the review scripts: no argument
     reports where the camera is and what the leash allows, a pair of
     degrees poses it. The arguments are relative to **home**, so
     __orbit(0, 0) is the opening framing. The report carries azimuth
     in both frames, because the two halves of the leash are expressed
     in different ones — elevation against home, azimuth against the
     monitor's front. */
  window.__orbit = (swing, rise) => {
    if (!controls) return null;
    if (swing !== undefined) {
      /* Park exactly where asked, and *stay* there: kill a walk home in
         progress, spend the glide, and clear the idle timer so the next
         one does not reclaim the camera out from under a screenshot. */
      killReturn();
      orbitIdleAt = 0;
      spendGlide();
      setOrbitAngles(
        THREE.MathUtils.clamp(
          orbitHome.theta + THREE.MathUtils.degToRad(swing),
          controls.minAzimuthAngle,
          controls.maxAzimuthAngle,
        ),
        THREE.MathUtils.clamp(
          orbitHome.phi - THREE.MathUtils.degToRad(rise || 0),
          controls.minPolarAngle,
          controls.maxPolarAngle,
        ),
      );
      controls.update();
      updateScreenOverlay();
      render();
    }
    const deg = THREE.MathUtils.radToDeg;
    const theta = controls.getAzimuthalAngle();
    return {
      swing: deg(theta - orbitHome.theta), // off home
      front: deg(theta - FACING), // off the monitor's front
      rise: deg(orbitHome.phi - controls.getPolarAngle()),
      enabled: controls.enabled,
      facing: screenFacing(),
      limits: {
        front: [
          deg(controls.minAzimuthAngle - FACING),
          deg(controls.maxAzimuthAngle - FACING),
        ],
        swing: [
          deg(controls.minAzimuthAngle - orbitHome.theta),
          deg(controls.maxAzimuthAngle - orbitHome.theta),
        ],
        rise: [-deg(ORBIT_DOWN), deg(ORBIT_UP)],
      },
    };
  };
  /* The camera itself, in the terms the perspective conversion is
     argued in: what the FOV is, how far back that stands the camera,
     and what frustum height it therefore frames at the target. `_persp.mjs`
     prints it beside each shot. */
  window.__cam = () => ({
    kind: `persp ${fov}°`,
    fov,
    near: camera.near,
    far: camera.far,
    dist: camera.position.distanceTo(flyTarget),
    eyeY: camera.position.y,
    frustum: 2 * camera.position.distanceTo(flyTarget) * tanHalfFov,
    homeDist: camDist(),
    homeFrustum: frustumFor(),
    fog: scene.fog ? [scene.fog.near, scene.fog.far] : null,
  });
  /* Switches the field of view and re-derives everything downstream of
     it — see setFov. No argument just reports. */
  window.__fov = (deg) => {
    if (deg !== undefined) setFov(deg);
    return { fov, dist: camDist(), frustum: frustumFor() };
  };
  /* Scales the establishing shot and re-derives everything downstream
     of it — see setHomeZoom. No argument just reports. */
  window.__zoom = (f) => {
    if (f !== undefined) setHomeZoom(f);
    return { zoom: homeZoom, dist: camDist(), frustum: frustumFor() };
  };
  /* "current" starts the flight from wherever the camera has been
     swung to; "home" walks it back first. See FLY_FROM. */
  window.__flyFrom = (mode) => {
    if (mode === "current" || mode === "home") flyFrom = mode;
    return flyFrom;
  };
  /* The flight exactly as a press on the machine starts it — the
     refit of the curve's first knot, or the walk home, included.
     flyToScreen skips both; this is the one the review scripts want. */
  window.__enter = () => enterScreen();
  /* Parks the flight at a point of the *timeline* and draws it. It
     seeks the real timeline rather than posing the camera itself, so
     what it shows is what the flight shows there — the login bitmap on
     the glass, the crossfade, the body classes and all. Seeking with
     events on is what makes the tweens' onUpdate run; the endpoints
     therefore also fire arrive/depart, which is what parking at an
     endpoint means. */
  window.__flyTo = (x) => {
    if (!flyTl) return null;
    const t = clamp01(x);
    flyTl.pause();
    const moving = t > 0 && t < 1;
    document.body.classList.toggle("screen-active", t > 0);
    document.body.classList.toggle("screen-zooming", moving);
    showStill(moving);
    fly.dir = 0; // parked: --scan and --blur resolve exactly
    /* Parked anywhere but the establishing shot, the camera is the
       flight's — same as during a real one, so the hint and the
       canvas's pointer events park with it. (Seeking to 0 fires the
       timeline's onReverseComplete, which hands them back.) */
    setOrbitEnabled(t === 0);
    flyTl.progress(t, false);
    render();
    return {
      position: camera.position.toArray(),
      target: flyTarget.toArray(),
      /* Read back off the pose rather than off the projection: there is
         no camera.top to subtract from any more, and the frustum height
         a perspective camera frames is its distance times the FOV. */
      frustumHeight: 2 * camera.position.distanceTo(flyTarget) * tanHalfFov,
      dist: camera.position.distanceTo(flyTarget),
      fov,
      fade: flyState.fade,
    };
  };

  onResize = () => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_DPR));
    renderer.setSize(width, height, false);
    composer?.setSize(width, height);
    /* The camera's distance is derived from the frustum, which crosses
       the mobile breakpoint — so the fog, whose range is an offset from
       that distance, crosses with it. near/far are plain uniforms; this
       costs no shader recompile. */
    setFogRange(scene.fog, camDist());
    /* The spline's frustum knots are framings, so they move with the
       aspect — and so, under perspective, do its position knots: the
       path has to be rebuilt, not just re-sampled. */
    buildFlyPath(width, height);
    /* Re-derived from fly.value rather than reset, so a resize part-way
       through the fly-in — or while the login page is up — keeps the
       camera where it was. */
    const keep = orbitAllowed()
      ? { theta: controls.getAzimuthalAngle(), phi: controls.getPolarAngle() }
      : null;
    applyFly(fly.value, width, height);
    /* applyFly puts the camera back on the path, which at the
       establishing shot is home — and the visitor may have swung it
       off. A resize is not a reason to take that away. */
    if (keep) setOrbitAngles(keep.theta, keep.phi);
    fitFloor(floorView(width, height));
    updateScreenOverlay();
    if (!frame && fly.value < 1) render();
  };
  window.addEventListener("resize", onResize);

  render();
  initScreenOverlay();
  buildFlyTimeline();
  /* Both before the reduced-motion return: the camera is still the
     visitor's to swing there, and the canvas is still what carries the
     press that flies in. What reduced motion loses is the inertia and
     the walk home — see initOrbit. */
  initOrbit();
  initPointer(canvas);
  initCanvasPress(canvas);
  loadEnvironment().then((ok) => {
    if (ok && !frame) render();
  });

  /* Reduced motion: one static frame and no loop. The screen is still
     clickable — the fly-in just arrives instead of flying. The
     treehouse's falling petals go with the loop; they were hidden back
     in buildScene, before the first frame was drawn. */
  if (prefersReducedMotion()) return true;

  /* Vite folds `import.meta.env.DEV` to `false` when building, so this
     branch — and src/perf.js with stats.js inside it — is dropped from
     the production bundle. */
  if (import.meta.env.DEV) {
    try {
      perf = (await import("./perf.js")).createPerfMeter();
    } catch {
      perf = null; // the meter is never load-bearing
    }
  }

  /* Hover happens entirely on the screen: the machine does not move, the
     picture does. The CRT comes up brighter and the window on it shows a
     greeting (`setScreen` crossfades the two pictures, see
     `screenDisplay` in computer.js). Nothing moves in world space, so
     the contact shadows and the cables stay put. */
  const screenMat = computer.screenMat;
  const screenGlow = computer.screenGlow;
  const clock = new THREE.Clock();
  let elapsed = 0;
  const tick = () => {
    frame = requestAnimationFrame(tick);
    perf?.begin();
    /* Time-based easing, so the picture settles at the same speed
       whatever the frame rate. */
    const dt = clock.getDelta();
    elapsed += dt;
    /* The controls own the camera at the establishing shot and nowhere
       else, so this is a no-op from the moment a flight starts. */
    tickOrbit(dt);
    /* The treehouse's falling petals — the only thing in the room that
       moves on its own. They do not cast, so the frozen shadow map is
       untouched by them; see buildDrift in treehouse.js. */
    treehouse.drift.update(dt);
    const k = 1 - Math.exp(-HOVER_RATE * dt);
    hover.value += (hover.target - hover.value) * k;
    computer.setScreen(hover.value);
    screenEl?.style.setProperty("--hover", hover.value.toFixed(3));
    /* A real tube never sits perfectly still — a shallow beat on the
       brightness, well under what reads as a flash. */
    const flicker =
      1 + 0.018 * Math.sin(elapsed * 11.3) * Math.sin(elapsed * 2.7);
    const bright = (1 + hover.value * 0.45) * flicker;
    screenMat.emissiveIntensity = bright;
    screenGlow.intensity = SCREEN_GLOW * bright;

    /* The fly-in is advanced by the GSAP timeline on its own ticker;
       all this loop owes it is a frame to land in. Once the page has
       the viewport the canvas is faded out, so there is nothing left to
       draw until the camera starts back. */
    if (fly.value < 1) render();
    perf?.end(fly.value);
  };
  tick();

  /* Don't burn frames on a hidden tab. */
  onVisibility = () => {
    if (document.hidden) {
      if (frame) cancelAnimationFrame(frame);
      frame = null;
    } else if (!frame) {
      tick();
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  return true;
}

export function disposeScene() {
  if (frame) cancelAnimationFrame(frame);
  frame = null;
  if (onResize) window.removeEventListener("resize", onResize);
  if (onVisibility)
    document.removeEventListener("visibilitychange", onVisibility);
  if (onPointerMove) window.removeEventListener("pointermove", onPointerMove);
  killReturn();
  if (canvasEl && onCanvasDown) {
    canvasEl.removeEventListener("pointerdown", onCanvasDown);
    canvasEl.removeEventListener("pointerup", onCanvasUp);
    canvasEl.removeEventListener("pointercancel", onCanvasCancel);
  }
  /* disconnect(), not just enabled = false: it is what puts back the
     touch-action and the cursor it wrote on the canvas. */
  controls?.disconnect();
  controls?.dispose();
  controls = null;
  onCanvasDown = onCanvasUp = onCanvasCancel = null;
  press = { id: -1, x: 0, y: 0, hit: false };
  orbitDragging = false;
  orbitIdleAt = 0;
  orbitDirty = false;
  orbitChangedAt = -Infinity;
  flyStart = null;
  flyFrom = FLY_FROM;
  fov = FOV_DEFAULT;
  tanHalfFov = Math.tan(THREE.MathUtils.degToRad(fov) / 2);
  homeZoom = HOME_ZOOM;
  document.getElementById("orbit-hint")?.setAttribute("hidden", "");
  perf?.dispose();
  perf = null;
  disposables.forEach((d) => d.dispose());
  disposables = [];
  disposeComputer();
  disposeDesk();
  disposeTreehouse();
  computer = null;
  desk = null;
  disposeFloor();
  flyTl?.kill();
  flyTl = null;
  flyState.p = flyState.fade = 0;
  flyPath = null;
  if (screenEl) {
    screenEl.removeEventListener("click", onScreenClick);
    if (onScreenInput) screenEl.removeEventListener("input", onScreenInput);
    screenEl.hidden = true;
    screenEl.style.transform = "";
    screenEl.style.visibility = "";
  }
  stillCanvas = null;
  stillDirty = true;
  stillHidden = false;
  screenAway = false;
  screenHidden = "";
  sceneFade = -1;
  document.body.style.removeProperty("--scene-fade");
  if (canvasEl) {
    canvasEl.style.opacity = "";
    canvasEl.style.cursor = "";
  }
  document.body.style.removeProperty("--page-fade");
  document.body.classList.remove(
    "screen-active",
    "screen-zooming",
    "screen-focused",
    "orbit-live",
    "orbit-used",
  );
  fly = { value: 0, dir: 0 };
  screenEl = null;
  gtaoPass = null;
  canvasEl = null;
  envMap?.dispose();
  composer?.dispose();
  renderer?.dispose();
  hover = { target: 0, value: 0 };
  renderer = scene = camera = composer = computer = envMap = null;
  onResize = onVisibility = onPointerMove = onScreenInput = null;
}
