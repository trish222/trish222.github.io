# The review scripts

Read this when you need to *check* something rather than change it.

Every helper is a `_`-prefixed `.mjs` Playwright script at the repo
root. **`.git/info/exclude` holds `_*.mjs`, so all of them are
local-only and never committed.** Most run headless, which means
SwiftShader — fine for geometry, NDC boxes and pixel readbacks, useless
for frame times (see `_perfcheck.mjs`).

Most need a server: `npm run preview` in one shell (pinned to port 4317,
which the scripts hardcode) and the script in another. The lamp scripts
that exercise `?lamp=` need `npm run dev` instead, because the flag is
dev-only; they take a `SCENE_URL` env var for that.

The guiding rule for all of them: **a question about geometry is a
question about projected corners, not about a screenshot.** That is what
`window.__fit`, `window.__pick`, `window.__probes`, `window.__histogram`
and `window.__shadowfit` exist for.

## The general pass

- **`_review.mjs`** — the one to use. Shoots desktop / mobile / light /
  reduced-motion / no-WebGL variants into `.impeccable/review/` and
  prints a per-variant probe plus a console-error tally. The no-WebGL
  pass stubs `getContext('webgl*')` to `null`; `scene: "fallback"` there
  and `scene: "live WxH"` elsewhere is the expected result. It does
  **not** exercise the fly-in.
- **`_err.mjs`-style checks**: `_probe.mjs` builds the treehouse in
  plain node with a stubbed `document` and prints the throw — the
  fastest way to find a build error in the model. It earned its place: a
  refactor deleted a function, the scene threw, and `main.js` was
  swallowing it in `.catch(initWithoutScene)`, so the page silently
  became the no-WebGL fallback. That catch now logs before falling back.

## The flight and the screen

- **`_flysteps.mjs`** walks `window.__flyTo` through the run and shoots
  each stop.
- **`_flycheck.mjs`** clicks the screen for real, fills the form and
  clicks back, on mobile and under reduced motion.
- **`_flyfrom.mjs`** shoots the two `FLY_FROM` modes side by side from
  the same off-home pose. Both legs are *posed* rather than played,
  because SwiftShader cannot render a 1.6s flight in 1.6s.
- **`_screenpos.mjs`** / **`_sideshot.mjs`** read `#screen`'s client
  rect, which *is* the projection of the screen plane's corners — so
  they are the A/B for "did the arrival pose move".

## Framing and the camera

- **`_deskfit.mjs`** — does the desk fit, read off `window.__fit` on
  both viewports. Prints the NDC box of the desk, the machine and the
  two together, where ±1 is the frame edge. What `FRUSTUM`,
  `FRUSTUM_MOBILE` and `ISO_TARGET` are set against.
- **`_deskshots.mjs`** — the room with the chrome hidden from home and
  both ends of the leash. **Shoot both after moving anything on the
  desk**: the first version's monitor overhung the back edge, and only a
  side view showed it.
- **`_zoomshots.mjs`** — the establishing shot at each `HOME_ZOOM`
  candidate on both viewports, printing the NDC box and a frame margin
  beside each. Drives `window.__zoom(f)`, so all candidates come off one
  page load. It shoots the flat clamp at each too.
- **`_lowshots.mjs`** — the room from straight in front of the monitor
  at four elevations (2° flat clamp, 10°, 20° home, 30° steep clamp)
  plus the flat clamp at the home azimuth, both viewports, chrome
  hidden, with `window.__fit`'s NDC box beside each. The front-on swing
  is −37 because home is 37° round from the front. Shoot it after
  touching anything the flat view can see.
- **`_persp.mjs`** — the orthographic/perspective comparison material,
  and what `window.__fov(deg)` candidates are shot with.
