"""Export-only fixes, after the lightmaps (so they stay valid): glTF drops procedural
roughness/metallic (exports 1.0) and the lamp shade's emission. Swap in what it can carry.
"""
import bpy

import bake_common as bc
import bake_details

# Noise-driven Map Range outputs at the noise mean (0.5); the trim's are face-area means of
# its metallicRoughness texels through max(B, 0.6) and G x 0.865 x 0.975 (see FACTOR).
CONSTANTS = {
    'lamp_shade': {'Roughness': 0.08, 'Coat Roughness': 0.04},
    'lamp_trim_brass': {'Metallic': 0.78, 'Roughness': 0.37},
    'brass': {'Roughness': 0.28},
    'nameplate_brass': {'Roughness': 0.32},
}
FACTOR = 0.843  # DefaultMaterial roughness = G x 0.865 x noise remap (mean 0.975)
EMIT_PX = 512


def set_constants():
    for name, inputs in CONSTANTS.items():
        mat = bpy.data.materials[name]
        for key, value in inputs.items():
            sock = bc.bsdf(mat).inputs[key]
            for link in list(sock.links):
                mat.node_tree.links.remove(link)
            sock.default_value = value


def roughness_factor():
    """A single Math Multiply after the G channel is a form the exporter turns into roughnessFactor."""
    mat = bpy.data.materials['DefaultMaterial']
    nt, sock = mat.node_tree, bc.bsdf(mat).inputs['Roughness']
    sep = next(n for n in nt.nodes if n.type == 'SEPARATE_COLOR')
    mul = nt.nodes.new('ShaderNodeMath')
    mul.operation = 'MULTIPLY'
    mul.inputs[1].default_value = FACTOR
    nt.links.new(sep.outputs['Green'], mul.inputs[0])
    nt.links.new(mul.outputs[0], sock)


def shade_emission(opts):
    """The shade's lamp-on glow (green body, warm underside) as an emissive map on UV0."""
    lamp = bpy.data.objects['baked_lamp']
    bc.begin('export fixes', 1)
    exr = bc.bake(opts, 'emit_lamp', [lamp], opts.px(EMIT_PX), 'EMIT', 16, lamp.data.uv_layers[0].name,
                  'Linear Rec.709', hdr=True)
    img, strength = bake_details.emissive_png('emit_lamp', exr)
    mat = bpy.data.materials['lamp_shade']
    b = bc.bsdf(mat)
    for sock in (b.inputs['Emission Color'], b.inputs['Emission Strength']):
        for link in list(sock.links):
            mat.node_tree.links.remove(link)
    bake_details.tex(mat.node_tree, img, b.inputs['Emission Color'])
    b.inputs['Emission Strength'].default_value = strength
    print(f'  lamp_shade: emissive strength {strength:.3f}')


def run(opts):
    shade_emission(opts)
    set_constants()
    roughness_factor()
