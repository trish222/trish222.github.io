"""B2 preview: render the exported GLB the way the site will shade it, with
albedo x lightmap (plus the tinted screen map) as unlit emission and no lights.

  blender -b --factory-startup -P art/scripts/preview_baked.py -- GLB BAKES_DIR OUT_PREFIX

Writes OUT_PREFIX-lampOn.png and OUT_PREFIX-lampOff.png from cam_overview, with
the reference renders' view settings (AgX, no look, exposure 0, gamma 1) so they compare 1:1.
The metals in scene-contract's reflection list get what three.js will give them: a
(1 - metallic) share of the lightmap plus their own BSDF lit only by the scene HDRI
(unoccluded, like an envMap). Glass shows no reflections.
"""
import os
import sys

import bpy
import numpy as np

GLB, BAKES, OUT = sys.argv[sys.argv.index('--') + 1:]
SCREEN_TINT = (0.25, 0.85, 0.85, 1)  # light_screen's authored teal
REFLECTIVE = ['baked_lamp', 'baked_lamp_chain', 'baked_nameplate_brass']  # the metals in the reflection list
HDRI = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'textures', 'shanghai_bund_4k.hdr')
HDRI_STRENGTH = 0.04  # scene.blend's world


def decoded(name):
    """The site's decode (scene-contract "Lightmaps"): square, then sRGB -> linear; range applied below."""
    src = bpy.data.images.load(os.path.join(BAKES, f'lightmap_{name}.png'))
    src.colorspace_settings.name = 'Non-Color'
    a = np.empty(src.size[0] * src.size[1] * 4, np.float32)
    src.pixels.foreach_get(a)
    s = a.reshape(-1, 4)[:, :3] ** 2
    a.reshape(-1, 4)[:, :3] = np.where(s <= 0.04045, s / 12.92, ((s + 0.055) / 1.055) ** 2.4)
    img = bpy.data.images.new(f'lightmap_{name}_linear', *src.size, float_buffer=True)
    img.colorspace_settings.name = 'Linear Rec.709'
    img.pixels.foreach_set(a)
    return img


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)
sc = bpy.context.scene
lamp_range, screen_range = sc['lightmap_range'], sc['lightmap_screen_range']
maps = {n: decoded(n) for n in ('lampOn', 'lampOff', 'screen')}


def lightmapped(mat, uv_name, metal):
    """Copy of mat that emits albedo x (lamp lightmap x range + tint x screen x screen range);
    a metal keeps its BSDF for the HDRI and emits only its (1 - metallic) diffuse share."""
    m = mat.copy()
    nt = m.node_tree
    b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    uv = nt.nodes.new('ShaderNodeUVMap')
    uv.uv_map = uv_name
    lamp, screen = nt.nodes.new('ShaderNodeTexImage'), nt.nodes.new('ShaderNodeTexImage')
    lamp.image, screen.image, lamp.label = maps['lampOn'], maps['screen'], 'lamp_lightmap'
    for t in (lamp, screen):
        nt.links.new(uv.outputs['UV'], t.inputs['Vector'])
    def mul(a, b_sock_or_val):
        n = nt.nodes.new('ShaderNodeMix')
        n.data_type, n.blend_type = 'RGBA', 'MULTIPLY'
        n.inputs['Factor'].default_value = 1
        nt.links.new(a, n.inputs['A'])
        if isinstance(b_sock_or_val, bpy.types.NodeSocket):
            nt.links.new(b_sock_or_val, n.inputs['B'])
        else:
            n.inputs['B'].default_value = b_sock_or_val
        return n.outputs['Result']
    light = nt.nodes.new('ShaderNodeMix')
    light.data_type, light.blend_type = 'RGBA', 'ADD'
    light.inputs['Factor'].default_value = 1
    nt.links.new(mul(lamp.outputs['Color'], (lamp_range,) * 3 + (1,)), light.inputs['A'])
    tint = tuple(c * screen_range for c in SCREEN_TINT[:3]) + (1,)
    nt.links.new(mul(screen.outputs['Color'], tint), light.inputs['B'])
    base = b.inputs['Base Color']
    albedo = base.links[0].from_socket if base.links else None
    em = nt.nodes.new('ShaderNodeEmission')
    lit = mul(light.outputs['Result'], albedo or tuple(base.default_value))
    surface = em.outputs[0]
    if metal:
        m_in = b.inputs['Metallic']
        diffuse = nt.nodes.new('ShaderNodeMath')
        diffuse.operation, diffuse.inputs[0].default_value = 'SUBTRACT', 1
        if m_in.links:
            nt.links.new(m_in.links[0].from_socket, diffuse.inputs[1])
        else:
            diffuse.inputs[1].default_value = m_in.default_value
        lit = mul(lit, diffuse.outputs[0])
        add = nt.nodes.new('ShaderNodeAddShader')
        nt.links.new(em.outputs[0], add.inputs[0])
        nt.links.new(b.outputs[0], add.inputs[1])
        surface = add.outputs[0]
    nt.links.new(lit, em.inputs['Color'])
    mix, clear = nt.nodes.new('ShaderNodeMixShader'), nt.nodes.new('ShaderNodeBsdfTransparent')
    alpha = b.inputs['Alpha']
    if alpha.links:
        nt.links.new(alpha.links[0].from_socket, mix.inputs['Fac'])
    else:
        mix.inputs['Fac'].default_value = alpha.default_value
    nt.links.new(clear.outputs[0], mix.inputs[1])
    nt.links.new(surface, mix.inputs[2])
    out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
    nt.links.new(mix.outputs[0], out.inputs['Surface'])
    return m