- **`_orbit.mjs`** — the leash, the click-or-drag decision, the walk
  home, the hint and the reduced-motion carve-out, with real pointer
  events so everything goes through OrbitControls. Two things about it:
  the walk home is **polled, not slept on** (GSAP's `lagSmoothing`
  counts a frame longer than 250ms as 250ms, so on SwiftShader a 1.1s
  tween takes several seconds of wall clock), and `window.__orbit(swing,
  rise)` takes degrees relative to **home** while reporting azimuth in
  both frames. **It still asserts the old ±90° azimuth
  leash and will fail until updated**: the azimuth is clamped off the
  two wall planes now, about -1°..+88° on desktop, with a 6° spring band
  past each end.
- **`_scene-shot.mjs`** — the scene with the Win95 chrome hidden, for
  looking at the 3D on its own.

## The room, the window and the lighting

- **`_probe-room.mjs`** projects candidate room corners into NDC off the
  live camera at home, so the slab and the walls were sized to the frame
  by measurement rather than by squinting at a shot.
- **`_roomshots.mjs`** — the room shell: floor, both walls, wainscot,
  trim and rug. Also verifies the void's pre-image on both render paths
  (it should report err 0). **Out of date**: it walks the leash watching
  `window.__walls()`, which went with the wall fade.
- **`_winshots.mjs`** — the window on the left wall, on desktop /
  mobile / reduced motion. Four jobs, the first two of which a
  screenshot cannot do: whether the assembly lands in frame
  (`window.__fit("wall-window")` — the portrait figure is the one to
  watch); whether the rain is running (`window.__rain()`, and under
  reduced motion whether its clock stays at zero while the shot still
  shows streaks); and a crop taken off its own NDC box, so the crop
  follows it as it is re-tuned. **Out of date** in one job: it reads
  `window.__walls()` to check the window faded with its wall, and there
  is no fade any more.
- **`_lightshots.mjs`** — the night rig, desktop and mobile. Whether the
  picture is moody rather than black (`window.__histogram` over the
  non-void pixels, plus `__probes` and `__pixel`); whether the shadow
  box still covers what casts and what receives (`window.__shadowfit`,
  where a negative margin now means a patch of floor flooded with
  moonlight rather than merely unshadowed); and crops of the three
  places acne would show — the drawer fronts, the contact under the
  monitor's base, and the window's sash inside its reveal.
  `node _lightshots.mjs sweep` re-runs the two searches the rig was set
  by — the six moon aims and the hemisphere/exposure/env grid — off one
  page load through `window.__lights`. It is the method, kept runnable,
  not a test.

## The lamp

- **`_lampshots.mjs`** — the fixture on desktop / mobile / reduced
  motion. Six jobs, and the first three are the ones a screenshot cannot
  do: whether it fits (`window.__fit("lamp")`, plus the margins to the
  walnut's -x and back edges and the gap to the computer kit — note the
  `kit ndc` figure is against the whole kit, contact shadows included,
  so it goes negative and that is fine); whether the moon's shadow box
  still covers it; whether it reads as a light source (`__probes` and
  `__histogram` with the lamp on and off — the local delta on the pool
  is the number); the interaction (a real press on the shade toggles and
  does *not* fly in, a press on the monitor flies in and does *not*
  toggle, the hidden button carries `aria-pressed`); the shots,
  including a crop off the lamp's own NDC box; and **reduced motion**,
  the only path with no render loop — so the fade has nothing to advance
  it and the toggle has to land on the endpoint and draw once, exercised
  through focus + Enter rather than a programmatic click.
  `node _lampshots.mjs aim` adds the tilt/swing sweep and the
  `castShadow` A/B — the method, kept runnable, not a test.
  Two things about it: **read the `curve` row, not the `live` one, for
  the fade** (SwiftShader gives these runs about a frame a second, so
  the whole 0.4s ramp lands between two samples; `curve` is the same
  ease the loop uses, read off the page). And the height it prints is
  the conservative `Box3` figure.
