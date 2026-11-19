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
# The glass tucks under the bezel's own lip (which ends at y about -0.168): its rim RIM_BACK behind that edge and TUCK
# outside it, so the screen's edges curve back into the bezel; its centre bulges forward to APEX, 1.5 mm proud of the
# top band of the bezel face (y -0.1751), the face's closest part: an 18.3 mm dome.
RIM_BACK, TUCK, APEX = 0.008, 0.006, -0.1766
Y_END = 0.11                                       # stepped rear: back face (natural scale)
# Larger screen: the opening grows DROP down and WIDEN out on each side (6% of its height, aspect kept). Its bevel
# and corners move rigidly, so they keep the download's shape; only the flat chin and side bands give way.
DROP, WIDEN = 0.0126, 0.00835
Z_BANDS = (0.952, 0.984, 1.04, 1.20)  # flat chin from, bevel from, corners up to, sides stretch up to
U_BANDS = (0.10, 0.162, 0.178)        # |x - CX|: top/bottom edges stretch out to, bevel out to, flat side band out to


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





def patch_uv(bm, uv0, half=0.004, faces=None):
    """New faces read a plain patch of the MasterView texture; box-projected so no face has zero UV area."""
    for name in ('UVMap', 'UVMap.001'):
        lay = bm.loops.layers.uv.get(name) or bm.loops.layers.uv.new(name)
        for f in faces or bm.faces:
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




def wz(z):
    a, b, c, d = Z_BANDS
    return float(np.interp(z, Z_BANDS, (a, b - DROP, c - DROP, d))) if a < z < d else z


def wx(x):
    c, b, e = U_BANDS; u = abs(x - CX)
    return CX + math.copysign(float(np.interp(u, (0, c, b, e), (0, c + WIDEN, b + WIDEN, e))), x - CX) if u < e else x


def widen_opening(bm):
    """The front shell (not the bottom plate) through wx, wz."""
    for v in bm.verts:
        if v.co.y < -0.125 and v.co.z > 0.94: v.co.x, v.co.z = wx(v.co.x), wz(v.co.z)


def material_own():
    """The MasterView's own material (cream, wear, roughness, normal map) on the logo-free texture,
    plus the detail tints (ink, note, pen, LED) with no extra ageing or grime."""
    for name in ('mv_plastic_own', 'Material.018'):  # renamed after the first build
        if name in bpy.data.materials: return bpy.data.materials[name]
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
    if 'mv_base_clean' in bpy.data.images or 'mv_base_even' in bpy.data.images: return  # even_plastic is built from it
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


def box(a, r):
    """Mean over a (2r+1)^2 window, edges clamped."""
    for ax in (0, 1):
        c = np.cumsum(np.pad(a, [(r + 1, r) if i == ax else (0, 0) for i in range(a.ndim)], mode='edge'), axis=ax)
        n = c.shape[ax]
        a = (np.take(c, range(2 * r + 1, n), axis=ax) - np.take(c, range(n - 2 * r - 1), axis=ax)) / (2 * r + 1)
    return a.astype(np.float32)


EVEN = {'monitor_plastic_normal.png': 'mv_normal_even', 'monitor_plastic_metallicRoughness.png': 'mv_rough_even'}  # buttons lifted out
GRIME_KEEP = 0.25  # share of the download's grey dirt left in; the rest lifts to the clean plastic around it
AO_WEIGHT = 0.8    # the download's own AO (buttons, seams): the site's lightmap is far too coarse to hold it


def even_plastic():
    """mv_base_even: mv_base_clean with its dirt patches lifted (painted vents and print spared), the download's AO
    multiplied in, and the painted buttons lifted out."""
    if 'mv_base_even' in bpy.data.images: return
    exec(open(ART + 'mvtex.py').read(), globals())
    A, Wd, Hd = tex_array('mv_base_clean'); L = A[..., :3] @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    clean = (L > box(L, 24) - 0.02).astype(np.float32)
    ref = box(L * clean, 64) / np.maximum(box(clean, 64), 1e-3)  # clean plastic level, about 3 cm around
    dirt = np.clip(ref - L, 0, None) * np.clip((L - 0.3) / 0.2, 0, 1)
    ao = tex_array('monitor_plastic_metallicRoughness.png')[0][..., 0]
    k = (L + (1 - GRIME_KEEP) * dirt) / np.maximum(L, 1e-4) * (1 - AO_WEIGHT * (1 - ao)) ** (1 / 2.2)  # AO is linear
    A[..., :3] = np.clip(A[..., :3] * k[..., None], 0, 1)
    maps = {'mv_base_even': A, **{EVEN[n]: tex_array(n)[0] for n in EVEN}}
    globals()['SH'] = shell = bpy.data.objects.new('tmp_src', bpy.data.meshes['mv_src_shell']); link(shell)
    bpy.context.view_layer.update()
    btn = {}; exec(open(ART + 'mvbuttons.py').read(), btn); btn['paint_out'](list(maps.values()), uv_at)  # mvbuttons.py models them
    bpy.data.objects.remove(shell)
    for name, a in maps.items():
        im = bpy.data.images.new(name, Wd, Hd); im.pixels.foreach_set(a.ravel()); im.pack()
        if name != 'mv_base_even': im.colorspace_settings.name = 'Non-Color'


