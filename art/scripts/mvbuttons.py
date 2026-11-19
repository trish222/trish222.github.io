"""Real chin buttons for mvbuild: the MasterView's three round buttons and its larger power button as raised,
bevelled cylinders in shallow round recesses, and its LED as a domed lens. The download only has them in its
textures (a domed normal map, AO rings, the LED dot): paint_out lifts those out around each icon, which stays on
the new button's top, and add cuts the recesses into the chin and builds the buttons in them.
Run through exec.
"""
import math

import bmesh
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform, delaunay_2d_cdt, intersect_point_line

# Where the download has them (x, z on its chin), the radius built, the LED glow, and what paint_out lifts:
# an ellipse (rx, rz) around the painted button and its AO, keeping the icon within `keep`.
SPOTS = [(-0.0665, 0.966, 0.0052, 0, (0.0075, 0.0068), 0.0032),
         (-0.0388, 0.966, 0.0052, 0, (0.0075, 0.0068), 0.0032),
         (-0.0106, 0.966, 0.0052, 0, (0.0075, 0.0068), 0.0032),
         (0.039, 0.966, 0.0068, 0, (0.0125, 0.0078), 0.0035),    # power: an oval in the download, round here
         (0.0166, 0.966, 0.0016, 1.6, (0.0032, 0.0032), 0)]     # LED
GROOVE, DEPTH, PROUD, BEVEL = 0.0009, 0.0012, 0.0011, 0.0006  # gap to the recess wall, its depth, the top above the chin
LED_GROOVE, LED_DEPTH, LED_DOME = 0.0005, 0.0005, 0.0009
SEG = 32
GRID = 0.0025  # chin re-triangulation spacing: long fan triangles shade as facets


def sampler(bm):
    """(x, z) -> (y, face index, {uv layer: uv}) on the chin as it is now (a snapshot: the faces get replaced)."""
    bm.verts.index_update(); bm.faces.index_update()
    tris = bm.calc_loop_triangles()
    tree = BVHTree.FromPolygons([v.co.copy() for v in bm.verts], [[l.vert.index for l in t] for t in tris])
    layers = list(bm.loops.layers.uv.values())
    snap = [([l.vert.co.copy() for l in t], t[0].face.index, {lay: [l[lay].uv.to_3d() for l in t] for lay in layers})
            for t in tris]

    def at(x, z):
        loc, _, i, _ = tree.ray_cast(Vector((x, -0.4, z)), Vector((0, 1, 0)))
        co, f, uvs = snap[i]
        return loc.y, f, {lay: barycentric_transform(loc, *co, *uv).to_2d() for lay, uv in uvs.items()}
    return at


def ring(cx, cz, r):
    return [(cx + r * math.cos(2 * math.pi * k / SEG), cz + r * math.sin(2 * math.pi * k / SEG)) for k in range(SEG)]


def cut_chin(bm, at, holes):
    """Re-triangulates the flat chin faces under the holes around the hole outlines, which it returns."""
    near = lambda f: any(abs(v.co.x - cx) < R + 0.012 and abs(v.co.z - cz) < R + 0.012 for cx, cz, R in holes for v in f.verts)
    faces = [f for f in bm.faces if f.normal.y < -0.97 and f.calc_center_median().y < -0.17 and near(f)]
    region = {f.index for f in faces}
    verts = list({v for f in faces for v in f.verts})
    circles = [ring(cx, cz, R) for cx, cz, R in holes]
    assert all(at(x, z)[1] in region for c in circles for x, z in c), 'a hole reaches past the flat chin'
    lo, hi = np.array([(v.co.x, v.co.z) for v in verts]).min(0), np.array([(v.co.x, v.co.z) for v in verts]).max(0)
    rim = [(e.verts[0].co.xz, e.verts[1].co.xz) for f in faces for e in f.edges if sum(g.index in region for g in e.link_faces) == 1]
    # a grid point on (or within float noise of) the region's edge splits it on one side only: a T-junction the site shows as a crack
    off_rim = lambda p: all((intersect_point_line(p, a, b)[0] - p).length > GRID / 2 or not 0 <= intersect_point_line(p, a, b)[1] <= 1
                            for a, b in rim)
    clear = lambda x, z: (at(x, z)[1] in region and all(math.hypot(x - cx, z - cz) > R + GRID / 2 for cx, cz, R in holes)
                          and all(math.hypot(x - v.co.x, z - v.co.z) > GRID / 2 for v in verts) and off_rim(Vector((x, z))))
    grid = [(x, z) for x in np.arange(lo[0], hi[0], GRID) for z in np.arange(lo[1], hi[1], GRID) if clear(x, z)]
    pts = [(v.co.x, v.co.z) for v in verts] + [p for c in circles for p in c] + grid
    index = {v: i for i, v in enumerate(verts)}
    edges = [(index[e.verts[0]], index[e.verts[1]]) for f in faces for e in f.edges
             if sum(g.index in region for g in e.link_faces) == 1]
    edges += [(len(verts) + k * SEG + j, len(verts) + k * SEG + (j + 1) % SEG) for k in range(len(holes)) for j in range(SEG)]
    out, _, tris, orig, *_ = delaunay_2d_cdt([Vector(p) for p in pts], edges, [], 0, 1e-7)
    assert len(out) == len(pts) and all(len(o) == 1 for o in orig), 'the hole outlines cross the chin edges'
    keep = []
    for t in tris:
        c = sum((out[i] for i in t), Vector((0, 0))) / 3
        if at(c.x, c.y)[1] in region and all(math.hypot(c.x - cx, c.y - cz) > R for cx, cz, R in holes):
            keep.append([orig[i][0] for i in t])
    inner = list({e for f in faces for e in f.edges})
    smooth = faces[0].smooth
    bmesh.ops.delete(bm, geom=faces, context='FACES_ONLY')
    new = verts + [new_vert(bm, at, x, z) for x, z in pts[len(verts):]]
    uv = lambda x, z: at(x, z)[2]
    chin = [face(bm, uv, [new[i] for i in t], smooth) for t in keep]
    if chin[0].normal.y > 0:
        bmesh.ops.reverse_faces(bm, faces=chin)
    bmesh.ops.delete(bm, geom=[e for e in inner if e.is_valid and not e.link_faces], context='EDGES')
    bmesh.ops.delete(bm, geom=[v for v in verts if v.is_valid and not v.link_faces], context='VERTS')
    return [new[len(verts) + k * SEG:len(verts) + (k + 1) * SEG] for k in range(len(holes))]


