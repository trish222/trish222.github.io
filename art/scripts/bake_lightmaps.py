"""Step 3: name report, the shared UVMap_Light atlas, three diffuse lightmaps
(lamp on, lamp off, screen) and the raw GLB export.

The screen light is baked alone with every screen emitter set to neutral white,
so the site can tint it with the UI's current colour without a re-bake.
Lightmaps are 8-bit, dithered sqrt(sRGB(value / range)); the ranges go to scene extras.
"""
import hashlib
import math
import os

import bmesh
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.interpolate import poly_3d_calc

import bake_common as bc
import bake_only
import bake_window
import export_fixes

CONTRACT = ['screen_plane', 'screen_glass', 'click_crt', 'click_lamp_chain',
            *[f'click_project_0{i}' for i in range(1, 7)], 'click_nameplate', 'click_treehouse',
            'window_view', 'lamp_bulb', 'crt_glow', 'cam_overview', 'cam_screen', 'cam_mobile']

AMBIENT_LIGHTS = ['light_window_fill']
LAMP_LIGHTS = ['light_lamp_key', 'light_lamp_spill', 'light_lamp_reach', 'light_lamp_reach_right',
               'light_right_accent', 'light_treehouse_accent', 'light_fill_right', 'light_bounce_right',
               'light_shade_spec']
SCREEN_LIGHTS = ['light_screen']
AMBIENT_EMIT = ['window_view_night', 'Material.018', 'Material.004']  # city view, LEDs
LAMP_EMIT = ['lamp_bulb_emit', 'lamp_shade']
SCREEN_EMIT = ['screen_win98', 'crt_glow_emit']

HERO, MID, ROOM = 1.0, 0.5, 0.2  # relative lightmap texel density
GROUPS = {
    HERO: ['baked_desk', 'baked_crt_monitor', 'baked_crt_case', 'baked_crt_keyboard', 'baked_crt_keycaps',
           'baked_crt_cables', 'baked_crt_drive', 'baked_crt_panel', 'baked_nameplate', 'baked_nameplate_brass',
           'baked_lamp', 'baked_treehouse', 'baked_floppies', 'baked_floppy_labels'],
    MID: ['baked_notepad', 'baked_paper_sheet', 'baked_paper_stack', 'baked_books', 'baked_mug',
          'baked_icedcoffee_drink', 'baked_icedcoffee_glass', 'baked_pencilcup', 'baked_pencil', 'baked_pen',
          'baked_lamp_chain'],
    ROOM: ['baked_wall', 'baked_floor', 'baked_curtains', 'baked_sill', 'baked_window_frame',
           'baked_window_glass'],
}
WEIGHTS = {name: w for w, names in GROUPS.items() for name in names}
LIGHTMAP_SPP, PREVIEW_SPP = 256, 32
JOINS = {  # bake rule 1: same-material props become one object (mobile draw-call budget)
    'baked_pencilcup': ['baked_pencil', 'baked_pen'],
    'baked_notepad': ['baked_paper_sheet', 'baked_paper_stack'],
    'baked_sill': ['baked_window_frame'],
}
SCREEN_COLORS = {}  # authored emitter colours, restored after the neutral screen bake


def name_report():
    lights = set(AMBIENT_LIGHTS + LAMP_LIGHTS + SCREEN_LIGHTS)
    names = {o.name for o in bpy.context.scene.objects}
    issues = [f'missing contract object: {n}' for n in CONTRACT if n not in names]
    for o in bpy.context.scene.objects:
        if o.name in CONTRACT or (o.type == 'LIGHT' and o.name in lights) or o.name in WEIGHTS:
            continue
        why = 'unclassified light' if o.type == 'LIGHT' else (
            'baked_* mesh missing from WEIGHTS' if o.name.startswith('baked_') else 'not in the contract')
        issues.append(f'{why}: {o.name} ({o.type})')
    return issues


def emit_sockets(mat):
    nodes = mat.node_tree.nodes
    return [n.inputs['Emission Strength'] for n in nodes if n.type == 'BSDF_PRINCIPLED'] + \
           [n.inputs['Strength'] for n in nodes if n.type == 'EMISSION']


def snapshot_emitters():
    known = set(AMBIENT_EMIT + LAMP_EMIT + SCREEN_EMIT)
    for m in bc.materials([o for o in bpy.context.scene.objects if o.type == 'MESH']):
        live = any(s.links or s.default_value > 0 for s in emit_sockets(m))
        if live and m.name not in known:
            raise RuntimeError(f'unclassified emissive material: {m.name}')
    return {name: [(s, s.default_value, s.links[0].from_socket if s.links else None)
                   for s in emit_sockets(bpy.data.materials[name])] for name in known}


