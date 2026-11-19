# MasterView replacement ("CRT Computer Monitor" by fizyman, CC BY 4.0; source in art/sources/masterview/),
# built in the live session.
#   exec(open('art/scripts/mvbuild.py').read()); build(1.0, 1.03, 'own' | 'step'); then mvcheck.py's check()
import math, os
import bpy, bmesh, numpy as np
from mathutils import Matrix, Vector

# exec'd in the live session (no __file__): the scripts sit beside art/scene.blend
ART = os.path.join(os.path.dirname(bpy.data.filepath), 'scripts') + os.sep
SOURCE = os.path.join(os.path.dirname(os.path.dirname(ART)), 'sources', 'masterview', 'masterview.blend')
# the download as placed in the scene: glass 288 mm wide, centred on the old screen, base on the case top
PLACE = Matrix.Translation((-0.0100000008, 0.0206276178, 1.1112426508)) @ Matrix.Scale(1.0041841277, 4)
MON = 'baked_crt_monitor'
CX, CZ = -0.01, 1.1257       # centre of the download's screen opening
GLASS_EDGE = -0.168          # the download's own glass rim, mean depth
SINK, DOME = 0.015, 0.019    # glass rim moved back by SINK; dome height, centre over rim (apex just behind the bezel face)
Y_END = 0.11                                       # stepped rear: back face (natural scale)


def link(o):
    bpy.data.collections['Collection'].objects.link(o)


def load_source():
    """mv_src_shell: the download's plastic shell, placed; brings its material and textures along."""
    if 'mv_src_shell' in bpy.data.meshes: return
    with bpy.data.libraries.load(SOURCE, relative=True) as (_, dst): dst.meshes = ['masterview_plastic']
    me = dst.meshes[0]; me.transform(PLACE); me.name = 'mv_src_shell'; me.use_fake_user = True
    for n in me.materials[0].node_tree.nodes:
        if n.type == 'TEX_IMAGE' and n.image: n.image.filepath = bpy.path.relpath(n.image.filepath)  # //sources/...


def plastic():
    return bpy.data.meshes['mv_src_shell'].materials[0]


def fresh(name, src):
    o = bpy.data.objects.get(name)
    if o:
        me = o.data; bpy.data.objects.remove(o)
        if me.users == 0: bpy.data.meshes.remove(me)
    me = bpy.data.meshes[src].copy(); me.name = name
    o = bpy.data.objects.new(name, me); link(o); return o


def comps(bm):
    bm.faces.ensure_lookup_table(); seen, out = set(), []
    for f in bm.faces:
        if f.index in seen: continue
        st, c = [f], []; seen.add(f.index)
        while st:
            g = st.pop(); c.append(g)
            for e in g.edges:
                for h in e.link_faces:
                    if h.index not in seen: seen.add(h.index); st.append(h)
        co = np.array([v.co for g in c for v in g.verts]); out.append((c, co.min(0), co.max(0)))
    return out


def outline(hx, hz, r, step=0.005):
    """Rounded rectangle around (CX, CZ): [(x, z, nx, nz)] with outward normals."""
    pts, cs = [], [(hx - r, hz - r, 0), (-(hx - r), hz - r, 90), (-(hx - r), -(hz - r), 180), (hx - r, -(hz - r), 270)]
    for i, (ox, oz, a0) in enumerate(cs):
        for k in range(7):
            a = math.radians(a0 + 15 * k); pts.append((CX + ox + r * math.cos(a), CZ + oz + r * math.sin(a), math.cos(a), math.sin(a)))
        a = math.radians(a0 + 90); nx_, nz_ = cs[(i + 1) % 4][:2]
        sx, sz, tx, tz = ox + r * math.cos(a), oz + r * math.sin(a), nx_ + r * math.cos(a), nz_ + r * math.sin(a)
        n = max(2, int(math.hypot(tx - sx, tz - sz) / step))
        for k in range(1, n): pts.append((CX + sx + (tx - sx) * k / n, CZ + sz + (tz - sz) * k / n, math.cos(a), math.sin(a)))
    return pts





