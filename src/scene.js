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
  loadScreenFont,
  FACING,
  MON_W,
  MON_H,
  MON_Y,
  SCREEN_W,
  SCREEN_H,
  OVERSCAN,
} from "./computer.js";
import * as executiveDesk from "./desks/executive.js";

/* **Which desk module the room is built with**, on the same pattern as
   the lamp below — `src/desks/executive.js` is the bulky walnut
   executive desk the room ships with, and `?desk=<name>` loads
   `src/desks/<name>.js` instead. `src/desks/classic.js`, the steel
   tanker desk that used to be it, is kept and still satisfies the same
   contract; it is reachable with `?desk=classic`.

   Dev only, for the same reason and with the same consequence as
   `?lamp=`: Vite folds `import.meta.env.DEV` to `false` at build, so
   rollup drops the branch *and every module only it reaches* — which
   now means `classic.js` is absent from production rather than
   executive. Verify the way the perf meter is verified: `npm run
   build`, then grep `dist/` for a marker only that module has
   (`0xc2b79e`, the tanker desk's cream enamel — a wood tint will not
   do, both modules carry walnut).

   The contract is `buildDesk()` → `{ root, ready }`, `disposeDesk()`,
   `DESK_TOP_Y` and `DESK_TOP` — and **every call goes through
   `deskMod`**, never a bound import, because a call site reaching past
   it would be the one place that quietly was not swappable.

   `DESK_TOP` is what makes "the same arrangement, on a different desk"
   mean something: see `seatToDesk`. */
let deskMod = executiveDesk;

async function resolveDesk() {
  if (!import.meta.env.DEV) return;
  const name = new URLSearchParams(location.search).get("desk");
  if (!name || name === "executive" || !/^[a-z0-9-]+$/.test(name)) return;
  try {
    deskMod = await import(`./desks/${name}.js`);
  } catch (err) {
    console.error(`desk module "${name}" failed to load`, err);
  }
}

/* --- The seat frame --------------------------------------
   Everything that stands on the desk — the machine, the lamp, the
   treehouse, the spare bricks — is seated by a pair of figures below
   that were authored against the **classic desk's top**: x measured
   from the slab's centre, z from its **front** edge, which is the edge
   someone sits at and the one the kit is spaced off. `seatToDesk`
   turns those into the current desk's frame by one translation, so a
   different top carries the identical arrangement rather than needing
   every seat re-tuned.

   **The reference frame stays the classic desk's even though the
   classic desk is no longer the default**, and deliberately: it is
   where the figures below were measured, every argument written beside
   them is stated in it, and re-basing it onto the executive top would
   silently change what each of those notes means while changing
   nothing on screen. The frame is a datum, not the default.

   One translation, not a rescale: "the same spacing" is exactly what a
   rigid shift preserves and what fitting the seats to a new width
   would destroy.

   **What this moved, once, when the executive desk became the
   default.** That desk's top is 0.6 deeper and centred like the
   tanker desk's, so `SEAT_DZ` is +0.3 and `SEAT_DX` is 0: the whole
   arrangement walks 0.3 toward the viewer with the front edge it is
   spaced off, and `COMPUTER_Z` with it. Rule 1's "the arrival pose
   must not move" is about not moving the glass *by accident* — by
   re-centring the kit, by nudging the desk — and `SCREEN_TARGET` is
   read off the screen mesh's world matrix precisely so that a
   deliberate move of the desk carries the fly-in's destination with
   it rather than stranding it. A different desk is the one change
   that is allowed to move it, and it moves it exactly once. */
const SEAT_REF_X = 0;
const SEAT_REF_FRONT_Z = 6.3;
let SEAT_DX = 0;
let SEAT_DZ = 0;
/* Height of the top the kit stands on. A `let` rather than a bound
   import because which desk is loaded is not known until the query
   string has been read. */
let DESK_TOP_Y = executiveDesk.DESK_TOP_Y;

function seatToDesk() {
  const top = deskMod.DESK_TOP;
  DESK_TOP_Y = deskMod.DESK_TOP_Y;
  SEAT_DX = top.X - SEAT_REF_X;
  SEAT_DZ = top.Z + top.D / 2 - SEAT_REF_FRONT_Z;
  /* The two figures derived from the seat frame rather than written
     down. Both are read at build time and `MONITOR_TARGET` is also
     read by the fly-in, so it is re-set in place rather than rebound. */
  COMPUTER_Z = SEAT_DZ + KIT_FRONT_Z - KIT_Z_MAX;
  MONITOR_TARGET.set(SEAT_DX, DESK_TOP_Y + MON_Y, COMPUTER_Z);
}
/* The brick-built cherry blossom treehouse standing on the desk. Its
   own module for the same reason the desk is: it is a self-contained
   object with its own origin on the surface it stands on. */
import { buildTreehouse, buildSpareBricks, disposeTreehouse } from "./treehouse.js";
/* The brass nameplate on the front edge of the desk. Its own module
   for the same reason, and it borrows the lamp's brass rather than
   mixing a second one — see `brassKit` in src/lamps/greenlamp.js. */
import { buildNameplate, disposeNameplate } from "./nameplate.js";
/* The desk lamp — the one object in the scene the visitor can change,
   and so the only one this module has to carry a *state* for as well
   as a place. lamp.js owns the shape and what "on" means for each of
   its parts; the state and the fade are below. */
import * as greenLamp from "./lamps/greenlamp.js";

/* **Which lamp module the scene is built with.**
   `src/lamps/greenlamp.js` is the one the room ships with — the
   green glass banker's lamp. `src/lamp.js`, the cone fixture that
   used to be it, is kept and still satisfies the same contract; it
   is reachable with `?lamp=lamp`.

   The contract is: `buildLamp`, `setLamp`, `aimLamp`, `lampLevels`,
   `disposeLamp`, `LAMP_SCALE`, `LAMP_COLOUR`, and optionally
   `LAMP_X` / `LAMP_Z` — a module that names its own seat gets it,
   and one that does not falls back on the constants below. See the
   Lamps section of CLAUDE.md.

   **Every call goes through `lampMod` rather than through a bound
   import**, because the interchangeability is the point: a call
   site that reached past this object would be the one place that
   quietly was not swappable.

   `resolveLamp` is behind `import.meta.env.DEV`, which Vite folds
   to `false` at build, so rollup drops the branch *and every module
   only it reaches* — which now means `src/lamp.js` is absent from
   production rather than greenlamp. Verify the way the perf meter
   is verified: `npm run build`, then grep `dist/`. It is also why
   `?lamp=` only works against `npm run dev`, not `npm run preview`. */
let lampMod = greenLamp;

async function resolveLamp() {
  if (!import.meta.env.DEV) return;
  const name = new URLSearchParams(location.search).get("lamp");
  if (!name || name === "greenlamp" || !/^[a-z0-9-]+$/.test(name)) return;
  try {
    /* Two static prefixes rather than one template, so Vite can see
       both arms: the cone lamp is not under `lamps/`. */
    lampMod = name === "lamp"
      ? await import("./lamp.js")
      : await import(`./lamps/${name}.js`);
  } catch (err) {
    console.error(`lamp module "${name}" failed to load`, err);
  }
}
/* The room is its own module — the plank floor, the two cutaway walls,
   the wainscot, the trim and the rug all live there, so the whole
   setting can be swapped without touching the camera. It replaces src/floor.js, which was the opposite idea: an
   effectively endless plane whose edges fog hid. */
import {
  buildFog,
  buildRoom,
  disposeRoom,
  ROOM_PLAN,
  ROOM_RADIUS,
  setFogRange,
  VOID,
} from "./room.js";
/* The rain on the window in the left wall is the only thing in the
   room that moves, so it is the only thing here this module owes a
   frame to. room.js builds and fades the window; the clock is this
   file's, so the advance is. `rainState` is the live-tuning handle —
   see `window.__rain` below. */
import { rainState, tickRain } from "./nightwindow.js";
/* Tone mapping is on now, and the background clear is the one thing it
   gets wrong — see src/tonemap.js for the asymmetry between the two
   render paths and why the void needs a pre-image on one of them. */
import { tonemapForward, tonemapPreimage, TONE_MAPPINGS } from "./tonemap.js";
/* The rug's wordmark is gone (see src/room.js), so the only typeset
   thing left in the scene is the greeting on the CRT's own picture.
   The webfont still has to be resident before the first frame for it —
   `loadScreenFont` is awaited below, and computer.js owns both the
   face and the reason. */

/* ==========================================
   ISOMETRIC INTRO SCENE

   Owns one <canvas id="scene">. The only module that imports three
   besides computer.js, desk.js and room.js.

   Camera: perspective on a narrow FOV, 20° down / 37° around — see
   design-references/isometric-angle.webp. It was orthographic; see
   "Perspective, and what replaced the frustum" below for what the
   switch cost and what it bought.
   Room: src/room.js. The whole setting — the plank floor, the two
   cutaway walls that fade as the camera comes round behind them, the
   wainscot, the trim and the rug — lives there; this module only lifts
   it into the scene and tells it where the camera is looking.
   A single low directional light rakes a long soft shadow across it.
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
   their old meanings. What stops being a constant is the
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
     With the room it no longer matters: the ground is a finite slab
     that ends well inside the frame, and what is beyond it is the
     void. The fog survives as a depth cue on the diorama's far corner
     rather than as the thing that hides an edge — see `buildFog` in
     src/room.js, whose range is still an offset from the camera's
     distance for the same reason CAM_DIST is gone. */
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

   The room needs no re-tuning for this. It is fixed geometry in world
   units, so a change of frustum only changes how much of it is in
   shot — unlike the old floor, whose type was sized as a share of the
   viewport and had to be laid out again whenever this moved. */
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
const KIT_Z_MAX = 7.2;     // the front of the keyboard's contact shadow

/* The kit is placed by that **front** figure, not by centring it, and
   the difference is the whole point of the shorter funnel. Centring is
   where the number came from: at the funnel's old 4.2 depth the kit ran
   -4.77..7.2 and sat square on the desk at z -1.215. The funnel now
   ends at -3.31, and re-centring the shorter kit would walk the machine
   0.73 back — taking the bezel, the glass and `SCREEN_TARGET` with it,
   which is the one thing the fly-in cannot have move. So the front edge
   is held where it was and the 1.47 the funnel gave up all becomes
   clear walnut behind the monitor. */
const KIT_FRONT_Z = 5.985;
/* Derived, and re-derived by `seatToDesk` once the desk module is
   known — hence a `let`. On the classic desk `SEAT_DZ` is 0 and this
   is the figure it always was. */
let COMPUTER_Z = KIT_FRONT_Z - KIT_Z_MAX;

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
/* **x moved +1.2 when the desk went 20% wider**, z did not. The 1.9
   units of new walnut on this end is what pays for it, and the point
   is screen separation rather than plan clearance: at this azimuth
   screen x runs roughly `0.8x - 0.6z`, so +1.2 in x is about a unit of
   screen width opening up between the canopy and the CRT's right
   flank — which is the breathing room, the monitor being the thing
   that has to stay the obvious target. In plan the conservative box
   goes to x 10.95 against the walnut's new 11.4 edge, so the model is
   still inside the slab by the figure that fails safe.

   z is untouched on purpose: the 1.6 units of depth behind the glass
   that -2.1 buys is the whole reason the canopy does not cross the
   bezel, and nothing about a wider desk changes that argument. */
const TREEHOUSE_X = 8.1;
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
/* Two-thirds of the 1.76 this was set to, on request: at that value the
   model stood 105% of the monitor's height, hung off the walnut on the
   +x and back edges, and its crown crossed in front of the CRT's right
   flank — so the one object a visitor is meant to find and press was
   partly behind a tree. Every one of those is measured, and at 1.1733
   every one of them comes back inside the furniture; see the figures
   under "Placement" in CLAUDE.md.

   It is a group scale rather than a rebuild, which is safe in this
   direction only so far: the note in treehouse.js is that STUD must
   never come *down*, because under about eight pixels a stud stops
   reading and the build stops being a build. Scaling the group down
   takes the stud with it, so this is the same argument — at 1.1733 a
   stud is ~0.35 world units against the 0.30 the model builds itself
   at, still above the pitch that has survived three rebuilds, but
   there is not much room left under this. Below about 1.0 the pitch
   itself is what is being cut, and the answer then is fewer bricks,
   not smaller ones.

   Applied about the model's own origin, which sits on the desk top at
   the base plate's centre, so the model shrinks in place rather than
   drifting and the base plate stays where it was set down. Re-run
   `_canopyfit.mjs` *and* `_tightfit.mjs` after touching this — the
   first fails safe on a yawed InstancedMesh, the second is the truth. */
const TREEHOUSE_SCALE = 1.1733;

/* The loose bricks travel with the model, by exactly the same +1.2 the
   model took, and this is a **group translation** rather than an edit
   to `SPARE_PLAN`. Two reasons, and the second is the one that matters:
   the plan's four x figures stay the numbers they were measured as, so
   they can still be read against the treehouse's own base plate; and
   moving the two together by one delta is what preserves the three
   clearances `_spares.mjs` holds — the canopy's +z overhang, the
   desk's +x edge and the mouse's painted contact shadow. The first two
   are relative to the model, so they are untouched by construction;
   the third is the one that *improves*, since the mouse does not move
   and the bricks walk 1.2 away from it.

   Note this is the one thing `SPARE_SCALE`'s own note in treehouse.js
   warns against doing at the group — but that warning is about
   *scaling* there, which would walk the pieces a share of seven units
   back toward the mouse. A translation has no such side effect. */
const SPARES_X = 1.2;

/* --- Where the nameplate is set down ---------------------
   The one piece of furniture on the desk that is read rather than
   used, so it goes where there is clear walnut and nothing behind it
   to be in front of: the **left** of the top, a little in front of
   the lamp, in the seat frame like everything else here.

   **In front of the lamp is where the light is.** The fixture's beam
   lands at (-8.05, -0.92) and spreads forward from there, so walking
   the plate back toward the base walks it into the pool: measured
   across its own face, the brass reads a median 57 of 255 at z 4.8,
   78 at 3.6, 95 at 1.8, 99 at 1.2, 100 at 0.95 and 105 at 0.75.

   The curve flattens long before the walk has to stop, so the seat is
   chosen on the **gap** rather than on the light. At z 1.2 the
   plate's box stands 0.46 off the fixture's and 0.37 off its painted
   contact shadow — about three quarters of an inch at this scale,
   which is a strip of lit walnut you can see between them. At 0.95 it
   is 0.12 and the two read as one object; at 0.75 the box has reached
   the fixture (0.01) and crossed into its shadow (-0.08), which is
   touching. So 1.2: as close to the base as the plate can go while
   still plainly standing apart from it, for the last 10 of 255 the
   remaining distance was worth. `_platesweep.mjs` is that walk, kept
   runnable.

   What the figures are set against, in plan — all world, and all of
   them things that were already on the desk:

   - the keyboard's painted contact shadow, x -4.1..4.3 over
     z 1.685..6.285. That quad is the *pick* footprint of the machine
     as well as its contact, so overlapping it would put the nameplate
     inside the press target it must never interfere with. The plate
     is 3.25 across, so at x -6.8 its right-hand end lands at -5.175:
     **1.08 clear.**
   - the walnut's left edge at -11.4 and its front edge at 6.6. The
     yawed solid reaches -8.5 and, at z 0.9, 1.94: **2.9 and 4.66
     clear.** It stood at 5.4, then 4.5, then 1.5, all of which left
     it out on the front half of the desk with the lamp behind it;
     this shares the lamp's corner instead.
   - **the lamp, which is what it is placed against now.** It stands
     at (-8.05, -2.45); its own box ends at z 0 and its painted
     contact shadow reaches 0.09. The nameplate's box starts at
     z 0.46: **0.46 clear of the fixture and 0.37 of its shadow.** In
     front and not touching, and in front is the side the light is
     on — behind the base is the one place on this half of the desk
     the shade's own shadow falls.

   The treehouse and the mouse are both on the +X half and never come
   into it; the monitor is at the middle and behind. Screen x runs
   roughly `0.8x - 0.6z` here, so the plate's near end lands at about
   -5.3 and the keyboard's at -4.3: the two are still a clear
   separation apart on screen even though they now share a band of
   depth. */
// Shift toward the window and slightly toward the lamp, leaving a gap
// in front of its base and keeping the whole wedge on the desktop.
const NAMEPLATE_X = -8.2;
const NAMEPLATE_Z = 0.6;
/* **Facing the seat, turned a little toward the lens.** 0 is square to
   the desk, which is where someone sitting at it would set a
   nameplate down and what the brief asks for; the camera is 37° off
   that (AZIMUTH), so dead square the brass is read at a slant. A
   quarter of the way round recovers most of the legibility and still
   reads as an object placed for the chair — turn it the whole way and
   it reads as aimed at the viewer, which is the one thing a nameplate
   on someone's own desk is not. The other quarter of that recovery is
   the face's own lean, `RUN` in nameplate.js, which costs nothing in
   how the object reads because a wedge is expected to lean. */
const NAMEPLATE_FACING = AZIMUTH * 0.26;
/* Whose desk it is. */
const NAMEPLATE_NAME = "Trish Nguyen";

