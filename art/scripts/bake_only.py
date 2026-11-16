"""Shader tweaks that only the lightmap bake sees; each is removed again before export."""
import bpy

import bake_common as bc

GLASS_SHADOW_ALPHA = 0.9  # iced-coffee glass base, shadow rays only
PEN_MATERIAL = 'Material.018'  # baked_crt_monitor's slot that holds the sticky note


class Tweak:
    """Nodes added to one material, and the links they replaced."""

    def __init__(self, mat):
        self.nt, self.added, self.relinks = mat.node_tree, [], []

    def node(self, kind):
        self.added.append(self.nt.nodes.new(kind))
        return self.added[-1]

    def math(self, op, a, b):
        n = self.node('ShaderNodeMath')
        n.operation = op
        for sock, v in zip(n.inputs, (a, b)):
            if isinstance(v, bpy.types.NodeSocket):
                self.nt.links.new(v, sock)
            else:
                sock.default_value = v
        return n.outputs[0]

    def replace(self, sock, new):
        self.relinks.append((sock.links[0].from_socket, sock))
        self.nt.links.new(new, sock)

    def restore(self):
        for src, sock in self.relinks:
            self.nt.links.new(src, sock)
        for n in self.added:
            self.nt.nodes.remove(n)


def glass_shadow():
    """Shadow rays see the iced-coffee glass's thick base as nearly opaque. At its
    shipped alpha (0.12-0.2) the base cast almost no contact shadow, so the glass
    looked like it floated on the notepad. The walls stay clear so the drink stays lit."""
    drink = bpy.data.objects['baked_icedcoffee_drink']
    base_top = min((drink.matrix_world @ v.co).z for v in drink.data.vertices) + 0.0005  # the drink rests on it
    mat = bpy.data.materials['icedcoffee_glass']
    b = Tweak(mat)
    alpha = bc.bsdf(mat).inputs['Alpha']
    z = b.node('ShaderNodeSeparateXYZ')
    b.nt.links.new(b.node('ShaderNodeNewGeometry').outputs['Position'], z.inputs[0])
    shadow = b.math('MULTIPLY', b.math('LESS_THAN', z.outputs['Z'], base_top),
                    b.node('ShaderNodeLightPath').outputs['Is Shadow Ray'])
    b.replace(alpha, b.math('MAXIMUM', alpha.links[0].from_socket, b.math('MULTIPLY', shadow, GLASS_SHADOW_ALPHA)))
    return b


def pen_shadowless():
    """The pencil film sits 0.2 mm proud of the note, so it cast a dark halo round every stroke."""
    mat = bpy.data.materials[PEN_MATERIAL]
    b = Tweak(mat)
    out = next(n for n in mat.node_tree.nodes if n.type == 'OUTPUT_MATERIAL' and n.is_active_output)
    surface = out.inputs['Surface']
    pen = b.node('ShaderNodeAttribute')
    pen.attribute_name = 'pen'
    mix = b.node('ShaderNodeMixShader')
    b.nt.links.new(b.math('MULTIPLY', b.math('GREATER_THAN', pen.outputs['Fac'], 0),
                          b.node('ShaderNodeLightPath').outputs['Is Shadow Ray']), mix.inputs['Fac'])
    b.nt.links.new(surface.links[0].from_socket, mix.inputs[1])
    b.nt.links.new(b.node('ShaderNodeBsdfTransparent').outputs[0], mix.inputs[2])
    b.replace(surface, mix.outputs[0])
    return b
