// The tube's shape and raster, shared by the shader (src/scene/crtMaterial.js) and the live DOM
// (src/style.css, `--crt-clip`), so the hand-over at arrival has nothing to give away.
export const CRT = {
  edge: 16,        // superellipse exponent of the rounded picture outline
  soft: 0.025,     // the picture fades into the tube glass over this much of the half-width
  scanPx: 3,       // scanline pitch in the desktop box's own pixels
  scanDark: 0.14,
  vignette: 0.38,
  tint: [1, 0.93, 0.84], // warm phosphor white, scaled in by LOOK.crtTint
};

// |x|^n + |y|^n <= 1 over the box, as a percentage polygon: crisp, hit-testable, Safari-safe.
export function crtClipPath(steps = 72) {
  const point = (i) => {
    const t = (i / steps) * Math.PI * 2;
    const c = Math.cos(t), s = Math.sin(t);
    const x = Math.sign(c) * Math.abs(c) ** (2 / CRT.edge), y = Math.sign(s) * Math.abs(s) ** (2 / CRT.edge);
    return `${(50 + x * 50).toFixed(2)}% ${(50 + y * 50).toFixed(2)}%`;
  };
  return `polygon(${Array.from({ length: steps }, (_, i) => point(i)).join(',')})`;
}
