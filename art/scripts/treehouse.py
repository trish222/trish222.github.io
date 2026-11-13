# LEGO cherry-blossom treehouse on a green baseplate, built from a voxel grid of
# studs (8 mm) x studs x plates (3.2 mm). Run inside art/scene.blend:
#   exec(open("art/scripts/treehouse.py").read())
# Replaces the mesh of `baked_treehouse` (vertex colours in `Col`) and refits `click_treehouse`.
import math
import random

import bmesh
import bpy
from mathutils import Vector

STUD, PLATE = 0.008, 0.0032
ORIGIN = Vector((0.262, 0.135, 0.7500))  # baseplate min corner on the desk
BASE_W, BASE_D = 24, 20
GAP = 0.00012  # seam between neighbouring pieces

C = {
    "green": (0.10, 0.36, 0.14), "brown": (0.25, 0.10, 0.05), "dark": (0.13, 0.06, 0.04),
    "tan": (0.80, 0.68, 0.48), "white": (0.93, 0.91, 0.86), "roof": (0.42, 0.07, 0.06),
    "pink": (0.98, 0.62, 0.74), "light": (1.0, 0.82, 0.88), "rose": (0.92, 0.42, 0.55),
    "coral": (0.98, 0.45, 0.38),
}
rng = random.Random(222)
grid = {}


def put(x, y, z, col, force=False):
    x = BASE_W - 1 - x  # designed sweeping left; mirrored so the canopy clears the monitor
    if force or (x, y, z) not in grid:
        grid[(x, y, z)] = col