- **`_lampbig.mjs`** answers **"does the lamp get in front of the
  monitor"**, and it is separate because it asks a different kind of
  question: not where the fixture is, but what is on the ray. It walks a
  15x15 grid over the glass (the live overlay's client rect *is* the
  screen plane's on-screen quad), over the kit's projected box and over
  the lamp's own, at home and at **both azimuth clamps**, asking
  `window.__pick` what a press at each point would hit.
  **The grid is walked twice and that is the whole point.** A point
  coming back "lamp" only says the lamp is nearest on that ray — over
  bare walnut that is simply where the lamp is. Occlusion is the
  *conjunction*: this point picks the lamp **and** would have picked the
  machine with the fixture out of the way. So the second pass moves the
  lamp's meshes to layer 1, which `pickTarget`'s raycaster does not
  test, and the script reports where the two passes disagree. An NDC-box
  overlap would have called this wrong in both directions — the two
  boxes already overlap at every azimuth and nothing is in front.
- **`_pool.mjs`** is the lighting half of the same question: a transect
  of on/off luma deltas along two **fixed** world lines across the desk
  top, through `window.__probes`. Fixed, because the beam moves when the
  fixture is re-scaled or re-aimed, and a line through the beam's own
  centre then measures two different places at the two scales — a pool
  that has *moved* reads as one that has dimmed. It prints the aim
  beside the rows so the two can be told apart.
- **`_poolcentre.mjs`** is the same transect taken *through the pool's
  own centre*, which is what "brightest right under the shade" is a
  claim about. Read it with the fixture in mind: from the home camera
  the lamp stands between the camera and its own pool, so the samples
  directly behind it come back 0/0 (occluded by the shade) and the
  three in front of it come back enormous (that is the lit fixture, not
  the walnut). The readable rows are the ones either side, and they are
  the A/B for anything that changes the cookie or `SPOT_INTENSITY`.
- **`_spillab.mjs`** and **`_spillsweep.mjs`** are for the fixture's
  three faint lights. `_spillab` is the A/B: one page load, each light
  alone and then all together, read as a whole block of the framebuffer
  rather than at named points — a spill "on the underside of the arm"
  is a *where* claim and a probe point is one guess at where. It
  reports the lift per band up the fixture, a separate green-shift
  measure (a hue claim needs its own number), how many pixels have gone
  white, and a control on the walnut and the CRT's glass that must not
  move. `_spillsweep` is the search those seats were found by: it walks
  one light over a grid at four intensities and prints the same
  per-band figures, `base` / `arm` / `rim` / `rimx` selecting which.
  Both drive the lights through `window.__lamp({ spillBase, spillArm,
  rim })` separately — moving them together could not attribute what it
  saw.
- **`_spillmap.mjs`** answers the same question as a picture, and it is
  the one to reach for first: it reads the framebuffer with each light
  on and off, amplifies the difference tenfold, draws it into a canvas
  over the page and screenshots that, with the lamp's projected box
  outlined so a patch can be told from the part it is on. Takes the
  gain as its argument. It is what showed the green landing on the
  chain, the shade's end cap and the CRT's bezel — which no count per
  band could have said.
- **`_lampshot.mjs`** / **`_poolw.mjs`** / **`_helpshot.mjs`** are the
  lamp-lab equivalents: one fixture from the lab's three framings, the
  world-unit pool width, and the helper overlays.

## The treehouse

- **`_thshot.mjs`** — the model at the home framing plus a crop of just
  the model, taken off its own NDC box so the crop follows it as it
  grows, with `window.__fit` for the model, the machine and the desk.
- **`_thdebug.mjs`** — the magnifier, and it exists because the home
  framing cannot do this job: the model is a tenth of that frame at a
  fixed three-quarter angle, so a wall that is *missing* and a wall that
  is merely *in shadow* look identical. It parks the model at the
  camera's target, winds the frustum to the orbit's minimum, hides the
  desk and the machine, and turns it face by face. It leaves the page
  mangled, which is fine — every run reloads.
- **`_treeshot.mjs`** — **the tree with the house hidden**, which the
  home framing cannot do: the trunk's S runs up behind exactly where the
  house hangs. It hides every mesh whose material is one of the house's
  seven colours. Colour is a sound handle rather than a hack — the kit
  batches by shape *and* colour, so the planks, trim, glass and shingle
  are already their own meshes.
- **`_canopyfit.mjs`** — does the canopy stay on the desk (the model's
  world box against the desk's, with a margin per edge) and stay off the
  glass (the live overlay's client rect against the model's NDC box).
  Note the world box is `Box3.setFromObject`, which for an
  `InstancedMesh` takes the AABB of a *rotated* AABB — conservative on
  the +x edge by about half a unit. **Treat it as the check rather than
  the truth: it is the one the model has to pass, and it fails safe.**
  Also prints the top of the tree as a height above the desk top, and
  the instance and mesh counts.
- **`_tightfit.mjs`** — the **true** world box, instance by instance,
  transforming each instance's own box corners. Run it beside
  `_canopyfit.mjs`, never instead of it. It uses `window.__camera`,
  exposed next to `window.__scene` for exactly this.
- **`_spares.mjs`** — the world boxes of the spare bricks, the
  treehouse, the computer kit and the desk, and the four gaps between
  them. Run it after moving anything in `SPARE_PLAN`.
- **`_finalshots.mjs`** — the four framings the finished model has to
  hold up in (home, eye level, and a profile of each flank) on both
  viewports, with `window.__fit` beside each.

## The desktop

- **`_step3.mjs`** covers the desktop itself, and the two variants are
  deliberately *different runs*, because the two viewports are different
  interaction models — mouse / double-click / floating windows against
  touch / one tap / maximized. Shared: open both windows, empty the bin,
  close the active one and check focus fell to the next, cross the
  `PHONE` breakpoint in both directions and check the maximize undid
  itself, log off and check the bin refilled. Desktop-only: raise the
  window behind, drag it, drag it far past the corner and check it
  clamped, click bare desktop and check focus dropped. Mobile-only: open
  by a single `tap`, check the window is `MAX(auto)`, and check the
  title bar is inert.
  Two things before editing it: the mobile context needs `hasTouch` and
  `isMobile`, and the Recycle Bin is reached with `focusBin`, not a bare
  taskbar click — the taskbar button is a **toggle**, so pressing it on
  the focused window minimizes it, which is correct behaviour that reads
  as a test failure.

## Frame rate

- **`_perfcheck.mjs`** — `npm run dev` in one shell, `node
  _perfcheck.mjs` in another (optionally with a url and
  `desktop`/`mobile` to limit it, and `notree` to hide the treehouse
  before measuring). It flies in and out for real and prints median /
  p95 / worst frame time and a count of frames over 33.4ms for each leg.
  It needs a **dev** build, since the meter only exists there. Three
  things are deliberate: it runs **headed** (headless chromium falls
  back to SwiftShader, and software-rasterised numbers say nothing);
  **one browser per variant**, because two live WebGL contexts in a
  single headed chromium reliably takes the renderer down; and every leg
  **parks the page first and retries if it did not animate**, because a
  headed window on macOS intermittently receives a real OS click just
  after it opens, which lands on the glass and starts the fly-in before
  the probe is ready. That is the harness, not the page.

See [perf.md](perf.md) for what the numbers should be and the rule about
never reading one without its A/B.

## Older one-offs

`_shot.mjs` and `_one.mjs` point at elements from a previous theme
(`#ink-field`) and will throw; `_review.mjs` supersedes them. `_fly.mjs`,
`_hover.mjs`, `_menu.mjs`, `_still.mjs`, `_step1.mjs`, `_orbitshots.mjs`,
`_realshots.mjs`, `_closeup.mjs`, `_backfit.mjs` and `_sideshot.mjs` are
single-question scripts kept from earlier passes — useful as templates,
not maintained.
