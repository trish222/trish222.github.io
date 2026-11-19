# Geometry checks for the built baked_crt_monitor (see mvbuild.py).
import bpy, bmesh, numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree


def check(edge):
    """edge: CRT.edge, the picture mask the site draws over screen_plane's rectangle."""
    dg = bpy.context.evaluated_depsgraph_get()
    mon = bpy.data.objects['baked_crt_monitor']; T = lambda o: BVHTree.FromObject(o, dg); tm = T(mon)
    me = mon.data; co = np.array([v.co for v in me.vertices])
    skip = {'baked_crt_monitor', 'old_crt_monitor', 'screen_glass', 'screen_curve', 'screen_plane', 'crt_glow'}
    hits = {o.name: len(k) for o in bpy.context.scene.objects
            if o.type == 'MESH' and o.name not in skip and not o.name.startswith('click_') and not o.hide_render and (k := tm.overlap(T(o)))}
    ink = np.array([a.value for a in me.attributes['detail_ink'].data])
    cross = {}
    for n in ('screen_glass',):
        ids = {b for a, b in T(bpy.data.objects[n]).overlap(tm)}; cross[n] = (len(ids), sum(1 for i in ids if ink[i] < 0.5))
    bm = bmesh.new(); bm.from_mesh(me)
    note, pen = bm.faces.layers.float['note'], bm.faces.layers.float['pen']
    rest = [f for f in bm.faces if not (f[note] > 0 or f[pen] > 0)]
    tree = BVHTree.FromPolygons([v.co.copy() for v in bm.verts], [[v.index for v in f.verts] for f in rest])
    nv = {v for f in bm.faces if f[note] > 0 or f[pen] > 0 for v in f.verts}
    covered = sum(1 for v in nv if (h := tree.ray_cast(Vector((v.co.x, -0.6, v.co.z)), Vector((0, 1, 0)), 1.0))[0] is not None and h[0].y < v.co.y - 1e-5)
    deg = sum(1 for f in bm.faces if f.calc_area() < 1e-10); bm.free()
    pl = np.array([v.co for v in bpy.data.objects['screen_plane'].data.vertices]); YP = pl[0, 1]
    X0, X1, Z0, Z1 = pl[:, 0].min(), pl[:, 0].max(), pl[:, 2].min(), pl[:, 2].max()
    beige = np.ones(len(co), bool)
    for p in me.polygons:
        if ink[p.index] > 0.5: beige[list(p.vertices)] = False
    for p in me.polygons:
        if ink[p.index] <= 0.5: beige[list(p.vertices)] = True
    cam = bpy.data.objects['cam_screen'].location
    s = co[beige & (co[:, 1] < YP)]; t = (YP - cam.y) / (s[:, 1] - cam.y)
    px, pz = cam.x + (s[:, 0] - cam.x) * t, cam.z + (s[:, 2] - cam.z) * t
    u, w = (px - (X0 + X1) / 2) / ((X1 - X0) / 2), (pz - (Z0 + Z1) / 2) / ((Z1 - Z0) / 2)
    inside = int((np.abs(u) ** edge + np.abs(w) ** edge < 1 - 1e-3).sum())
    print(f'  touches {hits or "nothing"} | glass/picture x monitor (faces, of them beige) {cross} | note/pen verts {len(nv)} covered {covered}'
          f' | beige inside picture mask (edge {edge}) from cam_screen {inside} | degenerate {deg} | monitor y {co[:, 1].min():.3f}..{co[:, 1].max():.3f}'
          f' z {co[:, 2].min():.3f}..{co[:, 2].max():.3f} | plane {1000 * (X1 - X0):.0f} x {1000 * (Z1 - Z0):.0f} mm at y {YP:.4f}')
