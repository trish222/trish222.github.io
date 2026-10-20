# trish222.github.io

Personal portfolio for Trish Nguyen. Static site, no framework: **Vite 5 + Tailwind CSS 4 + vanilla ES modules**.

Type: **Montserrat** (display), **JetBrains Mono** (everything structural), **Ballet** (the one script signature over the hero).

```bash
npm install
npm run dev      # dev server, HMR
npm run build    # production build -> dist/
npm run preview  # serve the built site locally
```

## Deploying

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages **on push to `main` only**. Work on a branch, merge to `main` to ship. `dist/` is gitignored and built by CI.

## Branch layout — read this first

The repo holds **parallel visual directions, one per branch**, not a linear history. They have genuinely different designs, not just different colors:

| Branch | What it is |
| --- | --- |
| `main` | Currently level with `theme/cyberpunk`. |
| `theme/dots` | **This branch.** Cyberpunk base + the halftone dot wordmark hero. |
| `theme/cyberpunk` | The neon base `theme/dots` was cut from. |
| `theme/flower` | The most developed branch — carries `PRODUCT.md`, `DESIGN.md`, `src/field.js` (~694 lines), `public/bloom.jpg`, a custom webfont. |
| `theme/dither`, `theme/editorial`, `theme/frutiger`, `theme/windows95`, `theme/y2k` | Other explorations. `frutiger` is explicitly retired (see `PRODUCT.md`). |

**`PRODUCT.md` and `DESIGN.md` exist only on `theme/flower`.** `PRODUCT.md` is the product truth for *every* branch — audiences, positioning, and the verified biographical facts — so read it before writing any copy here:

```bash
git show theme/flower:PRODUCT.md
git show theme/flower:DESIGN.md
```

Porting `PRODUCT.md` onto whichever branch becomes the real site is worth doing early.

## Layout

| Path | What it is |
| --- | --- |
| `index.html` | The whole page. Vite serves it directly; all markup lives here. |
| `src/main.js` | Entry module — wires up every interactive piece. |
| `src/style.css` | Tailwind import, the `@theme` tokens, and all component CSS. |
| `src/halftone-wordmark.js` | The hero dot field (see below). |
| `public/` | Served as-is, unprocessed. |

There is **no `tailwind.config.js`** — Tailwind 4 is configured through the `@tailwindcss/vite` plugin in `vite.config.js` plus the `@theme` block at the top of `src/style.css`. Add design tokens there, not in a JS config.

## Navigation

A glass pill floating over the wordmark (`.nav-dock` / `.nav-pill` in `src/style.css`). It is `position: fixed` and out of flow on purpose — that is what lets the hero measure the full screen. The highlight behind the links is a **single** element (`#nav-glider`) moved and resized by `setupNavGlider()` in `src/main.js`, so it slides between links rather than fading in per link; it measures live layout, so a late web font can't skew it. Under `md` the links collapse into the hamburger and the same glass drops down as `.nav-sheet`.

Because the page no longer scrolls, the nav links are anchors that go nowhere today. They work as-is the moment the scroll lock comes off.

Under the pill sits the **palette picker** (see Theming). On mobile the dropdown sheet lands in exactly that space, so opening the menu fades the picker out (`.palette-picker.is-hidden`).

## Theming

**Three custom properties are the whole palette:** `--color-page-bg`, `--color-page-text`, `--color-accent`. Everything else derives from them — the nav glass, the swatch ring, the folder glow (`--glow-color`), and the hero dot field (`--hwf-bg` / `--hwf-ink` / `--hwf-warm`). Add a color by deriving it from those with `color-mix()`, not by hard-coding a hex somewhere new.

They're declared light-first in the `src/style.css` `@theme` block with `.dark` overrides, and `@variant dark (&:where(.dark, .dark *))` makes Tailwind's `dark:` utilities follow the class.

### The palette picker

The row of squares under the nav is the real theme control. `PALETTES` at the top of `src/main.js` is the table — one entry per swatch:

```js
{ id: 'baltic', name: 'Baltic', dark: true,
  bg: '#33658a', text: '#ffffff', accent: '#f6ae2d',
  strip: ['#33658a', '#86bbd8', '#f6ae2d', '#f26419'] }
```

