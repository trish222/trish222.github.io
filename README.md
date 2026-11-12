# Trish Nguyen — interactive portfolio

A vanilla JavaScript / Three.js desk scene with a functional Windows 98 desktop projected onto a CRT monitor. Vite builds the static site for GitHub Pages.

```sh
npm ci
npm run dev
npm run build
npm run check:build
npm run preview   # http://127.0.0.1:4320
```

With the production preview running, `npm test` checks screen registration, camera/parallax, monitor entry and seated exit, login, desktop windows, lamp controls, responsive handover, and the no-WebGL fallback. Chromium must be installed for Playwright. `npm run test:lifecycle` uses the development server at port 4321 to check disposal/reinitialization and alternate models. `npm run check:source` checks local imports and cycles.

```text
src/main.js                application entry and desktop bootstrap
src/scene.js               experience state, transitions, and subsystem coordination
src/scene/                 camera rig, navigation, rendering, animation, lighting, assembly
src/overlay/               projection and DOM snapshots for the monitor
src/desktop/               session/login/apps, window manager, resizing, event lifecycle
src/config/experience.js   shared responsive handover rule
src/environment/presets.js window scenery selection
src/debug/                 optional geometry and experience diagnostics
src/computer.js            CRT, keyboard, mouse, screen surface contract
src/room.js                room shell and window placement
src/nightwindow.js         window joinery, rain, and built-in night scenery
src/desks/, src/lamps/     cohesive procedural model variants
src/treehouse.js           treehouse and spare bricks
src/nameplate.js           nameplate and lettering
src/tonemap.js             calibrated tone mapping mathematics
src/style.css, src/vendor/ desktop styling and generated scoped 98.css
src/utils/                 listener/timer lifecycle helper
public/                    shipped fonts, generated icons, licensed textures/environment
scripts/                   build checks, asset generation, profiling, review capture
tests/                    automated Node and Playwright checks
docs/                     architecture, calibration notes, deployment, refactor record
references/               retained monitor review images, never shipped
design-references/        ignored local mood board; never shipped
```

[Architecture and experience specification](docs/architecture.md) is authoritative. [Agent guidance](AGENTS.md) summarizes working rules. See [development tools](docs/scripts.md), [deployment](docs/deployment.md), and [refactor results](docs/refactor.md).

`npm run icons` regenerates original pixel icons; `npm run vendor:98` regenerates scoped 98.css. Vendored fonts and their licenses live in `public/fonts`; font packages are not needed to build them. `npm run review -- URL OUTPUT` captures desktop, phone, and intermediate-width home/monitor screenshots outside application sources. Profilers write to ignored output directories. Add `?diagnostics=1` to a production review URL to load debug handles; normal production visits do not load those chunks.

Development variants remain available with `?desk=classic` and `?lamp=lamp`. `lamp-lab.html` is a development harness, not a production build entry. No framework or general-purpose scene engine is used. Do not push or publish without an explicit request.
