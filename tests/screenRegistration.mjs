// Compares the #screen overlay's four transformed corners with screen_plane's
// projected vertices, in CSS pixels. Runs in the page.
export function registration(page) {
  return page.evaluate(() => {
    const plane = window.__scene.getObjectByName('screen_plane');
    const pos = plane.geometry.attributes.position;
    const verts = Array.from({ length: pos.count }, (_, i) => plane.localToWorld(plane.position.clone().fromBufferAttribute(pos, i)));
    const [a, b, c] = verts;
    const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    const flat = verts.every(v => Math.abs(v.clone().sub(a).dot(normal)) < 1e-6);
    const canvas = document.querySelector('#scene').getBoundingClientRect();
    const projected = verts.map(v => {
      const p = v.clone().project(window.__camera);
      return [(p.x + 1) * canvas.width / 2 + canvas.left, (1 - p.y) * canvas.height / 2 + canvas.top];
    });
    const el = document.querySelector('#screen');
    const m = new DOMMatrix(getComputedStyle(el).transform);
    const { offsetWidth: w, offsetHeight: h, offsetLeft: x0, offsetTop: y0 } = el;
    const corners = [[0, 0], [w, 0], [w, h], [0, h]].map(([x, y]) => {
      const p = m.transformPoint(new DOMPoint(x, y, 0, 1));
      return [x0 + p.x / p.w, y0 + p.y / p.w];
    });
    const error = Math.max(...corners.map(([x, y]) => Math.min(...projected.map(([px, py]) => Math.hypot(x - px, y - py)))));
    // Straight-on framing keeps the top and left edges axis-aligned.
    const skew = Math.max(Math.abs(corners[0][1] - corners[1][1]), Math.abs(corners[0][0] - corners[3][0]));
    return { flat, error, skew };
  });
}