for o in sc.objects:
    if o.type == 'MESH' and 'lightmap_uv' in o:
        uv_name = o.data.uv_layers[o['lightmap_uv']].name
        for s in o.material_slots:
            m_in = next(n for n in s.material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Metallic']
            metal = o.name in REFLECTIVE and (m_in.is_linked or m_in.default_value > 0)  # not the lamp shade
            s.link, s.material = 'OBJECT', lightmapped(s.material, uv_name, metal)
    if o.name.startswith('click_') or o.name == 'screen_glass':  # the site gives the glass its own material
        o.hide_render = True

# The GLB ships the city view already through AgX (bake_window.py); render the
# scene-referred bake instead so this render's own AgX doesn't apply twice.
for n in bpy.data.objects['window_view'].active_material.node_tree.nodes:
    if n.type == 'TEX_IMAGE':
        n.image = bpy.data.images.load(os.path.join(BAKES, 'emit_window_view.exr'))

sc.world = bpy.data.worlds.new('hdri')
sc.world.use_nodes = True
wn = sc.world.node_tree
env, bg = wn.nodes.new('ShaderNodeTexEnvironment'), next(n for n in wn.nodes if n.type == 'BACKGROUND')
env.image = bpy.data.images.load(HDRI)
wn.links.new(env.outputs['Color'], bg.inputs['Color'])
strength = wn.nodes.new('ShaderNodeMath')  # HDRI_STRENGTH, but black to the camera
strength.operation = 'MULTIPLY_ADD'
wn.links.new(wn.nodes.new('ShaderNodeLightPath').outputs['Is Camera Ray'], strength.inputs[0])
strength.inputs[1].default_value, strength.inputs[2].default_value = -HDRI_STRENGTH, HDRI_STRENGTH
wn.links.new(strength.outputs[0], bg.inputs['Strength'])
for o in sc.objects:  # an envMap is not occluded by the room
    o.visible_diffuse = o.visible_glossy = False
sc.camera = next(o for o in sc.objects if o.type == 'CAMERA' and o.name.startswith('cam_overview'))
sc.render.engine = 'CYCLES'
sc.cycles.samples = 32
sc.render.resolution_x, sc.render.resolution_y = 1920, 1080
sc.render.resolution_percentage = 50
sc.display_settings.display_device = 'sRGB'
sc.view_settings.view_transform, sc.view_settings.look = 'AgX', 'None'
sc.view_settings.exposure, sc.view_settings.gamma = 0, 1
print('preview_baked: AgX like the Cycles reference; metals reflect the HDRI only, glass is unlit')
bulb = next(n for n in bpy.data.objects['lamp_bulb'].active_material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
bulb_strength = bulb.inputs['Emission Strength'].default_value
for state in ('lampOn', 'lampOff'):
    for m in bpy.data.materials:
        for n in m.node_tree.nodes if m.node_tree else []:
            if n.label == 'lamp_lightmap':
                n.image = maps[state]
    bulb.inputs['Emission Strength'].default_value = bulb_strength if state == 'lampOn' else 0
    sc.render.filepath = f'{OUT}-{state}.png'
    bpy.ops.render.render(write_still=True)
    print('wrote', sc.render.filepath)