def plastic_maps(m):
    """Base colour, normal and roughness from the mv_*_even maps. The download's metal (about 0) and AO channels read its own UVs,
    which the bake replaces, so they would ship scrambled: metal goes to 0, AO is in mv_base_even."""
    nt = m.node_tree; b = next(x for x in nt.nodes if x.type == 'BSDF_PRINCIPLED')
    next(x for x in nt.nodes if x.type == 'TEX_IMAGE' and x.image.name.startswith('mv_base_')).image = bpy.data.images['mv_base_even']
    for x in nt.nodes:
        if x.type == 'TEX_IMAGE' and x.image.name in EVEN: x.image = bpy.data.images[EVEN[x.image.name]]
    for s in [b.inputs['Metallic']] + [x.inputs['Occlusion'] for x in nt.nodes if x.type == 'GROUP' and 'Occlusion' in x.inputs]:
        for l in list(s.links): nt.links.remove(l)
    b.inputs['Metallic'].default_value = 0.0


def drop_old_buttons():
    """The old monitor's six front buttons are part of baked_crt_cables; under the new bezel they hang in its shadow."""
    me = bpy.data.objects['baked_crt_cables'].data; bm = bmesh.new(); bm.from_mesh(me)
    dead = [f for c, lo, hi in comps(bm) if len(c) == 30 and hi[2] < 0.935 and hi[1] < -0.14 for f in c]
    bmesh.ops.delete(bm, geom=dead, context='FACES'); bm.to_mesh(me); bm.free()
    return len(dead) // 30


def details(mon, z_bottom):
    """TRISH badge where the logo was, and the note."""
    ns = {}
    exec(open(ART + 'crt_details.py').read().split("\nmon = bpy.data")[0].split("\nif 'detail_ink'")[0], ns)
    def place(kind, x, z, proud, ink_v, led_v, size=1.0):
        piece = ns['build_piece'](kind)
        for v in piece.verts:
            wx, wz = x + size * v.co.x, z + size * v.co.z
            v.co = Vector((wx, ns['surface_y'](mon, wx, wz) - proud + v.co.y, wz))
        return piece, ink_v, led_v
    # where the print was (x -0.111, z 1.2405-1.250), grey like it, at its letter height (~9 mm)
    parts = [place('badge', wx(-0.111), 1.2453, 0.00035, 0.85, 0.0, 1.6)]
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
    li['NOTE_TL'], li['NOTE_ANGLE'] = (0.1035, z_bottom - 0.006), math.radians(4)  # the shorter chin: overhangs its edge a little
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
    inner = lambda v: abs(v.co.x - CX) < 0.145 + WIDEN and abs(v.co.z - CZ) < 0.112 + DROP and v.co.y < -0.16
    edges = [e for e in bm.edges if e.is_boundary and all(inner(v) for v in e.verts)]
    nxt = {}
    for e in edges:
        a, b = e.verts; nxt.setdefault(a, []).append(b); nxt.setdefault(b, []).append(a)
    loop = [min(nxt, key=lambda v: v.co.x)]
    while True:
        step = [w for w in nxt[loop[-1]] if len(loop) < 2 or w is not loop[-2]][0]
        if step is loop[0]: return loop
        loop.append(step)


def opening_outline(loop, out=0.0):
    """The opening's outline (`loop`: its (x, z) points), resampled every 2 mm, pushed `out` outward along its normals."""
    pts = np.array(loop + loop[:1])
    s = np.r_[0, np.cumsum(np.linalg.norm(np.diff(pts, axis=0), axis=1))]; t = np.arange(0, s[-1], 0.002)
    p = np.c_[np.interp(t, s, pts[:, 0]), np.interp(t, s, pts[:, 1])]
    d = np.roll(p, -1, 0) - np.roll(p, 1, 0); n = np.c_[d[:, 1], -d[:, 0]] / np.linalg.norm(d, axis=1)[:, None]
    n *= np.sign(np.sum(n * (p - p.mean(0)), axis=1))[:, None]  # outward
    return p + out * n