def set_state(snap, lights, emitters, screen_white, world):
    """Render only the named lights and emissive materials."""
    for o in bpy.context.scene.objects:
        if o.type == 'LIGHT':
            o.hide_render = o.name not in lights
    for name, socks in snap.items():
        for sock, value, src in socks:
            for link in list(sock.links):
                sock.node.id_data.links.remove(link)
            on = name in emitters
            sock.default_value = value if on else 0
            if on and src:
                sock.node.id_data.links.new(src, sock)
    for name in SCREEN_EMIT:
        sock = bc.bsdf(bpy.data.materials[name]).inputs['Emission Color']
        sock.default_value = (1, 1, 1, 1) if screen_white else SCREEN_COLORS[name]
    bpy.data.objects['light_screen'].data.color = (1, 1, 1) if screen_white else SCREEN_COLORS['light_screen']
    bpy.context.scene.world = world


def texel_weight(o, f):
    if o.name == 'baked_desk':  # the desk top is hero, its sides and legs less so
        return 1.0 if (o.matrix_world.to_3x3() @ f.normal).normalized().z > 0.7 else 0.5
    return WEIGHTS[o.name]


def mug_seams(o):
    """Smart UV cut the mug's walls into panels whose lightmap seams showed as faint
    vertical stripes. Cut it at its sharp edges only; the mesh is already split once
    down the back, behind the handle (away from cam_overview)."""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    for e in bm.edges:
        e.seam = e.is_manifold and e.calc_face_angle() > math.radians(45)
    bm.to_mesh(o.data)
    bm.free()


def pen_on_note(mon):
    """Give each pencil stroke the lightmap texels of the paper under it. As its own
    islands (~1/3 texel per face) it picked up neighbouring dark texels."""
    bm = bmesh.new()
    bm.from_mesh(mon.data)
    uv = bm.loops.layers.uv['UVMap_Light']
    note, pen = bm.faces.layers.float['note'], bm.faces.layers.float['pen']
    paper = [f for f in bm.faces if f[note]]
    tree = BVHTree.FromPolygons([v.co for v in bm.verts], [[v.index for v in f.verts] for f in paper])
    for f in [f for f in bm.faces if f[pen]]:
        for loop in f.loops:
            hit, _, i, _ = tree.find_nearest(loop.vert.co)
            under = paper[i]
            w = poly_3d_calc([v.co for v in under.verts], hit)
            loop[uv].uv = sum((lp[uv].uv * k for lp, k in zip(under.loops, w)), Vector((0, 0)))
    bm.to_mesh(mon.data)
    bm.free()


def strip_pen(mon):
    bm = bmesh.new()
    bm.from_mesh(mon.data)
    pen = bm.faces.layers.float['pen']
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f[pen]], context='FACES')
    bm.to_mesh(mon.data)
    bm.free()


def join_into(target, obj):
    bc.select([target, obj])
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.join()


def atlas_strokes_in(mon):
    """Swap the note's strokes for the ones the lightmap atlas was packed with (lived_in.py,
    ATLAS_LINES), so a text change keeps UVMap_Light. Returns the real strokes, set aside."""
    bc.select([mon])
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='DESELECT')
    bpy.ops.object.mode_set(mode='OBJECT')
    pen = mon.data.attributes['pen'].data
    for p in mon.data.polygons:
        p.select = pen[p.index].value > 0
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.separate(type='SELECTED')
    bpy.ops.object.mode_set(mode='OBJECT')
    real = next(o for o in bpy.context.selected_objects if o is not mon)
    stand_in = bpy.data.objects.new('atlas_strokes', bpy.data.meshes['lived_note_atlas'].copy())
    bpy.context.collection.objects.link(stand_in)
    join_into(mon, stand_in)
    return real


def note_uvs(mon):
    """UVMap_Light corners of the note's paper faces and of its stroke vertices."""
    bm = bmesh.new()
    bm.from_mesh(mon.data)
    uv = bm.loops.layers.uv['UVMap_Light']
    note, pen = bm.faces.layers.float['note'], bm.faces.layers.float['pen']
    paper = [[tuple(lp[uv].uv) for lp in f.loops] for f in bm.faces if f[note]]
    ink = [tuple(lp[uv].uv) for f in bm.faces if f[pen] for lp in f.loops]
    bm.free()
    return paper, ink


