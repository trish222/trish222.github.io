# The Win98 desktop: windows, touch, typography, 98.css

Read this when touching `index.html`, `src/main.js`, `src/style.css`,
the desktop icons, or anything about how a window behaves.

`src/main.js` is imperative DOM code keyed off `id="window-<name>"` and
`data-window` / `data-drag` / `data-target` attributes, with a `WINDOWS`
registry object at the top. **Add a window by adding markup in
`index.html` *and* an entry in that registry.** The registry carries the
icon basename alongside the title, and skips any entry whose
`#window-<id>` does not exist — which is what lets a desktop icon land
before its window does.

The desktop chrome is invisible and inert until the sign-in; see the
gate in [screen-overlay.md](screen-overlay.md), and the three ways
back out to the room beside it — none of which ends the session.

**It is also inside the monitor.** The whole desktop — icons, windows,
taskbar, Start menu — lives in `#screen-shell`, a sibling of the login
inside the overlay box scene.js maps onto the screen plane. So "the
desktop's coordinates" below never means the viewport's: `#desktop` is
`SCREEN_BASE_W` x `SCREEN_BASE_H` less the taskbar (900 x 648), fixed,
whatever the viewport is, and the matrix scales that onto the glass.
Nothing in this file has to know that, with one exception — a **drag**,
which reads `clientX`/`clientY` instead of acting on a target, and so
goes through `glassPoint` first. Everything else (hit-testing, hover,
focus, wheel, caret placement) the browser puts through the transform
itself.

The one viewport-shaped thing left is the narrow break-out: under
`MOBILE_BP` the arrival crops the glass, so the desktop takes the page
instead and `#desktop` really is the viewport less the taskbar. Both
states are the same markup and the same code — see "NARROW VIEWPORTS"
in style.css.

## The windows

Five of the six are static markup. Two are worth a note each:

- **Resume** is the only place `--font-mono` is spent. Everything else
  on this desktop is chrome (`--font`) or copy (`--font-body`); a resume
  is a *document*, and Departure Mono is what separates it from both.
  The dates sit opposite the titles in a `flex` row that wraps rather
  than collides, so the entries hold together once the window is clamped
  to a phone.
- **Recycle Bin** is the one window carrying state. It is a detail view
  — Name / Original Location / Date Deleted, laid out on a `grid` so the
  header and the rows cannot drift apart — and the two right-hand
  columns drop out below 560px rather than squeezing the name to one
  character a line. **Emptying it really empties it**: dead chrome is
  worse than no chrome. The rows go `hidden` rather than being removed,
  so `logOff` can refill them, which is what makes the state testable
  more than once per load. The listing uses `--font`, not the body face:
  a file list is a UI, not reading matter.

## Escape, and what has the first claim on it

`dismissChrome` closes whatever is open *on* the desktop and reports
whether it took the press. Escape asks it first and leaves for the
room only if it says no — the 98 rule, where the key dismissed the
menu you had open before it meant anything else. The Start menu is the
whole of the list today, because it is the only chrome with an
open/closed state: the windows are not modal and Escape never closed
one in 98 either, and the two real dialogs (Empty Recycle Bin, Shut
Down) are native `confirm()`s the browser takes the key for before any
handler here runs. Anything added with a dismissible state goes in
`dismissChrome`, above the Start menu if it opens over it.

`setStartMenu` is the one place that menu's state is written, and it
writes three things: the panel, the Start button, and `menu-open` on
the body. That last one is a contract with the scene — a press on the
room flies the camera out, and the first press after opening a menu
has to be the one that closes the menu. `canLeaveScreen` reads the
class so scene.js never has to know what a Start menu is.

## Drag and focus

- **Drag is on pointer events with `setPointerCapture`**, not
  mouse-move-on-`document`. That is what makes a finger work at all, and
  the capture is what keeps a fast drag from being dropped when the
  pointer outruns the title bar. `touch-action: none` on
  `.window-titlebar` is required with it, or the browser claims the
  gesture as a scroll and the `pointermove` stream stops dead.
  `pointercancel` has to clear `dragState` too: left set, the window
  follows the next pointer that moves.
- **Bounds are measured off `#desktop`**, which is the window's own
  containing block, so `left`/`top` and the limits are in the same
  coordinates. Measuring off the *viewport* — `innerHeight` less a
  hard-coded 40, say — is wrong by the whole of the overlay transform
  now, not merely by the taskbar. `toggleMaximize` is `height: 100%`
  for the same reason: 100% of the glass is the screen's own rectangle.
