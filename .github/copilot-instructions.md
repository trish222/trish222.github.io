# Copilot / AI agent instructions — trish222.github.io

Project-specific guidance so an AI coding agent can be immediately productive. See `README.md` for the fuller tour, including the hero component's options and the current backlog.

## Project overview

- A small Vite-based static site: the personal portfolio of Trish Nguyen.
- Entry point is the root `index.html` — Vite serves it directly. **All markup lives in that one file**; there is no templating or component framework.
- Source lives in `src/` as plain ES modules. No React, no JSX, no bundled UI library.
- Static assets go in `public/` and are served as-is.

## Branches are parallel designs, not a linear history

The repo holds one visual direction per branch (`theme/dots`, `theme/cyberpunk`, `theme/flower`, `theme/dither`, `theme/editorial`, `theme/frutiger`, `theme/windows95`, `theme/y2k`). They differ structurally, not just in color — don't assume a file you remember exists on the current branch, and don't cherry-pick across them casually.

**`PRODUCT.md` and `DESIGN.md` live only on `theme/flower`**, but `PRODUCT.md` is the product truth for all of them:

```bash
git show theme/flower:PRODUCT.md
```

Read it before writing any user-facing copy. It fixes the audiences, the voice, the verified biographical facts, and the contact details — and it records what must **not** be fabricated (no project work has been supplied; the year ranges in it are stale and need the user's confirmation). The Frutiger Aero / glass-bubble direction is explicitly retired there; do not reintroduce it.

## Key files

- `package.json` — scripts: `npm run dev`, `npm run build`, `npm run preview`.
- `index.html` — the whole page. Tailwind utility classes are used directly in markup.
- `src/main.js` — the entry module. Imports `style.css`, then wires up the theme toggle, mobile menu, scroll observers, and the hero. New interactive pieces get wired here.
- `src/style.css` — Tailwind import, `@theme` design tokens, and every component/utility rule.
- `src/halftone-wordmark.js` — the hero dot field; exports `initHalftoneWordmark(root, options)` plus pure helpers.
- `vite.config.js` — Vite + the `@tailwindcss/vite` plugin, `base: '/'`.
- `.github/workflows/deploy.yml` — builds and deploys to GitHub Pages on push to `main`.

## Things that are NOT in this repo (don't assume them)

- **No `tailwind.config.js`.** Tailwind 4 is configured via the `@tailwindcss/vite` plugin and the `@theme { ... }` block at the top of `src/style.css`. Add tokens there. There is no `content` glob to maintain and no purge-safelist concern of the old kind.
- **No `src/counter.js`** or any Vite starter scaffolding.
- **No tests, linter, or formatter.** Don't invoke or assume them.
- **No React.** A past change deliberately ported a React component to vanilla JS rather than introduce a framework — match that choice.

## Build & dev workflow

- `npm run dev` starts Vite with HMR. Prior sessions have used `npm run dev -- --port 4317` together with the Playwright helper scripts (`_shot.mjs`, `_one.mjs`, `_review.mjs`) at the repo root to screenshot the result; `playwright` is already in `node_modules`. Note that `_shot.mjs` references an element id that no longer exists, so adapt it rather than running it blind.
- `npm run build` then `npm run preview` to check the production output.
- Deploys happen only from `main`.

## Conventions & patterns

- ESM throughout (`"type": "module"`). Keep modules in `src/` as `.js`.
- **Modules are functions that take a DOM element**, e.g. `initHalftoneWordmark(root, options)`. They return a small handle (`{ refresh, destroy }`) when they own listeners or observers. Follow this shape for new widgets.
- `src/main.js` has a fixed shape — `IMPORTS`, `CONSTANTS`, `FUNCTIONS`, `INITIALIZATION`, `EVENT LISTENERS` banner comments. Put new code in the matching section rather than appending to the bottom.
- Element lookups are hoisted to the `CONSTANTS` block and every consumer null-guards (`if (!el) return;`).
- CSS is light-first with `.dark` overrides, and the custom variant `@variant dark (&:where(.dark, .dark *))` makes Tailwind `dark:` utilities follow the `<html class="dark">` toggle.
- Prefer CSS custom properties over hardcoded colors so the theme toggle reaches everything.
- Respect `prefers-reduced-motion` — the existing scroll glow and the hero both do.

## Canvas work specifically

The hero paints to a `<canvas>`, which means CSS cannot restyle it. Two consequences:

1. It reads its palette from CSS custom properties (`--hwf-bg`, `--hwf-ink`, `--hwf-warm`) at init, and must be told to re-read them on a theme change — `toggleTheme()` calls `halftoneHero.refresh()`. Anything new that paints to a canvas needs the same wiring.
2. Measure the backing store, not the page, when probing pixels — the canvas is sized to its own element and scaled by `devicePixelRatio`, so page coordinates will not line up.

## Troubleshooting

- Runtime problems: browser devtools and the Vite console. There is no server-side code.
- If the hero wordmark is the wrong size or in the wrong face, the cause is almost always font timing — the layout re-runs on `document.fonts.ready` for exactly that reason.

## When editing this repo

- Keep changes small and isolated: add a module in `src/`, update `index.html`, verify with `npm run dev`.
- New dependencies go in `devDependencies` unless they ship to the browser at runtime.
- Update `README.md` when you change a workflow or a component's options.
