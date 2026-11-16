"""Step 2: the CRT detail pass from crt_details.py (plastic_detail) as images on
UV0: micro-grain bump to a tangent normal map, noise roughness to a roughness
map, and the LED glow to an emissive map. Materials keep their slots, and once
nothing reads the face attributes the exporter leaves them out.
"""
import os

import bpy

import bake_common as bc

# (unit, objects, normal/roughness px, emissive px or 0 for no LEDs)
# Sized to the texture-memory budget: one step up overshoots 256 MB desktop / 128 MB mobile.
UNITS = [
    ('crt_monitor', ['baked_crt_monitor'], 512, 512),
    ('crt_case', ['baked_crt_case'], 256, 0),
    ('crt_cables', ['baked_crt_cables', 'baked_crt_drive'], 256, 256),
    ('crt_keyboard', ['baked_crt_keyboard'], 256, 0),
    ('crt_keycaps', ['baked_crt_keycaps'], 256, 0),
]
SPP = 16


def tex(nt, img, sock):
    n = nt.nodes.new('ShaderNodeTexImage')
    n.image = img
    nt.links.new(n.outputs['Color'], sock)
    return n


def emissive_png(name, exr):
    """EXR glow -> PNG scaled into 0-1; returns (image, strength) for the material."""
    rgb = bc.pixels(exr)[..., :3]
    peak = float(rgb.max())
    assert peak > 0, f'{name}: emissive bake is black'
    path = os.path.join(os.path.dirname(exr.filepath_raw), name + '.png')
    return bc.save_png(name, bc.srgb(rgb / peak), path), peak


def rewire(mat, normal, rough, emit):
    nt, b = mat.node_tree, bc.bsdf(mat)
    nmap = nt.nodes.new('ShaderNodeNormalMap')
    nt.links.new(nmap.outputs['Normal'], b.inputs['Normal'])
    tex(nt, normal, nmap.inputs['Color'])
    sep = nt.nodes.new('ShaderNodeSeparateColor')
    nt.links.new(sep.outputs['Green'], b.inputs['Roughness'])
    tex(nt, rough, sep.inputs['Color'])
    for sock in (b.inputs['Emission Color'], b.inputs['Emission Strength']):
        for link in list(sock.links):
            nt.links.remove(link)
    if emit:
        img, strength = emit
        tex(nt, img, b.inputs['Emission Color'])
        b.inputs['Emission Strength'].default_value = strength
    else:
        b.inputs['Emission Strength'].default_value = 0


def run(opts):
    bc.begin('details', sum(2 + bool(e) for *_, e in UNITS))
    for unit, obj_names, px, emit_px in UNITS:
        objs = [bpy.data.objects[n] for n in obj_names]
        uv = objs[0].data.uv_layers[0].name
        size = opts.px(px)
        normal = bc.bake(opts, f'normal_{unit}', objs, size, 'NORMAL', opts.spp(SPP), uv, 'Non-Color')
        rough = bc.bake(opts, f'rough_{unit}', objs, size, 'ROUGHNESS', opts.spp(SPP), uv, 'Non-Color')
        emit = None
        if emit_px:
            exr = bc.bake(opts, f'emit_{unit}', objs, opts.px(emit_px), 'EMIT', opts.spp(SPP), uv,
                          'Linear Rec.709', hdr=True)
            emit = emissive_png(f'emit_{unit}', exr)
            print(f'  {unit}: LED emissive strength {emit[1]:.2f}')
        for m in bc.materials(objs):
            rewire(m, normal, rough, emit)
        for o in objs:  # every slot now reads the same images (keyboard + mouse): one draw call
            for p in o.data.polygons:
                p.material_index = 0
            while len(o.data.materials) > 1:
                o.data.materials.pop(index=1)