- **A drag maps the pointer back through the glass** (`glassPoint`).
  The scale is `#desktop`'s rendered width against its layout width,
  which is enough because the framing the desktop is used at is head-on
  and centred — there the overlay transform is a plain scale and
  translate (`quadTransform` writes a 2D `matrix()` for exactly that
  case) and the orbit is disabled while the camera is parked, so
  nothing can skew it. The no-WebGL path and the break-out carry no
  transform and fall out of it as scale 1. Unmapped, a window lagged
  the pointer by ~20% and slid out from under the grab.
- **Windows open sized and centred against the desktop.** The widths
  and positions in `index.html` are 1995 figures: 480px of About Me at
  `left:130` is a postage stamp in the corner of a 1567px display.
  `placeWindow` makes the authored width a *floor* (`OPEN_FRAC` of the
  desktop, capped at `OPEN_MAX`, past which a line of body copy is too
  long to read) and centres the result a little above the middle
  (`OPEN_RISE`, because the taskbar has already taken the bottom and
  dead centre reads as low). A height floor goes with it, and is not
  optional: these windows are sized by their content, so scaling width
  alone made About Me arrive 784x233 — bigger than before and *worse*, a
  letterbox slot with two sentences adrift in it. The floor is the
  smaller of a share of the frame's height and a proportion of the
  window's own width, and it is only a floor, so the Resume keeps its
  taller natural height. Each window after the first steps `CASCADE`
  down-right.
  Placement happens on the **first** open only (`dataset.placed`), so a
  window reopens where it was dragged to — a visitor who put it there
  meant it, which is also why the resize handler only clamps. Signing
  out clears the flags and the computed height, so a new session starts
  centred. `dataset.baseWidth` remembers the authored width, since after
  the first placement `style.width` holds the computed one and scaling
  that again each session would walk the window steadily wider.
- **Every window is clamped into view as it opens**, and again on
  resize. Contact opens at `left:310px`, which on a 390px phone is
  almost entirely off-stage. `.window` carries
  `max-width`/`max-height: 100%` as the other half of that — the clamp
  can only resolve to 0 if the window is bigger than the frame, so the
  two together always fit. The body is the flex child that gives, so it
  scrolls and the chrome stays whole. Clamping has to happen *after* the
  unhide: a `display: none` window measures 0 and would clamp itself
  into the corner.
- **`focusWindow` leaves early if the window is already on top.** Every
  `pointerdown` inside a window arrives there, and it rebuilds the
  taskbar's DOM — without the guard, clicking into a text field rebuilt
  the taskbar under it on every click.
- **Closing or minimizing hands focus down** to the topmost window left
  (`focusTopmost`, off the inline `zIndex`), and **clicking bare desktop
  drops it** (`blurWindows`). Windows live inside `#desktop`, so their
  clicks bubble to that handler and have to be filtered out; the taskbar
  and Start menu are outside it, which is why clicking those correctly
  does nothing.

## Touch, and why a phone gets a different interaction model

Measured on a 390x844 phone, the desktop metaphor had already stopped
paying for itself: the icon column is 72x395, the first window opened
390x525 at y=40, and that left **24px of one icon** visible and none of
the five whole. A window is the full width of the frame there whatever
you do — `max-width` clamps it and `left` can then only resolve to 0 —
so what the floating model actually bought was a window that covered the
icons *and* left a dead strip under itself.

So below `PHONE` (`max-width: 560px`) **windows open maximized**, and
the taskbar is the switcher. The implementation detail that matters is
`dataset.autoMax`: it marks a window maximized *by the viewport* rather
than by someone pressing the button, so crossing the breakpoint back to
a desktop width un-maximizes exactly those and leaves a deliberate press
alone. `toggleMaximize` deletes the flag — a press owns the state from
then on. `fitWindow` is the one place that decides, and both
`openWindow` and the resize handler go through it.

Crossing back to a desktop width runs `restore` and then `placeWindow`,
in that order, so a window first opened on a phone — one that was never
placed — is centred rather than dropped back onto its authored 1995
corner. `maximize`/`restore` carry `prevHeight` along with the position
for the same reason: placement may have set a height, and `height: ''`
would quietly drop it.

Two consequences fall out, both intended: a maximized window does not
drag (the `pointerdown` handler returns early), so on a phone the title
bar is a label rather than a handle; and the Resume gets the full 804px
instead of scrolling inside a 525px box.

The touch affordances that came with it:

- **`.win-btn` goes to 28x26 under `(pointer: coarse)`.** At 16x14 the
  close button is authentic and unhittable with a thumb — and on a phone
  it is the first thing a visitor reaches for when they want the desktop
  back. Keyed off the *pointer*, not the viewport: a 1280px tablet needs
  it and a 500px desktop browser window does not.
