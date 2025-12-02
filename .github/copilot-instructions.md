# Copilot / AI agent instructions — trish222.github.io

This file gives actionable, project-specific guidance so an AI coding agent can be immediately productive.

Project overview (big picture)
- A very small Vite-based static site. Entry point is the root `index.html` (Vite serves this directly).
- Source code lives in `src/` (ESM modules). CSS uses Tailwind via PostCSS and is imported from `src/style.css`.
- Static assets can live in `public/` and are served as-is by Vite.

Key files to inspect
- `package.json` — dev scripts: `npm run dev` (vite), `npm run build`, `npm run preview`.
- `index.html` — actual HTML entry; Tailwind classes are used directly in markup.
- `src/main.js` — imports `style.css` (current JS is minimal). Good place to wire new components.
- `src/counter.js` — small example component: `export function setupCounter(element) { ... }` — pattern for DOM-based modules.
- `tailwind.config.js` & `postcss.config.js` — PostCSS + Tailwind setup. `content` is `./index.html` and `./src/**/*.{js,ts}` so keep class usage in those files.

Build & dev workflows (concrete)
- Start dev server: `npm run dev` (Vite default port; open browser and use devtools). Modify files under `src/` or `index.html` to see HMR.
- Create production build: `npm run build` then `npm run preview` to serve the built site locally.
- When adding new Tailwind classes, ensure they appear in files matched by `tailwind.config.js` content paths; otherwise classes may be purged in the build.

Project conventions & patterns (specific)
- Use ESM imports/exports (package.json has `type: "module"`). Keep modules in `src/` as `.js`.
- Components are simple functions that accept DOM elements (see `src/counter.js`). Follow this pattern for small interactive widgets.
- CSS is managed via `src/style.css` and Tailwind. Do not add global CSS files outside `src/` unless placed in `public/` for static assets.
- No test framework or CI is present in the repo — avoid adding assumptions about tests unless you add config files.

Integration points & dependencies
- Dev tooling: Vite (v5) — fast dev server and build. Treat `index.html` as the HTML entry (not `src/index.html`).
- Tailwind CSS (v4) + PostCSS + Autoprefixer — configured in `postcss.config.js` and `tailwind.config.js`.
- Static assets: `public/` is for files that should bypass Vite processing.

Examples to copy/paste
- Wire `counter.js` into `src/main.js` (example):
```js
import './style.css'
import { setupCounter } from './counter.js'
const el = document.querySelector('#counter')
if (el) setupCounter(el)
```

Troubleshooting & debugging notes
- If Tailwind classes disappear in production, confirm the class strings exist literally in files matched by `tailwind.config.js` `content` globs (avoid constructing class names dynamically).
- For runtime problems, use browser devtools and the Vite console (the project uses no server-side code).

When editing this repo
- Keep changes minimal and backwards compatible: this is a static site. Prefer small, isolated changes (add a new module in `src/`, update `index.html`, and test with `npm run dev`).
- If adding dependencies, add them to `devDependencies` unless they are required at runtime in the browser (then add to `dependencies`) and update `package.json` accordingly.

Missing or not present (so don't assume)
- There are no automated tests, linters, or CI configs. There is no README — add documentation if you introduce new workflows.

If you need clarification
- Ask which browser/Node version to target and whether to add tests or CI. Point to a specific file you want to change and I will edit it.

-- end