/* --- Where the desk lamp is set down ---------------------
   On the desk at the **back left as the home view sees it**, which is
   -X and -Z: the camera sits in the +X/+Z octant, so screen left is
   desk left and the back edge is the far one (the same convention
   desk.js states for its pedestals and scene.js for the treehouse).

   Both figures are set against what is already on that half of the
   desk, and against where the lamp lands **on screen** rather than
   just in plan. Screen x runs roughly `0.8x - 0.6z` at this azimuth,
   so pushing an object *back* walks it screen-*right* — which is the
   opposite of what "back left" suggests, and is why the depth is the
   figure that was tuned.

   **LAMP_X was -7.6 and moved +0.6 when the fixture was scaled to
   LAMP_SCALE**, and what forced it is not geometry. At 1.75 the
   fixture's world box ran x -9.99..-5.21 against a walnut edge at
   -9.75: 0.24 over it. The part hanging off was the **painted contact
   shadow**, a square of BASE_R * 3.1 that scales with the group — the
   base disc itself was still 1.1 clear. But a contact blob off the
   edge of the desk is a grey patch in mid-air, which is the exact
   defect a painted shadow exists to avoid, so it binds. Nor is there
   a cheaper direction: both +x and -z go screen-*right* at this
   azimuth, toward the machine, and -x is the edge that was already
   over.

   In plan it now clears the walnut by **0.36 on the -x edge and 0.89
   on the back**, and sits **0.51 clear in x of the computer kit's own
   box** (0.79 / 1.92 / 2.14 at the old size). That last figure is the
   slackest of the three despite being the smallest number: the kit's
   x extent is the mouse's painted shadow, which sits at the desk's
   *front*, while the lamp is at the back — the two are separated in z
   and never meet. `_lampshots.mjs` prints all three off
   `window.__fit("lamp")`.

   **Moving it +x walks it toward the machine on screen, so that was
   checked rather than assumed.** `_lampbig.mjs` walks a grid over the
   glass and over both projected boxes at home and at both azimuth
   clamps, asking `window.__pick` twice per point — once with the
   fixture present, once with its meshes on a layer the raycaster does
   not test — so occlusion is the conjunction rather than a box
   overlap. Zero occluding points at every framing on both viewports;
   the glass comes back "machine" at all 225 points of all six grids.
   The NDC boxes do overlap at every azimuth and always did, which is
   why the box test is not the one to trust.

   It also stands in front of the window, below the sill, so the shade
   is silhouetted against the night sky and the moon throws it across
   the desk. That is on purpose, and **the taller fixture did not make
   the moon's shadow box grow**, which was measured rather than assumed
   because the window wall casts and a receiver outside the box is a
   patch of floor flooded with moonlight: `window.__shadowfit()` puts
   the lamp at lat 1.84..8.98, up -3.32..7.48, depth 20.57..31.18, and
   the union still clears the camera by 1.53 or more on every face. */
const LAMP_X = -7.0;
const LAMP_Z = -3.6;

/* **The lamp starts on**, which is the state the rig below is
   calibrated at: the four-source figures in "NIGHT LIGHTING" are the
   ones that hold at `lampLevel === 1`. Turning it off is a visitor's
   choice and the room is still meant to read — see LAMP_EXPOSURE_LIFT
   for the one thing that is allowed to move when they make it. */
const LAMP_START_ON = true;
/* How long the light takes to come up or go out, in seconds. The brief
   asks for ~0.4 and that is also about right physically: a tungsten
   filament takes a few hundred milliseconds to reach colour and rather
   less to drop out of it, which is why the two directions get
   different eases rather than one symmetric curve — see `tickLamp`. */
const LAMP_FADE_S = 0.4;
/* **There is no strike.** The lamp used to flicker on — a staircase of
   held multipliers over the on-ramp, three lit steps and two gaps,
   multiplying the ease rather than replacing it. It was removed on
   request, and the thing worth knowing is that it was the *only*
   non-monotonic term in the level: with it gone the fade below is the
   whole story in both directions, and `window.__lamp().curve` is the
   ease alone. Putting one back means multiplying `applyLampLevel`'s
   argument again, not re-shaping either ease.
*/
/* **The exposure moves a little with the lamp, and the direction is
   the one an eye moves in.** With the lamp off the room loses its one
   warm source and ACES's toe takes the walls and the floor back down
   toward the void — which is the thing TONE_EXPOSURE exists to stop
   (see below). Lifting the exposure as the lamp goes out is dark
   adaptation: the room stays legible, and the *difference* the lamp
   makes stays obvious because the lift is far smaller than the light
   it is standing in for. 0.1 over a base of 1.3 is about 8%.

   It is snapped to EXPOSURE_STEP before being written, because the
   void's pre-image has to be re-solved whenever it moves (see
   `applyVoidColor`) and a Newton solve per frame for 0.4s is a cost
   with nothing to show for it. Five distinct values across the fade;
   the steps are invisible under a light that is itself changing.

   **It is 0 now, and OFF_DARKNESS is why.** The argument above is a
   good one about legibility and the wrong one about this scene: dark
   adaptation is the operator spending 8% of the picture on making the
   two lamp states *more alike*, and the brief is that they read apart
   at a glance from the home framing. The off state is now shaped by
   the fill instead — darker and cooler rather than merely dimmer —
   and the room stays legible because OFF_DARKNESS is a floor under
   the hemisphere, not a cut to zero. The knob stays because it is the
   right one if the off state ever goes too far: it lifts the bottom
   of the curve, which is where everything dark in this room lives. */
const LAMP_EXPOSURE_LIFT = 0;
const EXPOSURE_STEP = 0.02;

/* ==========================================
   NIGHT LIGHTING

   **Four sources and nothing else**: the moon through the window, a
   hemisphere fill the colour of the room's own surfaces, the CRT, and
   the desk lamp. The daylight rig this replaced had five — a warm key,
   an ambient, a hemisphere, a studio HDRI and the tube — and the first
   two of those are gone rather than dimmed. An `AmbientLight` is a
   flat lift with no direction in it, which is exactly what a night
   room must not have: it is what makes a dark scene read as a grey
   scene.

   **The fourth is new and it has a switch**, which is the one thing
   that makes this rig different from the others: every figure below
   is calibrated with the lamp *on*, because that is the state the page
   opens in. What happens when a visitor turns it off is a separate
   question with a separate answer — see LAMP_EXPOSURE_LIFT above, and
   `_lampshots.mjs`, which shoots and measures both states. The lamp's
   own two intensities live in src/lamp.js, next to the fixture whose
   geometry sets them.

   **What the old calibration meant, and why none of it carries over.**
   Intensities read ~3x high because three's physical lighting divides
   them by PI — that part still holds. What does not is the target: the
   old numbers were set so lit ground landed exactly on the daylight
   floor's cream with its shadow at ~0.72 of it. There is no cream, the
   ground is a plum plank floor, and ACES at 0.95 now sits after the
   whole thing. These are set against the picture, through
   `window.__lights`, which is what let all four be moved on one page
   instead of one build per candidate.

   The brief for the look: **moody, not pitch black.** The floor in the
   moonlit patch, the walls away from it and the desk's lit side are
   the three values that decide whether that is true, and
   `_lightshots.mjs` prints all three off a real `readPixels` rather
   than leaving it to a judgement about a dark screenshot.
   ========================================== */
/* The moon. Low, cool, and the only thing in the scene with a
   direction — see `moonDirection` for how it is aimed through the
   window rather than placed by hand. */
const MOON_COLOUR = 0x8fa3d8;
/* **Down from 5.5, and what it bought was the desk top.** The moon is
   the only light that reaches the walnut from outside, and at 5.5 the
   window's pool on it was *clipping*: `__pixel` on the near-left
   corner read (180,172,200) with the lamp off as well as on — a
   near-white sheet with a blue bias, which is what a brown albedo
   looks like after ACES has rolled it off the top. It read as glare on
   a polished surface and the walnut is `roughness` 1.9, so there is no
   specular in it to blame; it was simply over-lit. At 2.2 the same
   corner reads (166,131,150) and the sash's stripes come back as
   stripes. The floor's own pool is not the loser here — it sits past
   the home framing's crop (see docs/lighting.md) and the hemisphere
   is most of what lights the rug. */
const MOON_INTENSITY = 2.2;
/* **The fill, and the one thing in the rig that had a hue fault.**
   Sky half is the wall plum lifted; ground half is the bounce off the
   plank floor and the lamp-lit walnut, so it is *warm*.

   It used to be the void colour, on the argument that what bounces up
   off the floor should be the colour the diorama floats in. That is a
   good argument about the edges of the picture and a wrong one about
   its middle: #1C1A2A is violet, #3A3560 was violet, and a hemisphere
   is the only light that reaches most of the beige in this room — the
   desk's enamel and the monitor's shell both face +z, and every source
   in the room except the tube is *behind* that plane, so N·L is
   negative for all of them and the fill is doing 100% of the work.
   Beige albedo times a fill whose blue channel is 2.7x its red came
   out lilac: the monitor measured (124,107,161) and the desk's
   pedestals (118,100,152), against an albedo of (206,196,171).

   So the ground half is warm now and the sky half is the same plum
   with the violet taken out of it. The two halves disagreeing is also
   what puts *modelling* back on a vertical face, which an evenly
   coloured hemisphere cannot: up-facing surfaces read cool moonlight,
   the lower verticals read the warm bounce, and the gradient between
   them is the shadow side. The walls stop reading royal blue for the
   same reason — the far wall was (5,5,57), eleven times as much blue
   as red off an albedo that is only 1.5x. */
const HEMI_SKY = 0x3e3b52;
const HEMI_GROUND = 0x3c3422;
/* **19, down from 30, and the colours above are half of why it could
   come down.** In three a light is colour times intensity, and both of
   these are *dark* — #3E3B52 is 0.08 linear at its brightest channel.
   A hemisphere in them at an intensity of 1 puts out almost nothing,
   and multiplied by the floor's own dark plum albedo it rounds to
   black before ACES has even seen it. 30 was past the figure the
   comment here already warned about ("past about 20 the walls turn a
   vivid royal blue and the enamel goes white") and both of those had
   happened.

   What sets it now is the ratio to the lamp rather than an absolute:
   the fill has to leave the fixture room to be the brightest thing on
   the desk. Measured at 19 with the warmer ground, the median room
   pixel is 19 and the share under luma 8 is 0.25 — both better than
   the 14/0.27 at 30, because the exposure pays for the drop and the
   warm half lifts the mid-tones the violet half was only tinting. */
const HEMI_INTENSITY = 19.0;

/* ===== What the room looks like with the lamp off =========

   **OFF_DARKNESS is the share of the fill the room keeps when the
   lamp is out, and it is the one knob that makes the switch an event
   in the room rather than on the desk.**

   The problem it answers is a property of the rig rather than of the
   lamp. Every figure in the night rig above was calibrated with the
   lamp *on*, because that is the state the page opens in — so the
   hemisphere is carrying a room that has a lit lamp in it, and it
   goes on carrying it at full strength after the lamp is switched
   off. A fill that does not know about the lamp is a fill that
   quietly stands in for it: with the lamp out, the far side of the
   desk, the wall and the floor barely moved, and the only thing that
   changed was the fixture and the patch of walnut under it.

   What a lamp going out in a real room does is take the warm bounce
   with it. So the hemisphere is scaled by this as the lamp fades,
   and — the half that does the most work — **its ground half goes
   cool**: HEMI_GROUND is the warm bounce off the plank floor and the
   lamp-lit walnut, and with the lamp off there is nothing warm left
   for the floor to bounce. HEMI_GROUND_OFF is what is left, which is
   moonlight that has been round the room once. The two together mean
   the off state is darker *and* a different temperature, and a
   temperature change is far easier to see at a glance than a
   brightness one.

   **0.52 and not lower.** The brief is cosy-dark, not a black frame:
   what is left has to keep the walls, the floor and the furniture's
   silhouettes readable on the moon and the CRT alone, and under about
   0.4 the room stops being a room — ACES's toe crushes the plum
   surfaces into the void and the diorama loses its edges, which is
   the exact failure TONE_EXPOSURE exists to prevent. Above about 0.7
   the difference is there in a measurement and not at a glance.

   The CRT is untouched by this and so is the moon: they are the two
   sources that *should* carry the off state, and leaving the moon at
   full strength against a dimmed fill is most of why the off state
   reads cool — the one light in the room with a direction in it
   becomes the dominant one. */
const OFF_DARKNESS = 0.52;
const HEMI_GROUND_OFF = 0x2a2a3e;

/* **The HDRI is not one of the three lights, so it is off.**
   "Studio Small 09" is a daylit studio, and under the old rig it ran
   at 0.7 as the ambient source — filling exactly the faces the key
   never reached, which is the one thing a night room cannot have.

   It was first kept at 0.1 "for the highlights", on the assumption
   that so small a number could only be a reflection. **That was wrong
   and the A/B caught it**: at 0.1 it was still doubling the median
   room pixel (4 to 8) and lifting the walls from 3 to 7 — a fourth
   light, quietly doing a third of the fill. The brief is that the
   room reads on these three lights alone, so it is 0, and the
   hemisphere was re-tuned afterwards to make up the difference
   honestly.

   What that costs is measurable and small: the desk's chrome pulls go
   from 79 to 54 and the CRT's glass from 127 to 107, so both still
   read as highlights, just duller. `window.__lights({ env })` puts it
   back on a live page if that trade ever wants revisiting.

   At 0 `loadEnvironment` does not fetch at all, so the 128 kB HDRI is
   no longer requested. The asset and its licence stay in
   `public/env/` — see the note in CLAUDE.md. */
const ENV_INTENSITY = 0;

/* **The exposure is a lighting control now, not a finishing trim.**
   It was 0.95, set under the daylight rig as "a trim rather than a
   correction", with a note that ACES's toe was the thing to watch when
   the night lighting landed. It landed, and the toe is exactly what
   had to be answered: at 0.95 the room's median pixel read 4/255 and
   over half of it sat under 8 — the walls and the floor were being
   crushed to the backdrop, so the diorama had no edges.

   1.25 is where the room comes back without the rig having to be
   turned up to the point of looking like daylight through a blue
   filter. It is not interchangeable with raising the lights: the
   lights lift the bright albedos (the desk's enamel) as fast as the
   dark ones, and this lifts the bottom of the curve where everything
   dark actually lives. Both were swept together — see HEMI_INTENSITY.

   AgX is the honest alternative and was measured beside it: at 0.95 it
   lands within a couple of levels of ACES at 1.9 everywhere, because
   its toe is gentler by about that much. ACES is what the restyle
   asked for, so ACES is what is set, and the exposure is what pays for
   its toe. `window.__tonemap('agx')` still switches on a live page.

   **1.45 now, and the extra 0.15 is what the fill gave up.** Taking
   the hemisphere from 30 to 19 is a cut to the one light most of the
   beige in this room is lit by, and the thing to avoid was paying for
   a shadow side with a black room. This is the knob that gives it back
   at the bottom of the curve rather than the top, which is the whole
   argument above — so the median room pixel came out *higher* after
   the cut (19 against 14) while the desk's enamel came down. */
const TONE_EXPOSURE = 1.45;

const GTAO_BLEND = 1.0; // deep enough that the creases actually darken
/* How far past the furniture the AO is allowed to reach. See
   buildComposer: everything outside this box is taken to be unoccluded,
   which on open floor it is. Wide enough that the fade lands well clear
   of the desk's feet and their contact shadows. */
const GTAO_BOX_MARGIN = 8;
const HOVER_RATE = 7; // hover easing, per second
/* Base intensity of the point light in front of the tube; the loop
   scales it with the picture brightness. It used to light the bezel
   and nothing else (2.1 at `decay` 2 over a 5.5 range); it is now the
   room's second light source and has to reach the keyboard and the
   walnut in front of it. See `screenGlow` in computer.js for the range
   and the decay that go with this. */
const SCREEN_GLOW = 8.5;

/* Desktop's GTAO composite stays capped at 1.5. Phones use the cheaper
   direct render and need a sharper raster for the small furniture and
   lettering on high-density screens. Cap those at 2 rather than native
   3x/4x so the improvement has a bounded fill-rate cost. */
const MAX_DPR = 1.5;
const MOBILE_MAX_DPR = 2;

function scenePixelRatio() {
  return Math.min(window.devicePixelRatio || 1, isMobile() ? MOBILE_MAX_DPR : MAX_DPR);
}

// Keep drawing buffers allocated across camera motion. Even a single canvas
// resize can synchronize with the GPU (100ms+ on the measured Metal path),
// and damping / the return home used to bounce between two resolutions.
// Desktop keeps a second, small composer for the existing motion resolution,
// so switching quality does not dispose/reallocate render targets either.
let motionQuality = false;
function syncRenderQuality() {
  const moving = cameraMoving() && !prefersReducedMotion();
  const ratio = scenePixelRatio();
  if (moving === motionQuality && renderer.getPixelRatio() === ratio) return;
  motionQuality = moving;
  // setPixelRatio calls setSize even for an unchanged value. Only a real DPR
  // or viewport breakpoint change should resize the canvas and composer.
  if (renderer.getPixelRatio() !== ratio) {
    renderer.setPixelRatio(ratio);
    composer?.setPixelRatio(ratio);
    if (composer && ratio > 1 && !motionComposer) {
      motionComposer = buildMotionComposer();
      motionComposer.render(); // a real DPR change, before the next gesture
    }
    motionComposer?.setPixelRatio(Math.min(ratio, 1));
  }
  // AO redraws the entire room for its depth/normal pass. Keep the real
  // light/shadow rendering during motion and restore contact detail at rest.
  if (gtaoPass) gtaoPass.enabled = !moving;
}

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
/* --- The azimuth leash is the room, and nothing else ---------
   **There is no longer a monitor-relative cap.** The azimuth used to be
   clamped to `ORBIT_SWING` either side of the machine's front — ±90°,
   then ±60° once the diorama's two walls had a fade to protect — and
   that constant is gone. It was asymmetric against the walls in a way
   that showed: home sits 37° round from the front, so ±60° let the
   visitor reach the -X wall's own limit going one way and stopped them
   23° short of anything on the other, at a diagonal of the monitor with
   the -Z wall still 37° off. Both ends come off the walls now and the
   two sides behave the same way.

   What that costs is `FACE_MIN`, and it is worth stating where the
   trade is. The -Z wall does not come in until about +88°, and the
   glass is edge-on well before that, so the live login stands down over
   the last few degrees of the right-hand swing and the baked still
   underneath carries the picture. That guard went back to being a
   working part rather than a formality; see `updateScreenOverlay`.

   **`_orbit.mjs` asserts the old ±90° behaviour and will fail until it
   is updated** — and so will `_roomshots.mjs` and `_winshots.mjs`,
   which read a `window.__walls` that went with the fade. */
