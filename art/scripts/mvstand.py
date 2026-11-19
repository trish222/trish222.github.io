"""Tilt-swivel stand for mvbuild, like crt-convex-side-ref.png: the download's base is a flat plate almost as wide as
the case, with only a dark recess under the chin. replace() drops it and builds a rounded-rect foot with a softly
domed top and a solid neck up into the monitor's bottom plate, all on the case top. Run through exec.
"""
import math

import bmesh

CX, YC = -0.01, -0.025         # stand centre (x, y): on the case top (y -0.154..0.228)
Z0, TOP = 0.8757, 0.9348       # foot bottom on the case top (before mvbuild's 0.6 mm lift); neck top inside the bottom plate
FOOT = (0.118, 0.100, 0.034)   # half width (63% of the 376 mm monitor), half depth, corner radius
# foot profile, outside in: (inset from the foot outline, height above Z0); rounded shoulder, then a low dome
FOOT_PROFILE = [(0, 0), (0, 0.0055), (0.0012, 0.0082), (0.0035, 0.0096), (0.012, 0.0112), (0.024, 0.0128), (0.036, 0.0140)]
NECK = [((0.078, 0.064, 0.024), 0.0140), ((0.072, 0.058, 0.022), 0.0185),  # small flare where it meets the foot
        ((0.068, 0.054, 0.020), 0.0240), ((0.062, 0.050, 0.018), TOP - Z0)]
CORNER_SEG, SIDE_SEG = 8, 10


def rrect(hx, hy, r, z):
    """Rounded rectangle around (CX, YC) at height z, always the same vertex count, counter-clockwise from +x."""
    pts = []
    for i, (sx, sy) in enumerate(((1, 1), (-1, 1), (-1, -1), (1, -1))):
        ox, oy, a0 = sx * (hx - r), sy * (hy - r), 90 * i
        for k in range(CORNER_SEG + 1):
            a = math.radians(a0 + 90 * k / CORNER_SEG); pts.append((CX + ox + r * math.cos(a), YC + oy + r * math.sin(a), z))
        nx, ny = ((-1, 1), (-1, -1), (1, -1), (1, 1))[i]
        tx, ty = nx * (hx - r) + r * math.cos(math.radians(a0 + 90)), ny * (hy - r) + r * math.sin(math.radians(a0 + 90))
        ex, ey = pts[-1][0] - CX, pts[-1][1] - YC
        pts += [(CX + ex + (tx - ex) * k / SIDE_SEG, YC + ey + (ty - ey) * k / SIDE_SEG, z) for k in range(1, SIDE_SEG)]
    return pts


def replace(bm, comps, patch_uv, uv0):
    """Delete the download's base, swivel ring and cradle (everything under its bottom plate); build foot and neck."""
    dead = [f for c, lo, hi in comps(bm) if hi[2] < TOP for f in c]
    bmesh.ops.delete(bm, geom=dead, context='FACES')
    hx, hy, r = FOOT
    rings = [rrect(hx - d, hy - d, max(r - d, NECK[0][0][2]), Z0 + h) for d, h in FOOT_PROFILE]
    rings += [rrect(*dims, Z0 + h) for dims, h in NECK]
    new = []
    loops = [[bm.verts.new(p) for p in ring] for ring in rings]
    for a, b in zip(loops, loops[1:]):
        n = len(a)
        new += [bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i])) for i in range(n)]
    for f in new: f.smooth = True
    new += [bm.faces.new(list(reversed(loops[0]))), bm.faces.new(loops[-1])]  # flat bottom on the case; top hidden in the plate
    bmesh.ops.recalc_face_normals(bm, faces=new)
    patch_uv(bm, uv0, faces=new)
    return len(dead)
