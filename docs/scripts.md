# Development and verification tools

Use production preview on port 4320 for browser checks. Run `npm run build` first. Development lifecycle/variant checks use `npm run dev -- --port 4321`.

| Command | Purpose |
| --- | --- |
| `npm test` | Projection math, interaction matrix, lamp/fallback startup, responsive boundary checks |
| `npm run test:interaction` | Drag limits, parallax, stable drawing buffers/GPU reuse, screen projection, session/windows, seated return |
| `npm run test:startup` | First frame, lamp keyboard toggle, monitor click, Escape, no-WebGL login |
| `npm run test:responsive` | 560/561/650/760/761px widths and short touch landscape; window resizing |
| `npm run test:lifecycle` | Dispose/reinitialize, canceled snapshot work, development model variants |
| `npm run check:source -- --graph` | Local import validation, cycles, entry graph |
| `npm run check:build` | Compiled entry, shipped assets and provenance hashes |
| `npm run check:deployment` | Read-only local/live asset/provenance comparison; does not deploy |
| `npm run review -- URL OUTPUT` | Home/monitor screenshots at 1440, 390 and 650px |
| `node scripts/review/nameplate.mjs OUTPUT URL` | Focused nameplate visual/geometry inspection |
| `node scripts/review/render-quality.mjs URL OUTPUT` | Fixed-camera DPR/AO/MSAA comparisons, renderer inventory, screenshots and frame cadence; run separately from other browser work |
| `npm run profile:startup` | Browser startup timings and CPU profiles |
| `npm run profile:interaction -- URL --trials=3` | Matched interaction measurements; explicit URLs should include `?diagnostics=1` |
| `npm run icons`, `npm run vendor:98` | Regenerate original icons and scoped vendor CSS |

Diagnostics load automatically in development; production review URLs need `?diagnostics=1`. Common handles: `__scene`, `__camera`, `__orbit`, `__enter`, `__flyTo`, `__stillReady`, `__fit`, `__pick`, `__lamp`, `__lights`, `__shadowfit`, `__probes`, `__pixel`, `__histogram`. Tests and profilers deliberately opt in. They are removed on disposal.

Root `_*.mjs` calibration sweeps and generated comparison PNGs were retired after verifying recovery copies. `refactor-artifacts.json` lists every path and hash. Historical script notes are in `history/review-scripts-before-refactor.md`; they do not describe supported commands. Keep new reusable scripts here and generated results in ignored output directories.
