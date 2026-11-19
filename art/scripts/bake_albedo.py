"""Step 1: restore the source normal maps (so the lightmap bake sees surface
detail; bake_lightmaps strips them before export), then bake every procedural
base colour to an image on UV0 so it survives the glTF export.

Roughness maps are not restored: the lightmap bake is diffuse-only, so they
would change nothing and be stripped anyway.
"""
import os

import bpy
import numpy as np

import bake_common as bc

NORMALS = {  # material -> art/textures file (Poly Haven CC0; the lamp's from its Sketchfab source)
    'WoodenTable_01': 'WoodenTable_01_nor_gl_2k.jpg',
    'painted_plaster_wall_material_baked_wall': 'painted_plaster_wall_nor_gl_2k.jpg',
    'plank_flooring_04_material_baked_floor': 'plank_flooring_04_nor_gl_2k.jpg',
    'book_encyclopedia_set_01_cover': 'book_encyclopedia_set_01_cover_nor_gl_1k.jpg',
    'book_encyclopedia_set_01_paper': 'book_encyclopedia_set_01_paper_nor_gl_1k.jpg',
    'office_notepads': 'office_notepads_nor_gl_1k.jpg',
    'stationery_supplies': 'stationery_supplies_nor_gl_1k.jpg',
    'DefaultMaterial': 'DefaultMaterial_normal.png',
    'lamp_trim_brass': 'DefaultMaterial_normal.png',
}

# (map, objects sharing one UV0 atlas, px, needs a fresh Smart UV0). Every material
# on the unit bakes into the one image, so the texture count barely changes.
UNITS = [
    ('albedo_crt_monitor', ['baked_crt_monitor'], 2048, False),
    ('albedo_crt_case', ['baked_crt_case'], 1024, False),
    ('albedo_crt_cables', ['baked_crt_cables', 'baked_crt_drive'], 1024, False),
    ('albedo_crt_keyboard', ['baked_crt_keyboard'], 1024, False),
    ('albedo_crt_keycaps', ['baked_crt_keycaps'], 1024, False),
    ('albedo_crt_panel', ['baked_crt_panel'], 512, False),
    ('albedo_desk', ['baked_desk'], 2048, False),  # the nameplate reuses it on its tiled UVs
    ('albedo_lamp', ['baked_lamp'], 2048, False),
    ('albedo_notepads', ['baked_notepad', 'baked_paper_sheet', 'baked_paper_stack'], 1024, False),
    ('albedo_mug', ['baked_mug'], 1024, True),  # glaze spans all of UV0, under the coffee disc
    ('albedo_icedcoffee', ['baked_icedcoffee_drink'], 512, True),
    ('albedo_lamp_chain', ['baked_lamp_chain'], 256, True),
    ('albedo_walnut', ['baked_sill', 'baked_window_frame'], 1024, True),  # replaces tiled UVs
]
SPP = 64  # AO grime in plastic_detail needs samples to converge
DETAIL_WEIGHT = 8  # texel density of zero-UV details (note writing, badge, LED) vs the body
# Objects with a fresh UV0, adopted by bake_details once it has baked them: until then their image
# textures (the MasterView's normal map) still read the old UV0.
ADOPT = []


def upstream_image(sock, seen=None):
    seen = seen if seen is not None else set()
    for link in sock.links:
        n = link.from_node
        if n.name in seen:
            continue
        seen.add(n.name)
        if n.type == 'TEX_IMAGE':
            return n
        for s in n.inputs:
            found = upstream_image(s, seen)
            if found:
                return found
    return None


def restore_normals():
    for mat_name, file in NORMALS.items():
        path = os.path.join(bc.ROOT, 'textures', file)
        if not os.path.exists(path):
            raise FileNotFoundError(f'{path}: download it from Poly Haven (see TODO P2 note)')
        mat = bpy.data.materials[mat_name]
        nt, b = mat.node_tree, bc.bsdf(mat)
        base = upstream_image(b.inputs['Base Color'])
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.image = bc.load(path, 'Non-Color')
        nmap = nt.nodes.new('ShaderNodeNormalMap')
        tex.label = nmap.label = 'restored'
        if base.inputs['Vector'].links:
            nt.links.new(base.inputs['Vector'].links[0].from_socket, tex.inputs['Vector'])
        nt.links.new(tex.outputs['Color'], nmap.inputs['Color'])
        target = b.inputs['Normal']
        if target.links and target.links[0].from_node.type == 'BUMP':
            target = target.links[0].from_node.inputs['Normal']
        nt.links.new(nmap.outputs['Normal'], target)


