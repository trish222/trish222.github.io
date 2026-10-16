# Design

The world is a **halftoned botanical press plate**: one photograph screened into
visible four-ink dots, with the name stamped across it at a scale that does not
fit the sheet. Under the ink the sheet is not flat — it is four grounds clouded
into each other and drifting. Both themes are the same plate: dark is the poster
pulled on black, light is the same pull on paper.

Tokens live in `src/style.css` (`@theme` + the `:root` / `.dark` blocks). Both
shader passes read their palette from those same custom properties at runtime, so
CSS stays the single source of colour.

## Colour

Two ink sets, because the interface and the plate are asked for opposite things.

**The interface inks** (`@theme`) own whole regions; they are never small
accents. Full strength on purpose — they have to hold contrast at 1px and at
12px.

| Token | Value | Role |
|---|---|---|
| `--color-ink-magenta` | `#ff2e93` | The lead ink. Owns the close panel outright, carries links, tags, focus rings. |
| `--color-ink-rose` | `#c0186b` | Reserved companion to the lead ink. |
| `--color-ink-amber` | `#f79824` | Warm plate. |
| `--color-ink-cyan` | `#1fbde3` | Cold plate. |

**The plate inks** are the same four names let down and shifted off red, and the
amber off orange. A link needs an ink that survives being a hairline; a flower
printed in that same magenta goes crimson, because full-strength magenta
multiplied against paper takes nearly all the green out of it.

| Token | Dark (poster) | Light (paper) | Role on the plate |
|---|---|---|---|
| `--plate-magenta` | `#ea6fa5` | `#e87aab` | The petals. |
| `--plate-rose` | `#a8487f` | `#bb6090` | The key plate — deepens the shaded side of the bloom. Browner and a shaded petal goes khaki. |
| `--plate-amber` | `#cc9a72` | `#dcab8c` | Anthers, the warm rim of a petal, misregistration fringe. |
| `--plate-cyan` | `#6aa8c2` | `#7bb3c4` | Leaf shadow, the opposite edge of every fringe. |

**The aura** — the four grounds the field drifts between. Not accents and not
inks: this is the paper's own colour, clouded. Close in value so the record set
over them keeps its contrast, far apart in hue so the drift reads.

| Token | Dark | Light |
|---|---|---|
| `--aura-1` | `#182a4e` ink blue | `#f5edd9` cream |
| `--aura-2` | `#1e5e44` deep green | `#aecb93` sage |
| `--aura-3` | `#6e4714` bronze | `#f2c97a` gold |
| `--aura-4` | `#541a5e` plum | `#cdb4d8` lilac |

Grounds and text, per theme:

| Token | Dark (poster) | Light (paper) |
|---|---|---|
| `--color-page-bg` | `#07070a` | `#efebe1` |
| `--color-page-text` | `#f4f1ea` | `#0c0b09` |
| `--color-page-muted` | `#948f86` | `#5c574e` |
| `--color-page-rule` | `#f4f1ea` | `#0c0b09` |

Alpha tokens, rather than hard-coded rgba: `--rule-a` (hairline rules),
`--grid-a` (the register grid), `--sheet-a` (how opaque the record sits over the
field). Nothing leans on the field for legibility: every piece of text either
sits on `.sheet` — the page colour at 0.91–0.955 — or carries its own `.paste`.

## Type

- **Wordmark — Canobis Demo** (Craft Supply Co), self-hosted from
  `public/fonts/`, one use only: the name across the plate. A psychedelic
  display face with uppercase and lowercase and nothing else — no figures, no
  punctuation, not even a space — which is exactly as much as the wordmark
  needs, since every glyph there is its own span. Free for personal use; the
  commercial licence is at craftsupply.co.
- **Display — Bodoni Moda**, 600–900. Every section title and entry role.
  Extreme thick/thin is the point.
- **Structural — Archivo**, 400–700. All body copy, margin notes, the rail.
- **Signature — Mrs Saint Delafield**, one use only: the name at the close.

Computed steps: body 16px → entry role 20.8px → section title 32.8px, opening to
22.4px and 36.8px from `md` up. Margin notes and rail labels sit at 10px
(`.note`, `.mark`); `.mark` adds uppercase and +0.17em. No monospace anywhere —
the measurement readout uses Archivo with `font-variant-numeric: tabular-nums`
(`.tnum`).

The design detector reports `flat-type-hierarchy` against this file. It is a
false positive: the sizes come from `@apply` inside `@layer components`, which
the detector cannot resolve, so it reads every role as 16px.

## Components

Named in `@layer components`:

- `.field` — the fixed canvas plate, with the same four aura colours laid under
  it as radial washes. That is the pre-paint and the no-canvas fallback, so the
  moment the field lands is a change of texture rather than of colour.
- `.register` — the fixed hairline grid, the press's own guides, at `--reg`
  (≈12 columns).
- `.sheet` — the near-opaque ground the record sits on, letting the dots show at
  the edges without costing text its contrast.
- `.paste` — a label pasted onto the proof. Any small text that sits directly on
  the plate carries one, so contrast never depends on what the photo is doing
  underneath.