def mask_ring(mon, loop, y):
    """The tube's black border, as on a real CRT: a dark (detail_ink) ring just behind the picture, from 1 mm inside
    its edge to past the glass's tucked rim, so the glass under the lip shows black, not the hollow shell."""
    a, b = opening_outline(loop, -0.001), opening_outline(loop, TUCK + 0.002)
    bm = bmesh.new(); ink = bm.faces.layers.float.new('detail_ink')
    va, vb = [bm.verts.new((x, y, z)) for x, z in a], [bm.verts.new((x, y, z)) for x, z in b]
    for i in range(len(va)):
        j = (i + 1) % len(va); bm.faces.new((va[i], va[j], vb[j], vb[i]))[ink] = 1.0
    bm.normal_update()
    if sum(f.normal.y for f in bm.faces) > 0: bmesh.ops.reverse_faces(bm, faces=list(bm.faces))
    join_uv(mon, bm, bpy.data.meshes.new('mv_mask'), (-0.112, 1.262))


def box_of(rim):
    xs, zs = rim[:, 0], rim[:, 1]
    return (xs.min() + xs.max()) / 2, (zs.min() + zs.max()) / 2, (xs.max() - xs.min()) / 2, (zs.max() - zs.min()) / 2


def dome(name, rim, box, y_of, rings=24):
    """Domed cap over the outline `rim` (centred on `box`): concentric copies of it to the centre, y from y_of(x, z);
    UV 0-1 over `box`."""
    cx, cz, hx, hz = box
    me = bpy.data.objects[name].data; b = bmesh.new(); uv = b.loops.layers.uv.new('UVMap')
    def vert(x, z):
        return b.verts.new((x, y_of(x, z), z))
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
    even_plastic()
    glass_look()
    buttons = drop_old_buttons()
    mon = fresh(MON, 'mv_src_shell')
    mon.data.materials.clear(); mon.data.materials.append(material_own()); plastic_maps(material_own())
    exec(open(ART + 'mvtex.py').read(), globals())
    globals()['SH'] = mon
    uv0 = uv_at(-0.01, 1.262)[0]
    bm = bmesh.new(); bm.from_mesh(mon.data)
    for name in ('detail_ink', 'led', 'note', 'pen'): bm.faces.layers.float.new(name)
    widen_opening(bm)
    btn = {}; exec(open(ART + 'mvbuttons.py').read(), btn); btn['add'](bm, wx, wz)
    dropped = step_rear(bm) if rear == 'step' else 0
    st = {}; exec(open(ART + 'mvstand.py').read(), st); st['replace'](bm, comps, patch_uv, uv0)
    edge = opening(bm); loop = [(v.co.x, v.co.z) for v in edge]
    y_rim = max(v.co.y for v in edge) + RIM_BACK
    rim, glass_rim = opening_outline(loop), opening_outline(loop, TUCK)
    bm.to_mesh(mon.data); bm.free(); mon.data.update()
    if rear == 'step': join(mon, rear_box(uv0), 'mv_rear')
    box, gbox = box_of(rim), box_of(glass_rim)
    details(mon, box[1] - box[3])
    bm = bmesh.new(); bm.from_mesh(mon.data)  # the font leaves zero-area triangles in the badge
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.calc_area() < 1e-9], context='FACES_ONLY')
    bm.to_mesh(mon.data); bm.free()
    mask_ring(mon, loop, y_rim + 0.0008)
    atlas_strokes(mon)
    sag = y_rim - APEX
    dome('screen_glass', glass_rim, box,
         lambda x, z: y_rim - sag * (1 - ((x - gbox[0]) / gbox[2]) ** 2) * (1 - ((z - gbox[1]) / gbox[3]) ** 2))
    rect('screen_plane', box, y_rim); rect('crt_glow', box, y_rim + 0.003)
    cam = bpy.data.objects['cam_screen']; cam.location = (box[0], y_rim - 0.42 * box[2] / 0.144, box[1])
    M = Matrix.Translation((0, 0, 0.0006))  # lifts everything so the base clears the case top (z 0.87597)
    for n in (MON, 'screen_glass', 'screen_plane', 'crt_glow'): bpy.data.objects[n].data.transform(M)
    cam.location = M @ cam.location
    mon.data.update()
    print(f'built rear {rear}: faces {len(mon.data.polygons)}, rear pieces dropped {dropped}, old buttons dropped {buttons}, '
          f'screen {2000 * box[2]:.1f} x {2000 * box[3]:.1f} mm, opening edge y {y_rim - RIM_BACK:.4f}, rim y {y_rim:.4f}, '
          f'apex y {APEX:.4f}, sag {1000 * sag:.1f} mm, CRT.edge fit {edge_fit(rim, box)}, bulge {sag / box[3]:.3f}, '
          f'cam {tuple(round(c, 4) for c in cam.location)}')
