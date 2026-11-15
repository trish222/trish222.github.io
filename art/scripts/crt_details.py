"""CRT detail pass: power button, LED and "TRISH" badge on the monitor chin,
an emissive LED and beige button on the case, and a shared plastic_detail
node group (top yellowing, AO grime, micro-grain bump, detail tints).

No new material slots (mobile draw-call budget): details are tinted through
the face attributes `detail_ink`, `led` and `beige`, read by the materials.
Rerunning strips the previous details and rebuilds them.
Run inside Blender: exec(open(path).read()).
"""
import bpy
import bmesh
from mathutils import Matrix, Vector

MONITOR = 'baked_crt_monitor'
CABLES = 'baked_crt_cables'  # holds the case's front LEDs and power button
PLASTICS = ['Material.017', 'Material.018', 'Material.021', 'Material.022', 'mouse_beige']
INK = (0.10, 0.09, 0.075, 1)
LED_GREEN = (0.12, 1.0, 0.3, 1)
CHIN_Z = 0.981
BADGE_X = -0.011  # monitor centre


def surface_y(obj, x, z):
    ok, loc, _, _ = obj.ray_cast(Vector((x, -0.4, z)), Vector((0, 1, 0)))
    assert ok, (x, z)
    return loc.y


def box(bm, w, h, d, bevel):
    geom = bmesh.ops.create_cube(bm, size=1)['verts']
    bmesh.ops.scale(bm, vec=(w, d, h), verts=geom)
    bmesh.ops.translate(bm, vec=(0, d / 2, 0), verts=geom)
    edges = list({e for v in geom for e in v.link_edges})
    bmesh.ops.bevel(bm, geom=edges, offset=bevel, segments=3, affect='EDGES')


def build_piece(kind):
    """Return a bmesh piece with its front face at y=0, extending into +y."""
    bm = bmesh.new()
    if kind == 'button':
        box(bm, 0.012, 0.007, 0.0022, 0.0008)
    elif kind == 'led':
        bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=0.0020,
                              radius2=0.0017, depth=0.0016,
                              matrix=Matrix.Translation((0, 0.0008, 0)) @ Matrix.Rotation(1.5708, 4, 'X'))
    else:
        curve = bpy.data.curves.new('tmp_badge', 'FONT')
        curve.body = 'TRISH'
        curve.font = bpy.data.fonts['Cinzel Regular']
        curve.size = 0.0100
        curve.space_character = 1.25
        curve.extrude = 0.0004
        curve.resolution_u = 3  # ~4 mm glyphs; the default 12 is thousands of faces
        curve.align_x, curve.align_y = 'CENTER', 'CENTER'
        tmp = bpy.data.objects.new('tmp_badge', curve)
        bpy.context.collection.objects.link(tmp)
        me = bpy.data.meshes.new_from_object(tmp.evaluated_get(bpy.context.evaluated_depsgraph_get()))
        bpy.data.objects.remove(tmp)
        bpy.data.curves.remove(curve)
        while me.uv_layers:  # the font's UVs would shadow the chin's
            me.uv_layers.remove(me.uv_layers[0])
        bm.from_mesh(me)
        # Faux bold: a curve offset breaks Cinzel's outlines, a shifted copy doesn't.
        bmesh.ops.translate(bm, vec=(0.00018, 0, 0), verts=bm.verts)
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
        bmesh.ops.transform(bm, matrix=Matrix.Translation((0, 0.0004, 0)) @ Matrix.Rotation(1.5708, 4, 'X'), verts=bm.verts)
    return bm


def add_chin_details(mon):
    chin = mon.data
    hit = mon.ray_cast(Vector((BADGE_X, -0.4, CHIN_Z)), Vector((0, 1, 0)))
    loop = chin.loops[chin.polygons[hit[3]].loop_indices[0]].index
    uvs = {name: chin.uv_layers[name].data[loop].uv.copy() for name in ('UVMap', 'UVMap.001')}

    # (kind, x, z, proud, detail_ink, led)
    parts = [('badge', BADGE_X, CHIN_Z, 0.00035, 0.88, 0.0),
             ('button', -0.140, CHIN_Z, 0.0010, 0.10, 0.0),
             ('led', -0.121, CHIN_Z, 0.0007, 0.0, 1.6)]  # led > 1 glows brighter than the case LED
    me = bpy.data.meshes.new('crt_details')
    bm = bmesh.new()
    ink = bm.faces.layers.float.new('detail_ink')
    led = bm.faces.layers.float.new('led')
    for kind, x, z, proud, ink_v, led_v in parts:
        piece = build_piece(kind)
        for v in piece.verts:
            wx, wz = x + v.co.x, z + v.co.z
            v.co = Vector((wx, surface_y(mon, wx, wz) - proud + v.co.y, wz))
        tmp = bpy.data.meshes.new('tmp')
        piece.to_mesh(tmp)
        piece.free()
        first = len(bm.faces)
        bm.from_mesh(tmp)
        bpy.data.meshes.remove(tmp)
        bm.faces.ensure_lookup_table()
        for f in bm.faces[first:]:
            f[ink], f[led] = ink_v, led_v
    for name, uv in uvs.items():
        layer = bm.loops.layers.uv.get(name) or bm.loops.layers.uv.new(name)
        for f in bm.faces:
            for lp in f.loops:
                lp[layer].uv = uv
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new('crt_details', me)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mon.material_slots[0].material)
    with bpy.context.temp_override(active_object=mon, selected_editable_objects=[mon, obj]):
        bpy.ops.object.join()