def fresh_uv0(objs, weight):
    """Bake target UV for units whose UV0 can't hold their albedo: tiled, missing, or
    with details that crt_details.py / lived_in.py added at zero UV area."""
    bc.smart_uv(objs, 'UVMap_bake', 0.004, weight)


def adopt_uv0(objs):
    """After the bake: the fresh layer becomes the only UV0."""
    for o in objs:
        uvs = o.data.uv_layers
        for old in [u for u in uvs if u.name != 'UVMap_bake']:
            uvs.remove(old)
        uvs['UVMap_bake'].name = 'UVMap'
        uvs['UVMap'].active_render = True


def route_to_emission(mats):
    """Feed each Base Color into an Emission shader so an EMIT bake captures albedo."""
    undo = []
    for m in mats:
        nt, b = m.node_tree, bc.bsdf(m)
        out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL' and n.is_active_output)
        prev = out.inputs['Surface'].links[0].from_socket
        em = nt.nodes.new('ShaderNodeEmission')
        src = b.inputs['Base Color']
        if src.links:
            nt.links.new(src.links[0].from_socket, em.inputs['Color'])
        else:
            em.inputs['Color'].default_value = src.default_value
        nt.links.new(em.outputs[0], out.inputs['Surface'])
        undo.append((nt, em, prev, out))
    return undo


def use_image(mats, img):
    for m in mats:
        tex = m.node_tree.nodes.new('ShaderNodeTexImage')
        tex.image = img
        m.node_tree.links.new(tex.outputs['Color'], bc.bsdf(m).inputs['Base Color'])


def glass_alpha(opts):
    """icedcoffee_glass maps its condensation mask to alpha 0.12-0.2 with a Map Range,
    which glTF drops, so the raw mask shipped and the drops rendered opaque. Write the
    remapped alpha into its own image instead."""
    mat = bpy.data.materials['icedcoffee_glass']
    nt = mat.node_tree
    rng = next(n for n in nt.nodes if n.type == 'MAP_RANGE')
    tex = rng.inputs['Value'].links[0].from_node
    s = bc.pixels(tex.image)[..., :1]
    mask = np.where(s <= 0.04045, s / 12.92, ((s + 0.055) / 1.055) ** 2.4)  # sRGB, as the shader reads it
    lo, hi = rng.inputs['To Min'].default_value, rng.inputs['To Max'].default_value
    tex.image = bc.save_png('alpha_icedcoffee_glass', np.repeat(lo + (hi - lo) * mask, 3, -1),
                            os.path.join(opts.out, 'alpha_icedcoffee_glass.png'))
    nt.links.new(tex.outputs['Color'], bc.bsdf(mat).inputs['Alpha'])
    nt.nodes.remove(rng)


def run(opts):
    restore_normals()
    glass_alpha(opts)
    bc.begin('albedo', len(UNITS))
    for name, obj_names, px, new_uv in UNITS:
        objs = [bpy.data.objects[n] for n in obj_names]
        zero = {o.name: bc.zero_uv_faces(o) for o in objs if o.data.uv_layers}
        fresh = new_uv or any(zero.values())
        if fresh:
            print(f'  {name}: fresh UV0' + ''.join(f', {len(z)} zero-UV faces on {n} at {DETAIL_WEIGHT}x'
                                                   for n, z in zero.items() if z))
            fresh_uv0(objs, (lambda o, f: DETAIL_WEIGHT if f.index in zero.get(o.name, ()) else 1.0)
                      if any(zero.values()) else None)
        mats = bc.materials(objs)
        undo = route_to_emission(mats)
        uv0 = {o.name: next(u.name for u in o.data.uv_layers if u.active_render) for o in objs}
        assert len(set(uv0.values())) == 1, f'{name}: objects disagree on UV0 {uv0}'
        img = bc.bake(opts, name, objs, opts.px(px), 'EMIT', opts.spp(SPP),
                      'UVMap_bake' if fresh else next(iter(uv0.values())))
        for nt, em, prev, out in undo:
            nt.links.new(prev, out.inputs['Surface'])
            nt.nodes.remove(em)
        if fresh:
            ADOPT.extend(objs)
        use_image(mats, img)
        for o in objs:  # baked into the image now; the exporter would still ship them
            for attr in list(o.data.color_attributes):
                o.data.color_attributes.remove(attr)
