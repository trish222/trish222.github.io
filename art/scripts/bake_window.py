"""window_view's city view. Its colour grade (desaturate, gamma, sodium tint, bokeh
jitter) is procedural, so the exporter used to ship the raw HDR crop clipped to 8 bits:
posterized, with garish neon. The graded emission is baked instead.

The view spans ~17 stops (sky ~0.007, neon cores in the hundreds), more than 8 bits
hold linearly, so the shipped image is display-referred: the scene's AgX view
transform applied, as in the reference renders. The site shows it unlit and without
tone mapping.

While the lightmaps bake, the window emits its mean colour (the same power): Cycles
can't importance-sample the texture on one big emitter, so its few hot texels came
out as fireflies on the curtains.
"""
import os

import bpy

import bake_common as bc

PX, SPP = 1024, 64  # ~ the 1272x744 crop it replaces; samples average the bokeh jitter


def emission():
    nt = bpy.data.objects['window_view'].active_material.node_tree
    return nt, next(n for n in nt.nodes if n.type == 'EMISSION')


def bake(opts):
    """Bake the graded view to EXR and an AgX PNG; returns the PNG path."""
    o = bpy.data.objects['window_view']
    bc.bake(opts, 'emit_window_view', [o], opts.px(PX), 'EMIT', opts.spp(SPP),
            o.data.uv_layers[0].name, 'Linear Rec.709', hdr=True)
    # A fresh bake's in-memory image reads ~80x the saved EXR (mean ~23 vs 0.28, the
    # true emission), so both paths read the file. Not bc.load: check_existing would
    # return that in-memory image.
    exr_path = os.path.join(opts.out, 'emit_window_view.exr')
    sc = bpy.context.scene
    fmt = sc.render.image_settings
    fmt.file_format, fmt.color_mode, fmt.color_depth = 'PNG', 'RGB', '8'
    path = os.path.join(opts.out, 'emit_window_view.png')
    # Through the scene's view transform (AgX), with the EXR's default tag: that reading
    # is what Cycles renders (it matches r14). The Linear retag below reads ~80x darker,
    # and AgX then lifts the night sky to a flat grey.
    bpy.data.images.load(exr_path, check_existing=False).save_render(path, scene=sc)
    exr = bpy.data.images.load(exr_path)
    exr.colorspace_settings.name = 'Linear Rec.709'
    nt, em = emission()
    for link in list(em.inputs['Color'].links):
        nt.links.remove(link)
    em.inputs['Color'].default_value = (*bc.pixels(exr)[..., :3].mean((0, 1)), 1)
    em.inputs['Strength'].default_value = 1
    return path


def use_image(path):
    """After the lightmap bakes: emit the AgX image, which is what the GLB ships."""
    nt, em = emission()
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = bc.load(path)
    nt.links.new(tex.outputs['Color'], em.inputs['Color'])
