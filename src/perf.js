import Stats from "stats.js";

/* ==========================================
   FRAME-RATE METER — DEV ONLY

   stats.js (MIT) panel pinned top-left, plus a rolling log of frame
   deltas tagged with the fly parameter so a Playwright probe can report
   what the rate does *during* the animation rather than relying on
   reading the panel by eye.

   scene.js only ever reaches this module through a dynamic import
   guarded by `import.meta.env.DEV`. Vite replaces that with the literal
   `false` in a production build, so rollup drops the branch, this
   module and stats.js along with it — nothing here ships. Verify with
   `npm run build` and grep the output for "stats".
   ========================================== */

/* Enough to cover a couple of seconds at 120fps. */
const LOG_CAP = 600;

export function createPerfMeter() {
  const stats = new Stats();
  stats.showPanel(0); // fps
  /* pointer-events:none so the panel never swallows a click meant for
     the desktop chrome or the back button underneath it — stats.js's own
     click-to-cycle is exposed as __perf.panel() instead. */
  stats.dom.style.cssText +=
    ";position:fixed;top:8px;left:8px;z-index:99999;opacity:0.92;pointer-events:none";
  document.body.appendChild(stats.dom);

  /* [timestamp, fly.value] per frame. */
  const log = [];

  const begin = () => stats.begin();

  const end = (flyValue) => {
    stats.end();
    if (log.length >= LOG_CAP) log.shift();
    log.push([performance.now(), flyValue]);
  };

  /* Frames whose fly value is strictly between the endpoints are the
     ones the animation paid for; the rest are the idle scene. */
  const report = () => {
    const rate = (frames) => {
      if (frames.length < 2) return null;
      const deltas = [];
      for (let i = 1; i < frames.length; i++) {
        deltas.push(frames[i][0] - frames[i - 1][0]);
      }
      deltas.sort((a, b) => a - b);
      const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
      const at = (q) => deltas[Math.min(deltas.length - 1, Math.round(q * (deltas.length - 1)))];
      return {
        frames: frames.length,
        fps: +(1000 / mean).toFixed(1),
        meanMs: +mean.toFixed(2),
        medianMs: +at(0.5).toFixed(2),
        p95Ms: +at(0.95).toFixed(2),
        worstMs: +deltas[deltas.length - 1].toFixed(2),
        /* Anything past 2 frames at 60Hz is a visible hitch. */
        janky: deltas.filter((d) => d > 33.4).length,
      };
    };
    return {
      all: rate(log),
      idle: rate(log.filter(([, v]) => v === 0 || v === 1)),
      animating: rate(log.filter(([, v]) => v > 0 && v < 1)),
    };
  };

  const reset = () => {
    log.length = 0;
  };

  window.__perf = { log, report, reset, panel: (i) => stats.showPanel(i) };

  return {
    begin,
    end,
    dispose() {
      stats.dom.remove();
      delete window.__perf;
    },
  };
}