- **Desktop icons open on one tap.** Double-tap is a desktop idiom —
  there is no hover to preview with, so the first tap has nothing else
  to mean. The decision reads `e.pointerType` off the last
  `pointerdown` rather than a media query, because a laptop with a
  touchscreen answers yes to `(pointer: coarse)` and is still being
  driven by a mouse; what matters is which input is in use right now.
- **`touch-action: manipulation` on every control.** It kills
  double-tap-to-zoom, which otherwise both collides with the icon
  gesture and adds the ~300ms click delay everywhere else.
  `manipulation`, not `none` — panning and pinch stay.

**Testing any of this needs `hasTouch` *and* `isMobile` on the
Playwright context.** `(pointer: coarse)` describes the input, not the
viewport, so a plain 390px context still reports a fine pointer and none
of the touch rules apply — the run looks green while testing nothing.

## Typography, and the desktop icons

**The chrome face is a local stack and the window faces are vendored.**
`--font` asks for MS Sans Serif, then Trebuchet MS, then Arial: nothing
is bundled for it, so title bars, buttons, menus, icon labels, the
taskbar and the login dialog render in whatever the visitor already has.
The vendored 98.css falls back to `--font` too, so it is one knob for the
whole kit. (This is the rule violation tracked in CLAUDE.md's notes.)

The faces that *are* shipped are OFL and vendored into `public/fonts/`
with their provenance in the `LICENSE.txt` beside them, rather than
imported from `node_modules`: Vite hashes what it emits and a preload
needs a URL that does not move.

- **Playfair Display** — the greeting on the CRT's picture, drawn with
  canvas 2D, which is why it is preloaded from `index.html`.
- **Atkinson Hyperlegible** (`--font-body`) — reading matter inside
  windows, set on `.window-body`. The chrome face is a readability tax
  on anything longer than a label; the controls inside a window body are
  chrome and opt back in explicitly.
- **Departure Mono** (`--font-mono`) — the resume and anything else that
  wants to read as a terminal.

A pixel chrome face (Pixelify Sans) was fitted and taken back out on
request. Two things it needed are worth knowing if one is ever fitted
again: `-webkit-font-smoothing: none` plus integer sizes, since
antialiasing only greys the edges of blocks that are already the right
shape; and a widened word space, since a one-column space reads as
"Awebapp" at UI sizes. The third is in the still — see "fonts cannot be
fetched" in [screen-overlay.md](screen-overlay.md), which stops being a
footnote the moment `--font` is a face the generic fallback does not
resemble.

**The desktop icons are 32×32 PNGs in `public/icons/`**, generated by
`scripts/make-icons.mjs` (`npm run icons`) from rectangles, tapers and
discs — the same reasoning as the 3D machine: a checked-in binary with
no source is a dead end, and at this size every pixel should be placed
rather than resampled. They are **placeholders for Trish's own pixel
art**: drop real PNGs of the same names over them and nothing else
changes. They replaced emoji, which are a font rather than artwork and
so render as whatever the visitor's OS feels like. Everything that shows
one — desktop, taskbar, Start menu, title bars — draws it with
`image-rendering: pixelated`, at 32px on the desktop and 16px
everywhere else. The Start button's mark is a little CRT: the machine
the site is set inside, and nothing anyone else owns. `document.png` is
the odd one out — it is not a desktop icon at all but the row glyph in
the Recycle Bin's listing, drawn separately so `resume.png` keeps
meaning the resume.

## 98.css

The login screen on the CRT is built with [98.css] (MIT). It is **not**
imported from `node_modules` — `npm run vendor:98` derives
`src/vendor/98.scoped.css` from it, and that generated file is what
`src/style.css` imports. Three things have to change first, all of them
in `scripts/vendor-98css.mjs`:

- **It ships MS Sans Serif as woff/woff2.** Those are Microsoft fonts,
  which the project rules forbid, and importing the package directly
  makes Vite emit the binaries into `dist/`. The `@font-face` blocks are
  dropped and the stack falls back to the site's own `--font`. (Its
  icons are fine — all inline `data:` SVGs redrawn by the 98.css author,
  no Microsoft artwork.)
- **It styles bare `body`, `h1`-`h4`, `button`, `input`, `select`,
  `table` and `textarea`**, which would stomp the desktop chrome. Every
  rule is scoped under `.ui98`, so the kit only applies inside the login
  screen.
- **`.window` and `.window-body` are already taken** by the desktop's
  own chrome, and `main.js` drives every `.window` on the page through
  the window manager. They are renamed `.win98` / `.win98-body` — so the
  login dialog's markup reads `class="login-dialog win98"` rather than
  the `class="window"` the 98.css docs show.

Regenerate after bumping the dependency; never hand-edit the output.

[98.css]: https://github.com/jdan/98.css
