"""Step 3: name report, the shared UVMap_Light atlas, three diffuse lightmaps
(lamp on, lamp off, screen) and the raw GLB export.

The screen light is baked alone with every screen emitter set to neutral white,
so the site can tint it with the UI's current colour without a re-bake.
Lightmaps are 8-bit, dithered sqrt(sRGB(value / range)); the ranges go to scene extras.
"""
import math
import os

import bmesh
import bpy
import numpy as np

import bake_common as bc

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


def build_uvs(objs, size, margin_px):
    bc.smart_uv(objs, 'UVMap_Light', margin_px / size, texel_weight)
    for o in objs:  # keep UV0 (if any) and UVMap_Light so the lightmap is TEXCOORD_lightmap_uv
        uvs = o.data.uv_layers
        for extra in [u for u in uvs if u.name != 'UVMap_Light' and not u.active_render]:
            uvs.remove(extra)
        o['lightmap_uv'] = uvs.find('UVMap_Light')
    density_report(objs, size)


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


def encode(opts, on_img, off_img, screen_img):
    """Float EXRs -> 8-bit PNGs (see the module docstring); returns the ranges."""
    on, off, scr = (bc.pixels(i)[..., :3] for i in (on_img, off_img, screen_img))
    covered = on.max(-1) > 0
    lamp_range = math.ceil(np.percentile(on.max(-1)[covered], 99.5) * 2) / 2
    y = scr @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    screen_range = math.ceil(np.percentile(y[covered], 99.5) * 20) / 20
    for name, rgb, rng in (('lightmap_lampOn', on, lamp_range), ('lightmap_lampOff', off, lamp_range),
                           ('lightmap_screen', np.repeat(y[..., None], 3, axis=2), screen_range)):
        clipped = (rgb.max(-1)[covered] > rng).mean() * 100
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
    # ~27k islands (each LEGO brick face is one), so the packing gap must stay tiny;
    # the bake still extends edges into the empty space around each island.
    screen_size, gap, margin = (512, 1, 4) if opts.preview else (1024, 2, 16)
    build_uvs(objs, size, gap)

    SCREEN_COLORS.update({n: tuple(bc.bsdf(bpy.data.materials[n]).inputs['Emission Color'].default_value)
                          for n in SCREEN_EMIT}, light_screen=tuple(bpy.data.objects['light_screen'].data.color))
    snap = snapshot_emitters()
    world, black = sc.world, bpy.data.worlds.new('tmp_black')
    black.color = (0, 0, 0)
    states = [
        ('lightmap_lampOn', size, AMBIENT_LIGHTS + LAMP_LIGHTS, AMBIENT_EMIT + LAMP_EMIT, False, world),
        ('lightmap_lampOff', size, AMBIENT_LIGHTS, AMBIENT_EMIT, False, world),
        ('lightmap_screen', screen_size, SCREEN_LIGHTS, SCREEN_EMIT, True, black),
    ]
    bc.begin('lightmaps', len(states))
    baked = []
    for name, px, lights, emitters, white, w in states:
        set_state(snap, lights, emitters, white, w)
        baked.append(bc.bake(opts, name, objs, px, 'DIFFUSE', spp, 'UVMap_Light', 'Linear Rec.709',
                             hdr=True, margin=margin, pass_filter={'DIRECT', 'INDIRECT'}))
    every = AMBIENT_LIGHTS + LAMP_LIGHTS + SCREEN_LIGHTS
    set_state(snap, every, list(snap), False, world)

    print('\n== Lightmap encoding')
    sc['lightmap_range'], sc['lightmap_screen_range'] = encode(opts, *baked)
    export(os.path.join(bc.ROOT, 'export', 'scene-raw-preview.glb' if opts.preview else 'scene-raw.glb'))
