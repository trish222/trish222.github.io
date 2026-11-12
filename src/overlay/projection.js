/* Map a rectangular DOM surface onto TL/TR/BR/BL CSS-pixel corners. */
export function quadTransform(quad, boxW, boxH) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = quad;
  /* How far the quad is from being a parallelogram, in pixels. */
  const sx = x0 - x1 + x2 - x3;
  const sy = y0 - y1 + y2 - y3;
  const span = Math.abs(x1 - x0) + Math.abs(y3 - y0) + 1;

  /* Affine while the keystone is under a hundredth of a pixel across
     the whole box — the head-on framings, the arrival among them. Not
     an optimisation: it is what keeps those writing the exact 2D
     `matrix()` they wrote before the camera changed, rather than one
     with a w row of rounding noise. */
  if (Math.abs(sx) + Math.abs(sy) < span * 1e-5) {
    const a = (x1 - x0) / boxW;
    const c = (y1 - y0) / boxW;
    const b = (x3 - x0) / boxH;
    const d = (y3 - y0) / boxH;
    return `matrix(${a},${c},${b},${d},${x0},${y0})`;
  }

  const dx1 = x1 - x2;
  const dy1 = y1 - y2;
  const dx2 = x3 - x2;
  const dy2 = y3 - y2;
  const den = dx1 * dy2 - dy1 * dx2;
  if (!den) return null;
  const g = (sx * dy2 - dx2 * sy) / den;
  const h = (dx1 * sy - sx * dy1) / den;
  const a = (x1 - x0 + g * x1) / boxW;
  const c = (y1 - y0 + g * y1) / boxW;
  const b = (x3 - x0 + h * x3) / boxH;
  const d = (y3 - y0 + h * y3) / boxH;
  return (
    `matrix3d(${a},${c},0,${g / boxW},` +
    `${b},${d},0,${h / boxH},` +
    `0,0,1,0,` +
    `${x0},${y0},0,1)`
  );
}

