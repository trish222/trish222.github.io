> Historical brief for a different visual theme. Superseded by docs/architecture.md.

---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: ["src/style.css","src/main.js"]
---

## Status — 2026-10-19 (not yet built)

**The direction contract below is unbuilt. The shipped `index.html` is a different design.** Read this note before treating anything under "Direction contract" as describing the live site.

What actually ships today:

- Hero is an interactive **halftone dot wordmark** reading `trish nguyen`, ported from a 21st.dev component into `src/halftone-wordmark.js`. See `README.md`.
- Type is **Montserrat + JetBrains Mono**, not Bodoni Moda / Archivo. The contract's "exactly one signature" *is* now built, but in **Ballet** rather than Mrs Saint Delafield: `.hero-script` lays the name in script over the dot field.
- Palette is the cyberpunk neon set in `src/style.css` `@theme` (`#121321` ground, neon green / cyan / fuchsia), not the four print inks.
- Sections render as neon "folder" cards with placeholder bodies.
- **The bloom photograph is not wired up on this branch** — `public/bloom.jpg` does not exist here and nothing references it. The image itself is not lost: it sits untracked at `design-references/bloom.jpg`, and is committed as `public/bloom.jpg` on `theme/flower` alongside `src/field.js`, which is where this contract was actually pursued.

Where the two overlap: both want a halftone screen that reacts to the pointer, and a name set too large for its sheet, bleeding past the margins. That much is live.

Open decision: revive this contract deliberately — the assets and `src/field.js` are on `theme/flower` — or retire this document. Leaving it unmarked will mislead the next reader.

## Scope

`index.html` — single-page portfolio for Trish Nguyen. Visitor mode: **Experience** leading into **Read**. Audience: recruiters/hiring managers skimming for role + stack + proof, and design-literate peers who will read the craft. Both weighted equally, so the first viewport is the artifact and everything below it is a scannable record.

Product truth comes from PRODUCT.md (NC State CS, SAS Institute CI360 Web & Mobile intern, NCSU Engineering IT student web developer). Projects and skills ship as visibly labeled placeholder slots — no invented claims.

Confirmed this round: the bloom is a **real photograph the user supplies** at `public/bloom.jpg`, halftoned at runtime; a procedurally painted bloom feeds the identical pipeline until that file lands. Both themes ship — dark is the poster, light is the same plate pulled on paper. Sections build at full structural fidelity with marked placeholder copy.

Replaced worlds, anti-reference only: Frutiger Aero glass bubbles; the cold-white blue-moiré press proof.

## Direction contract

**THESIS.** A botanical plate run on a press that was never cleaned: one enormous flower, screened into visible halftone dots, with the name stamped across it at a scale that will not fit the paper. It refuses the portfolio default — centered name on a quiet ground, equal project cards, a tasteful accent — and refuses its opposite, the austere type-only page, by letting a photograph bleed edge to edge and letting the letterforms break at the margins.

**OWN-WORLD.** Ground `#07070A`; the plate prints in four inks — magenta `#FF2E93`, rose `#C0186B`, amber `#F79824`, cyan `#1FBDE3` — that own whole regions, never accents. Bodoni Moda for display: extreme thick/thin, each letter individually stretched and widened so the word swells and pinches across the measure. Archivo for every structural and annotation text, annotations at 9–10px in sentence case, set hard against the grid, never mono-as-costume. Mrs Saint Delafield, copperplate script, for exactly one signature. A fixed hairline register grid at `rgba` 7% sits over the whole document — the press's own guides. No cards, no rounded chrome: content sits in grid cells with 1px rules.

**STORY.** The visitor lands inside a print — a flower dissolving into dots, a name too large for its sheet — and reads craft before reading a word. Scrolling, the bloom recedes behind a legible record: role, employer, stack, placeholders honestly marked. They leave with an email address and the memory of the halftone resolving as they moved.

**FIRST VIEWPORT.** Full-bleed halftoned bloom, dots sized ~5px, drifting. Hairline rail at top: name left in Archivo 10px, section index right, 1px rule under. `TRISH NGUYEN` set at ~19vw across two lines, white, per-letter stretched and bleeding past both margins, stamped over the bloom. Two annotation blocks at grid intersections carry real facts — discipline and school at upper-left-under-the-rule, current role at mid-right, both ragged to the grid like the reference's margin notes. Primary action `Write →` mailto sits bottom-left in a 1px box. Bottom-right: live mono-free readout of the screen's angle and dot pitch, proving the field is computed.

**SIGNATURE INTERACTION / MOTION.** The halftone screen rotates and the four inks separate under the pointer — moving the cursor pulls the plates out of register and the dot angle follows it; at rest the screen drifts back. One authored moment; the wordmark letters settle from over-stretched to their set widths on load, exponential ease-out, already visible before it runs. Reduced motion renders one static frame and no drift.

**FORM.** Halftoned botanical press plate / experimental exhibition poster. Brief-pinned by the user's supplied reference image (oversized smeared letterforms over a dithered magenta tulip, hairline grid, margin annotations, script signature) — a pinned direction beats the roll, so no concept tournament ran. Seed key: `brief-pinned/halftone-botanical`. Code-led: no image generation in this tool surface, so there is no comp and the ambition rides in FIRST VIEWPORT and the signature interaction above.

**FINISH.** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
