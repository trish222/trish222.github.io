# Working on this portfolio

Read [docs/architecture.md](docs/architecture.md) first; it is the authoritative experience and architecture specification. README lists commands. CLAUDE.md and Copilot instructions point here rather than carrying competing rules.

- Preserve the seated desk opening, inverted parallax, limited head turns, monitor entry, functional HTML desktop, lamp toggle, and seated screen exit. This phase does not authorize a visual redesign.
- Use vanilla ES modules and Three.js. Keep cohesive procedural models intact. Keep model dimensions with their model and application logic in `src/desktop`.
- Preserve the calibrated camera spline, screen-plane coordinates, homography, tone mapping, and frozen shadow map. Geometry or lighting changes need rendered comparison.
- `src/scene.js` owns experience transitions. Navigation owns controls/return tweens; the rig owns camera paths; snapshots own asynchronous rasterization. Do not duplicate state between them.
- Framing uses `<=760px`; fullscreen desktop uses the shared `<=760px` or short/coarse query. The matching CSS query must stay identical to `src/config/experience.js`.
- One press has one action. New 3D targets go through the existing nearest-hit picker.
- Review current imports, package scripts, tests, documentation, and CI before deleting. Keep generated output outside `src` and `public`. Use `scripts/review` for reusable tools, `tests` for checks, and ignored output directories for captures.
- Preserve asset licenses. Reference photos are local mood-board material, not production assets. Do not introduce Microsoft artwork or bundled Microsoft fonts.
- Run `npm run build`, `npm run check:build`, `npm run check:source`, and relevant browser tests after structural changes. Do not claim visual/performance improvements without comparison evidence.
- Preserve a Git checkpoint before broad cleanup. Use reviewable commits. Do not push or deploy unless asked.

Detailed model docs retain calibration context; `docs/history` is historical and does not override the specification. `.impeccable` contains only local tool configuration/cache and is not design authority.