def build_trunk():
    """S-curved trunk (bonsai-like) rising from the middle of the plate."""
    top = 44
    for z in range(1, top):
        t = z / top
        cx = 9 + 3.2 * math.sin(t * math.pi * 1.4) - 2.5 * t
        cy = 10 + 1.2 * math.sin(t * math.pi)
        r = 2.4 - 1.0 * t + (1.6 if z < 4 else 0)  # root flare
        for x in range(int(cx - r) - 1, int(cx + r) + 2):
            for y in range(int(cy - r) - 1, int(cy + r) + 2):
                if (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r:
                    put(x, y, z, "dark" if z < 3 or rng.random() < 0.18 else "brown")
    # Branches reaching out to the canopy clusters.
    for (x0, y0, z0), (x1, y1, z1) in [((7, 10, 34), (-1, 9, 46)), ((8, 10, 40), (17, 11, 50)),
                                       ((10, 10, 24), (19, 9, 30)), ((7, 10, 42), (6, 12, 54))]:
        n = 24
        for i in range(n + 1):
            t = i / n
            p = (x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z0 + (z1 - z0) * t)
            for dz in range(3):
                put(round(p[0]), round(p[1]), round(p[2]) + dz, "brown")


def build_house():
    """A small hut on a tan deck to the right of the trunk, on two stilts."""
    x0, y0, z0, w, d = 11, 6, 18, 8, 8
    for x in range(x0, x0 + w):
        for y in range(y0, y0 + d):
            put(x, y, z0, "tan", force=True)
    for sx, sy in [(x0 + w - 1, y0), (x0 + w - 1, y0 + d - 1), (x0 + 3, y0)]:
        for z in range(1, z0):
            put(sx, sy, z, "brown", force=True)
    hx, hy, hw, hd = x0 + 2, y0 + 1, 5, 5
    for z in range(z0 + 1, z0 + 10):
        for x in range(hx, hx + hw):
            for y in range(hy, hy + hd):
                edge = x in (hx, hx + hw - 1) or y in (hy, hy + hd - 1)
                door = y == hy and x == hx + 2 and z < z0 + 8
                window = x == hx + hw - 1 and y == hy + 2 and z0 + 4 <= z <= z0 + 6
                if edge and not door and not window:
                    put(x, y, z, "white", force=True)
    for i in range(4):  # stepped gable roof along x
        for x in range(hx - 1, hx + hw + 1):
            for y in (hy - 1 + i, hy + hd - i):
                put(x, y, z0 + 10 + i, "roof", force=True)
    for x in range(hx - 1, hx + hw + 1):
        put(x, hy + 2, z0 + 14, "roof", force=True)


def blossom(cx, cy, cz, rx, ry, rz):
    """A flattened, ragged cloud of pink plates."""
    for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for z in range(int(cz - rz) - 1, int(cz + rz) + 2):
                d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2
                if d <= 1 and (d < 0.55 or rng.random() < 0.75):
                    roll = rng.random()
                    col = "light" if roll < 0.35 else "pink" if roll < 0.75 else "rose" if roll < 0.93 else "coral"
                    if (z - cz) > rz * 0.35 and rng.random() < 0.5:
                        col = "light"  # sun-bleached tops
                    put(x, y, z, col)


def build_canopy():
    blossom(1, 9, 50, 9.5, 7.0, 4.2)     # big tier sweeping left
    blossom(9, 11, 56, 7.5, 6.0, 3.6)    # crown
    blossom(17, 11, 52, 6.5, 5.5, 3.4)   # right tier
    blossom(20, 9, 33, 4.0, 3.5, 2.6)    # low cluster over the hut
    blossom(-3, 8, 42, 4.0, 3.5, 2.2)    # drooping left tip


def build_base():
    for x in range(BASE_W):
        for y in range(BASE_D):
            put(x, y, 0, "green", force=True)
    for _ in range(9):  # fallen petals
        put(rng.randrange(BASE_W), rng.randrange(BASE_D), 1, rng.choice(["pink", "light"]))


def pieces():
    """Greedy-merge cells into 1xN bricks (N<=4) up to 3 plates tall."""
    used, out = set(), []
    for key in sorted(grid, key=lambda k: (k[2], k[1], k[0])):
        if key in used:
            continue
        x, y, z = key
        col = grid[key]
        if z == 0:  # baseplate is one piece
            continue
        n = 1
        while n < 4 and grid.get((x + n, y, z)) == col and (x + n, y, z) not in used:
            n += 1
        h = 1
        while h < 3 and all(grid.get((x + i, y, z + h)) == col and (x + i, y, z + h) not in used for i in range(n)):
            h += 1
        cells = [(x + i, y, z + j) for i in range(n) for j in range(h)]
        used.update(cells)
        hidden = all(all((a + dx, b + dy, c + dz) in grid for dx, dy, dz in
                         [(1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)]) for a, b, c in cells)
        if not hidden:
            out.append((x, y, z, n, h, col))
    return out


def emit(bm, col_layer, lo, hi, rgb):
    v = [bm.verts.new((a, b, c)) for a in (lo.x, hi.x) for b in (lo.y, hi.y) for c in (lo.z, hi.z)]
    faces = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    for f in faces:
        face = bm.faces.new([v[i] for i in f])
        for loop in face.loops:
            loop[col_layer] = (*rgb, 1.0)


def stud(bm, col_layer, cx, cy, z, rgb, seg=8):
    r, h = 0.0024, 0.0017
    ring_lo = [bm.verts.new((cx + r * math.cos(a), cy + r * math.sin(a), z)) for a in
               (2 * math.pi * i / seg for i in range(seg))]
    ring_hi = [bm.verts.new((p.co.x, p.co.y, z + h)) for p in ring_lo]
    for i in range(seg):
        j = (i + 1) % seg
        face = bm.faces.new((ring_lo[i], ring_lo[j], ring_hi[j], ring_hi[i]))
        for loop in face.loops:
            loop[col_layer] = (*rgb, 1.0)
    face = bm.faces.new(ring_hi)
    for loop in face.loops:
        loop[col_layer] = (*rgb, 1.0)


def jitter(rgb):
    k = 1 + rng.uniform(-0.05, 0.04)
    return tuple(min(1.0, c * k) for c in rgb)


def build_mesh():
    bm = bmesh.new()
    col_layer = bm.loops.layers.color.new("Col")
    # Baseplate: thin plate (real baseplates are ~1.6 mm), studs where nothing sits on it.
    emit(bm, col_layer, ORIGIN, ORIGIN + Vector((BASE_W * STUD, BASE_D * STUD, PLATE * 0.5)), C["green"])
    for x in range(BASE_W):
        for y in range(BASE_D):
            if (x, y, 1) not in grid:
                stud(bm, col_layer, ORIGIN.x + (x + 0.5) * STUD, ORIGIN.y + (y + 0.5) * STUD,
                     ORIGIN.z + PLATE * 0.5, C["green"], seg=6)
    for x, y, z, n, h, col in pieces():
        rgb = jitter(C[col])
        lo = ORIGIN + Vector((x * STUD + GAP, y * STUD + GAP, (z - 0.5) * PLATE))
        hi = ORIGIN + Vector(((x + n) * STUD - GAP, (y + 1) * STUD - GAP, (z + h - 0.5) * PLATE))
        emit(bm, col_layer, lo, hi, rgb)
        for i in range(n):
            if (x + i, y, z + h) not in grid:
                stud(bm, col_layer, lo.x + (i + 0.5) * STUD - GAP, lo.y + 0.5 * STUD - GAP, hi.z, rgb)
    return bm


build_base()
build_trunk()
build_house()
build_canopy()
bm = build_mesh()
obj = bpy.data.objects["baked_treehouse"]
old = obj.data
bm.to_mesh(obj.data)
bm.free()
obj.data.update()

proxy = bpy.data.objects["click_treehouse"]
vs = [obj.matrix_world @ v.co for v in obj.data.vertices]
lo = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
hi = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
pm = bmesh.new()
bmesh.ops.create_cube(pm, size=1.0)
for v in pm.verts:
    v.co = Vector((lo.x if v.co.x < 0 else hi.x, lo.y if v.co.y < 0 else hi.y, lo.z if v.co.z < 0 else hi.z))
pm.to_mesh(proxy.data)
pm.free()
proxy.matrix_world.identity()
print("treehouse", len(obj.data.vertices), "verts", len(obj.data.polygons), "faces, bounds", lo, hi)