def strip_chin_details(mon):
    me = mon.data
    bm = bmesh.new()
    bm.from_mesh(me)
    ink = bm.faces.layers.float['detail_ink']
    led = bm.faces.layers.float['led']
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f[ink] or f[led]], context='FACES')
    bm.to_mesh(me)
    bm.free()
    for name in ('detail_ink', 'led'):
        me.attributes.remove(me.attributes[name])


def mark_case_faces(cab):
    """Green LED glows; the blue power button turns beige like the monitor's."""
    me = cab.data
    for name in ('led', 'beige'):
        if name in me.attributes:
            me.attributes.remove(me.attributes[name])
    led = me.attributes.new('led', 'FLOAT', 'FACE')
    beige = me.attributes.new('beige', 'FLOAT', 'FACE')
    for p in me.polygons:
        c = p.center
        if c.y > -0.140:
            continue
        if (Vector((c.x, c.z)) - Vector((-0.0055, 0.7795))).length < 0.0032:
            led.data[p.index].value = 1.0
        if (Vector((c.x, c.z)) - Vector((0.0137, 0.776))).length < 0.0100:
            beige.data[p.index].value = 1.0


def detail_group():
    old = bpy.data.node_groups.get('plastic_detail')
    if old:
        bpy.data.node_groups.remove(old)
    g = bpy.data.node_groups.new('plastic_detail', 'ShaderNodeTree')
    g.interface.new_socket('Color', in_out='INPUT', socket_type='NodeSocketColor')
    grime_in = g.interface.new_socket('Grime', in_out='INPUT', socket_type='NodeSocketFloat')
    grime_in.default_value = 0.4
    g.interface.new_socket('Age', in_out='INPUT', socket_type='NodeSocketFloat').default_value = 1.0
    for name, kind in (('Color', 'NodeSocketColor'), ('Normal', 'NodeSocketVector'),
                       ('Emission Strength', 'NodeSocketFloat')):
        g.interface.new_socket(name, in_out='OUTPUT', socket_type=kind)
    n, ln = g.nodes, g.links
    gi, go = n.new('NodeGroupInput'), n.new('NodeGroupOutput')

    def mix(a, b, fac, blend='MIX'):
        m = n.new('ShaderNodeMix')
        m.data_type, m.blend_type = 'RGBA', blend
        for sock, val in ((m.inputs[0], fac), (m.inputs[6], a), (m.inputs[7], b)):
            ln.new(val, sock) if not isinstance(val, (float, tuple)) else setattr(sock, 'default_value', val)
        return m.outputs[2]

    def math(op, a, b):
        m = n.new('ShaderNodeMath')
        m.operation = op
        for sock, val in zip(m.inputs, (a, b)):
            ln.new(val, sock) if not isinstance(val, float) else setattr(sock, 'default_value', val)
        return m.outputs[0]

    def attr(name):
        a = n.new('ShaderNodeAttribute')
        a.attribute_name = name
        return a.outputs['Fac']

    # Yellowing gathers on surfaces that face up toward the room light.
    up = n.new('ShaderNodeSeparateXYZ')
    ln.new(n.new('ShaderNodeNewGeometry').outputs['Normal'], up.inputs[0])
    top = n.new('ShaderNodeMapRange')
    top.inputs[1].default_value, top.inputs[2].default_value = 0.35, 0.95
    top.inputs[4].default_value = 0.4
    ln.new(up.outputs['Z'], top.inputs[0])
    col = mix(gi.outputs['Color'], (1.0, 0.86, 0.62, 1), math('MULTIPLY', top.outputs[0], gi.outputs['Age']), 'MULTIPLY')

    # Grime in vents, seams and around keys.
    ao = n.new('ShaderNodeAmbientOcclusion')
    ao.samples = 8
    ao.inputs['Distance'].default_value = 0.008
    col = mix(col, (0.10, 0.075, 0.05, 1), math('MULTIPLY', math('SUBTRACT', 1.0, ao.outputs['AO']), gi.outputs['Grime']))

    beige_luma = n.new('ShaderNodeRGBToBW')
    ln.new(col, beige_luma.inputs[0])
    beige_col = mix((0.40, 0.335, 0.225, 1), math('MULTIPLY', beige_luma.outputs[0], 1.8), 1.0, 'MULTIPLY')
    col = mix(col, beige_col, attr('beige'))
    col = mix(col, INK, attr('detail_ink'))
    led = attr('led')
    col = mix(col, LED_GREEN, led)
    ln.new(col, go.inputs['Color'])
    ln.new(math('MULTIPLY', led, 1.8), go.inputs['Emission Strength'])

    # Fine plastic grain, sub-millimetre.
    grain = n.new('ShaderNodeTexNoise')
    grain.inputs['Scale'].default_value = 2500.0
    grain.inputs['Detail'].default_value = 2.0
    ln.new(n.new('ShaderNodeTexCoord').outputs['Object'], grain.inputs['Vector'])
    bump = n.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.06
    bump.inputs['Distance'].default_value = 0.0002
    ln.new(grain.outputs['Fac'], bump.inputs['Height'])
    ln.new(bump.outputs['Normal'], go.inputs['Normal'])
    return g