/* --- The walls' own limit, which is now the only one --------
   **The azimuth is clamped so the camera never leaves the room.** It
   replaces the cutaway outright: the two walls used to fade as the
   camera came round behind them, and now they stay opaque and there is
   nowhere behind them to get. Both ends of the leash are this; the
   margin below is the same on each side, so the two walls are reached
   the same way.

   Both inner faces are planes — `ROOM_PLAN.X0` with normal +X and
   `ROOM_PLAN.Z0` with normal +Z — and the camera rides a circle about
   the target. Where that circle crosses each plane is one `asin` or
   `acos` of room.js's own figures, which is the whole reason the limits
   are derived rather than typed in: move a wall and the leash moves
   with it.

   **`AZ_WALL_MARGIN` is how far short of each plane the camera comes to
   rest.** At the plane itself a wall is exactly edge-on — a grazing
   sliver of field filling that side of the frame — and 9° off it reads
   as a wall again.

   **The two sides are not symmetric, and the room is why, not the
   leash.** The -X wall's plane passes 13 units from the pivot while the
   camera stands 75 out, so the circle crosses it only 10° short of the
   monitor's front; the -Z wall's is 9 units out on the other axis and
   almost parallel to the circle there, so it is not crossed until 97°.
   Off the front, that is about -1°..+88° on desktop and +2.5°..+85° on
   a phone — 89° and 83° of swing, most of it to the right of home at
   37°. **The camera cannot get in front of the machine**, and that is
   not a tuning choice: there is a wall in the way. */
const AZ_WALL_MARGIN = THREE.MathUtils.degToRad(9);
/* How far a drag may pull past that resting limit while the spring in
   `easeAzimuthLimits` pulls back. Deliberately less than the margin:
   at full stretch there are still 3° of clearance before the plane, so
   the stretch can only ever spend margin — it cannot show the back of
   a wall. OrbitControls' own clamp sits at the stretched figure and is
   what makes that a guarantee rather than a hope. */
const AZ_WALL_STRETCH = THREE.MathUtils.degToRad(6);
/* The spring's rate, per second — the same exponential form as the
   hover ease, so it is frame-rate independent. At 9 the overshoot is
   90% spent in a quarter of a second: slow enough to read as a pull
   rather than a snap, quick enough that letting go at the end of the
   swing does not feel like waiting. */
const AZ_EASE_RATE = 9;
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

   - **The floor's size**, which has stopped being a question: the room
     is a finite diorama now (see src/room.js), its own edges are in
     frame deliberately, and what lies past them is the void rather
     than more ground. The endless 1700-unit plane is gone.
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
     `SCREEN_BASE_W` of blurring and gradient-filling to produce that
     sliver.
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
   is sitting at the machine — the glass centred and large with the
   bezel still around it (`screenFrustum`). `applyFly` derives the whole
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

/* How much taller than the glass the arrival's frame is. The flight
   used to end with the picture *covering* the viewport, which cropped
   the panel on every axis and left no monitor in shot at all: the
   arrival read as a page, not as a machine. Above 1 the camera stops
   short of that, so the bezel and a little of the case sit around the
   screen and it reads as sitting down at the thing.

   It is a multiple of the glass, not of the case, because the glass is
   what the login is mapped onto — so this figure *is* the share of the
   frame the page keeps (1/1.2, about 83% of the height on a desktop
   viewport). The case is 5.4 units against the glass's 3.63, so
   holding the whole front panel would want 1.49 and cost the dialog a
   third of its size; "a bit of the housing" is the trade.

   Narrow viewports get their own, barely over 1. There the frame is
   taller than it is wide and the glass is 4:3, so the height is the
   only axis with anything to spare — see screenFrustum. */
const ARRIVE_PAD = 1.2;
const ARRIVE_PAD_MOBILE = 1.06;

/* ==========================================
   THE SECOND MOVE — the bezel framing in to a full viewport

   **Phones only.** `ARRIVE_PAD` is deliberately a pull-back: the
   flight stops with the monitor in shot, because that is what makes
   the login read as a machine in a room, and on a desktop viewport the
   desktop that follows is legible inside that monitor (see
   "THE SIGN-IN" below). On a phone it is not — the glass is already
   cropped at the arrival and a 900px desktop mapped onto it would be
   two thirds off frame — so there the sign-in spends a second, shorter
   push-in getting the glass to cover the viewport, and hands over to a
   desktop laid out for the phone.

   It is kept as its own parameter rather than extending `fly` past 1,
   for two reasons. `fly.value === 1` is tested in a dozen places as
   "parked at the login" (the rAF loop stops there, the resize handler
   draws its own frame there, the orbit is disabled there, a press on
   the room flies back out there), and the spline's knots are the four
   framings the first flight was art-directed through — the arrival is
   its endpoint by construction. `dive.value` sits on top: 0 is exactly
   `applyFly(1)`, 1 is the glass covering the viewport. Nothing about
   the first flight changes, on any viewport.

   The move is a pure dolly: both poses are head-on at `SCREEN_TARGET`,
   so the only thing between them is the radius, and the radius comes
   off a log-space lerp of the two frustum heights for the same reason
   the flight's does — the frustum *is* the zoom, and lerping it
   linearly lurches. `applyDive` therefore takes its direction from
   `applyFly(1)` rather than restating it, which is what guarantees
   q = 0 and the arrival are the same pose down to the digits.
   ========================================== */
const DIVE_S = 0.9; // seconds; the flight's 1.6s would drag over a dolly this short
const DIVE_EASE = FLY_EASE;
/* The glass overfills the frame by this much at the end, rather than
   meeting it exactly. The quad's corners land on rounded CSS pixels and
   the tube's own overscan border is the outermost thing in the texture,
   so a framing that only just contains the viewport can leave a
   hairline of bezel down one edge on some viewport sizes. 1.5% is
   invisible and cannot. */
const COVER_BLEED = 0.985;

/* **The machine's resolution.** The live HTML on the glass is a DOM
   box of this width, mapped onto the screen plane with a CSS matrix,
   and everything on it — the login, and since the sign-in the whole
   desktop — is laid out in these pixels. It is the one knob for how
   big the picture reads: the height comes off the glass's aspect
   below, the window manager measures every figure as a share of it,
   and the still is rasterised at it, so nothing else needs touching.

   Smaller is bigger. The box is scaled onto the glass, so dropping
   this from 1200 to 900 magnifies the contents by a third; 900 also
   puts the box within a tenth of 1:1 against the pixels it lands on at
   the arrival (~981 wide on a 1440x900 viewport), which is as sharp as
   a scaled box gets. Much under this and the chrome starts to read as
   a blown-up screenshot; much over it and 11px text on a tube two
   feet away is a squint. */
export const SCREEN_BASE_W = 900;
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
/* The second move, on top of the first and only ever at fly.value === 1
   — see "THE SECOND MOVE". 0 is the arrival's bezel framing, 1 is the
   glass covering the viewport, and only a phone's sign-in ever leaves
   0. Same shape as `fly` on purpose: `dir` is what the rAF loop and
   `cameraMoving` read. */
let dive = { value: 0, dir: 0 };
let camera = null;
let composer = null;
let motionComposer = null;
let computer = null;
let desk = null;
let treehouse = null;
let nameplate = null;
/* { root, shade, point, spot } from buildLamp. The only object in the
   scene with a state the visitor can change, so it is the only one
   this module carries more than a handle for:

   - `lampOn` is the switch;
   - `lampP` is where the fade has got to, 0..1, in LAMP_FADE_S of
     wall clock either way;
   - `lampLevel` is what the lights and the emissives are actually
     running at — `lampP` eased. Nothing else multiplies it any more;
     see LAMP_FADE_S for what used to.

   All four are reset by disposeScene. */
let lamp = null;
let lampOn = LAMP_START_ON;
let lampP = LAMP_START_ON ? 1 : 0;
let lampLevel = LAMP_START_ON ? 1 : 0;
let lampBtn = null;
let onLampBtn = null;
/* The exposure the operator runs at with the lamp **on**. The lamp's
   own lift is 0 now (see LAMP_EXPOSURE_LIFT) but the arrangement
   stands, because `window.__lights` moves this and the loop writes
   `toneBase + lift` rather than a bare number — which is what keeps
   the handle and the switch from stomping each other. */
let toneBase = TONE_EXPOSURE;
/* Last exposure actually written, so the void's pre-image is re-solved
   only when it moves. */
let toneWritten = -1;
/* The fill the room runs at with the lamp **on**, for the same reason
   `toneBase` exists: the lamp scales the hemisphere down as it goes
   out (OFF_DARKNESS) and `window.__lights({ hemi })` moves the base,
   so the loop writes `hemiBase * dim` and never a bare number.
   Without this the next toggle would silently revert the handle. */
let hemiBase = HEMI_INTENSITY;
/* OFF_DARKNESS, as a `let` only so `window.__lights({ off })` can
   sweep it on a live page — the off state is a look, and a look is
   judged against one picture rather than one build per candidate. */
let offDarkness = OFF_DARKNESS;
/* The two ends of the ground half's swing, pre-built because
   `applyLampLevel` lerps between them every frame of the fade and a
   Color per frame is garbage for nothing. Both are converted to the
   working space on construction, so the lerp is linear-light. */
const HEMI_GROUND_WARM = new THREE.Color(HEMI_GROUND);
const HEMI_GROUND_COOL = new THREE.Color(HEMI_GROUND_OFF);
/* { root } from buildRoom. */
let room = null;
let envMap = null;
let hover = { target: 0, value: 0 };
/* { moon, hemi } — the two scene lights, kept so `window.__lights`
   can re-tune them on a live page. The CRT's own point light hangs off
   the computer and is reached through `computer.screenGlow`. */
let lights = null;
/* The CRT's point light runs at this times the picture's brightness.
   It is a `let` only so `window.__lights` can move it; SCREEN_GLOW is
   the value, and dispose puts it back. */
let screenGlowBase = SCREEN_GLOW;
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
/* The press being tracked for the click-or-drag decision. `target` is
   what `pickTarget` found on the way down — "lamp", "machine" or
   null — so the two actions are mutually exclusive by construction. */
let press = { id: -1, x: 0, y: 0, target: null };
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
/* stats.js panel; null unless a dev build is explicitly asked for one
   — see `perfWanted` and src/perf.js. */
let perf = null;

/* **Two gates, and they do different jobs.** `import.meta.env.DEV` is
   the one that keeps stats.js out of the bundle: Vite folds it to the
   literal `false` when building, so rollup drops the dynamic import
   and the library with it. This flag is the one that keeps the panel
   off the picture — a black FPS box pinned over the top-left corner of
   a scene being art-directed is in the way of the thing being looked
   at, and every shot `_roomshots.mjs` and friends take in dev had it
   in the corner.

   `?perf` in the query string, or `perf` in localStorage so it
   survives the reloads a profiling session makes. `_perfcheck.mjs`
   appends the parameter itself. */