- `.plate-solid` — a flat spot-colour panel. One region the ink owns outright;
  used once, at the close.
- `.boxed` — the only button shape: 1px rule, no radius, inverts to magenta.
- `.slot` — a labelled placeholder with a diagonal hatch. Marks absent content as
  absent rather than filling it with fiction.

No cards, no radii above 2px, no shadows. Elevation is declared once, always as a
1px rule.

## The wordmark

`src/main.js` → `fitWordmark()`. Two words of very different length, both asked
to run the full measure. Four rules make it work:

1. **The two lines share a stretch, not a point size.** Canobis carries about
   0.45em of advance per cap, so TRISH — three caps shorter than NGUYEN — needs
   a third more of either stretch or size to reach the same margin. Sharing the
   size is what makes the stack look like two different fonts: one line lands
   at 1.6x and the one under it at 1.1x, and a stretched stem is a heavier
   stem. So the fitter bisects for the single stretch both lines can afford
   within the height budget, then sets each line at whatever size brings it to
   the margin there. The shorter word is simply set larger, the way a line of
   wood type gets justified.
2. CSS transforms do not reserve layout space, so each span's `width` is set to
   the width its stretched glyph actually occupies. Without this, wide letters
   simply overlap their neighbours.
3. **Nothing narrows below its drawn width** (`MIN_STRETCH`), and nothing
   exceeds `MAX_STRETCH` = 1.75, past which Canobis's bowls flatten into
   lozenges and the line reads as a smear. Width the floor costs is taken back
   off the letters still free.
4. The face is drawn with 0.03em sidebearings — set for words, not for a
   wordmark pulled to the width of a sheet — so `--wm-gap` adds real space
   between letters and the fitter subtracts it from the measure before
   dividing.

The `font-size` on `.wm-line` is a **height budget, not a size**: the fitter
conserves the two lines' total and trades size between them. Its three terms
each guard the height — `28vw` sets the scale, `26rem` stops it running away on
a large monitor, `38svh` keeps the margin notes and the button on the same
screen as the name on a short laptop. `.wm-bleed` caps at `100rem` for the same
reason: past that, a wider measure only buys stretch.

Per-letter `--sx` in CSS is an authored ripple — which letters carry a little
more of the line than their neighbours — held much closer than the Didone took,
since Canobis draws its own rhythm. The fitter renormalises it to the measure
(`--sxf`) and overruns the sheet by a fixed `BLEED`. Because every advance comes
from the wordmark face, the fit is redone on `fonts.ready`, an explicit
`fonts.load()` of Canobis Demo, `loadingdone`, and `window.load` — and a sanity
check rejects advances that are implausibly narrow for the point size, which is
what a fallback-metrics fit looks like.

## The field

`src/field.js`, in two passes.

**The ground.** Four aura colours clouded into each other by warped value noise
and combined as sharpened weights, not a chain of mixes — averaging four hues
gives grey, which is exactly how an ombré turns to mud. It carries nothing finer
than a soft blob, so it renders into a buffer of about 40k pixels and the screen
pass stretches it back up under bilinear filtering. Run per-pixel at full size it
cost roughly as much as the halftone itself. The ink prints *on* this in both
directions, so the ground drifting moves the whole plate with it.

**The screen.** A fragment shader runs four rotated halftone screens
(75°/45°/0°/15°) over `public/bloom.jpg`, each ink on its own plate with its own
offset. Two separations, because the grounds are physically opposite:

- **On black** the inks add light, so each plate carries how much of its own ink
  the pixel emits — the colour is unmixed against the real ink primaries
  (`unmixMatrix`). This is what keeps the halftone tonal: a lit petal prints
  small dots, a shadowed one prints large. Keying on chroma alone flattens a
  photograph into a sticker.
- **On paper** the inks subtract, so that plate is an ordinary CMY pull.

Both are masked by chroma, so the near-neutral wall the flower was photographed
against carries no ink and falls back to the ground.

Replacing the photograph needs no code change: `public/bloom.jpg` or
`public/bloom.png`. There is deliberately **no drawn substitute**. A generated
flower reads as an icon, and a field that quietly swaps one in hides the fact
that the photograph went missing — so with neither file the canvas removes itself
and the CSS ground shows through. The cover crop is anchored at 32% vertically
because the blooms sit in the upper two thirds.

## Motion

One grammar, registration:

- The wordmark settles out of over-stretch on load, exponential ease-out, from an
  already-visible state (`@property --settle`).
- The pointer pulls the plates out of register and turns the screens; at rest
  they drift back.
- The aura drifts under all of it, slowly enough that the page reads as still.

`prefers-reduced-motion` renders one static frame and no drift. The render loop
also stops when the tab is hidden or the field scrolls out of view.

## Constraints held

Single page, no runtime dependencies, no backend. Works without WebGL (one static
2D screen, the same chroma key and the same unmix) and without canvas (the CSS
aura washes). Keyboard operable with visible focus; selection, scrollbar, and
caret are themed from the palette rather than left to the browser.