def build_uvs(objs, size, margin_px):
    """Packs UVMap_Light; returns its key (uv_key) as packed, before the real strokes return,
    and the note's UVs for unink()."""
    mug = bpy.data.objects['baked_mug']
    mug_seams(mug)
    mon = bpy.data.objects['baked_crt_monitor']
    real = atlas_strokes_in(mon)
    bc.smart_uv(objs, 'UVMap_Light', margin_px / size, texel_weight, seamed=[mug])
    pen_on_note(mon)
    key = uv_key(objs)
    paper, ink = note_uvs(mon)
    strip_pen(mon)
    join_into(mon, real)
    pen_on_note(mon)
    ink += note_uvs(mon)[1]
    for o in objs:  # keep UV0 (if any) and UVMap_Light so the lightmap is TEXCOORD_lightmap_uv
        uvs = o.data.uv_layers
        for extra in [u for u in uvs if u.name != 'UVMap_Light' and not u.active_render]:
            uvs.remove(extra)
        o['lightmap_uv'] = uvs.find('UVMap_Light')
    density_report(objs, size)
    return key, (paper, ink)


def density_report(objs, size):
    print(f'\n== Lightmap texel density at {size} px (px per cm)')
    for w, names in GROUPS.items():
        px2 = cm2 = 0.0
        for name in [n for n in names if n in bpy.data.objects]:
            o = bpy.data.objects[name]
            bm = bmesh.new()
            bm.from_mesh(o.data)
            bm.transform(o.matrix_world)
            uv = bm.loops.layers.uv['UVMap_Light']
            for f in bm.faces:
                c = [loop[uv].uv for loop in f.loops]
                px2 += abs(sum(a.x * b.y - b.x * a.y for a, b in zip(c, c[1:] + c[:1]))) / 2 * size * size
                cm2 += f.calc_area() * 1e4
            bm.free()
        print(f'  weight {w}: {math.sqrt(px2 / cm2):.2f} px/cm over {cm2 / 1e4:.2f} m2 ({len(names)} objects)')


def uv_key(objs):
    h = hashlib.sha1()
    for o in objs:
        uv = np.empty(len(o.data.loops) * 2, np.float32)
        o.data.uv_layers['UVMap_Light'].data.foreach_get('uv', uv)
        h.update(o.name.encode() + uv.tobytes())
    return h.hexdigest()


def unink(rgb, note):
    """The strokes share the paper's texels (pen_on_note), so the bake wrote their own darker
    light there: the text showed as a blurred shadow, and a ghost once the text changed.
    Refill those paper texels (one texel of margin) from the paper light around them."""
    paper, ink = note
    size = rgb.shape[0]
    inside = np.zeros((size, size), bool)
    for poly in paper:
        p = np.array(poly) * size - 0.5  # texel-centre coordinates
        (x0, y0), (x1, y1) = np.floor(p.min(0)).astype(int), np.ceil(p.max(0)).astype(int) + 1
        ys, xs = np.mgrid[y0:y1, x0:x1]
        for a, b, c in ((p[0], p[i], p[i + 1]) for i in range(1, len(p) - 1)):
            d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
            if d:
                l1 = ((b[1] - c[1]) * (xs - c[0]) + (c[0] - b[0]) * (ys - c[1])) / d
                l2 = ((c[1] - a[1]) * (xs - c[0]) + (a[0] - c[0]) * (ys - c[1])) / d
                hit = (l1 >= -1e-6) & (l2 >= -1e-6) & (l1 + l2 <= 1 + 1e-6)
                inside[ys[hit], xs[hit]] = True
    hole = np.zeros_like(inside)
    t = np.clip((np.array(ink) * size).astype(int), 0, size - 1)
    hole[t[:, 1], t[:, 0]] = True
    hole = np.pad(hole, 1)
    hole = np.logical_or.reduce([hole[1 + dy:size + 1 + dy, 1 + dx:size + 1 + dx]
                                 for dy in (-1, 0, 1) for dx in (-1, 0, 1)]) & inside
    out = rgb.copy()
    out[hole] = rgb[inside & ~hole].mean(0)
    for _ in range(400):  # Jacobi: each hole texel becomes the mean of its paper neighbours
        acc, n = np.zeros_like(out), np.zeros(inside.shape + (1,), np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            m = np.roll(inside, (dy, dx), (0, 1))[..., None]
            acc += np.roll(out, (dy, dx), (0, 1)) * m
            n += m
        out[hole] = (acc / np.maximum(n, 1))[hole]
    return out


def encode(opts, on_img, off_img, screen_img, note):
    """Float EXRs -> 8-bit PNGs (see the module docstring); returns the ranges."""
    on, off, scr = (unink(bc.pixels(i)[..., :3], note) for i in (on_img, off_img, screen_img))
    on_covered = on.max(-1) > 0

    def covered(rgb):  # the shared atlas, so lamp-on coverage strided down to this map's size
        k = on.shape[0] // rgb.shape[0]
        return on_covered[::k, ::k]

    lamp_range = math.ceil(np.percentile(on.max(-1)[on_covered], 99.5) * 2) / 2
    y = scr @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    screen_range = math.ceil(np.percentile(y[covered(y)], 99.5) * 20) / 20
    for name, rgb, rng in (('lightmap_lampOn', on, lamp_range), ('lightmap_lampOff', off, lamp_range),
                           ('lightmap_screen', np.repeat(y[..., None], 3, axis=2), screen_range)):
        clipped = (rgb.max(-1)[covered(rgb)] > rng).mean() * 100
        bc.save_png(name + '_png', bc.quantise(np.sqrt(bc.srgb(rgb / rng))), os.path.join(opts.out, name + '.png'))
        print(f'  {name}: range {rng}, {clipped:.2f}% of covered texels clipped')
    return lamp_range, screen_range


def export(path):
    for m in bpy.data.materials:  # restored Poly Haven normals only served the bake
        if m.node_tree:
            for n in [n for n in m.node_tree.nodes if n.label == 'restored']:
                m.node_tree.nodes.remove(n)
    bpy.data.images['DefaultMaterial_metallicRoughness.png'].scale(1024, 1024)  # texture budget
    sc = bpy.context.scene
    for key in [k for k in sc.keys() if not k.startswith('lightmap_')]:  # add-on and script state
        del sc[key]
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_yup=True, export_extras=True,
                              export_apply=True, export_cameras=True, export_lights=False,
                              export_vertex_color='MATERIAL', export_attributes=False)
    print(f'exported {os.path.relpath(path, bc.ROOT)} ({os.path.getsize(path) / 1e6:.2f} MB)')