`applyPalette()` writes `bg`/`text`/`accent` **inline onto `<html>`** — inline style beats any rule, so it overrides both the `@theme` defaults and the `.dark` block — and toggles the `dark` class from `dark:` so Tailwind's dark utilities stay honest. `strip` is only what the square itself shows, painted as hard-stop vertical bands; it doesn't have to match the three applied colors. **To add a palette, add a row to that table** — the swatch, its label, keyboard order and persistence all follow.

The sun/moon button is now a shortcut between the two neutral palettes (`paper` / `noir`); every other palette carries its own light or dark side.

Persistence: `localStorage.palette` holds the id, and `localStorage['palette-vars']` holds the plain hexes that the inline `<head>` script replays before first paint so a reload doesn't flash the default. That script deliberately has **no copy of the table** — it replays values. `localStorage.theme` is still written for backwards compatibility.

**The hero canvas reads its colors from CSS**, so a palette change has to tell it to re-read them: `applyPalette()` calls `halftoneHero.refresh()`. Anything else that paints to a canvas needs the same treatment.

## The hero dot field

`src/halftone-wordmark.js` is a vanilla port of [21st.dev `@kedhareswer/halftone-wordmark-footer`](https://21st.dev/@kedhareswer/components/halftone-wordmark-footer) (component #37628). The original is React and is a *footer*; this port is plain JS and is the *hero*.

The name is set enormous and rasterized to an offscreen mask. Each grid cell samples that mask and becomes a dot sized by how much of the letter covers it, so the type keeps clean edges at any scale. The pointer pushes dots off their home position on springs and they shift toward the accent color as they travel; clicking sends a shock ring through the word. It sleeps (cancels its rAF loop) once every dot is home, and when scrolled out of view.

### Usage

```html
<section id="hero" class="hwf-root" data-wordmark="TRISH NGUYEN">
  <canvas aria-hidden="true"></canvas>
  <h1 class="hwf-sr">Trish Nguyen</h1>
</section>
```

The canvas is `aria-hidden`; the visually-hidden `<h1>` is the real accessible heading. **Keep it** — it's the page's only `h1`.

### The signature

`.hero-script` is a third layer in the hero: the same name set in **Ballet** (Google Fonts, loaded in the `<head>` with the other families), laid over the dot field and lifted so it crosses the top of the printed caps. It's `aria-hidden` — the `<h1>` already says the name — and `pointer-events: none`, so the dot field still gets every pointer event under it.

The lift is a fraction of the script's own size (`translateY(-0.45em)`), so it scales with the viewport and the overlap holds. Below `720px` the wordmark stacks onto two lines and the block gets much taller, so a media query at that same breakpoint lifts the signature further (`-1.72em`). **Those two numbers are tuned by eye** — change the wordmark's size or `stackBelow` and they need re-checking.

**The two names are the same width.** `WORD_FIT` at the top of `src/main.js` (default `1.02`) is the single knob: it's passed to the dot field as its `fit` option *and* used by `fitSignature()`, which measures the script's natural width and sets `--sig-stretch` to `heroWidth * WORD_FIT / naturalWidth`. The CSS applies that as a `scaleX()` after the centring transform, so the letterforms widen without the centring or the lift moving. At 1440px that's about `1.89` — a deliberately stretched script, not a bigger one.

Lower `WORD_FIT` to pull *both* in off the edges (`0.9` stops the bleed and drops the stretch to ~1.67); the two stay matched either way. `fitSignature()` re-runs on resize and after `document.fonts.ready`, because the script's natural width isn't known until Ballet has actually landed.

It paints in `--color-accent`, so it follows the palette.

```js
import { initHalftoneWordmark } from './halftone-wordmark.js';

const hero = initHalftoneWordmark(document.getElementById('hero'), {
  fontWeight: 900,
  stack: ['trish', 'nguyen'],
});

hero.refresh();  // re-read CSS colors + re-layout (call after a theme change)
hero.destroy();  // drop every listener and observer
```

### Options

| Option | Default | Meaning |
| --- | --- | --- |
| `wordmark` | `data-wordmark` attr | The word to print. |
| `stack` | `[]` | Lines to use *instead* of `wordmark` on narrow screens. |
| `stackBelow` | `720` | Viewport width at or under which `stack` takes over. |
| `fit` | `1.02` | Line width as a multiple of the root's width. Over 1 bleeds off both edges. |
| `lineGap` | `0.10` | Gap between stacked lines, as a multiple of font size. |
| `dotGap` | `6` | Distance between dot centres in CSS px. Smaller = finer, more dots. |
| `radius` | `90` | How far the pointer pushes, in CSS px. |
| `anchor` | `'center'` | `'center'` floats the block; `'bottom'` crops it on the bottom edge. |
| `crop` | `0.2` | `'bottom'` only — how much of the cap height hangs below the edge. |
| `grain` | `0.5` | Print grain over everything, 0–1. |
| `interactive` | `true` | Pointer and click response. |
| `fontWeight` | `800` | Weight of the wordmark. |

Font comes from the `--hwf-display` CSS property on `.hwf-root`. `prefers-reduced-motion` renders a static field with no springs and no ring.

The module also exports its pure math (`hwfHex`, `hwfRadius`, `hwfStep`, `hwfWarmth`, `hwfFitSize`) — unit-testable without a DOM, should you add tests.

### Three deliberate deviations from the upstream component

1. **`anchor: 'center'`.** Upstream pins the word to the bottom edge and crops it, which suits a footer and not a hero. `anchor: 'bottom'` still gives the original behavior.
2. **Line stacking.** "trish nguyen" is 12 characters; width-fitted into a 390px phone it rendered ~38px tall and read as mush. Narrow viewports get two lines at full scale instead. Leading keys off each line's **cap height**, not font size, so the gap stays tight under a line with no ascenders ("nguyen") as well as one with them ("trish").
3. **Palette from CSS, not props.** So the existing theme toggle drives it.

### Hero sizing

The page is **one screen and does not scroll** — `html, body { height: 100%; overflow: hidden }` in `src/style.css`. The hero is `100dvh`, and the nav is `position: fixed`, so the wordmark gets the whole viewport. The sections below the hero are still in the markup; they are simply clipped.

`fitHeroToFirstScreen()` in `src/main.js` still sets the hero's height from its own measured offset (currently `0`, since nothing is in flow above it) and re-runs on `resize` and after `document.fonts.ready`. The CSS `height` on `.hwf-root` is the pre-JS value.

Undoing the scroll lock means: drop the `overflow: hidden` rule, give the nav a scrolled state or put it back in flow, and the hero re-measures itself.

## Where to continue

Roughly in order of payoff:

1. **Fill in the section content**, using `git show theme/flower:PRODUCT.md` as the source. `#about`, `#experience`, `#projects`, and `#skills` are built at full structural fidelity but their bodies are placeholders (`Your bio content goes here...`, `// List of projects goes here...`). `PRODUCT.md` already holds the verified facts — SAS Institute CI360 internship, NCSU Engineering IT, NC State CS — so nothing needs inventing. It also records two hard rules: **no project work has been supplied**, so Projects ships as clearly-marked empty slots rather than invented entries; and the **year ranges in it are stale and need your confirmation** before they go on the page. Note these sections are **currently clipped** by the scroll lock — see Hero sizing — so filling them in means deciding how they get reached.
2. **Add contact details.** There is no email or social link on the page yet. This is *not* an open question — `PRODUCT.md` already specifies a `mailto:` link and lists the email, GitHub, and LinkedIn to use. Copy them from there.
3. **Decide on a footer.** The site currently ends at the Skills section. The halftone component began life as a footer; if you want one back, a second `.hwf-root` with `anchor: 'bottom'` would do it — but running the same effect twice on one page may be one time too many.
4. **Merge `theme/dots` to `main`.** Nothing deploys until you do — the workflow only fires on `main`. Worth settling which theme branch wins first.
5. **Possible cleanup:** both `@tailwindcss/vite` (in `vite.config.js`) and `@tailwindcss/postcss` (in `postcss.config.js`) are configured. Only one is needed; the build currently works, but dropping `postcss.config.js` would remove the ambiguity.
6. **Reconcile `.impeccable/surfaces/index-html.md`.** That design contract describes a halftoned-bloom direction (Bodoni Moda display type, a four-ink print palette) that was never built on this branch. The shipped hero shares its halftone idea but none of its typography or color. The bloom photograph it calls for *does* exist — untracked at `design-references/bloom.jpg`, and committed at `public/bloom.jpg` on `theme/flower` — so the direction is revivable, not lost. Either pursue it deliberately or retire the document; a dated status note at the top of that file flags the divergence meanwhile.

## Not present

No tests, no linter, no CSS-in-JS. CI only builds and deploys.