def unwire(mat):
    """Undo a previous run so the group can be rebuilt without losing links."""
    nt = mat.node_tree
    bsdf = next(x for x in nt.nodes if x.type == 'BSDF_PRINCIPLED')
    for gn in [x for x in nt.nodes if x.type == 'GROUP']:
        nt.links.new(gn.inputs['Color'].links[0].from_socket, bsdf.inputs['Base Color'])
        nt.nodes.remove(gn)
    for node in [x for x in nt.nodes if x.label == 'satin']:
        nt.nodes.remove(node)


def wire(mat, group, grime, age, gloss=None):
    nt = mat.node_tree
    bsdf = next(x for x in nt.nodes if x.type == 'BSDF_PRINCIPLED')
    gn = nt.nodes.new('ShaderNodeGroup')
    gn.node_tree = group
    gn.inputs['Grime'].default_value = grime
    gn.inputs['Age'].default_value = age
    nt.links.new(bsdf.inputs['Base Color'].links[0].from_socket, gn.inputs['Color'])
    nt.links.new(gn.outputs['Color'], bsdf.inputs['Base Color'])
    nt.links.new(gn.outputs['Emission Strength'], bsdf.inputs['Emission Strength'])
    bsdf.inputs['Emission Color'].default_value = LED_GREEN
    if gloss is None:  # Material.004 (cables, drive) only takes the LED and button tints
        return
    nt.links.new(gn.outputs['Normal'], bsdf.inputs['Normal'])
    bsdf.inputs['Specular IOR Level'].default_value = 0.5
    rough = bsdf.inputs['Roughness']
    if rough.is_linked:  # keyboard and mouse already vary roughness; lower the range
        rough.links[0].from_node.inputs[3].default_value = gloss[0]
        rough.links[0].from_node.inputs[4].default_value = gloss[1]
        return
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.label = 'satin'
    noise.inputs['Scale'].default_value = 6.0
    nt.links.new(nt.nodes.new('ShaderNodeTexCoord').outputs['Object'], noise.inputs['Vector'])
    rng = nt.nodes.new('ShaderNodeMapRange')
    rng.label = 'satin'
    rng.inputs[1].default_value, rng.inputs[2].default_value = 0.3, 0.7
    rng.inputs[3].default_value, rng.inputs[4].default_value = gloss
    nt.links.new(noise.outputs['Fac'], rng.inputs[0])
    nt.links.new(rng.outputs[0], rough)


mon = bpy.data.objects[MONITOR]
if 'detail_ink' in mon.data.attributes:
    strip_chin_details(mon)
add_chin_details(mon)
mark_case_faces(bpy.data.objects[CABLES])
for name in PLASTICS + ['Material.004']:
    unwire(bpy.data.materials[name])
group = detail_group()
for name in PLASTICS:
    keyboard = name not in ('Material.017', 'Material.018')
    wire(bpy.data.materials[name], group, 0.45 if keyboard else 0.25, 1.0,
         (0.36, 0.55) if keyboard else (0.40, 0.54))
wire(bpy.data.materials['Material.004'], group, 0.0, 0.0)