def join_props():
    for target, parts in JOINS.items():
        bpy.ops.object.select_all(action='DESELECT')
        for name in [target, *parts]:
            bpy.data.objects[name].select_set(True)
        bpy.context.view_layer.objects.active = bpy.data.objects[target]
        bpy.ops.object.join()


def run(opts):
    sc = bpy.context.scene
    join_props()
    objs = [bpy.data.objects[n] for n in WEIGHTS if n in bpy.data.objects]
    size, spp = (512, PREVIEW_SPP) if opts.preview else (2048, LIGHTMAP_SPP)
    # ~27k islands (each LEGO brick face is one), so the packing gap must stay tiny.
    # Blender applies the bake margin per object, over texels other objects already
    # baked, so it may fill at most half the gap: a 16 px margin smeared neighbouring
    # islands across the CRT parts' slivers (chrome-like streaks on keys and drive bays).
    screen_size, gap = (512, 1) if opts.preview else (1024, 2)  # 2 px at 512 shrinks every island to nothing
    key, note = build_uvs(objs, size, gap)

    bc.begin('lightmaps', 4)
    window = bake_window.bake(opts)
    SCREEN_COLORS.update({n: tuple(bc.bsdf(bpy.data.materials[n]).inputs['Emission Color'].default_value)
                          for n in SCREEN_EMIT}, light_screen=tuple(bpy.data.objects['light_screen'].data.color))
    snap = snapshot_emitters()
    world, black = sc.world, bpy.data.worlds.new('tmp_black')
    black.color = (0, 0, 0)
    # Lightmaps from another atlas would load fine and shade every texel wrongly.
    key_path = os.path.join(opts.out, 'lightmap_uv.sha1')
    if not os.path.exists(key_path) or open(key_path).read() != key:
        print('UVMap_Light changed since the last lightmap bake: re-baking all lightmaps')
        opts.force_maps |= {'lightmap_lampOn', 'lightmap_lampOff', 'lightmap_screen'}
    states = [
        ('lightmap_lampOn', size, AMBIENT_LIGHTS + LAMP_LIGHTS, AMBIENT_EMIT + LAMP_EMIT, False, world),
        ('lightmap_lampOff', size, AMBIENT_LIGHTS, AMBIENT_EMIT, False, world),
        ('lightmap_screen', screen_size, SCREEN_LIGHTS, SCREEN_EMIT, True, black),
    ]
    baked = []
    tricks = [bake_only.glass_shadow(), bake_only.pen_shadowless()]
    for name, px, lights, emitters, white, w in states:
        set_state(snap, lights, emitters, white, w)
        baked.append(bc.bake(opts, name, objs, px, 'DIFFUSE', spp, 'UVMap_Light', 'Linear Rec.709',
                             hdr=True, margin=gap * px // size // 2, pass_filter={'DIRECT', 'INDIRECT'}))
    for t in tricks:
        t.restore()
    with open(key_path, 'w') as f:
        f.write(key)
    every = AMBIENT_LIGHTS + LAMP_LIGHTS + SCREEN_LIGHTS
    set_state(snap, every, list(snap), False, world)

    print('\n== Lightmap encoding')
    sc['lightmap_range'], sc['lightmap_screen_range'] = encode(opts, *baked, note)
    bake_window.use_image(window)
    export_fixes.run(opts)
    export(os.path.join(bc.ROOT, 'export', 'scene-raw-preview.glb' if opts.preview else 'scene-raw.glb'))