def new_vert(bm, at, x, z, y=None):
    return bm.verts.new((x, at(x, z)[0] if y is None else y, z))


def face(bm, uv, vs, smooth=False):
    f = bm.faces.new(vs)
    f.smooth = smooth
    for l in f.loops:
        for lay, value in uv(l.vert.co.x, l.vert.co.z).items():
            l[lay].uv = value
    return f


def button(bm, at, uv, outline, cx, cz, r, led):
    """Recess wall and floor down from the hole outline, then the button (or lens) up out of the floor."""
    y = at(cx, cz)[0]
    groove, depth = (LED_GROOVE, LED_DEPTH) if led else (GROOVE, DEPTH)
    if led:  # spherical cap over the lens radius
        profile = [(r * math.sin(a), y + depth - (depth + LED_DOME) * math.cos(a) ** 0.5) for a in np.linspace(math.pi / 2, 0.25, 5)[1:]]
    else:
        top = y - PROUD
        profile = [(r, top + BEVEL)] + [(r - BEVEL + BEVEL * math.cos(a), top + BEVEL - BEVEL * math.sin(a))
                                        for a in np.linspace(0, math.pi / 2, 4)[1:]] + [(r * 0.55, top - 0.00008)]
    rings = [outline] + [[new_vert(bm, at, x, z, py) for x, z in ring(cx, cz, pr)]
                         for pr, py in [(r + groove - 0.0002, y + depth), (r, y + depth)] + profile]
    faces = []
    for k, (a, b) in enumerate(zip(rings, rings[1:])):
        smooth = k >= 2 if led else 2 <= k < 6  # side and bevel smooth, the top flat
        faces += [face(bm, uv, [a[j], a[(j + 1) % SEG], b[(j + 1) % SEG], b[j]], smooth) for j in range(SEG)]
    tip = new_vert(bm, at, cx, cz, rings[-1][0].co.y - (0.00015 if led else 0.00003))
    faces += [face(bm, uv, [rings[-1][j], rings[-1][(j + 1) % SEG], tip], bool(led)) for j in range(SEG)]
    return faces, faces[2 * SEG:] if led else []


def add(bm, wx, wz):
    """Recesses and buttons on the chin after mvbuild's opening warp (wx, wz), which squeezed the chin's texture:
    each button reads it unsqueezed around its download position, so its icon keeps its shape."""
    at = sampler(bm)
    spots = [(wx(x), wz(z), r, led, x, z) for x, z, r, led, *_ in SPOTS]
    outlines = cut_chin(bm, at, [(x, z, r + (LED_GROOVE if led else GROOVE)) for x, z, r, led, *_ in spots])
    glow = bm.faces.layers.float['led']
    for outline, (x, z, r, led, x0, z0) in zip(outlines, spots):
        uv = lambda px, pz: at(wx(x0 + px - x), wz(z0 + pz - z))[2]
        faces, lens = button(bm, at, uv, outline, x, z, r, led)
        if faces[-1].normal.y > 0:
            bmesh.ops.reverse_faces(bm, faces=faces)
        for f in lens:
            f[glow] = led
    print(f'  chin buttons: {len(SPOTS) - 1} buttons and the LED in recesses')


def paint_out(maps, uv_at):
    """Lifts the download's buttons out of each texture in maps ((rows, cols, rgba), edited in place) around their
    icons: texels in the ring take random texels from the plastic just around it. uv_at reads the download's chin."""
    rng = np.random.default_rng(5)
    h, w = maps[0].shape[:2]
    for x, z, _, _, (rx, rz), keep in SPOTS:
        inside, around = set(), set()
        for gx in np.arange(x - rx - 0.003, x + rx + 0.003, 0.0002):
            for gz in np.arange(z - rz - 0.003, z + rz + 0.003, 0.0002):
                uv = uv_at(gx, gz)[0]
                if uv is None or math.hypot(gx - x, gz - z) < keep: continue
                t = (int(uv[1] % 1 * h), int(uv[0] % 1 * w))
                (inside if math.hypot((gx - x) / rx, (gz - z) / rz) < 1 else around).add(t)
        around -= inside
        src = np.array(sorted(around))[rng.integers(0, len(around), len(inside))]
        dst = np.array(sorted(inside))
        for A in maps:
            A[dst[:, 0], dst[:, 1]] = A[src[:, 0], src[:, 1]]