function perfWanted() {
  try {
    if (new URLSearchParams(location.search).has("perf")) return true;
    return localStorage.getItem("perf") === "1";
  } catch {
    return false; // a sandboxed iframe can throw on either
  }
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function isMobile() {
  return window.innerWidth < MOBILE_BP;
}

/* `isMobile` is the *framing* question — which frustum the establishing
   shot and the arrival are fitted at — and it is width alone, because
   that is what it has always been and the arrival pose is not a thing
   to move by accident (rule 1).

   This is the other question: is the glass a place a desktop can
   actually live? A phone held sideways is 844x390, which is wider than
   MOBILE_BP and still a phone — the glass is cropped top and bottom
   instead of left and right, and a 900px desktop mapped onto it is no
   more usable for the rotation. So the hand-over's own test is "narrow,
   or short and being touched".

   `pointer: coarse` is only on the short arm, and deliberately: a
   laptop window dragged down to 500px tall is a laptop, and rule 1's
   sibling here is that a desktop viewport keeps the in-monitor desktop.
   Width under MOBILE_BP needs no such qualification — it is the
   breakpoint the scene already frames itself at.

   Three places have to agree on this: here, `PHONE` in main.js, and
   "THE PHONE'S DESKTOP" in style.css. */
const PHONE_MAX_H = 520;

function isHandheld() {
  return (
    isMobile() ||
    (window.innerHeight <= PHONE_MAX_H &&
      window.matchMedia("(pointer: coarse)").matches)
  );
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

function buildScene() {
  const s = new THREE.Scene();
  /* The background is **not** set here, and that is deliberate: which
     colour is correct depends on whether the composer is in play, and
     that is not decided until after this returns. `applyVoidColor`
     owns it. */
  /* Fog in the void's own colour. In floor.js this hid an endless
     plane's edges; here the edges are meant to be seen, and the fog
     only just catches the diorama's far corner as a depth cue. */
  s.fog = buildFog(camDist());

  /* Reduced motion is passed in rather than read in there: the room's
     one moving part is the rain on the window, and under reduced
     motion this module runs no loop at all — so the flag is really
     only a belt-and-braces slow-down. See RAIN_SLOW in
     src/nightwindow.js. */
  room = buildRoom(
    renderer.capabilities.getMaxAnisotropy(),
    prefersReducedMotion(),
  );
  s.add(room.root);

  /* The desk, and the machine standing on it. The computer is built in
     its own local space with the origin on *its* ground plane, so the
     whole group simply rises by the height of the desk top — including
     the contact-shadow blobs under the stand, the keyboard and the
     mouse, which then land on the wood rather than on the floor. */
  desk = deskMod.buildDesk();
  desk.root.name = "desk";
  s.add(desk.root);

  /* Max anisotropy, as the room takes it: the machine is seen at a
     three-quarter view, so its canvas textures are foreshortened hard
     along one axis and isotropic mip selection costs them a level or
     two of sharpness — see `canvasTexture` in computer.js. */
  computer = buildComputer(renderer.capabilities.getMaxAnisotropy());
  computer.root.name = "computer";
  /* **scene.js owns what the tube's light runs at, computer.js owns
     where it is and how it falls off.** The loop multiplies this by
     the picture's brightness every frame — but there is no loop under
     reduced motion and none before the first tick, so it is written
     once here as well. Left to computer.js's constructed value the two
     paths would disagree the moment SCREEN_GLOW moved, and the
     symptom would be a dim tube for exactly the visitors who get a
     single static frame. */
  computer.screenGlow.intensity = screenGlowBase;
  computer.root.position.set(SEAT_DX, DESK_TOP_Y, COMPUTER_Z);
  s.add(computer.root);

  /* The treehouse, likewise built with its origin on the surface it
     stands on, so it only has to be lifted by the desk's height. */
  treehouse = buildTreehouse();
  treehouse.root.name = "treehouse";
  treehouse.root.position.set(
    SEAT_DX + TREEHOUSE_X, DESK_TOP_Y, SEAT_DZ + TREEHOUSE_Z);
  treehouse.root.rotation.y = TREEHOUSE_FACING;
  treehouse.root.scale.setScalar(TREEHOUSE_SCALE);
  s.add(treehouse.root);

  /* The leftovers from building it, lying on the desk in front. Their
     own group and their own frame — the desk's, unyawed — so the
     clearances they hold (the mouse, its cord, the base plate) are
     stated in the coordinates they were measured in, and so
     `__fit("treehouse")` still measures only the model. */
  const spares = buildSpareBricks();
  spares.name = "spares";
  spares.position.set(SEAT_DX + SPARES_X, DESK_TOP_Y, SEAT_DZ);
  s.add(spares);

  /* The nameplate, on the front left of the top. Same contract as the
     two above — origin on the surface it stands on, +Z its front — so
     it is lifted by the desk's height and yawed, and nothing else.
     Built here rather than lazily because the shadow map is rendered
     once after `buildScene` returns and frozen: a caster that arrives
     later would stand in the room without a shadow. */
  nameplate = buildNameplate(
    NAMEPLATE_NAME,
    renderer.capabilities.getMaxAnisotropy(),
  );
  nameplate.root.name = "nameplate";
  nameplate.root.position.set(
    SEAT_DX + NAMEPLATE_X, DESK_TOP_Y, SEAT_DZ + NAMEPLATE_Z);
  nameplate.root.rotation.y = NAMEPLATE_FACING;
  s.add(nameplate.root);

  /* The desk lamp, on the back-left corner. Built with its origin on
     the surface it stands on like everything else here, so it only
     has to be lifted by the desk's height — and unyawed, because the
     shade's own two tilts are what point it and a group rotation on
     top would make "forward" mean two different things. */
  lamp = lampMod.buildLamp();
  /* The module may name its own seat; most do not. An alternative
     fixture is a different size and shape, so the x and z it has to
     stand at to clear the walnut's edges are its own facts, not the
     scene's — see the note in src/lamps/greenlamp.js. */
  lamp.root.position.set(
    SEAT_DX + (lampMod.LAMP_X ?? LAMP_X),
    DESK_TOP_Y,
    SEAT_DZ + (lampMod.LAMP_Z ?? LAMP_Z),
  );
  s.add(lamp.root);
  /* The lights and the emissives at the state the page opens in.
     There is no loop under reduced motion and none before the first
     tick, so the one in `tickLamp` cannot be the only writer — same
     argument as the CRT's spill above. */
  applyLampLevel(lampLevel);

  /* --- the moon ---
     Aimed *through* the window rather than placed, so moving the
     opening in room.js re-aims the beam instead of leaving it shining
     at a wall. `moonDirection` is where that is worked out. */
  const moon = new THREE.DirectionalLight(MOON_COLOUR, MOON_INTENSITY);
  moon.position.copy(MOON_FROM);
  moon.target.position.copy(MOON_AT);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  /* VSM, so this is a blur width in texels rather than a PCF spread —
     see the shadowMap.type note in initScene. 3 was set against a box
     spreading the map over ±80 world units; the box is a quarter of
     that now (below), so the same radius is a *smaller* penumbra in
     world terms. 4 puts it back to about where it read, which is what
     "soft" means here: a moon is a half-degree source, so the penumbra
     wants to be visible but not a smear. */
  moon.shadow.radius = 4;
  moon.shadow.blurSamples = 16;
  /* **The bias, which is the one number the brief asks for by name.**
     `bias` stays 0 and must: VSM does not compare depths, it compares
     a depth against a variance-bounded estimate, and a constant offset
     there shifts the whole distribution and shows up as light leaking
     out from under contacts rather than as the acne it would cure
     under PCF. What does the work is `normalBias`, which walks the
     sample point along the surface normal by a distance in *world*
     units — so the figure is a function of how much world a texel
     covers, and that changed when the box did.

     Measured rather than guessed, on the surfaces that produced acne
     before — desk.js's drawer fronts, which stand 0.03 off the face
     behind them, and now the window's own sash sitting inside its
     reveal. At the old ±80 box a texel covered 0.078 world units and
     `normalBias` was 0.02, a quarter of one. The box below is 47 x 44,
     so a texel is 0.023, and 0.035 is about a texel and a half — which
     is the band this wants: under about one texel the acne comes back
     at the shallow end of the orbit, and past about three the contact
     under the monitor's base visibly detaches. `_lightshots.mjs` crops
     all three. */
  moon.shadow.bias = 0;
  moon.shadow.normalBias = 0.035;
  /* **The box, and why it had to grow laterally and shrink overall.**
     A shadow map lives in the light's space and the light never moves,
     so nothing here is camera-dependent — the orbit cannot reach its
     edges. What it has to cover is every *caster* laterally, and every
     *receiver* the casters can reach in depth. Outside it three's
     lookup returns "lit", which is the thing to be afraid of now: the
     left wall casts (see room.js), so a receiver outside the box is
     not merely unshadowed, it is a patch of floor flooded with
     moonlight that should be in the wall's shadow.

     So the caster set is no longer just the furniture. Measured with
     `window.__shadowfit()`, which projects the room, the desk, the
     machine and the treehouse into the light's own basis: the union
     occupies **-14.0..29.3 across, -13.8..27.0 up and 15.0..60.8 in
     depth** about the light's axis. The box below clears that by about
     1.5 on every face, and is **deliberately asymmetric** — the light
     comes in over one corner of a room that is not square to it, so a
     box centred on the axis would spend half its texels on empty
     space. 47 x 44 over a 2048² map is a texel of **0.023 world
     units**, against 0.078 at the old ±80. That is most of why the
     drawer-front contacts are clean under a light raking in at 28°
     when they produced acne at 13°.

     Re-run `__shadowfit` after anything that moves the window, the
     aim or the furniture: the basis turns with the light, so these
     six numbers do not survive a re-aim.

     **`bottom` and `near` moved when the window was re-sized, and the
     other four did not** — which is the basis telling on itself. The
     taller opening raised the aim's origin, so the beam steepened
     from 36.5 to 43 degrees below the horizon, but its *azimuth* did
     not change: the horizontal part of the direction was still (11,
     13). A pure change in elevation leaves the light's right vector
     alone, so the lateral extents were the same figures to four
     decimals, and only the up/depth pair had to be re-read.

     **The landscape opening turned the azimuth, and none of the six
     had to move anyway.** Its centre dropped to 14.1 and came forward
     to z 0, so the horizontal part of the direction is now (11, 11) —
     a dead 45 degrees in plan, about 5 off the old one — and the rake
     eased to 42.2. That turns the basis, so every figure here had to
     be *re-read* rather than reasoned about: `_castfit.mjs` puts the
     caster at -6.4..13.9 across, -15.0..15.6 up and 13.0..43.4 deep,
     and `__shadowfit('desk', 'computer', 'treehouse', 'lamp')` puts
     the furniture at -3.7..22.3, -13.1..12.8 and 21.1..49.8. Both sit
     inside the faces below with margin on all six, so the box is left
     where it is — the texel stays 0.023 and `normalBias` stays
     calibrated against it.

     The caster is the thing that outgrew them. Measured in the
     light's basis, room.js's casting rectangle — now 23 tall rather
     than 19 — runs -4.5..14.0 across, **-15.6..16.1 up and 12.7..44.3
     in depth**, so at the old -15.5 and 13 the wall's own bottom
     corner and its outer face were being clipped out of the map:
     parts of the one caster in the room, not casting. -17.5 and 11
     clear it by about 1.7 either way, and cost a texel 0.0222 world
     units wide against 0.0215. */
  const cam = moon.shadow.camera;
  cam.left = -16;
  cam.right = 31;
  cam.bottom = -17.5;
  cam.top = 28.5;
  cam.near = 11;
  cam.far = 64;
  cam.updateProjectionMatrix();
  s.add(moon, moon.target);

  /* --- the fill ---
     One hemisphere and nothing else. Its two colours are the room's
     own: the sky half is the wall plum, the ground half is the warm
     bounce off the plank floor and the lamp-lit walnut. That is what
     a night interior's bounce actually is — light that has already
     hit these surfaces once — and it is also what keeps the shadowed
     side of everything *coloured* rather than merely dark, which is
     the whole difference between moody and black.

     **The two halves are deliberately different temperatures**, and
     that is load-bearing rather than decorative: see HEMI_SKY. Every
     source in this room but the tube sits behind the plane the desk's
     enamel and the monitor's shell face, so the fill is the only
     thing lighting them and a single-coloured hemisphere renders them
     flat by construction. */
  const hemi = new THREE.HemisphereLight(HEMI_SKY, HEMI_GROUND, HEMI_INTENSITY);
  s.add(hemi);
  /* Written even though nothing is loaded into `scene.environment`,
     so `window.__lights()` reports what the rig means rather than
     three's default of 1 over a map that is not there. */
  s.environmentIntensity = ENV_INTENSITY;
  lights = { moon, hemi };
  /* The fill is created at its **lamp-on** figures, because that is
     what HEMI_INTENSITY and HEMI_GROUND are calibrated as — so if the
     lamp is not on, the room has to be taken down to the off state
     before the first frame. `applyLampLevel` ran once already, from
     the lamp's own build, when `lights` was still null and there was
     nothing to write to; this is the catch-up, and it is a no-op at
     LAMP_START_ON. */
  applyLampLevel(lampLevel);

  return s;
}

/* ==========================================
   AIMING THE MOON

   A DirectionalLight has no position, only a direction — but "coming
   through the window" is a statement about a *line*, and the line is
   the one from the opening to where the beam lands on the desk. So
   both ends are derived:

   - the opening's centre comes off `ROOM_PLAN.window`, which room.js
     writes from the same two constants it cuts the hole with, so
     moving the window re-aims the light rather than leaving it
     shining at a wall;
   - `MOON_AT` is where the beam is pointed, chosen rather than
     derived: a little past the machine and a little below the desk
     top, so the patch of floor the window throws lands clear of the
     desk's own shadow instead of inside it.

   The elevation that falls out is 42.2° below the horizon. It is much
   steeper than the daylight key's 13°, and consistent rather than a
   compromise: the moon is hung high in the window's own sky, so the
   beam has to come down from up there. Both ends of the line are
   derived, which is why re-sizing the opening re-aims the light on its
   own — and why the shadow box above has to be re-measured when it
   does.

   `MOON_DIST` only decides where the shadow camera sits along the
   axis; the light itself is parallel. It is short because the box's
   `near`/`far` are set against it, and a long throw spends depth
   precision on empty space.
   ========================================== */
/* **Where the beam lands, and it is the one figure here that was
   genuinely searched for rather than tuned.** The light has to clear
   the desk to reach any floor at all: the window's centre is at y
   14.1 and the desk top is at 9 only 3.2 units in from the wall, so a
   beam shallow enough to run the length of the room is already below
   the desk top before it has left the wall, and one steep enough to
   land inside the 32-unit room lands *on* the desk. Six aims were
   shot (`_lightshots.mjs`'s A..F pass); five put the whole floor in
   the wall's shadow and lit nothing.

   This one works because it goes mostly **forward in +z rather than
   across in +x**: by the time it has reached the desk's near edge it
   is already past it in depth, so it crosses the desk top, clears the
   front edge and lands on the floor and the rug in front. That is the
   pool in the shot — striped by the sash and its three bars, which
   is what the casting wall buys. */
const MOON_AT = new THREE.Vector3(-2.0, 0, 11.0);
const MOON_DIST = 45;

/* The opening's centre on the left wall's inner face, off the same two
   constants room.js cuts the hole with. */
function windowCentre() {
  const win = ROOM_PLAN.window;
  return new THREE.Vector3(ROOM_PLAN.X0, win.sillY + win.h / 2, win.z);
}

function moonDirection(at = MOON_AT) {
  return at.clone().sub(windowCentre()).normalize();
}

/* Where three has to stand the light so the beam runs down that line.
   The light is parallel, so this only decides where the shadow camera
   sits along the axis — and the box's near/far are quoted against it. */
const MOON_FROM = MOON_AT.clone().addScaledVector(moonDirection(), -MOON_DIST);

/* Re-aims the moon on a live page, through `window.__lights({ at })`.
   **The shadow map has to be re-rendered**, which is the one thing
   that makes this more than two assignments: `autoUpdate` is off, so
   without the flag the beam moves and its shadow does not. */
function setMoonAt(x, y, z) {
  MOON_AT.set(x, y, z);
  lights.moon.target.position.copy(MOON_AT);
  lights.moon.position.copy(
    MOON_AT.clone().addScaledVector(moonDirection(), -MOON_DIST),
  );
  lights.moon.target.updateMatrixWorld();
  renderer.shadowMap.needsUpdate = true;
}

/* ==========================================
   THE DESK LAMP

   The one thing in the room with a switch. Everything about *what* the
   lamp is lives in src/lamp.js — the shape, the two lights, and the
   curve from a 0..1 level to five brightnesses. What lives here is the
   state, the fade, and the one knob the room's exposure lends it.

   The division is the same one the fly-in draws between GSAP and
   `applyFly`, and for the same reason: `setLamp` is linear in its
   level, so the easing can be re-shaped without touching anything
   about how a lamp at 0.3 looks — which is also what let the strike
   come back out without touching lamp.js at all.
   ========================================== */

/* Writes a level to the fixture, **to the room's fill, and to the
   exposure** — the two halves that cannot live in lamp.js: the fill
   belongs to the room and the operator belongs to the renderer, and
   the void's pre-image moves with the latter.

   **The fill is the off state.** See OFF_DARKNESS for the argument;
   what is here is the curve, and it is linear in the level on purpose
   so it tracks `setLamp` exactly rather than crossing it somewhere in
   the middle of the fade. The ground half's colour moves with it,
   which is the half of the effect the eye reads as temperature.

   **Nothing here moves a light**, so the frozen shadow map stays
   valid: an intensity and a colour are both shader uniforms, and the
   only thing in this scene that invalidates the map is a light
   changing position — see `window.__lamp`'s `tilt`. */
function applyLampLevel(level) {
  lampLevel = level;
  lampMod.setLamp(level);
  /* The nameplate's brass is lit by a drawn environment rather than by
     the fixture, so it has to be told; see ENV_OFF in nameplate.js.
     Two uniform writes, and nothing here moves a light — the frozen
     shadow map is as valid after this as before it. */
  nameplate?.setLight(level);
  /* `lights` is still null when `buildScene` calls this to seed the
     fixture — the lamp is built before the fill is — and the rig is
     created at its lamp-on figures, so there is nothing to catch up. */
  if (lights) {
    const dim = offDarkness + (1 - offDarkness) * level;
    lights.hemi.intensity = hemiBase * dim;
    lights.hemi.groundColor
      .copy(HEMI_GROUND_COOL)
      .lerp(HEMI_GROUND_WARM, level);
  }
  if (!renderer) return;
  /* Snapped, because every distinct value costs a Newton solve for the
     void's pre-image. See EXPOSURE_STEP. */
  const want =
    Math.round(
      ((toneBase + LAMP_EXPOSURE_LIFT * (1 - level)) / EXPOSURE_STEP),
    ) * EXPOSURE_STEP;
  if (Math.abs(want - toneWritten) < 1e-6) return;
  toneWritten = want;
  renderer.toneMappingExposure = want;
  applyVoidColor();
}

/* The switch. One entry point for all three routes in — a press on the
   fixture, the hidden button, and `window.__lamp` — so the DOM's
   `aria-pressed` cannot fall out of step with the light.

   `jump` is what reduced motion and dispose take: there is no render
   loop on that path, so a fade would leave the lamp stuck wherever the
   last frame put it. It lands on the endpoint and draws once. */
function setLampOn(on, jump = !frame) {
  lampOn = !!on;
  if (jump) {
    lampP = lampOn ? 1 : 0;
    applyLampLevel(lampP);
    if (renderer) render();
  }
  lampBtn?.setAttribute("aria-pressed", String(lampOn));
  return lampOn;
}

/* Called once a frame from the render loop. Linear in time, so the
   fade really is LAMP_FADE_S rather than an exponential that never
   arrives — and the two directions get different shapes:

   - **on** is `1-(1-p)^2`: fast off the mark, settling into the last
     few percent, which is how a filament behaves.
   - **off** is `p^2`: the light drops most of the way immediately and
     then tails out, which is a filament cooling.

   Nothing is written once the ramp has arrived, so a lamp sitting
   still costs one comparison. */
function tickLamp(dt) {
  if (!lamp) return;
  const target = lampOn ? 1 : 0;
  if (lampP === target) return;
  const step = dt / LAMP_FADE_S;
  lampP = lampOn
    ? Math.min(1, lampP + step)
    : Math.max(0, lampP - step);
  applyLampLevel(lampOn ? 1 - (1 - lampP) * (1 - lampP) : lampP * lampP);
}

/* The hidden button in index.html — the keyboard and screen-reader
   route to the same switch. Unhidden here rather than in main.js for
   the same reason the orbit hint is: without WebGL there is no lamp,
   so there must be no control for one either. `aria-pressed` carries
   the state and is written by `setLampOn`, so a press on the fixture
   updates the button too. */
function initLampButton() {
  lampBtn = document.getElementById("lamp-toggle");
  if (!lampBtn) return;
  lampBtn.hidden = false;
  lampBtn.setAttribute("aria-pressed", String(lampOn));
  onLampBtn = () => setLampOn(!lampOn);
  lampBtn.addEventListener("click", onLampBtn);
}

/* ==========================================
   THE VOID

   The diorama floats in a flat #1C1A2A, and that colour has to come
   out of the pipeline exactly: it is a large flat area, and it is also
   what `--scene-void` paints into the strip the taskbar vacates during
   the fly-in, so a few levels of drift between the two shows as a
   seam across the bottom of the picture.

   Tone mapping breaks that, and asymmetrically — which is the part
   worth knowing. three writes the background clear through
   `getUnlitUniformColorSpace`, which hands back the *output* colour
   space when drawing straight to the canvas and *linear* sRGB when
   drawing into a render target. So:

   - **direct path** (mobile, reduced motion): the clear is written to
     the canvas in sRGB and never passes through an operator. Exact for
     free, with the raw colour.
   - **composer path** (desktop): the clear lands in the HalfFloat
     buffer and `OutputPass` tone maps it along with everything else.
     Untreated, #1C1A2A would come out #15152A under AgX — and #0A0917
     under ACES, which is nearly black.

   So the composer path gets the colour that tone maps *to* the void,
   and src/tonemap.js solves for it. The fog needs none of this: three
   includes `fog_fragment` after both `tonemapping_fragment` and
   `colorspace_fragment` and uploads `fogColor` through the same
   colour-space helper, so a fully-fogged fragment already resolves to
   exactly `fog.color` on both paths.

   Called after the composer decision, and again by `__tonemap`.
   `_roomshots.mjs` verifies the result against a real `readPixels` of
   the void and prints the error in 0-255 units. */
function applyVoidColor() {
  if (!scene || !renderer) return;
  const target = new THREE.Color(VOID);
  scene.background = composer
    ? tonemapPreimage(target, renderer.toneMapping, renderer.toneMappingExposure)
    : target;
  /* The fog is the raw colour on both paths — see above. */
  scene.fog?.color.set(target);
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
/* Re-set by `seatToDesk` — see there for why it is mutated rather than
   rebound. */
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

/* ...and the one the flight arrives at: the glass centred and large,
   with the bezel and a little of the case around it. `ARRIVE_PAD` is
   the whole of the pull-back; the target is still the screen's own
   centre, so nothing here decides where the glass sits in the frame,
   only how much of the machine comes with it.

   **`max`, not the `min` this used to be.** `min` was "cover the
   viewport": it took the smaller of the two fits, so the glass
   overhung whichever axis was spare and the panel was cropped on all
   four sides. `max` contains the glass instead — both axes fit — and
   the pad then buys the border. On a 16:9 frame the width is what is
   spare, which is why the sides show more case than the top and bottom
   show bezel. That asymmetry is the viewport's, not a choice.

   **Narrow viewports keep the height fit alone.** A portrait frame
   containing a 4:3 panel's *width* would leave the glass about a third
   of the frame — and with it the login, which is already the smallest
   it can usefully be there. So the height is fitted, padded barely
   over 1, and the sides of the panel run off frame: less bezel on a
   phone, on purpose. Over 4:3 that is the looser of the two fits
   anyway, so a narrow landscape window gets the whole glass regardless.

   Both of these are unchanged by the perspective camera, and that is
   the point of specifying framings as frustum heights: the relationship
   between a height at the target, the aspect and what fills the frame
   is the same for either projection. Only the step from a height to a
   camera position is new. */
function screenFrustum(aspect) {
  const h = SCREEN_H * SCREEN_INNER;
  const w = SCREEN_W * SCREEN_INNER;
  return isMobile()
    ? ARRIVE_PAD_MOBILE * h
    : ARRIVE_PAD * Math.max(h, w / aspect);
}

/* ...and the one the *second* move arrives at: the glass covering the
   viewport, which is the `min` this one's sibling above deliberately
   stopped being. Both fits are candidates and the smaller wins, so the
   glass overhangs whichever axis is spare and nothing but picture is
   left in the frame — no bezel, no case, no wall. That is the wrong
   framing for a login and the only possible one for a phone's
   desktop, which is why there are two of these rather than one knob.

   Note how little of a move it is on a portrait phone: `screenFrustum`
   is already at `ARRIVE_PAD_MOBILE` (1.06) on the same axis this fits,
   so the dive is a 6% push that takes the last sliver of bezel off the
   top and bottom. Correct, and deliberately undramatic — the glass
   already overflows a phone sideways at the arrival. What the move
   buys is not drama; it is the right to hand the page over. */
function coverFrustum(aspect) {
  const h = SCREEN_H * SCREEN_INNER;
  const w = SCREEN_W * SCREEN_INNER;
  return COVER_BLEED * Math.min(h, w / aspect);
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

/* The second move's pose, and it is deliberately thin: `applyFly(1)`
   does all the work and this only shortens the radius.

   That is what keeps the two moves honest with each other. The arrival
   is defined by the spline's endpoint — not by a copy of it here — so
   q = 0 *is* `applyFly(1)`, and anything that moves the glass (which
   moves `SCREEN_TARGET`, and with it the whole flight; see
   docs/screen-overlay.md) moves both framings together. Direction comes
   off the camera applyFly just posed, for the same reason: the arrival
   is head-on by construction rather than by assertion, and this does
   not need to know that.

   Linear in q, like `applyFly` — the easing is the timeline's. */
function applyDive(q, width, height) {
  const f0 = applyFly(1, width, height);
  const u = clamp01(q);
  if (u === 0) return f0;
  /* `min` guards the one case that would read as a zoom *out* mid
     sign-in: a viewport whose cover fit is somehow looser than the
     arrival's. There isn't one at either pad, but the guard is free. */
  const f1 = Math.min(f0, coverFrustum(width / height));
  const f = Math.exp(lerp(Math.log(f0), Math.log(f1), u));
  const dist = distFor(f);
  flyOffset.copy(camera.position).sub(flyTarget);
  const len = flyOffset.length() || 1;
  camera.position.copy(flyTarget).addScaledVector(flyOffset, dist / len);
  camera.lookAt(flyTarget);
  camera.updateMatrixWorld();
  flyPose.frustum = f;
  flyPose.dist = dist;
  return f;
}

/* The one call anything outside the two moves should make: whichever of
   them currently owns the camera, posed for this viewport. Both are
   derived from their parameter rather than stored, so this is also the
   whole of what a resize has to do — which is what keeps a phone that
   rotates mid-session framed correctly. See onResize and reframeHome. */
function applyPose(width, height) {
  return dive.value > 0
    ? applyDive(dive.value, width, height)
    : applyFly(fly.value, width, height);
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
   to anything, which is the arrival: it stands ~12 units off the glass
   at the default 20° FOV, and ~9.5 at the 25° end of what
   `window.__fov` will shoot. (It used to have to clear a second,
   closer move — the sign-in pushed in until the glass covered the
   viewport, ~8 units out — and half a unit was a wide margin even
   there. The desktop arrives on the glass at the arrival's own framing
   now, so nothing comes closer than this.) `far` reaches the far edge of the floor plane
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
  return ROOM_RADIUS + distFor(FRUSTUM_MOBILE * homeZoom) + 20;
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

/* The controls are the camera's owner at the establishing shot and
   nowhere else. `fly.value === 0` is the whole of it: the flight
   disables them on its way in and `depart` hands them back, and that
   holds whether or not anyone is signed in — a visitor can leave the
   desktop up on the glass, walk the camera back out to the room and
   swing it, and the desktop is still there when they press the monitor
   again. */
function orbitAllowed() {
  return !!controls && controls.enabled && fly.value === 0;
}

/* True while the camera is in motion for any reason: the flight, a
   drag, the damping glide after one, or the walk home.
   updateScreenOverlay snaps the two expensive CRT variables while it
   is — the cost is a raster per distinct value, and an orbit changes
   the screen's on-screen scale just as a flight does. */
function cameraMoving() {
  return (
    fly.dir !== 0 ||
    dive.dir !== 0 ||
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

/* Where the camera's orbit circle crosses each wall's inner face, in
   azimuth. `phi` is the **flattest** polar angle the elevation leash
   allows, because that is where the horizontal radius is widest and
   the crossing closest to the monitor's front: one pair of scalars
   that holds at every elevation, rather than a clamp that creeps about
   underneath the visitor as they tilt.

   A wall the circle cannot reach constrains nothing, which is what the
   out-of-range branches are — and they are not hypothetical, since the
   radius is the framing and a phone's is half again a desktop's. */
function wallAzimuthRange(radius, phi) {
  const R = radius * Math.sin(phi);
  let lo = -Math.PI;
  let hi = Math.PI;
  /* The -X wall: camera.x >= X0, and camera.x - target.x = R sin(t),
     so sin(t) >= s. That bounds t below at asin(s) and above at its
     reflection, pi - asin(s). */
  const sx = (ROOM_PLAN.X0 - ISO_TARGET.x) / R;
  if (sx > -1) {
    const a = Math.asin(Math.min(1, sx));
    lo = Math.max(lo, a);
    hi = Math.min(hi, Math.PI - a);
  }
  /* The -Z wall: camera.z >= Z0, and camera.z - target.z = R cos(t),
     so cos(t) >= s, which is the band |t| <= acos(s). */
  const sz = (ROOM_PLAN.Z0 - ISO_TARGET.z) / R;
  if (sz > -1) {
    const a = Math.acos(Math.min(1, sz));
    lo = Math.max(lo, -a);
    hi = Math.min(hi, a);
  }
  return { lo, hi };
}

/* The leash in force: where the camera rests, and where OrbitControls'
   own hard clamp sits a stretch beyond it. */
const orbitLeash = { min: 0, max: 0, softMin: 0, softMax: 0 };

/* Both clamps, from the room and from home. Called wherever the radius
   or the home pose is (re-)seeded — initOrbit and reframeHome — because
   the azimuth half depends on the radius now, which the viewport
   decides.

   Reduced motion gets no stretch, so the hard clamp *is* the resting
   limit: the spring is motion, there is no render loop to run it in,
   and a visitor who asked for less of it should not be the one who
   finds the camera parked inside the margin. */
function applyOrbitLimits() {
  const wall = wallAzimuthRange(orbitHome.radius, orbitHome.phi + ORBIT_DOWN);
  orbitLeash.softMin = wall.lo + AZ_WALL_MARGIN;
  orbitLeash.softMax = wall.hi - AZ_WALL_MARGIN;
  /* A room small enough for the two to cross would leave no leash at
     all; collapse to home rather than hand OrbitControls an inverted
     pair, which it would resolve by dragging the camera to one end. */
  if (orbitLeash.softMin > orbitLeash.softMax) {
    orbitLeash.softMin = orbitLeash.softMax = orbitHome.theta;
  }
  const stretch = controls.enableDamping ? AZ_WALL_STRETCH : 0;
  orbitLeash.min = orbitLeash.softMin - stretch;
  orbitLeash.max = orbitLeash.softMax + stretch;
  controls.minAzimuthAngle = orbitLeash.min;
  controls.maxAzimuthAngle = orbitLeash.max;
  controls.minPolarAngle = orbitHome.phi - ORBIT_UP;
  controls.maxPolarAngle = orbitHome.phi + ORBIT_DOWN;
}

/* **The soft end of the leash.** OrbitControls' clamp is hard and it is
   still there — it is what makes the wall a guarantee — but it sits
   AZ_WALL_STRETCH past where the camera is meant to come to rest, and
   this takes a share of the overshoot back every frame.

   One exponential does both halves of the feel. Pushing into the band
   meets a resistance that grows the further it goes, because the drag
   adds a fixed delta per frame while this takes a fraction of the
   *whole* overshoot, and the two balance short of the stop. Letting go
   leaves only the pull, so the camera eases out of the band instead of
   sitting against a wall it hit.

   Writing the camera here needs nothing kept in sync: `update()`
   re-derives its angles from the camera position on every call, which
   is the same reason the walk home can tween it. */
function easeAzimuthLimits(dt) {
  const theta = controls.getAzimuthalAngle();
  const over =
    theta < orbitLeash.softMin
      ? theta - orbitLeash.softMin
      : theta > orbitLeash.softMax
        ? theta - orbitLeash.softMax
        : 0;
  if (!over) return;
  setOrbitAngles(
    theta - over * (1 - Math.exp(-AZ_EASE_RATE * dt)),
    controls.getPolarAngle(),
  );
  /* The spring moves the camera without going through the controls, so
     no `change` fires for it — without this `cameraMoving()` would read
     at rest while the band is still unwinding, and the CRT would take a
     raster per frame of it. */
  orbitChangedAt = performance.now();
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
     frame, not just on input. The soft limit rides immediately behind
     it, on the same condition: the walk home writes angles of its own
     and neither of these may argue with it. */
  if (!orbitTween) {
    controls.update(dt);
    easeAzimuthLimits(dt);
  }

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

/* What is under this event: the lamp, the machine, or neither.

   Both targets are the whole object rather than the part that does the
   work — the machine is the same group hover already highlights, and on
   a phone the glass alone (or a 0.07-unit pole) is a small thing to hit.

   **One raycast over both, nearest wins, and the lamp wins a tie**,
   which is how "check the lamp before the monitor" is kept true at
   every point of the orbit leash rather than just at the home framing.
   Testing the lamp first and returning would toggle it through the
   monitor from the azimuths where it sits behind the machine; taking
   the nearest hit means a press can only ever be one of the two, which
   is the thing that actually matters. */
const pickNdc = new THREE.Vector2();
const pickRay = new THREE.Raycaster();

function pickTarget(e) {
  if (!computer || !canvasEl || !camera) return null;
  const r = canvasEl.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  pickNdc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  pickNdc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  pickRay.setFromCamera(pickNdc, camera);
  /* The lamp is listed first so three's stable sort leaves it ahead of
     the machine at equal distance. */
  const roots = lamp ? [lamp.root, computer.root] : [computer.root];
  const hits = pickRay.intersectObjects(roots, true);
  if (!hits.length) return null;
  for (let o = hits[0].object; o; o = o.parent) {
    if (lamp && o === lamp.root) return "lamp";
    if (o === computer.root) return "machine";
  }
  return null;
}

/* The click-or-rotate decision. A press that travelled more than
   CLICK_SLOP was a drag, and the camera has already answered it by
   turning; only a press that stayed put is a click. Both halves are
   recorded on the way down, because by the time the pointer comes up
   the camera has moved and the raycast would be asking about a
   different frame.

   **The lamp is decided in the same raycast as the monitor**, which is
   what makes "one click never does both" a property of the code rather
   than of where the two objects happen to sit — see `pickTarget`. */
/* Is this point on the glass? The canvas is only asked once the camera
   has arrived, and the arrival is head-on: the quad is axis-aligned
   there (`quadTransform` takes its `matrix()` branch), so the box's
   client rect is the glass exactly rather than a bound around it.

   The press below is on the canvas, which sits *under* #screen — so a
   press that lands on the picture never reaches it in the first place.
   This is the second half of that, for the pointer *up*: the canvas
   captures the stream on the way down, so a release that drifted onto
   the glass would otherwise still arrive here. Both ends outside is
   the rule. */
function overScreen(x, y) {
  if (!screenEl) return false;
  const r = screenEl.getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

/* Can a press on the room take the camera back out? Only parked at the
   screen, only while nothing else is moving, never on a phone's
   full-page desktop — there the canvas is behind the whole page and
   there is no "outside the screen" to press — and not while a menu is
   open on the desktop, because the first press after opening one
   closes it and does nothing else. `menu-open` is main.js's, written
   so this does not have to know what a Start menu is; Escape follows
   the same rule through `dismissChrome`. */
function canLeaveScreen() {
  return (
    !!screenEl &&
    fly.value === 1 &&
    fly.dir === 0 &&
    dive.value === 0 &&
    dive.dir === 0 &&
    !screenBrokenOut() &&
    !document.body.classList.contains("menu-open")
  );
}

function initCanvasPress(canvas) {
  onCanvasDown = (e) => {
    press.id = -1;
    if (!e.isPrimary) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (orbitAllowed()) {
      press = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        target: pickTarget(e),
      };
      return;
    }
    /* Parked at the screen, the canvas is everything that is *not* the
       picture — bezel, case, desk, lamp, room, wall. A click on any of
       it is "take me back", which is the same gesture as clicking off
       a dialog. One target for the lot: nothing out here is pickable
       while the camera is at the glass. */
    if (!canLeaveScreen() || overScreen(e.clientX, e.clientY)) return;
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, target: "room" };
    /* OrbitControls would normally be holding the capture, but it is
       disabled at the screen and takes none — so without this a
       release a few pixels away over the glass never arrives. */
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* A pointer that has already gone. The slop check below still
         holds without the capture. */
    }
  };
  /* OrbitControls captures the pointer on this same element, so the up
     still arrives here however far outside the canvas the drag went. */
  onCanvasUp = (e) => {
    if (e.pointerId !== press.id) return;
    const moved = Math.hypot(e.clientX - press.x, e.clientY - press.y);
    const target = press.target;
    press.id = -1;
    if (target === "room") {
      if (canvas.hasPointerCapture?.(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
      /* A drag is a drag wherever it ends: the leash is not live here,
         so travel means the visitor changed their mind, not that they
         swung the camera. */
      if (moved > CLICK_SLOP || overScreen(e.clientX, e.clientY)) return;
      if (canLeaveScreen()) flyFromScreen();
      return;
    }
    if (!target || moved > CLICK_SLOP || !orbitAllowed()) return;
    /* The lamp first, and it returns — so the monitor's zoom cannot
       also see this press. */
    if (target === "lamp") setLampOn(!lampOn);
    else enterScreen();
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
     ELEVATION; the azimuth leash is not — it is the room's, and comes
     off the two wall planes. */
  orbitHome.theta = controls.getAzimuthalAngle();
  orbitHome.phi = controls.getPolarAngle();
  orbitHome.radius = camera.position.distanceTo(controls.target);
  /* Azimuth off the room's own two walls, elevation off home.
     orbitHome.theta sits inside the azimuth range
     rather than in the middle of it, which is the whole point — and it
     has to sit inside it, or the walk home would be tugging against
     the leash. See applyOrbitLimits. */
  applyOrbitLimits();

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

   It used to reach one thing setFov does not — the floor, whose type
   was sized off `frustumFor()` and so had to be laid out again
   whenever this number moved. The room is fixed world geometry, so
   there is nothing left to re-lay-out and this is now a pure camera
   change. */
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
  applyPose(width, height);

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
    /* Both clamps, not just the elevation pair: the azimuth half comes
       off the orbit radius, and the radius is what a resize changed. */
    applyOrbitLimits();
  }
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
/* The last string written, so a frame that computes the same transform
   costs no style invalidation — which the break-out, writing `none` on
   every call, would otherwise do once per resize-driven update. */
let screenTransform = "";

function setScreenTransform(t) {
  if (t === screenTransform) return;
  screenTransform = t;
  screenEl.style.transform = t;
}

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

  /* Signed in on a viewport where the arrival crops the glass, the box
     is not on the plane at all: CSS has laid it over the whole page
     (see "NARROW VIEWPORTS" in style.css) and the matrix has to come
     off for `inset: 0` to mean anything. Written once on the way in
     rather than every frame, and the overlay stays *visible* — it is
     the only thing on screen in that state. */
  if (screenBrokenOut()) {
    setBrokenOut(true);
    setScreenTransform("none");
    screenAway = false;
    syncScreenVisibility();
    return;
  }
  setBrokenOut(false);

  /* Seen from behind, a plane projects to a mirrored quad: the matrix
     below would fold the login inside out rather than hide it. **The
     leash does now reach this**, which it did not while a ±60° cap off
     the monitor's front was in front of it: the right-hand end of the
     swing is the -Z wall at about +88°, and the glass goes edge-on
     around +80°. So the last few degrees of that swing hand the picture
     to the baked still, and this is a working part rather than a
     guard. */
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
  setScreenTransform(transform);

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
   stands up fine without it, it just loses its highlights — which is
   all it does now. It is not one of the night rig's three lights; see
   ENV_INTENSITY.
   ========================================== */
async function loadEnvironment() {
  /* Off means off: no fetch, not a fetch whose result is scaled to
     nothing. See ENV_INTENSITY. */
  if (!ENV_INTENSITY) return false;
  try {
    const url = `${import.meta.env.BASE_URL}env/studio-small-09-256.hdr`;
    const hdr = await new HDRLoader().loadAsync(url);
    const pmrem = new THREE.PMREMGenerator(renderer);
    envMap = pmrem.fromEquirectangular(hdr).texture;
    scene.environment = envMap;
    /* **It arrives as a reflection, not as a light.** Under the
       daylight rig this was the ambient source and the flat fills came
       *down* when it landed, to stop the cream blowing out. Nothing
       comes down now: at ENV_INTENSITY the HDRI's diffuse term is
       below the quantisation of the darkest surface in the room, and
       all it is still here for is to put something in the CRT's glass
       and the desk's chrome pulls. See the constant for the A/B. */
    scene.environmentIntensity = ENV_INTENSITY;
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
  if (lamp) clip.union(new THREE.Box3().setFromObject(lamp.root));
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

function buildMotionComposer() {
  const c = new EffectComposer(renderer);
  // Same RenderPass -> OutputPass path and motion resolution as before,
  // with its buffers retained while the full-resolution AO composer rests.
  c.setPixelRatio(Math.min(scenePixelRatio(), 1));
  c.addPass(new RenderPass(scene, camera));
  const output = new OutputPass();
  // The final pass writes straight to the canvas. Keep reading the same
  // target instead of allocating the unused ping-pong target on frame two.
  output.needsSwap = false;
  c.addPass(output);
  return c;
}

/* ==========================================
   HOVER, AND THE CURSOR

   One raycast per pointer move, feeding two things: the screen's
   hover brightness, and what the cursor says the canvas will do with
   a press — the machine and the lamp are clicks, the room around them
   is a drag.

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
    // A drag already owns the gesture; raycasting every coalesced move
    // cannot change its action and competes with drawing the next frame.
    if (orbitDragging) {
      hover.target = 0;
      canvas.style.cursor = "grabbing";
      return;
    }
    if (e.target?.closest?.(".window, #taskbar, #start-menu")) {
      hover.target = 0;
      return;
    }
    const target = pickTarget(e);
    /* Only the machine takes the screen's hover brightness — the lamp
       says what it does by being a switch, and brightening the CRT
       when the pointer is over something else would be a lie about
       what a press is going to do. */
    hover.target = target === "machine" ? 1 : 0;
    canvas.style.cursor = orbitDragging
      ? "grabbing"
      : target
        ? "pointer"
        : "grab";
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
  syncRenderQuality();
  const activeComposer = motionQuality && motionComposer ? motionComposer : composer;
  if (activeComposer) activeComposer.render();
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

/* setFly's counterpart for the second move. There is no `--scene-fade`
   hand-over to drive here: it finished at 1 well before the flight
   landed, and the strip under the canvas has been desktop teal ever
   since. */
function setDive(q) {
  dive.value = q;
  applyDive(q, canvasEl.clientWidth, canvasEl.clientHeight);
  updateScreenOverlay();
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
  /* Arriving on a phone's signed-in session, the desktop takes the
     page from here — and `screenBrokenOut` only becomes true now that
     `fly.dir` is back to 0, so the overlay has to be asked again. */
  updateScreenOverlay();
  /* The login's field is what a visitor who has not signed in came
     for. One who has is coming back to a desktop they left open, and
     taking the focus off whatever is up in it would be rude. */
  if (!document.body.classList.contains("signed-in")) {
    document.getElementById("login-user")?.focus({ preventScroll: true });
  }
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

   - the live overlay takes the picture over from the still (the
     stylesheet derives its opacity from `--page-fade`),
   - the page scales the last FADE_SCALE up to its resting size, so it
     settles into the frame rather than snapping to it,
   - and `--page-fade` crosses the body from the floor grey the taskbar
     strip shows during the flight to the desktop teal behind the login.

   **The canvas no longer dissolves here, and the arrival framing is
   why.** It used to: the flight ended with the glass covering the
   viewport, so the monitor it was mapped onto had nothing left in shot
   and fading it out was free. The arrival now keeps the bezel and a
   little of the case around the screen (see `screenFrustum`), and the
   canvas is the only thing drawing them — dissolve it and the login is
   left floating on bare teal, which is the exact framing this change
   was made to get away from. The hand-over is still a crossfade, just
   of the picture on the glass alone: the still underneath and the live
   overlay on top are the same login at the same place, so there is
   nothing to give away. The canvas goes out at the **sign-in**
   instead, where the desktop really does take the whole viewport —
   that is a CSS transition off `body.signed-in`, which is also why
   nothing here writes the canvas's opacity any more (an inline one
   would outrank it).
   ========================================== */
function applyFade(v) {
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
/* Nothing inside a <foreignObject> can reach the network, which the
   fonts already have to live with — but the desktop is *made* of
   images (every icon, on the desktop, in a title bar, in the taskbar,
   on the Start button), and a still with holes where they go is worse
   than no still at all. So they are fetched once, turned into `data:`
   URIs and kept: the set is small, fixed and generated by
   `npm run icons`, and after the first still every one of them is a
   cache hit. */
const dataUrls = new Map();

async function inlineImages(root) {
  await Promise.all(
    [...root.querySelectorAll("img[src]")].map(async (img) => {
      const src = img.getAttribute("src");
      if (!src || src.startsWith("data:")) return;
      try {
        if (!dataUrls.has(src)) {
          const blob = await (await fetch(src)).blob();
          dataUrls.set(
            src,
            await new Promise((ok, fail) => {
              const r = new FileReader();
              r.onload = () => ok(r.result);
              r.onerror = fail;
              r.readAsDataURL(blob);
            }),
          );
        }
        img.setAttribute("src", dataUrls.get(src));
      } catch {
        /* One icon that would not load is a gap in a bitmap shown for
           1.6s. The rest of the still is still worth having, so this
           is deliberately not fatal. */
      }
    }),
  );
}

/* Whichever layer is the picture right now. They are siblings in the
   same box and exactly one of them is up, so the still follows the
   sign-in without being told about it. */
function stillLayer() {
  return document.getElementById(
    document.body.classList.contains("signed-in") ? "screen-shell" : "screen-page",
  );
}

async function buildStillMarkup(w, h) {
  const page = stillLayer();
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
  const clone = page.cloneNode(true);
  /* The gate's state is carried by a class on the *body*, and in here
     there is no body to carry it — so the stylesheet's `opacity: 0`
     for a desktop nobody has signed in to would blank the bitmap.
     This is the one thing the clone has to be told. */
  clone.style.opacity = "1";
  clone.style.visibility = "visible";
  await inlineImages(clone);
  wrap.append(style, clone);

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
    const svg = await buildStillMarkup(w, h);
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

/* The login changes only when someone types into it, which the form's
   `input` listener covers. The desktop changes whenever a window
   opens, moves, is minimized or closed, and there is no one event for
   that — so the subtree is watched instead and the bitmap redrawn once
   the changes stop. Debounced, not per-mutation: dragging a window is
   a mutation a frame and rasterising is several milliseconds.

   The clock is excluded. It rewrites its own text once a second for as
   long as the page is open, and a still whose clock is a minute stale
   — on a picture shown for 1.6s, shrinking as it goes — is not a
   defect worth a redraw a second. */
const STILL_SETTLE_MS = 600;
let stillObserver = null;
let stillTimer = 0;

function watchDesktopStill() {
  const shell = document.getElementById("screen-shell");
  if (!shell || !window.MutationObserver) return;
  const clock = document.getElementById("taskbar-clock");
  stillObserver = new MutationObserver((records) => {
    if (clock && records.every((r) => clock.contains(r.target))) return;
    stillDirty = true;
    clearTimeout(stillTimer);
    stillTimer = setTimeout(refreshStill, STILL_SETTLE_MS);
  });
  stillObserver.observe(shell, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["class", "style", "hidden"],
  });
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

/* ==========================================
   THE SIGN-IN — a hand-over with no camera move in it

   The desktop comes up **on the glass**, inside the same overlay box
   the login is in and at the framing the flight already parked at. So
   there is no second camera move here and nothing for this module to
   animate: `signed-in` on the body is the whole of it, the stylesheet
   crosses the desktop over the login, and the monitor the canvas is
   drawing stays exactly where it was for the length of the session.

   What is left for the scene to do is the overlay. Two cases:

   - On a viewport wide enough for the arrival to *contain* the glass,
     nothing: the matrix that was laying the login onto the plane goes
     on laying the desktop onto it, and the desktop is interactive
     through it because the browser hit-tests through a transform.
   - Under MOBILE_BP the arrival fits the glass's height alone and the
     panel runs off frame sideways, so a desktop mapped onto it would
     be two thirds off screen. There it breaks out and takes the page,
     the room fading out behind it — see "NARROW VIEWPORTS" in
     style.css. The camera still does not move; the overlay just stops
     being mapped onto anything.

   `glass-fullscreen` on the body is the second case, and it is derived
   rather than remembered — `screenBrokenOut` is re-asked on every
   overlay update, so crossing the breakpoint on a resize, or leaving
   for the room, lands on the right one without anyone switching it.
   ========================================== */

/* True while the page has left the glass: parked at the end of the
   second move, where the glass covers the viewport anyway, so the box
   can stop being mapped onto it and simply *be* the page.

   `dive.value === 1` is the main clause and the dive is a phone's
   alone, so this is the phone's full-screen desktop. The `isHandheld`
   arm beside it is the case with no dive in it: a window dragged
   narrower than `MOBILE_BP` while signed in, where the glass is
   suddenly cropped and the in-monitor desktop has nowhere to live.
   Both want the same layout, which is why they are one flag.

   Everything else is "and the camera is parked at the screen", which
   is what ends the state the moment either move starts — the picture
   during a move has to be the picture *on the monitor*.

   The box is laid out by CSS over the whole page here, so the matrix
   has to come off: a transform and `inset: 0` would otherwise fight
   each other every frame. */
function screenBrokenOut() {
  return (
    fly.value === 1 &&
    fly.dir === 0 &&
    dive.dir === 0 &&
    (dive.value === 1 ||
      (isHandheld() && document.body.classList.contains("signed-in")))
  );
}

/* The last value written, so the class is toggled on the transitions
   rather than on every frame of a flight. */
let brokenOut = false;

function setBrokenOut(v) {
  if (v === brokenOut) return;
  brokenOut = v;
  document.body.classList.toggle("glass-fullscreen", v);
}

/* ==========================================
   THE SECOND MOVE — the timeline and the hand-over

   Same shape as the flight, one tween deep: a paused timeline whose
   `play()` pushes in and whose `reverse()` is the way back, so the two
   directions cannot drift apart. The still is on the tube for the
   whole of it, for the same reason and by the same mechanism as the
   flight's — the overlay is a subtree the matrix rescales every frame,
   and this move is the one that ends with it filling a phone.

   What the move hands over to is not the login grown large: it is the
   desktop, laid out for the phone rather than for the machine's 900px
   screen. So the sequence is "zoom to the glass, then change the
   picture", and the change is the sign-in's own crossfade (see "THE
   SIGN-IN GATE" in style.css) rather than anything here. `diveLanded`
   therefore puts the *live* page back on the glass before it calls
   main.js: the login re-appears at the phone's own size for the
   instant it takes the desktop to fade up over it, which is what the
   crossfade has to be a crossfade *of*.
   ========================================== */
let diveTl = null;
const diveState = { q: 0 };
/* What to run once the camera has the viewport. main.js's sign-in, in
   practice: the camera move has to finish before the DOM hand-over,
   and the module that owns the desktop is not this one. */
let onDiveLanded = null;

function buildDiveTimeline() {
  diveTl = gsap
    .timeline({
      paused: true,
      onComplete: diveLanded,
      onReverseComplete: diveLifted,
    })
    .to(
      diveState,
      {
        q: 1,
        duration: DIVE_S,
        ease: DIVE_EASE,
        onUpdate: () => setDive(diveState.q),
      },
      0,
    );
}

/* Both ends of the move land the same way — the camera stops, the
   live page comes back on the glass, and whoever asked is told. The
   only difference is which picture is there afterwards. */
function diveSettled() {
  dive.dir = 0;
  document.body.classList.remove("screen-zooming");
  document.body.classList.add("screen-focused");
  /* `setDive` re-asks `screenBrokenOut`, which only now can be true:
     `dive.dir` is back to 0. So this is also what makes the box the
     page, before anything is shown in it. */
  setDive(dive.value);
  applyFade(1);
  showStill(false);
  /* The rAF loop stops drawing the moment `dive.dir` is 0 — same
     bargain as the arrival — and GSAP's ticker is not this loop, so
     the frame the camera actually landed on is this call's to draw. */
  render();
}

function diveLanded() {
  diveState.q = 1;
  diveSettled();
  const done = onDiveLanded;
  onDiveLanded = null;
  done?.();
}

function diveLifted() {
  diveState.q = 0;
  onDiveLanded = null;
  diveSettled();
  /* Back at the bezel framing with the login on the glass, which is a
     form again from here — unless nobody logged off, which is the
     resize case below: a session that is still signed in has no field
     to put the focus in, and `arrive` declines it for the same
     reason. */
  if (!document.body.classList.contains("signed-in")) {
    document.getElementById("login-user")?.focus({ preventScroll: true });
  }
}

/* Sign-in on a phone: push in from the bezel framing until the glass
   has the viewport, then hand over. `onLanded` is called either way —
   reduced motion, and every viewport that takes no second move at all
   — so the caller never has to know which path ran. */
export function diveToDesktop(onLanded) {
  if (!screenEl || !diveTl || !isHandheld() || fly.value !== 1 || dive.value === 1) {
    onLanded?.();
    return;
  }
  onDiveLanded = onLanded ?? null;
  document.body.classList.remove("screen-focused");
  /* The still is drawn on `input` and refreshed on departure, so the
     dialog it carries is the one the visitor typed into — but the
     sign-in note is written by a submit handler, not an input event.
     `refreshLoginStill` is what the caller uses to close that gap; by
     here the bitmap is either current or the previous one, and the
     previous one differs by a line of text under a form that is about
     to leave. */
  showStill(true);
  applyFade(0);
  if (prefersReducedMotion()) return jumpDive(1);
  document.body.classList.add("screen-zooming");
  dive.dir = 1;
  diveTl.play();
}

/* Log Off on a phone: the reverse, back to the login at its bezel
   framing. From there the way out to the desk is the room around the
   screen, Escape, or the back button — the same three as anywhere. */
export function riseFromDesktop() {
  if (!screenEl || !diveTl || dive.value === 0) return;
  onDiveLanded = null;
  document.body.classList.remove("screen-focused");
  showStill(true);
  applyFade(0);
  if (prefersReducedMotion()) return jumpDive(0);
  document.body.classList.add("screen-zooming");
  dive.dir = -1;
  diveTl.reverse();
}

/* Reduced motion gets the pose without the push, exactly as `jumpFly`
   does for the flight. The hand-over it leaves behind is a short CSS
   fade rather than none at all — see "THE SIGN-IN GATE" in style.css. */
function jumpDive(to) {
  diveTl?.pause();
  diveState.q = to;
  dive.dir = 0;
  dive.value = to;
  document.body.classList.remove("screen-zooming");
  if (to === 1) diveLanded();
  else diveLifted();
}

/* The form's `input` listener keeps the still current, but the sign-in
   note is not an input event. Called at submit, so the redraw lands in
   idle time during the beat before the move rather than on its first
   frame. */
export function refreshLoginStill() {
  stillDirty = true;
  refreshStill();
}

/* The one call main.js makes across the sign-in and the log off, after
   it has flipped the body class. There is no pose to change, so this
   is only the overlay catching up with which state the box is in —
   plus a frame, because the loop stops drawing while the camera is
   parked and the break-out changes what the canvas is for.

   The still goes stale here by definition: the picture on the glass
   has just changed from a login to a desktop, or back. */
export function syncDesktopOverlay() {
  if (!screenEl) return;
  stillDirty = true;
  refreshStill();
  updateScreenOverlay();
  render();
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
  /* Signed in or not: the desktop is on the glass, so flying out leaves
     it there rather than from under anything. It is the same session
     when the camera comes back — see `arrive`.

     `dive.value > 0` is the phone's desktop having the viewport (or
     being on its way there): the flight's endpoint is not where the
     camera is, so reversing from here would jump. Log Off brings the
     dive back first, and nothing that leads here is reachable until it
     has — see `riseFromDesktop`. */
  if (!screenEl || fly.value === 0 || dive.value > 0 ||
      (flyTl && flyTl.isActive() && flyTl.reversed())) return;
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
  watchDesktopStill();
  refreshStill();

  updateScreenOverlay();
}

/* ==========================================
   LIFECYCLE
   ========================================== */
export async function initScene(canvas) {
  performance.mark('room:start');
  if (!canvas) return false;

  canvasEl = canvas;
  const { clientWidth: w, clientHeight: h } = canvas;

  // Construct the actual renderer once; a throwaway capability probe
  // initializes a second graphics context and cannot test this canvas.
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  } catch {
    return false;
  }
  // Shader diagnostics force synchronous driver queries on first use.
  // Keep them in development; production uses the same compiled shaders.
  renderer.debug.checkShaderErrors = import.meta.env.DEV;
  /* three's default since r152, so this is a statement of intent
     rather than a change: every texture authored here is sRGB and the
     canvas is written in sRGB. It is spelled out because the composer
     path hands the conversion to `OutputPass` instead (see
     `buildComposer`), and the two having to agree is exactly the kind
     of thing that is invisible until it is wrong. */
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  /* **Tone mapping, which the daylight scene did without.** A night
     room has a far wider range than a grey floor under a studio HDRI
     — a glowing tube and a lamp against walls three stops down — and
     without an operator the highlights clip to flat white and the
     shadows crush to the same black.

     **ACES at 0.95, chosen rather than measured into.** The first pass
     shot AgX and ACES side by side and took AgX, on two counts: ACES's
     toe drags the plum walls toward black, and its blue-to-cyan skew
     points straight at the CRT's teal. One of those counts has since
     gone — the cream wordmark it was also protecting is off the rug —
     and ACES is what was asked for, so it is what is set. The toe is
     the thing to watch when the night lighting lands: it is why the
     exposure is 0.95 rather than 1.0, which is a trim rather than a
     correction. `window.__tonemap('agx')` switches on a live page and
     `_roomshots.mjs` shoots all three.

     This is also what makes src/tonemap.js necessary: the operator
     runs on the background clear too, but only on the composer path,
     and the void has to come out at exactly #1C1A2A on both. The
     pre-image is solved numerically, so it follows this exposure
     rather than needing to be re-derived beside it. See
     `applyVoidColor`. */
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = TONE_EXPOSURE;
  renderer.setPixelRatio(scenePixelRatio());
  renderer.setSize(w, h, false);
  renderer.shadowMap.enabled = true;
  /* **This is deliberately not `PCFSoftShadowMap`**, which is what the
     restyle asked for and what every three tutorial still says. The
     constant survives in 0.186 but the implementation does not:
     `WebGLShadowMap` checks for it and warns "PCFSoftShadowMap has been
     removed. Using PCFShadowMap instead." (node_modules/three/src/
     renderers/webgl/WebGLShadowMap.js:99). Setting it would trade the
     soft shadow this scene already has for a hard one plus a console
     warning — the opposite of what asking for it means. VSM is the
     remaining soft option, and the key's `radius` / `blurSamples` /
     `bias = 0` beside it are tuned for VSM specifically. */
  renderer.shadowMap.type = THREE.VSMShadowMap;
  /* Nothing in this scene ever casts a different shadow: the lights
     are fixed and the machine does not move (`lift` exists but nothing
     animates it any more — see computer.js). The desk lamp lives
     inside that rule rather than breaking it — switching it changes
     an *intensity*, and a shadow map carries occlusion, not
     brightness, so the lamp's frozen map is as correct at level 0 as
     at level 1. So the map is rendered once and then frozen, instead of re-rendering a 2048² VSM depth
     pass with 16 blur samples on every frame of the fly-in.

     `needsUpdate` is set rather than cleared — three renders the map on
     the next frame and clears the flag itself. If anything is ever
     animated back into the scene, this is what has to be reverted. */
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;

  /* The CRT's greeting is drawn with canvas 2D, so the webfont has to
     be resident before the texture is drawn or it silently falls back
     to Georgia — a canvas does not re-draw itself when a face arrives
     later. This used to be the rug wordmark's await; the rug no longer
     sets any type, and the screen is what keeps it alive. */
  performance.mark('room:renderer-ready');
  await Promise.all([loadScreenFont(), resolveDesk(), resolveLamp()]);
  performance.mark('room:assets-ready');
  seatToDesk();
  scene = buildScene();
  performance.mark('room:geometry-ready');
  camera = buildCamera();
  /* The machine never moves, so one update pins the screen plane's
     world matrix for the overlay projection and for SCREEN_TARGET. */
  scene.updateMatrixWorld(true);
  computer.screen.getWorldPosition(SCREEN_TARGET);
  applyFly(0, w, h);
  /* Re-asserted now that the scene (and the key light's shadow camera)
     actually exists. `autoUpdate` is off, so this is the one pass that
     ever renders the map: anything that changes a caster or the shadow
     camera has to set it again. */
  renderer.shadowMap.needsUpdate = true;

  if (!isMobile() && !prefersReducedMotion()) {
    try {
      composer = buildComposer(w, h);
      if (scenePixelRatio() > 1) motionComposer = buildMotionComposer();
    } catch {
      composer?.dispose();
      motionComposer?.dispose();
      composer = motionComposer = null; // fall back to a straight render
    }
  }

  /* After the composer decision, because that is what decides which of
     the two background colours is the correct one. */
  applyVoidColor();

  /* Handles for the visual-review scripts. `__flyTo` parks the camera
     at a point of the fly-in and draws it, which is how the head-on
     framing gets tuned without trying to catch it mid-animation. */
  window.__scene = scene;
  /* The room's own plan, so the fit scripts can read the opening
     instead of restating it. Three of them hardcoded WINDOW_Z, the
     sill and the opening's two sides, and all three went stale the
     first time the window was re-sized. */
  window.__room = ROOM_PLAN;
  /* Exposed for the same reason the scene is: a review script that
     wants to project its own points — `_tightfit.mjs` reads the
     model's true corners rather than the conservative box `__fit`
     reports — needs the camera `__fit` projects against. */
  window.__camera = camera;
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
        /* The *resting* range, not the stretched one: a pose parked
           inside the spring's band would unwind out of it on the next
           tick, under whatever is being shot. */
        THREE.MathUtils.clamp(
          orbitHome.theta + THREE.MathUtils.degToRad(swing),
          orbitLeash.softMin,
          orbitLeash.softMax,
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
          deg(orbitLeash.softMin - FACING),
          deg(orbitLeash.softMax - FACING),
        ],
        swing: [
          deg(orbitLeash.softMin - orbitHome.theta),
          deg(orbitLeash.softMax - orbitHome.theta),
        ],
        /* How far past the resting pair the spring allows, and where
           the walls themselves are — the first is what a drag can
           reach, the second is what it is being kept off. */
        stretch: [
          deg(orbitLeash.min - orbitHome.theta),
          deg(orbitLeash.max - orbitHome.theta),
        ],
        walls: (() => {
          const w = wallAzimuthRange(
            orbitHome.radius,
            orbitHome.phi + ORBIT_DOWN,
          );
          return [deg(w.lo - FACING), deg(w.hi - FACING)];
        })(),
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
  /* Switches the tone-mapping operator on a live page and re-derives
     the void's pre-image with it, which is what let AgX and ACES be
     compared off one build rather than two. No argument just reports.
     Materials recompile themselves: three's `setProgram` treats
     `renderer.toneMapping` as part of the program cache key. */
  window.__tonemap = (name) => {
    if (name !== undefined) {
      const m = TONE_MAPPINGS[name];
      if (m === undefined) return { error: `unknown: ${name}`, known: Object.keys(TONE_MAPPINGS) };
      renderer.toneMapping = m;
      applyVoidColor();
      render();
    }
    const found = Object.entries(TONE_MAPPINGS)
      .find(([, v]) => v === renderer.toneMapping);
    const target = new THREE.Color(VOID);
    return {
      tonemap: found ? found[0] : renderer.toneMapping,
      exposure: renderer.toneMappingExposure,
      path: composer ? "composer" : "direct",
      void: VOID,
      /* What the clear is actually set to, and what the void would
         have come out as with no pre-image — the error this is all
         here to remove. */
      background: `#${scene.background.getHexString()}`,
      untreated: `#${tonemapForward(target, composer ? renderer.toneMapping : THREE.NoToneMapping, renderer.toneMappingExposure).getHexString()}`,
    };
  };
  /* **The night rig, on a live page.** Every intensity in it was set
     through this rather than by rebuilding per candidate — four
     numbers that only mean anything against each other, so they have
     to be movable together while looking at one picture. No argument
     just reports.

     Note `glow` is the *base* the loop multiplies by the picture's
     brightness and the hover bump, so what is written here is what
     SCREEN_GLOW means, not what the light is running at this frame. */
  window.__lights = (next = {}) => {
    if (next.moon !== undefined) lights.moon.intensity = next.moon;
    /* The **base**, for the reason the exposure's is: the lamp scales
       the fill as it goes out (OFF_DARKNESS), so writing
       `hemi.intensity` here would be reverted by the next toggle.
       `applyLampLevel` is what puts the figure on the light, at this
       instant's lamp level. */
    if (next.hemi !== undefined) {
      hemiBase = next.hemi;
      applyLampLevel(lampLevel);
    }
    /* The off state's two knobs, so the pair can be judged against one
       picture the way the rig's four were. `off` is OFF_DARKNESS; it
       takes effect on the next frame of a fade, or now if the lamp is
       already out. */
    if (next.off !== undefined) {
      offDarkness = next.off;
      applyLampLevel(lampLevel);
    }
    if (next.env !== undefined) scene.environmentIntensity = next.env;
    if (next.at !== undefined) setMoonAt(...next.at);
    /* The operator's exposure, which in a night scene is a lighting
       control rather than a finishing one — see TONE_EXPOSURE. */
    if (next.exposure !== undefined) {
      /* The **base**, not the live value: the lamp lifts the exposure
         as it goes out, and the loop writes `toneBase + lift` every
         frame it moves. Writing `toneMappingExposure` here instead
         would be silently reverted the next time the lamp was
         switched. */
      toneBase = next.exposure;
      toneWritten = -1; // force the re-solve below
      applyLampLevel(lampLevel); // writes the exposure and the pre-image
    }
    if (next.glow !== undefined) {
      screenGlowBase = next.glow;
      /* The loop would pick this up on its next frame, but the point
         of the handle is to see it now — and under reduced motion
         there is no next frame. `bright` is 1 at rest, so this is what
         the loop would have written anyway. */
      computer.screenGlow.intensity = screenGlowBase;
    }
    if (Object.keys(next).length) render();
    return {
      moon: lights.moon.intensity,
      /* What the fill is running at this instant, and the figure it
         would be at with the lamp on — which is the one HEMI_INTENSITY
         names. They differ only while the lamp is off or fading. */
      hemi: lights.hemi.intensity,
      hemiBase,
      off: offDarkness,
      hemiGround: `#${lights.hemi.groundColor.getHexString()}`,
      env: scene.environmentIntensity,
      /* Without this the `env` figure above is a number about nothing:
         ENV_INTENSITY is 0, so no HDRI is fetched at all. */
      envMap: !!envMap,
      glow: screenGlowBase,
      /* What the operator is running at this instant, and the figure
         it would be at with the lamp on — which is the one
         TONE_EXPOSURE names. They differ only while the lamp is off or
         fading. */
      exposure: renderer.toneMappingExposure,
      exposureBase: toneBase,
      moonFrom: lights.moon.position.toArray().map((v) => Number(v.toFixed(2))),
      moonAt: MOON_AT.toArray(),
      /* Degrees below the horizon, which is the figure the shadow's
         length is argued in. */
      elevation: Number(
        THREE.MathUtils.radToDeg(Math.asin(-moonDirection().y)).toFixed(2),
      ),
    };
  };
  /* **What the shadow box has to cover**, in the light's own basis —
     which is the only frame the question makes sense in. It walks the
     named objects' world boxes, projects all eight corners of each
     onto the light's right / up / forward axes, and prints the union
     beside what the camera is actually set to. Lateral is the half
     extent the casters need; depth is where the receivers sit.

     This is what the ±22 / 20..80 above was read off, and it is the
     check to re-run after moving the window, the light or anything on
     the desk. A receiver outside this box is not merely unshadowed —
     the wall casts now, so it is a patch of floor flooded with
     moonlight that should be dark. */
  window.__shadowfit = (...names) => {
    const light = lights.moon;
    const fwd = new THREE.Vector3()
      .subVectors(light.target.position, light.position)
      .normalize();
    const right = new THREE.Vector3(0, 1, 0).cross(fwd).normalize();
    const up = new THREE.Vector3().crossVectors(fwd, right).normalize();
    const v = new THREE.Vector3();
    const out = {};
    let all = null;
    for (const n of names.length
      ? names
      : ["room", "desk", "computer", "treehouse", "lamp"]) {
      const o = scene.getObjectByName(n);
      if (!o) continue;
      const b = new THREE.Box3().setFromObject(o);
      const r = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity };
      for (const x of [b.min.x, b.max.x])
        for (const y of [b.min.y, b.max.y])
          for (const z of [b.min.z, b.max.z]) {
            v.set(x, y, z).sub(light.position);
            const a = v.dot(right), c = v.dot(up), d = v.dot(fwd);
            r.x0 = Math.min(r.x0, a); r.x1 = Math.max(r.x1, a);
            r.y0 = Math.min(r.y0, c); r.y1 = Math.max(r.y1, c);
            r.z0 = Math.min(r.z0, d); r.z1 = Math.max(r.z1, d);
          }
      out[n] = r;
      all = all
        ? {
            x0: Math.min(all.x0, r.x0), x1: Math.max(all.x1, r.x1),
            y0: Math.min(all.y0, r.y0), y1: Math.max(all.y1, r.y1),
            z0: Math.min(all.z0, r.z0), z1: Math.max(all.z1, r.z1),
          }
        : { ...r };
    }
    const c = light.shadow.camera;
    return {
      perObject: out,
      union: all,
      camera: { left: c.left, right: c.right, top: c.top, bottom: c.bottom, near: c.near, far: c.far },
      /* World units a shadow texel covers, on each lateral axis. */
      texel: [
        Number(((c.right - c.left) / light.shadow.mapSize.x).toFixed(4)),
        Number(((c.top - c.bottom) / light.shadow.mapSize.y).toFixed(4)),
      ],
      normalBias: light.shadow.normalBias,
      bias: light.shadow.bias,
    };
  };
  /* **The desk lamp, on a live page.** No argument reports; `on`
     switches it; `jump` forces the endpoint rather than the fade,
     which is what a screenshot wants; `point` and `spot` move the two
     lights against each other, which is how the pair was calibrated
     (see lamp.js for why there are two of them).

     `level` is what the fixture is running at *now* — the eased ramp —
     so a report taken mid-fade shows where the fade has got to rather
     than the endpoint it is heading for. */
  window.__lamp = (next = {}) => {
    if (next.on !== undefined) setLampOn(next.on, next.jump !== false);
    /* Re-aiming moves the light, which is the one change in this scene
       that invalidates the frozen shadow map — so this is the only
       place outside `window.__lights` that sets `needsUpdate`. */
    const aim =
      next.tilt !== undefined
        ? (renderer.shadowMap.needsUpdate = true,
          lampMod.aimLamp(next.tilt, next.swing))
        : lampMod.aimLamp();
    const levels = lampMod.lampLevels(next);
    if (
      next.point !== undefined ||
      next.spot !== undefined ||
      next.spillBase !== undefined ||
      next.spillArm !== undefined ||
      next.rim !== undefined ||
      next.warm !== undefined ||
      next.tilt !== undefined
    )
      render();
    return {
      on: lampOn,
      level: Number(lampLevel.toFixed(4)),
      p: Number(lampP.toFixed(4)),
      fadeSeconds: LAMP_FADE_S,
      /* **The on-ramp as the loop would write it**, sampled off the
         same ease rather than described. It exists because the live
         reading cannot be trusted on a software renderer: SwiftShader
         gives the review scripts about a frame a second, so a 0.4s
         fade is over before the second sample. This is the
         deterministic half — 21 points across the ramp, and with the
         strike gone it should now climb monotonically from 0 to 1,
         which is the check. */
      curve: Array.from({ length: 21 }, (_, i) => {
        const u = i / 20;
        return [
          Number((u * LAMP_FADE_S).toFixed(3)),
          Number((1 - (1 - u) * (1 - u)).toFixed(3)),
        ];
      }),
      exposure: renderer.toneMappingExposure,
      exposureBase: toneBase,
      exposureLift: LAMP_EXPOSURE_LIFT,
      colour: levels.colour,
      lights: levels,
      /* Where the beam lands on the desk top, in world coordinates —
         which is what "aimed at the keyboard" or "aimed at bare
         walnut" is actually a statement about. */
      aim,
      button: lampBtn
        ? { pressed: lampBtn.getAttribute("aria-pressed"), hidden: lampBtn.hidden }
        : null,
    };
  };
  /* **What a press at a screen point would hit** — the same
     `pickTarget` the pointer handlers use, so this is the real
     precedence rather than a restatement of it. It is how "does the
     lamp occlude the monitor" and "does the monitor still win where
     both are hit" are answered off raycasts rather than off a dark
     screenshot: walk a grid over the machine's own projected box and
     count how many points come back "lamp".

     Takes CSS pixels relative to the canvas, which is what
     `__fit`'s NDC converts to. */
  window.__pick = (x, y) => {
    const r = canvasEl?.getBoundingClientRect();
    if (!r) return null;
    return pickTarget({ clientX: r.left + x, clientY: r.top + y });
  };
  /* The rain on the window: where its clock stands, how fast it is
     running and whether reduced motion caught it. A speed in
     cell-runs per second re-tunes it on a live page, which is how the
     streaks were set without a rebuild per candidate. */
  window.__rain = (speed) => {
    const r = rainState(speed);
    if (speed !== undefined) render();
    return r;
  };
  /* **What the void actually resolves to on screen**, which is the
     only way the pre-image in src/tonemap.js is worth trusting. It
     hides the whole scene, draws, and reads the centre pixel back off
     the default framebuffer with `readPixels` — so what it reports is
     the post-operator, post-sRGB value the visitor sees, on whichever
     render path this page is using. Hiding everything rather than
     hunting for a corner that happens to be background is what makes
     it deterministic.

     readPixels on the back buffer is valid here without
     `preserveDrawingBuffer` because the draw and the read are in the
     same task. */
  /* **What the picture resolves to at a handful of named places**,
     read back off the framebuffer after a draw — so these are the
     post-operator, post-sRGB values the visitor sees rather than what
     a material was handed. It is the only way to answer "moody but not
     pitch black": a dark screenshot is exactly the thing judgement is
     worst at, and the difference between 12 and 30 out of 255 is the
     difference between the room being there and not.

     The points are world coordinates on surfaces the home framing can
     see. `readPixels` on the back buffer is valid here without
     `preserveDrawingBuffer` for the same reason it is in
     `__voidcheck`: the draw and the read are in one task. */
  /* See the comment at the call site. Returns nothing at all if the
     lamp is not up, rather than a point about somewhere else. */
  const lampProbes = () => {
    if (!lamp) return {};
    const aim = lampMod.aimLamp();
    const mouth = lamp.spot.getWorldPosition(new THREE.Vector3());
    return {
      ...(aim?.pool
        ? { "lamp pool": [aim.pool[0], aim.pool[1] + 0.02, aim.pool[2]] }
        : {}),
      "lamp shade": mouth.toArray(),
    };
  };
  window.__probes = (extra) => {
    const pts = {
      /* Inside the pool the window throws, and outside it — the two
         numbers the whole rig is set between. */
      "floor pool": [-4.0, 0.02, 12.0],
      "floor dark": [9.0, 0.02, 13.5],
      "floor bare": [14.0, 0.02, 2.0],
      "wall far": [6.0, 13.0, -8.85],
      "wall left": [-12.9, 13.0, 6.0],
      "desk pool": [-6.0, DESK_TOP_Y + 0.02, 0.0],
      "desk dark": [7.6, DESK_TOP_Y + 0.02, -4.0],
      "keyboard": [0.1, DESK_TOP_Y + 0.55, 2.6],
      /* The lamp's own pool, and the lit inside of the shade it comes
         out of — the two numbers that say whether the fixture reads as
         a light source rather than as an ornament.

         **Both are derived from where the beam actually points**, not
         written down: `aimLamp()` reports the world point the axis
         meets the desk top at, and the spot sits just past the mouth,
         so projecting it lands on the glowing inner wall behind. A
         pair of hard-coded points went quietly meaningless the first
         time the shade was re-aimed — the "shade" one ended up
         reading the night sky through the window behind it, at luma
         197, which looks like a brilliantly lit shade and is not
         one. */
      ...lampProbes(),
      ...(extra || {}),
    };
    render();
    const gl = renderer.getContext();
    const v = new THREE.Vector3();
    const px = new Uint8Array(4);
    const out = {};
    for (const [name, p] of Object.entries(pts)) {
      v.set(p[0], p[1], p[2]).project(camera);
      const x = Math.round(((v.x + 1) / 2) * gl.drawingBufferWidth);
      /* NDC y is up and so is gl's read origin, so no flip here. */
      const y = Math.round(((v.y + 1) / 2) * gl.drawingBufferHeight);
      if (x < 0 || y < 0 || x >= gl.drawingBufferWidth || y >= gl.drawingBufferHeight) {
        out[name] = { hex: "(off frame)", rgb: [], luma: 0 };
        continue;
      }
      gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const rgb = [px[0], px[1], px[2]];
      out[name] = {
        hex: "#" + rgb.map((c) => c.toString(16).padStart(2, "0")).join(""),
        rgb,
        luma: Math.round(0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]),
      };
    }
    return out;
  };
  /* **How dark the picture actually is**, as a distribution rather
     than as a handful of points. The named probes above answer "what
     is this surface doing"; this answers the brief's own question —
     "moody but not pitch black" is a statement about the whole frame,
     and a frame can have a bright pool in it and still be 80% void.

     It reads the framebuffer back after a draw and buckets the luma of
     every pixel that is **not the void**, which is the only honest
     denominator: the diorama floats in #1C1A2A and most of a desktop
     frame is backdrop, so counting that would let any scene pass by
     being mostly empty. Reports the share of the *room* under a few
     thresholds plus its percentiles. */
  /* One pixel by *screen* fraction — (0,0) top-left. The world probes
     above follow the geometry, which is what you want for "is this
     surface lit"; this is for "is that part of the picture black",
     where the question is about the frame and a world point can
     quietly land on the wrong surface. */
  window.__pixel = (u, v) => {
    render();
    const gl = renderer.getContext();
    const px = new Uint8Array(4);
    gl.readPixels(
      Math.min(gl.drawingBufferWidth - 1, Math.max(0, Math.round(u * gl.drawingBufferWidth))),
      Math.min(gl.drawingBufferHeight - 1, Math.max(0, Math.round((1 - v) * gl.drawingBufferHeight))),
      1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px,
    );
    const rgb = [px[0], px[1], px[2]];
    return {
      hex: "#" + rgb.map((c) => c.toString(16).padStart(2, "0")).join(""),
      rgb,
      luma: Math.round(0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]),
    };
  };
  /* GTAO's blend, live. It exists because the night rig changed what
     the AO is *multiplying*: under the daylight key most surfaces had
     a strong direct term and the AO only deepened creases, where now
     the floor and the walls are lit by the hemisphere alone — so the
     occlusion term is the whole value, and a plane that false-occludes
     itself at a grazing angle goes black rather than merely darker.
     This is the A/B that found it. */
  window.__gtao = (blend, margin) => {
    if (gtaoPass && blend !== undefined) {
      gtaoPass.blendIntensity = blend;
      render();
    }
    return { blend: gtaoPass ? gtaoPass.blendIntensity : null, margin };
  };
  window.__histogram = () => {
    render();
    const gl = renderer.getContext();
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    const buf = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    const voidRgb = new THREE.Color(VOID);
    const vr = Math.round(voidRgb.r * 255);
    const vg = Math.round(voidRgb.g * 255);
    const vb = Math.round(voidRgb.b * 255);
    const lumas = [];
    for (let i = 0; i < buf.length; i += 4) {
      const r = buf[i], g = buf[i + 1], b = buf[i + 2];
      /* Within a level or two of the backdrop, on every channel. The
         fog resolves to exactly the void, so this also drops the far
         corner of the diorama, which is correct — it is backdrop by
         construction. */
      if (Math.abs(r - vr) <= 2 && Math.abs(g - vg) <= 2 && Math.abs(b - vb) <= 2) continue;
      lumas.push(0.2126 * r + 0.7152 * g + 0.0722 * b);
    }
    lumas.sort((a, b) => a - b);
    const n = lumas.length;
    if (!n) return { room: 0 };
    const pct = (q) => Math.round(lumas[Math.min(n - 1, Math.floor(q * n))]);
    const under = (t) => Number((lumas.filter((v) => v < t).length / n).toFixed(3));
    return {
      roomPixels: n,
      roomShare: Number((n / (w * h)).toFixed(3)),
      p05: pct(0.05),
      p25: pct(0.25),
      median: pct(0.5),
      p75: pct(0.75),
      p95: pct(0.95),
      under8: under(8),
      under16: under(16),
      under32: under(32),
    };
  };
  window.__voidcheck = () => {
    const hidden = [];
    for (const child of scene.children) {
      if (child.visible) {
        hidden.push(child);
        child.visible = false;
      }
    }
    render();
    const gl = renderer.getContext();
    const px = new Uint8Array(4);
    gl.readPixels(
      Math.floor(gl.drawingBufferWidth / 2),
      Math.floor(gl.drawingBufferHeight / 2),
      1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px,
    );
    for (const child of hidden) child.visible = true;
    render();
    const got = [px[0], px[1], px[2]];
    const want = [0x1c, 0x1a, 0x2a];
    const hex = (a) => "#" + a.map((v) => v.toString(16).padStart(2, "0")).join("");
    return {
      path: composer ? "composer" : "direct",
      got: hex(got),
      want: hex(want),
      err: Math.max(...got.map((v, i) => Math.abs(v - want[i]))),
    };
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
    /* The flight's parameter means nothing while the second move is
       off its endpoint, so park that first. Straight to 0 rather than
       animated: this is a review handle, not a transition. */
    if (dive.value !== 0) {
      diveTl?.pause();
      diveState.q = 0;
      dive.dir = 0;
      setDive(0);
    }
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

  /* The same, for the second move: parks the sign-in push-in at a point
     of its timeline and draws it. It seeks the real timeline too, so
     the still and the body classes are whatever the move puts there.
     The flight has to be at its endpoint first — this move is defined
     on top of that pose and nowhere else — so it takes the camera
     there rather than refusing. Phones only in production; the handle
     ignores the breakpoint so the framing can be shot anywhere. */
  window.__diveTo = (x) => {
    if (!diveTl) return null;
    const t = clamp01(x);
    if (fly.value !== 1) window.__flyTo(1);
    diveTl.pause();
    const moving = t > 0 && t < 1;
    document.body.classList.toggle("screen-zooming", moving);
    document.body.classList.toggle("screen-focused", !moving);
    showStill(moving);
    applyFade(moving ? 0 : 1);
    dive.dir = 0; // parked
    /* Timeline progress, like __flyTo — so the two differ from the
       geometric parameter by the same easing, and what this shows is
       what the move shows there. */
    diveTl.progress(t, false);
    setDive(diveState.q);
    render();
    return {
      position: camera.position.toArray(),
      target: flyTarget.toArray(),
      frustumHeight: 2 * camera.position.distanceTo(flyTarget) * tanHalfFov,
      dist: camera.position.distanceTo(flyTarget),
      /* What covering this viewport asks for, beside what the login's
         framing asks for — the whole of what the move is between. */
      arriveFrustum: screenFrustum(canvasEl.clientWidth / canvasEl.clientHeight),
      coverFrustum: coverFrustum(canvasEl.clientWidth / canvasEl.clientHeight),
      brokenOut: document.body.classList.contains("glass-fullscreen"),
      fov,
    };
  };

  onResize = () => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    syncRenderQuality();
    renderer.setSize(width, height, false);
    composer?.setSize(width, height);
    motionComposer?.setSize(width, height);
    /* The camera's distance is derived from the frustum, which crosses
       the mobile breakpoint — so the fog, whose range is an offset from
       that distance, crosses with it. near/far are plain uniforms; this
       costs no shader recompile. */
    setFogRange(scene.fog, camDist());
    /* The spline's frustum knots are framings, so they move with the
       aspect — and so, under perspective, do its position knots: the
       path has to be rebuilt, not just re-sampled. */
    buildFlyPath(width, height);
    /* A viewport that has stopped being a handheld's — a rotation is
       not this, a dev-tools drag or a desktop browser's zoom is —
       takes the second move back, so the desktop returns to the glass
       where a desktop viewport's desktop belongs. Jumped rather than
       animated: a resize is not an occasion for a camera move, and the
       pose below is then derived from the parameter this just set. */
    if (dive.value > 0 && dive.dir === 0 && !isHandheld()) jumpDive(0);
    /* Re-derived from whichever move owns the camera rather than
       reset, so a resize part-way through either one — or while the
       login page is up, or while the desktop has the viewport — keeps
       the camera where it was. Both framings are aspect-dependent, so
       this is also what keeps the desktop edge to edge across a resize
       rather than only at the size it was signed in at. */
    const keep = orbitAllowed()
      ? { theta: controls.getAzimuthalAngle(), phi: controls.getPolarAngle() }
      : null;
    applyPose(width, height);
    /* applyFly puts the camera back on the path, which at the
       establishing shot is home — and the visitor may have swung it
       off. A resize is not a reason to take that away. */
    if (keep) setOrbitAngles(keep.theta, keep.phi);
      updateScreenOverlay();
    /* The loop draws this one unless it has stopped — either because
       there is no loop at all (reduced motion) or because the camera
       is parked at the screen, where the canvas is now the monitor
       around the login rather than something faded out. `setSize` has
       just reallocated the drawing buffer, so a frame nobody redraws
       is a blank one. */
    if (!frame || fly.value >= 1) render();
  };
  window.addEventListener("resize", onResize);

  performance.mark('room:before-first-frame');
  // Allocate/upload the small motion targets before interaction, not on the
  // first drag. The following full-resolution draw reuses programs/shadows.
  motionComposer?.render();
  render();
  performance.mark('room:first-frame');
  initScreenOverlay();
  buildFlyTimeline();
  buildDiveTimeline();
  /* Both before the reduced-motion return: the camera is still the
     visitor's to swing there, and the canvas is still what carries the
     press that flies in. What reduced motion loses is the inertia and
     the walk home — see initOrbit. */
  initOrbit();
  initPointer(canvas);
  initCanvasPress(canvas);
  /* The keyboard and screen-reader route to the lamp. After
     `initOrbit` only so that everything a press can reach exists
     before anything is unhidden. */
  initLampButton();
  performance.mark('room:interactive');
  loadEnvironment().then((ok) => {
    if (ok && !frame) render();
  });
  /* **The walnut is the only asynchronous asset left**, and on a path
     that draws one frame and stops — reduced motion — nothing would
     otherwise notice it arriving. This used to be covered by accident:
     `loadEnvironment` resolved after a 128 kB HDRI, long after three
     512px jpgs, and re-rendered. Turning the HDRI off (ENV_INTENSITY)
     took that re-render with it, and the desk top came out flat black
     under reduced motion. `_winshots.mjs`'s reduced pass is what
     caught it. */
  desk.ready.then(() => {
    if (!frame) render();
  });

  /* Reduced motion: one static frame and no loop. The screen is still
     clickable — the fly-in just arrives instead of flying. */
  if (prefersReducedMotion()) return true;

  /* Vite folds `import.meta.env.DEV` to `false` when building, so this
     branch — and src/perf.js with stats.js inside it — is dropped from
     the production bundle. `perfWanted()` is the second gate: in dev
     the panel is off unless it is asked for. See above. */
  if (import.meta.env.DEV && perfWanted()) {
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
  let hoverStyle = "";
  const tick = () => {
    frame = requestAnimationFrame(tick);
    perf?.begin();
    /* Time-based easing, so the picture settles at the same speed
       whatever the frame rate. */
    const dt = clock.getDelta();
    // The canvas is frozen behind the live desktop. Leave native scrolling
    // alone instead of updating invisible rain, textures and inherited CSS.
    // Keep the lamp ramp live for its keyboard control.
    if (fly.value === 1 && fly.dir === 0 && dive.dir === 0) {
      const lampMoving = lamp && lampP !== (lampOn ? 1 : 0);
      tickLamp(dt);
      if (lampMoving || motionQuality) render();
      perf?.end(1 - dive.value);
      return;
    }
    elapsed += dt;
    /* The rain. One float write — the streaks are computed in the
       fragment shader from the pane's own coordinates, so there is
       nothing per-drop to update. */
    tickRain(dt);
    /* The controls own the camera at the establishing shot and nowhere
       else, so this is a no-op from the moment a flight starts. */
    tickOrbit(dt);
    /* The lamp's fade. A no-op once the light has
       settled, which it is for all but 0.4s per press. */
    tickLamp(dt);
    const k = 1 - Math.exp(-HOVER_RATE * dt);
    hover.value += (hover.target - hover.value) * k;
    computer.setScreen(hover.value);
    const nextHoverStyle = hover.value.toFixed(3);
    if (nextHoverStyle !== hoverStyle) {
      hoverStyle = nextHoverStyle;
      screenEl?.style.setProperty("--hover", hoverStyle);
    }
    /* A real tube never sits perfectly still — a shallow beat on the
       brightness, well under what reads as a flash. */
    const flicker =
      1 + 0.018 * Math.sin(elapsed * 11.3) * Math.sin(elapsed * 2.7);
    const bright = (1 + hover.value * 0.45) * flicker;
    screenMat.emissiveIntensity = bright;
    screenGlow.intensity = screenGlowBase * bright;

    /* The fly-in is advanced by the GSAP timeline on its own ticker;
       all this loop owes it is a frame to land in. Parked at the
       screen it owes it nothing: the camera is still, the live overlay
       has the glass, and the only animated thing the arrival framing
       still holds — the tube's brightness flicker — is under that
       overlay. So the loop stops drawing and the canvas keeps its last
       frame, which is what pays for leaving the canvas *visible*
       there. Anything that invalidates that frame while it is up has
       to draw one itself; the resize handler is the one that does. */
    if (fly.value < 1 || dive.dir !== 0) render();
    /* The meter counts a frame as the animation's when its parameter is
       strictly between the endpoints, so the second move has to be fed
       in on the same scale: 1 - dive.value is 1 parked at the login, 0
       parked at the phone's desktop, and strictly between while it
       moves. */
    perf?.end(fly.value < 1 ? fly.value : 1 - dive.value);
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
  press = { id: -1, x: 0, y: 0, target: null };
  orbitDragging = false;
  orbitIdleAt = 0;
  orbitDirty = false;
  orbitChangedAt = -Infinity;
  flyStart = null;
  flyFrom = FLY_FROM;
  fov = FOV_DEFAULT;
  tanHalfFov = Math.tan(THREE.MathUtils.degToRad(fov) / 2);
  homeZoom = HOME_ZOOM;
  screenGlowBase = SCREEN_GLOW;
  lights = null;
  if (lampBtn && onLampBtn) lampBtn.removeEventListener("click", onLampBtn);
  if (lampBtn) {
    lampBtn.hidden = true;
    lampBtn.setAttribute("aria-pressed", String(LAMP_START_ON));
  }
  lampBtn = onLampBtn = null;
  lamp = null;
  lampOn = LAMP_START_ON;
  lampP = lampLevel = LAMP_START_ON ? 1 : 0;
  toneBase = TONE_EXPOSURE;
  toneWritten = -1;
  /* The two the off state is shaped by, reset with the rest so a
     re-init is not inheriting a sweep from the last one. */
  hemiBase = HEMI_INTENSITY;
  offDarkness = OFF_DARKNESS;
  document.getElementById("orbit-hint")?.setAttribute("hidden", "");
  perf?.dispose();
  perf = null;
  disposables.forEach((d) => d.dispose());
  disposables = [];
  disposeComputer();
  deskMod.disposeDesk();
  disposeTreehouse();
  disposeNameplate();
  lampMod.disposeLamp();
  computer = null;
  nameplate = null;
  desk = null;
  disposeRoom();
  room = null;
  flyTl?.kill();
  flyTl = null;
  flyState.p = flyState.fade = 0;
  flyPath = null;
  diveTl?.kill();
  diveTl = null;
  diveState.q = 0;
  onDiveLanded = null;
  if (screenEl) {
    screenEl.removeEventListener("click", onScreenClick);
    if (onScreenInput) screenEl.removeEventListener("input", onScreenInput);
    screenEl.hidden = true;
    screenEl.style.transform = "";
    screenEl.style.visibility = "";
    screenTransform = "";
  }
  stillObserver?.disconnect();
  stillObserver = null;
  clearTimeout(stillTimer);
  stillCanvas = null;
  stillDirty = true;
  stillHidden = false;
  screenAway = false;
  brokenOut = false;
  screenHidden = "";
  sceneFade = -1;
  document.body.style.removeProperty("--scene-fade");
  if (canvasEl) canvasEl.style.cursor = "";
  document.body.style.removeProperty("--page-fade");
  document.body.classList.remove(
    "screen-active",
    "screen-zooming",
    "screen-focused",
    "glass-fullscreen",
    "orbit-live",
    "orbit-used",
  );
  fly = { value: 0, dir: 0 };
  dive = { value: 0, dir: 0 };
  screenEl = null;
  gtaoPass = null;
  canvasEl = null;
  envMap?.dispose();
  motionComposer?.passes.forEach((pass) => pass.dispose());
  motionComposer?.dispose();
  motionComposer = null;
  composer?.dispose();
  renderer?.dispose();
  hover = { target: 0, value: 0 };
  renderer = scene = camera = composer = computer = envMap = null;
  motionQuality = false;
  onResize = onVisibility = onPointerMove = onScreenInput = null;
}