def patch_uv(bm, uv0, half=0.004):
    """New faces read a plain patch of the MasterView texture; box-projected so no face has zero UV area."""
    for name in ('UVMap', 'UVMap.001'):
        lay = bm.loops.layers.uv.get(name) or bm.loops.layers.uv.new(name)
        for f in bm.faces:
            ax = max(range(3), key=lambda i: abs(f.normal[i])); a, b = [(1, 2), (0, 2), (0, 1)][ax]
            for l in f.loops:
                p = l.vert.co
                l[lay].uv = (uv0[0] - half + 2 * half * ((p[a] + 1) * 25 % 1), uv0[1] - half + 2 * half * ((p[b] + 1) * 25 % 1))





def slot(bm, cs):
    vs = [bm.verts.new(c) for c in cs]
    for q in ((0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)): bm.faces.new([vs[i] for i in q])


def rear_box(uv0):
    """Boxy rear housing behind the front shell: smaller, slightly tapered, vented."""
    YF, F, B = -0.1295, dict(hx=0.168, z0=0.937, z1=1.255), dict(hx=0.148, z0=0.940, z1=1.215)
    def at(y):
        t = (y - YF) / (Y_END - YF); L = lambda a, b: a + (b - a) * t
        return L(F['hx'], B['hx']), L(F['z0'], B['z0']), L(F['z1'], B['z1'])
    bm = bmesh.new()
    def loop(y):
        hx, z0, z1 = at(y); return [bm.verts.new((CX + sx * hx, y, z)) for sx, z in ((-1, z0), (1, z0), (1, z1), (-1, z1))]
    f, b = loop(YF), loop(Y_END)
    bm.faces.new(list(reversed(f))); bm.faces.new(b)
    for i in range(4): j = (i + 1) % 4; bm.faces.new((f[i], f[j], b[j], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.bevel(bm, geom=list(bm.edges), offset=0.012, segments=3, profile=0.5, affect='EDGES')
    me = bpy.data.meshes.new('tmp_rear'); bm.to_mesh(me); bm.free()
    box = bpy.data.objects.new('tmp_rear', me); link(box)
    cb = bmesh.new(); Wd, DEP, OUT = 0.003, 0.004, 0.02
    for k in range(9):
        y0 = -0.035 + k * 0.0105
        for xa, xb in ((-0.115, -0.016), (-0.004, 0.095)):
            slot(cb, [(CX + x, y, at(y)[2] + o) for o in (-DEP, OUT) for (x, y) in ((xa, y0), (xb, y0), (xb, y0 + Wd), (xa, y0 + Wd))])
    for side in (-1, 1):
        for k in range(7):
            z0 = 0.962 + k * 0.0105
            slot(cb, [(CX + side * (at(y)[0] + o), y, z) for o in (-DEP, OUT) for (y, z) in ((-0.06, z0), (0.08, z0), (0.08, z0 + Wd), (-0.06, z0 + Wd))])
    for k in range(10):
        z0 = 0.975 + k * 0.0105
        slot(cb, [(CX + x, Y_END + o, z) for o in (-DEP, OUT) for (x, z) in ((-0.095, z0), (0.095, z0), (0.095, z0 + Wd), (-0.095, z0 + Wd))])
    cme = bpy.data.meshes.new('tmp_cut'); bmesh.ops.recalc_face_normals(cb, faces=cb.faces); cb.to_mesh(cme); cb.free()
    cut = bpy.data.objects.new('tmp_cut', cme); link(cut)
    mod = box.modifiers.new('v', 'BOOLEAN'); mod.operation, mod.object, mod.solver = 'DIFFERENCE', cut, 'EXACT'
    with bpy.context.temp_override(object=box, active_object=box):
        bpy.ops.object.modifier_apply(modifier='v')
    bpy.data.objects.remove(cut); bpy.data.meshes.remove(cme)
    bm = bmesh.new(); bm.from_mesh(me); bpy.data.objects.remove(box); bpy.data.meshes.remove(me)
    # back plate closing the front shell behind its strips (y -0.128)
    pl = [bm.verts.new((x, -0.1285, z)) for x, z, _, _ in outline_abs(0.1865, 0.1655, 0.012, 1.111)]
    bm.faces.new(list(reversed(pl)))  # faces +y, into the room behind
    bm.normal_update()
    for fc in bm.faces:  # only the bevels are round; smoothing the big flat sides shades them in gradients
        fc.smooth = max(abs(c) for c in fc.normal) < 0.995
    patch_uv(bm, uv0)
    return bm


def outline_abs(hx, hz, r, cz):
    global CZ
    keep, CZ = CZ, cz
    try: return outline(hx, hz, r)
    finally: CZ = keep


def step_rear(bm):
    """Drop the MasterView's tapered rear pieces; pull its bottom plate in to the new box."""
    dead = []
    for c, lo, hi in comps(bm):
        if hi[1] > -0.12 and hi[2] > 0.95: dead += c
    bmesh.ops.delete(bm, geom=dead, context='FACES')
    for c, lo, hi in comps(bm):
        if len(c) == 180:  # bottom plate z 0.933-0.937, y to 0.148
            for v in {v for f in c for v in f.verts}:
                if v.co.y > -0.12:
                    v.co.y = -0.12 + (v.co.y + 0.12) * (Y_END - 0.004 + 0.12) / (0.148 + 0.12)
                    t = (v.co.y + 0.1295) / (Y_END + 0.1295); hw = 0.168 + (0.148 - 0.168) * t - 0.004
                    v.co.x = CX + max(-hw, min(hw, v.co.x - CX))
    return len(dead)




def material_own():
    """The MasterView's own material (cream, wear, roughness, normal map) on the logo-free texture,
    plus the detail tints (ink, note, pen, LED) with no extra ageing or grime."""
    if 'mv_plastic_own' in bpy.data.materials: return bpy.data.materials['mv_plastic_own']
    m = plastic().copy(); m.name = 'mv_plastic_own'
    bsdf = next(x for x in m.node_tree.nodes if x.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].links[0].from_node.image = bpy.data.images['mv_base_clean']
    ns = {}; exec(open(ART + 'crt_details.py').read().split("\nmon = bpy.data")[0], ns)
    ns['wire'](m, bpy.data.node_groups['plastic_detail'], 0.0, 0.0)
    li = {}; exec(open(ART + 'lived_in.py').read().split('\nadd_note()\nadd_ring()')[0], li)
    li['wire_matte'](m)
    return m



def clean_logo():
    """mv_base_clean: the base colour with the 'MasterView' print painted out from its own plastic."""
    if 'mv_base_clean' in bpy.data.images: return
    exec(open(ART + 'mvtex.py').read(), globals())
    bsdf = next(x for x in plastic().node_tree.nodes if x.type == 'BSDF_PRINCIPLED')
    src = bsdf.inputs['Base Color'].links[0].from_node.image; A, Wd, Hd = tex_array(src.name)
    globals()['SH'] = shell = bpy.data.objects.new('tmp_src', bpy.data.meshes['mv_src_shell']); link(shell)
    bpy.context.view_layer.update()
    uvs = [uv_at(x, z)[0] for x in np.arange(-0.156, -0.066, 0.002) for z in np.arange(1.233, 1.255, 0.002)]
    bpy.data.objects.remove(shell)
    uvs = np.array([u for u in uvs if u is not None]) % 1
    x0, x1 = int(uvs[:, 0].min() * Wd) - 8, int(uvs[:, 0].max() * Wd) + 8
    y0, y1 = int(uvs[:, 1].min() * Hd) - 8, int(uvs[:, 1].max() * Hd) + 8
    reg = A[y0:y1, x0:x1].copy(); L = reg[..., :3] @ np.array([0.2126, 0.7152, 0.0722])
    bg = np.percentile(L, 70); mask = L < bg - 0.05
    for _ in range(3):
        mask = mask | np.roll(mask, 1, 0) | np.roll(mask, -1, 0) | np.roll(mask, 1, 1) | np.roll(mask, -1, 1)
    good = reg[~mask]; rng = np.random.default_rng(3)
    reg[mask] = good[rng.integers(0, len(good), mask.sum())]
    A[y0:y1, x0:x1] = reg
    im = bpy.data.images.new('mv_base_clean', Wd, Hd); im.pixels.foreach_set(A.ravel()); im.pack()
    print('logo region px', (x0, y0, x1, y1), 'painted', int(mask.sum()))


def details(mon, z_bottom):
    """TRISH badge where the logo was, green LED on the MasterView's own LED dot, and the note."""
    ns = {}
    exec(open(ART + 'crt_details.py').read().split("\nmon = bpy.data")[0].split("\nif 'detail_ink'")[0], ns)
    def place(kind, x, z, proud, ink_v, led_v, size=1.0):
        piece = ns['build_piece'](kind)
        for v in piece.verts:
            wx, wz = x + size * v.co.x, z + size * v.co.z
            v.co = Vector((wx, ns['surface_y'](mon, wx, wz) - proud + v.co.y, wz))
        return piece, ink_v, led_v
    # where the print was (x -0.111, z 1.2405-1.250), grey like it, at its letter height (~9 mm)
    parts = [place('badge', -0.111, 1.2453, 0.00035, 0.85, 0.0, 1.6),
             place('led', 0.0155, 0.966, 0.0007, 0.0, 1.6)]
    me = bpy.data.meshes.new('mv_details'); bm = bmesh.new()
    ink = bm.faces.layers.float.new('detail_ink'); led = bm.faces.layers.float.new('led')
    for piece, ink_v, led_v in parts:
        tmp = bpy.data.meshes.new('tmp'); piece.to_mesh(tmp); piece.free()
        first = len(bm.faces); bm.from_mesh(tmp); bpy.data.meshes.remove(tmp); bm.faces.ensure_lookup_table()
        for f in bm.faces[first:]: f[ink], f[led] = ink_v, led_v
    join_uv(mon, bm, me, (-0.112, 1.262))
    li = {}
    src = open(ART + 'lived_in.py').read().split('\nadd_note()\nadd_ring()')[0]
    exec(src, li)
    li['NOTE_TL'], li['NOTE_ANGLE'] = (0.1035, z_bottom - 0.016), math.radians(4)
    li['NOTE_W'], li['NOTE_H'] = 0.0608, 0.060  # seen from cam_overview as large as the old monitor's note, which wrapped its edge
    li['NOTE_C'] = (li['NOTE_TL'][0] + li['NOTE_W'] / 2 * math.cos(li['NOTE_ANGLE']) + li['NOTE_H'] / 2 * math.sin(li['NOTE_ANGLE']),
                    li['NOTE_TL'][1] + li['NOTE_W'] / 2 * math.sin(li['NOTE_ANGLE']) - li['NOTE_H'] / 2 * math.cos(li['NOTE_ANGLE']))
    li['BEZEL_EDGE'], li['X_FLAT'], li['Z_FLAT'] = 0.177, 0.170, 0.952
    li['surface'] = lambda m_, x, z: m_.ray_cast(Vector((min(x, 0.170), -0.4, max(z, 0.952))), Vector((0, 1, 0)))[1].y
    bm = bmesh.new(); li['build_note'](mon, bm, li['LINES'])
    li['join_piece'](mon, bm, bpy.data.meshes.new('mv_note'), ((li['NOTE_C'][0], -0.4, li['NOTE_C'][1]), (0, 1, 0)))
    for p in mon.data.polygons:
        if mon.data.attributes['note'].data[p.index].value or mon.data.attributes['pen'].data[p.index].value: p.use_smooth = True



def atlas_strokes(mon):
    """lived_note_atlas (bake_lightmaps.atlas_strokes_in) becomes this note's own strokes, so the
    lightmap atlas packs them where they are and later text edits keep it."""
    bm = bmesh.new(); bm.from_mesh(mon.data); pen = bm.faces.layers.float['pen']
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if not f[pen]], context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')  # the badge font's loose wire
    bm.transform(mon.matrix_world); bm.to_mesh(bpy.data.meshes['lived_note_atlas']); bm.free()


def join_uv(mon, bm, me, xz):
    hit = mon.ray_cast(Vector((xz[0], -0.4, xz[1])), Vector((0, 1, 0)))
    loop = mon.data.polygons[hit[3]].loop_indices[0]
    for name in mon.data.uv_layers.keys():
        lay = bm.loops.layers.uv.get(name) or bm.loops.layers.uv.new(name); uv = mon.data.uv_layers[name].data[loop].uv.copy()
        for f in bm.faces:
            for l in f.loops: l[lay].uv = uv
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(me.name, me); link(o); me.materials.append(mon.material_slots[0].material)
    with bpy.context.temp_override(active_object=mon, selected_editable_objects=[mon, o]): bpy.ops.object.join()


def join(mon, bm, name, normals=None):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    if normals:  # per corner: smooth faces take the given vertex normal, flat faces their own
        me.normals_split_custom_set([normals.get(me.loops[li].vertex_index, p.normal) if p.use_smooth else p.normal
                                     for p in me.polygons for li in p.loop_indices])
    o = bpy.data.objects.new(name, me); link(o); me.materials.append(mon.material_slots[0].material)
    with bpy.context.temp_override(active_object=mon, selected_editable_objects=[mon, o]): bpy.ops.object.join()



def opening(bm):
    """The download's screen opening: its boundary loop, in order."""
    inner = lambda v: abs(v.co.x - CX) < 0.145 and abs(v.co.z - CZ) < 0.112 and v.co.y < -0.16
    edges = [e for e in bm.edges if e.is_boundary and all(inner(v) for v in e.verts)]
    nxt = {}
    for e in edges:
        a, b = e.verts; nxt.setdefault(a, []).append(b); nxt.setdefault(b, []).append(a)
    loop = [min(nxt, key=lambda v: v.co.x)]
    while True:
        step = [w for w in nxt[loop[-1]] if len(loop) < 2 or w is not loop[-2]][0]
        if step is loop[0]: return loop
        loop.append(step)


def across(v):
    """The wall edge from the ring in front to opening vertex v (the one running most nearly straight back)."""
    return max((v.co - e.other_vert(v).co for e in v.link_edges if not e.is_boundary), key=lambda d: d.normalized().y)


def wall_dirs(loop):
    """Per opening vertex, the wall's own direction back, without its slide along the opening (the edge
    "across" may be a triangle's diagonal): what remains is the wall's real inward slope."""
    out = []
    for i, v in enumerate(loop):
        t = (loop[(i + 1) % len(loop)].co - loop[i - 1].co).normalized(); d = across(v)
        d = (d - t * d.dot(t)).normalized(); out.append(d if d.y > 0.5 else Vector((0, 1, 0)))
    return out


def plastic_patch(x0=0.06, z0=1.249, period=0.024):
    """(s, t) in metres -> UVs of a clean piece of the bezel's top band at the texture's own density,
    mirrored every `period` along s, so a long strip of new wall wears the same plastic without seams."""
    maps = {}
    for name in ('UVMap', 'UVMap.001'):
        u0 = Vector(uv_at(x0, z0, name)[0]); h = 0.002
        ds, dt = (Vector(uv_at(x0 + h, z0, name)[0]) - u0) / h, (Vector(uv_at(x0, z0 + h, name)[0]) - u0) / h
        maps[name] = (u0, ds, dt)
    tri = lambda s: period - abs(s % (2 * period) - period)
    return lambda name, s, t: maps[name][0] + maps[name][1] * tri(s) + maps[name][2] * t


def deepen(bm, loop, y_end, patch):
    """Carry the opening's own inner wall straight on back to y_end, at its own slope, with the bezel's plastic
    (`patch`) and the wall's own smooth normals, so the edge reads as the original one, only deeper.
    Returns the new faces and, per vertex on them, the (wall face, opening vertex) whose corner normal it shares."""
    uvs = [bm.loops.layers.uv[n] for n in ('UVMap', 'UVMap.001')]
    n = len(loop); cols, src, d_all, faces = [], {}, [], []
    d_all = wall_dirs(loop)
    seg = np.mean([across(v).length for v in loop])
    K = max(1, round((y_end - np.mean([v.co.y for v in loop])) / seg))
    arc = np.r_[0, np.cumsum([(loop[i].co - loop[i - 1].co).length for i in range(1, n)])]
    st = {}
    for v, d, s_ in zip(loop, d_all, arc):
        t = (y_end - v.co.y) / d.y
        cols.append([v] + [bm.verts.new(v.co + d * t * k / K) for k in range(1, K + 1)])
        for k, c in enumerate(cols[-1]): st[c] = (s_, t * k / K)
    for i in range(n):
        j = (i + 1) % n; a, b = loop[i], loop[j]
        w = next(f for f in bm.edges.get((a, b)).link_faces)
        la = next(l for l in w.loops if l.vert is a); lb = next(l for l in w.loops if l.vert is b)
        flip = la.link_loop_next is lb  # wind each new face against the wall face's edge, so it faces the same way
        for k in range(K):
            corners = ((i, la, k), (j, lb, k), (j, lb, k + 1), (i, la, k + 1))
            if flip: corners = corners[::-1]
            f = bm.faces.new([cols[c][r] for c, _, r in corners]); f.smooth = True; faces.append(f)
            for l in f.loops:
                s_, t = st[l.vert]
                if j == 0 and l.vert in cols[0]: s_ = arc[-1] + (loop[0].co - loop[-1].co).length  # closing edge
                for u, name in zip(uvs, ('UVMap', 'UVMap.001')): l[u].uv = patch(name, s_, t)
            for c in (cols[i][k], cols[j][k], cols[j][k + 1], cols[i][k + 1]):
                src[c] = (w, a if c in cols[i] else b)
    return faces, src, K


def outline_at(loop, y):
    """The deepened wall's outline at depth y, resampled every 2 mm, as (x, z)."""
    pts = []
    for v, d in zip(loop, wall_dirs(loop)):
        p = v.co + d * (y - v.co.y) / d.y; pts.append((p.x, p.z))
    pts = np.array(pts + pts[:1]); seg = np.linalg.norm(np.diff(pts, axis=0), axis=1); s = np.r_[0, np.cumsum(seg)]
    t = np.arange(0, s[-1], 0.002)
    return np.c_[np.interp(t, s, pts[:, 0]), np.interp(t, s, pts[:, 1])]


def dome(name, rim, box, y_of, rings=24):
    """Domed cap over the outline `rim`: concentric copies of it to the centre; UV 0-1 over `box`."""
    cx, cz, hx, hz = box
    me = bpy.data.objects[name].data; b = bmesh.new(); uv = b.loops.layers.uv.new('UVMap')
    def vert(x, z):
        u, v = (x - cx) / hx, (z - cz) / hz; return b.verts.new((x, y_of(u, v), z))
    rs = [[vert(cx + (x - cx) * s, cz + (z - cz) * s) for x, z in rim] for s in np.linspace(1, 0, rings + 1)[:-1]]
    c = vert(cx, cz); n = len(rim)
    for r0, r1 in zip(rs, rs[1:] + [None]):
        for i in range(n):
            j = (i + 1) % n
            f = b.faces.new((r0[i], r0[j], r1[j], r1[i]) if r1 else (r0[i], r0[j], c)); f.smooth = True
    for f in b.faces:
        for l in f.loops: l[uv].uv = ((l.vert.co.x - cx + hx) / (2 * hx), (l.vert.co.z - cz + hz) / (2 * hz))
    b.normal_update()
    if sum(f.normal.y for f in b.faces) > 0: bmesh.ops.reverse_faces(b, faces=list(b.faces))
    me.clear_geometry()
    for u in list(me.uv_layers): me.uv_layers.remove(u)
    b.to_mesh(me); b.free()


def rect(name, box, y):
    cx, cz, hx, hz = box
    me = bpy.data.objects[name].data; co = np.array([v.co for v in me.vertices]); lo, hi = co.min(0), co.max(0)
    for v in me.vertices:
        v.co.x = cx - hx + 2 * hx * (v.co.x - lo[0]) / (hi[0] - lo[0])
        v.co.z = cz - hz + 2 * hz * (v.co.z - lo[2]) / (hi[2] - lo[2])
        v.co.y = y


def edge_fit(rim, box, margin=0.001):
    """Largest CRT.edge (superellipse exponent, even) whose picture mask keeps `margin` inside every corner
    of the rim outline; along the straight sides mask and rim coincide."""
    cx, cz, hx, hz = box; rel = rim - (cx, cz)
    order = np.argsort(np.arctan2(rel[:, 1], rel[:, 0])); ang, rad = np.arctan2(rel[:, 1], rel[:, 0])[order], np.hypot(*rel.T)[order]
    corner = min(np.interp(np.arctan2(sz * hz, sx * hx), ang, rad) for sx in (1, -1) for sz in (1, -1))
    return max(e for e in range(4, 98, 2) if corner - 2 ** (-1 / e) * math.hypot(hx, hz) >= margin)

def glass_look():
    """crt_glass: a lighter grey-green tint and edge reflections rising with Fresnel, so the dome reads as a
    gradient. (The soft highlight is render-only, mvrender.py: the bake refuses unclassified emitters, and
    the site draws its own from crtGlare.)"""
    m = bpy.data.materials['crt_glass']; nt = m.node_tree
    if 'fresnel' in nt.nodes: return
    b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    nt.nodes['Mix'].inputs[6].default_value = (0.13, 0.16, 0.145, 1)  # clean glass (smudges keep the other colour)
    nt.nodes['Map Range.004'].inputs[3].default_value = 0.22           # base coverage, up from 0.12
    b.inputs['Coat Weight'].default_value, b.inputs['Specular IOR Level'].default_value = 1.0, 1.0
    lw = nt.nodes.new('ShaderNodeLayerWeight'); lw.name = 'fresnel'; lw.inputs['Blend'].default_value = 0.35
    alpha = nt.nodes.new('ShaderNodeMath'); alpha.operation = 'ADD'; alpha.use_clamp = True
    nt.links.new(nt.nodes['Map Range.004'].outputs[0], alpha.inputs[0]); nt.links.new(lw.outputs['Fresnel'], alpha.inputs[1])
    nt.links.new(alpha.outputs[0], b.inputs['Alpha'])

def build(rear):
    load_source()
    clean_logo()
    glass_look()
    bpy.data.objects['old_crt_monitor'].hide_render = True
    mon = fresh(MON, 'mv_src_shell')
    mon.data.materials.clear(); mon.data.materials.append(material_own())
    exec(open(ART + 'mvtex.py').read(), globals())
    globals()['SH'] = mon
    uv0 = uv_at(-0.01, 1.262)[0]
    y_rim = GLASS_EDGE + SINK
    bm = bmesh.new(); bm.from_mesh(mon.data)
    for name in ('detail_ink', 'led', 'note', 'pen'): bm.faces.layers.float.new(name)
    dropped = step_rear(bm) if rear == 'step' else 0
    loop = opening(bm)
    rim = outline_at(loop, y_rim)
    faces, src, K = deepen(bm, loop, y_rim + 0.002, plastic_patch())  # the wall runs on 2 mm past the glass rim
    bm.faces.index_update(); bm.verts.index_update()
    pairs = {c.index: (w.index, a.index) for c, (w, a) in src.items()}
    new_faces = [f.index for f in faces]
    bm.to_mesh(mon.data); bm.free(); mon.data.update()
    me = mon.data; cn = [c.vector.copy() for c in me.corner_normals]
    wall_n = {}
    for vi, (fi, ai) in pairs.items():  # the wall's own smooth normal at the opening vertex the column grows from
        p = me.polygons[fi]; li = next(l for l in p.loop_indices if me.loops[l].vertex_index == ai); wall_n[vi] = cn[li]
    for fi in new_faces:
        for li in me.polygons[fi].loop_indices: cn[li] = wall_n[me.loops[li].vertex_index]
    me.normals_split_custom_set([tuple(c) for c in cn])
    if rear == 'step': join(mon, rear_box(uv0), 'mv_rear')
    xs, zs = rim[:, 0], rim[:, 1]
    box = ((xs.min() + xs.max()) / 2, (zs.min() + zs.max()) / 2, (xs.max() - xs.min()) / 2, (zs.max() - zs.min()) / 2)
    details(mon, box[1] - box[3])
    bm = bmesh.new(); bm.from_mesh(mon.data)  # the font leaves zero-area triangles in the badge
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.calc_area() < 1e-9], context='FACES_ONLY')
    bm.to_mesh(mon.data); bm.free()
    atlas_strokes(mon)
    inset = np.array(box[:2]) + (rim - box[:2]) * (1 - 0.0003 / np.linalg.norm(rim - box[:2], axis=1))[:, None]  # clear of the wall
    bump = lambda u, v: DOME * (1 - u * u) * (1 - v * v)
    dome('screen_glass', inset, box, lambda u, v: y_rim - 0.0005 - bump(u, v))
    dome('screen_curve', inset, box, lambda u, v: y_rim - 0.9 * bump(u, v))
    rect('screen_plane', box, y_rim); rect('crt_glow', box, y_rim + 0.003)
    cam = bpy.data.objects['cam_screen']; cam.location = (box[0], y_rim - 0.42 * box[2] / 0.144, box[1])
    M = Matrix.Translation((0, 0, 0.0006))  # lifts everything so the base clears the case top (z 0.87597)
    for n in (MON, 'screen_glass', 'screen_curve', 'screen_plane', 'crt_glow'): bpy.data.objects[n].data.transform(M)
    cam.location = M @ cam.location
    mon.data.update()
    print(f'built rear {rear}: faces {len(mon.data.polygons)}, rear pieces dropped {dropped}, wall steps {K}, '
          f'screen {2000 * box[2]:.1f} x {2000 * box[3]:.1f} mm, rim y {y_rim:.4f}, apex y {y_rim - DOME:.4f}, '
          f'CRT.edge fit {edge_fit(rim, box)}, bulge {DOME / box[3]:.3f}, cam {tuple(round(c, 4) for c in cam.location)}')
