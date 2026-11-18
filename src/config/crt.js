// The tube's shape and raster, shared by the shader (src/scene/crtMaterial.js) and the live DOM
// (src/style.css, `--crt-clip`), so the hand-over at arrival has nothing to give away.
export const CRT = {
  edge: 16,        // superellipse exponent of the rounded picture outline
  soft: 0.025,     // the picture fades into the tube glass over this much of the half-width
  scanPx: 3,       // scanline pitch in the desktop box's own pixels
  scanDark: 0.14,
  vignette: 0.38,
  tint: [1, 0.93, 0.84], // warm phosphor white, scaled in by LOOK.crtTint
  bulge: 0.065,    // screen_glass's centre sag over the half-height (LOOK.crtBarrel when it was shaped)
};

// The glare on the convex glass, grey on black, `width` px wide at the box's aspect. screen_glass
// bulges as sag * (1 - u^2)(1 - v^2), so seen straight on it reflects along twice its slope: a soft
// spot from up-left plus a streak across it, both bent by the dome. Shared by the WebGL glass
// (emissive map) and the live DOM's .crt-glare, so the hand-over keeps the same reflection.
export function crtGlare(aspect, width = 256) {
  const height = Math.round(width / aspect);
  const canvas = Object.assign(document.createElement('canvas'), { width, height });
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = (x + 0.5) / width * 2 - 1, v = 1 - (y + 0.5) / height * 2;
      const rx = 4 * CRT.bulge * u * (1 - v * v) / aspect, ry = 4 * CRT.bulge * v * (1 - u * u);
      const spot = 0.35 * Math.exp(-((rx + 0.09) ** 2 + (ry - 0.13) ** 2) / 0.006);
      const streak = 0.14 * Math.exp(-((0.8 * ry - 0.6 * rx - 0.09) ** 2) / 0.0006);
      image.data.set([...Array(3).fill(255 * Math.min(spot + streak, 1)), 255], (y * width + x) * 4);
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

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
