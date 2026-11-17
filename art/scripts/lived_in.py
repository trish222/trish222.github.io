"""Lived-in touches: a hand-written sticky note on the monitor's lower-right
bezel, a coffee ring on the notepad and faint dust and smudges on screen_glass.

No new material slots (mobile draw-call budget): the note paper and pen are
face attributes `note` and `pen` on baked_crt_monitor (read by plastic_detail,
see crt_details.py) and the ring is a face attribute `stain` on baked_notepad.
The handwriting is single-stroke pencil paths with seeded jitter, not a font.
The shipped lightmap atlas was packed with the ATLAS_LINES strokes, so those are
kept as the mesh `lived_note_atlas` (fake user, not in the scene) and stand in for
the real strokes while bake_lightmaps packs UVMap_Light: a text change alone then
needs no lightmap re-bake. Set ATLAS_LINES = LINES at the next lightmap re-bake.
Rerunning strips the previous note and ring and rebuilds them. Run
crt_details.py first (it owns the plastic_detail group), then:
Run inside Blender: exec(open(path).read()).
"""
import math
import random
import bpy
import bmesh
from mathutils import Matrix, Vector

MONITOR, NOTEPAD, GLASS = 'baked_crt_monitor', 'baked_notepad', 'screen_glass'
NOTE_TL = (0.1155, 0.9986)  # top-left corner: top edge at z ~1.0, far corner ~11 mm past the bezel's right edge
NOTE_W, NOTE_H = 0.060, 0.056  # the flat bezel face is ~55 mm tall under the glass lip; the rest overhangs
NOTE_ANGLE = math.radians(6)
NOTE_C = (NOTE_TL[0] + NOTE_W / 2 * math.cos(NOTE_ANGLE) + NOTE_H / 2 * math.sin(NOTE_ANGLE),
          NOTE_TL[1] + NOTE_W / 2 * math.sin(NOTE_ANGLE) - NOTE_H / 2 * math.cos(NOTE_ANGLE))
SHEET_GAP = 0.0003  # paper clearance in front of the bezel
BEZEL_EDGE, X_FLAT = 0.1702, 0.1655  # right edge, and where the front face starts to round off
Z_FLAT = 0.953  # below this the face drops into the recess, so the paper hangs instead of following
CURL, CURL_ZONE = 0.0028, 0.008  # bottom-edge lift (m) and how far up it reaches
HANG, HANG_ZONE = 0.0016, 0.010  # extra lift of the part past the bezel edge
INK_PROUD, INK_WIDTH = 0.0002, 0.00062  # ink is a film on the paper; clears the chord between grid vertices
GLASS_C, GLASS_R = (-0.3001, 0.1074), 0.0350  # iced-coffee glass base (measured)
RING_SHIFT, RING_SHIFT_DIR = 0.0025, math.radians(-20)  # a thin crescent peeks out right of the glass
RING_C = (GLASS_C[0] + RING_SHIFT * math.cos(RING_SHIFT_DIR), GLASS_C[1] + RING_SHIFT * math.sin(RING_SHIFT_DIR))
RING_R = GLASS_R - 0.0005  # the ring sits under the base, so it matches its rim
PAD_TOP = 0.7598
# (pen x in metres, baseline y, text); the box is the checkbox
LINES = [(0.0075, 0.0345, '\u2610finish'), (0.0100, 0.0163, 'website')]
ATLAS_LINES = [(0.0075, 0.0345, '\u2610finish'), (0.0100, 0.0163, 'portfolio')]
ATLAS_MESH = 'lived_note_atlas'

# Single-stroke glyphs: x right, y up, x-height 0.5, ascender 1.0, descender -0.5.
# name: (advance, [strokes])
GLYPHS = {
    'f': (0.38, [[(0.42, 0.93), (0.27, 1.02), (0.15, 0.85), (0.12, 0.5), (0.1, 0.0), (0.06, -0.28)],
                 [(0.0, 0.52), (0.34, 0.5)]]),
    'i': (0.2, [[(0.05, 0.5), (0.05, 0.0)], [(0.05, 0.78), (0.055, 0.8)]]),
    'n': (0.42, [[(0.0, 0.5), (0.0, 0.0)],
                 [(0.0, 0.38), (0.12, 0.52), (0.28, 0.5), (0.36, 0.32), (0.36, 0.0)]]),
    's': (0.34, [[(0.3, 0.45), (0.16, 0.53), (0.04, 0.42), (0.14, 0.28), (0.3, 0.14), (0.22, 0.0), (0.02, 0.04)]]),
    'h': (0.42, [[(0.0, 1.0), (0.0, 0.0)],
                 [(0.0, 0.36), (0.12, 0.5), (0.28, 0.48), (0.36, 0.3), (0.36, 0.0)]]),
    'p': (0.42, [[(0.0, 0.5), (0.0, -0.5)],
                 [(0.0, 0.35), (0.15, 0.52), (0.31, 0.4), (0.33, 0.2), (0.2, 0.02), (0.0, 0.1)]]),
    'o': (0.4, [[(0.22, 0.5), (0.06, 0.4), (0.02, 0.2), (0.12, 0.02), (0.27, 0.1), (0.34, 0.3), (0.24, 0.5), (0.12, 0.54)]]),
    'r': (0.3, [[(0.0, 0.5), (0.0, 0.0)], [(0.0, 0.36), (0.1, 0.5), (0.26, 0.48)]]),
    't': (0.32, [[(0.12, 0.86), (0.1, 0.12), (0.2, 0.0), (0.3, 0.06)], [(0.0, 0.5), (0.3, 0.5)]]),
    'l': (0.24, [[(0.05, 1.0), (0.04, 0.22), (0.13, 0.0)]]),
    'w': (0.5, [[(0.0, 0.5), (0.1, 0.0), (0.22, 0.4), (0.34, 0.0), (0.46, 0.52)]]),
    'e': (0.36, [[(0.04, 0.26), (0.31, 0.3), (0.28, 0.46), (0.14, 0.52), (0.03, 0.38), (0.04, 0.12),
                  (0.16, 0.0), (0.32, 0.06)]]),
    'b': (0.4, [[(0.02, 1.0), (0.0, 0.0)],
                [(0.0, 0.22), (0.12, 0.46), (0.28, 0.48), (0.36, 0.28), (0.28, 0.04), (0.12, 0.0), (0.0, 0.08)]]),
}
BOX = [(0.02, 0.0), (0.74, 0.03), (0.72, 0.7), (0.0, 0.68), (0.03, -0.04)]  # corners overshoot
TICK = [(0.12, 0.38), (0.3, 0.06), (0.62, 0.55), (1.0, 1.02)]


def smooth(pts, per=5):
    """Catmull-Rom through pts, so jittered points still make a pen curve."""
    p = [pts[0]] + list(pts) + [pts[-1]]
    out = []
    for i in range(1, len(p) - 2):
        for s in range(per):
            t = s / per
            out.append(tuple(0.5 * (2 * p[i][k] + (p[i + 1][k] - p[i - 1][k]) * t
                                    + (2 * p[i - 1][k] - 5 * p[i][k] + 4 * p[i + 1][k] - p[i + 2][k]) * t * t
                                    + (3 * p[i][k] - p[i - 1][k] - 3 * p[i + 1][k] + p[i + 2][k]) * t ** 3)
                             for k in (0, 1)))
    out.append(p[-2])
    return out


def handwriting(rng, lines):
    """Return [(polyline in metres, local to the note's lower-left)]."""
    unit = 0.0106  # two lines with a generous margin on the 60x56 mm note
    strokes = []
    for x, pen_y, text in lines:  # x is the pen position in metres
        items = [('box', 1.0) if c == '\u2610' else (c, None) for c in text]
        for n, (name, adv) in enumerate(items):
            scale = unit * rng.uniform(0.94, 1.06)
            slant = math.tan(math.radians(rng.uniform(5, 11)))
            base = rng.uniform(-0.05, 0.05) + 0.012 * n  # baseline drifts upward
            glyph = [BOX, TICK] if name == 'box' else GLYPHS[name][1]
            if name != 'box':
                adv = GLYPHS[name][0]
            for stroke in glyph:
                pts = []
                for gx, gy in stroke:
                    gx, gy = gx + rng.gauss(0, 0.012), gy + rng.gauss(0, 0.012)
                    pts.append((x + (gx + gy * slant) * scale, pen_y + (base + gy) * scale))
                strokes.append(smooth(pts))
            x += (adv + rng.uniform(0.04, 0.09)) * scale
    return strokes


def to_world(u, v):
    """Note-local metres (origin lower-left) to world x, z on the bezel."""
    dx, dz = u - NOTE_W / 2, v - NOTE_H / 2
    c, s = math.cos(NOTE_ANGLE), math.sin(NOTE_ANGLE)
    return NOTE_C[0] + dx * c - dz * s, NOTE_C[1] + dx * s + dz * c


def surface(mon, x, z):
    """Front-face depth under (x, z). Past the flat face the paper keeps the last depth."""
    ok, loc, _, _ = mon.ray_cast(Vector((min(x, X_FLAT), -0.4, max(z, Z_FLAT))), Vector((0, 1, 0)))
    assert ok, (x, z)
    return loc.y - 0.25 * max(0.0, Z_FLAT - z)  # the lip bulges forward ~1 mm just below the flat face


def curl(v, x):
    """The adhesive strip (top) stays flush; the bottom edge and the overhang lift a little."""
    d = max(0.0, 1 - v / CURL_ZONE)
    h = min(1.0, max(0.0, (x - BEZEL_EDGE) / HANG_ZONE + 0.15)) if x > BEZEL_EDGE - 0.0015 else 0.0
    return CURL * d * d + HANG * h * h


def point(mon, u, v, proud):
    x, z = to_world(u, v)
    return Vector((x, surface(mon, x, z) - SHEET_GAP - proud - curl(v, x), z))


def build_note(mon, bm, lines):
    """The paper (unless bm already has it) and the pencil strokes of `lines`."""
    note = bm.faces.layers.float.get('note') or bm.faces.layers.float.new('note')
    pen = bm.faces.layers.float.get('pen') or bm.faces.layers.float.new('pen')
    rows, cols = 48, 24  # columns follow the bezel's sideways slope
    if not bm.faces:
        grid = [[bm.verts.new(point(mon, NOTE_W * i / cols, NOTE_H * j / rows, 0)) for i in range(cols + 1)]
                for j in range(rows + 1)]
        for j in range(rows):
            for i in range(cols):
                f = bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
                f[note] = 1.0
    rng = random.Random(7)
    press = random.Random(13)  # HB pencil: uneven pressure, some strokes fainter
    for line in handwriting(rng, lines):
        weight = press.uniform(0.55, 1.0)
        width = INK_WIDTH * rng.uniform(0.85, 1.15)
        left, right = [], []
        for k, (u, v) in enumerate(line):
            a, b = line[max(k - 1, 0)], line[min(k + 1, len(line) - 1)]
            tx, ty = b[0] - a[0], b[1] - a[1]
            norm = math.hypot(tx, ty) or 1.0
            w = width * (0.7 + 0.45 * math.sin(math.pi * k / max(len(line) - 1, 1))) * rng.uniform(0.9, 1.1)
            nx, ny = -ty / norm * w, tx / norm * w
            left.append(bm.verts.new(point(mon, u + nx, v + ny, INK_PROUD)))
            right.append(bm.verts.new(point(mon, u - nx, v - ny, INK_PROUD)))
        for k in range(len(line) - 1):
            f = bm.faces.new((left[k], left[k + 1], right[k + 1], right[k]))
            f[pen] = weight
    for f in bm.faces:
        if f.normal.y > 0:  # face the room
            f.normal_flip()


def strip(obj, names):
    me = obj.data
    present = [a for a in names if a in me.attributes]
    if not present:
        return
    bm = bmesh.new()
    bm.from_mesh(me)
    layers = [bm.faces.layers.float[a] for a in present]
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if any(f[l] for l in layers)], context='FACES')
    bm.to_mesh(me)
    bm.free()
    for a in present:
        me.attributes.remove(me.attributes[a])


def join_piece(obj, bm, me, uv_from):
    """Join bm into obj, copying the UV of the face under uv_from (x, z) or (x, y)."""
    hit = obj.ray_cast(Vector(uv_from[0]), Vector(uv_from[1]))
    poly = obj.data.polygons[hit[3]]
    loop = poly.loop_indices[0]
    uvs = {n: obj.data.uv_layers[n].data[loop].uv.copy() for n in obj.data.uv_layers.keys()}
    for name, uv in uvs.items():
        layer = bm.loops.layers.uv.get(name) or bm.loops.layers.uv.new(name)
        for f in bm.faces:
            for lp in f.loops:
                lp[layer].uv = uv
    bm.to_mesh(me)
    bm.free()
    piece = bpy.data.objects.new(me.name, me)
    bpy.context.collection.objects.link(piece)
    piece.data.materials.append(obj.material_slots[0].material)
    with bpy.context.temp_override(active_object=obj, selected_editable_objects=[obj, piece]):
        bpy.ops.object.join()


def atlas_strokes(mon):
    """The ATLAS_LINES strokes alone, as built on a bare bezel (see the module docstring)."""
    paper = bmesh.new()
    build_note(mon, paper, [])
    n = len(paper.faces)
    build_note(mon, paper, ATLAS_LINES)
    paper.faces.ensure_lookup_table()
    bmesh.ops.delete(paper, geom=list(paper.faces[:n]), context='FACES')
    me = bpy.data.meshes.get(ATLAS_MESH) or bpy.data.meshes.new(ATLAS_MESH)
    paper.to_mesh(me)
    paper.free()
    if not me.uv_layers:
        me.uv_layers.new(name='UVMap')
    me.use_fake_user = True


def add_note():
    mon = bpy.data.objects[MONITOR]
    strip(mon, ['note', 'pen'])
    wire_matte(mon.material_slots[0].material)
    atlas_strokes(mon)
    bm = bmesh.new()
    build_note(mon, bm, LINES)
    join_piece(mon, bm, bpy.data.meshes.new('lived_note'), ((NOTE_C[0], -0.4, NOTE_C[1]), (0, 1, 0)))
    flags = [mon.data.attributes[a].data for a in ('note', 'pen')]
    for p in mon.data.polygons:  # smooth, or the curl shows as stripes
        if any(f[p.index].value for f in flags):
            p.use_smooth = True


def wire_matte(mat):
    """Paper and ink are matte whatever the plastic's satin is; graphite keeps a faint sheen."""
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    rough = bsdf.inputs['Roughness']
    if not any(n.label == 'note_matte' for n in nt.nodes):
        both = nt.nodes.new('ShaderNodeAttribute')
        both.attribute_name, both.label = 'note', 'note_matte'
        ink = nt.nodes.new('ShaderNodeAttribute')
        ink.attribute_name, ink.label = 'pen', 'note_matte'
        fac = nt.nodes.new('ShaderNodeMath')
        fac.operation, fac.use_clamp, fac.label = 'ADD', True, 'note_matte'
        nt.links.new(both.outputs['Fac'], fac.inputs[0])
        nt.links.new(ink.outputs['Fac'], fac.inputs[1])
        mix = nt.nodes.new('ShaderNodeMix')
        mix.data_type, mix.label = 'FLOAT', 'note_matte'
        mix.inputs[3].default_value = 0.9
        nt.links.new(fac.outputs[0], mix.inputs[0])
        if rough.is_linked:
            nt.links.new(rough.links[0].from_socket, mix.inputs[2])
        else:
            mix.inputs[2].default_value = rough.default_value
        nt.links.new(mix.outputs[0], rough)
    if not any(n.label == 'pen_gloss' for n in nt.nodes):
        ink = nt.nodes.new('ShaderNodeAttribute')
        ink.attribute_name, ink.label = 'pen', 'pen_gloss'
        gloss = nt.nodes.new('ShaderNodeMix')
        gloss.data_type, gloss.label = 'FLOAT', 'pen_gloss'
        gloss.inputs[3].default_value = 0.42
        nt.links.new(ink.outputs['Fac'], gloss.inputs[0])
        nt.links.new(rough.links[0].from_socket, gloss.inputs[2])
        nt.links.new(gloss.outputs[0], rough)


def ring_radius(a, rng_phase):
    return RING_R * (1 + 0.012 * math.sin(2 * a + rng_phase[0]) + 0.008 * math.sin(3 * a + rng_phase[1]))


def build_ring(rng):
    me = bpy.data.meshes.new('lived_ring')
    bm = bmesh.new()
    stain = bm.faces.layers.float.new('stain')
    phase = (rng.uniform(0, 6.28), rng.uniform(0, 6.28))
    segs, z = 160, PAD_TOP + 0.0001  # under the glass bottom (0.14 mm over the paper)
    # radial strips (offset from the edge, strength): a darker rim that fades inward
    bands = [(0.0006, 0.0), (0.0, 0.5), (-0.0010, 0.2), (-0.0022, 0.07)]
    rim = [[None] * (segs + 1) for _ in bands]
    for i in range(segs + 1):
        a = 2 * math.pi * i / segs
        for b, (off, _) in enumerate(bands):
            r = ring_radius(a, phase) + off
            rim[b][i] = bm.verts.new((RING_C[0] + r * math.cos(a), RING_C[1] + r * math.sin(a), z))
    for i in range(segs):
        a = 2 * math.pi * (i + 0.5) / segs
        # broken arc: strength dips where the glass base lifted, and varies slowly
        gap = 0.25 + 0.75 * max(0.0, math.sin(a + phase[0] * 0.3)) ** 0.5
        mod = gap * (0.85 + 0.15 * math.sin(7 * a + phase[1]))
        for b in range(len(bands) - 1):
            f = bm.faces.new((rim[b][i], rim[b][i + 1], rim[b + 1][i + 1], rim[b + 1][i]))
            f[stain] = bands[b + 1][1] * mod
    for _ in range(3):  # a few splash dots near the ring
        a, d = rng.uniform(0, 6.28), RING_R + rng.uniform(0.004, 0.012)
        cx, cy, r = RING_C[0] + d * math.cos(a), RING_C[1] + d * math.sin(a), rng.uniform(0.0006, 0.0012)
        disc = [bm.verts.new((cx + r * math.cos(t * 0.785), cy + r * math.sin(t * 0.785), z)) for t in range(8)]
        bm.faces.new(disc)[stain] = 0.4
    for f in bm.faces:
        if f.normal.z < 0:
            f.normal_flip()
    return bm, me


def add_ring():
    pad = bpy.data.objects[NOTEPAD]
    strip(pad, ['stain'])
    bm, me = build_ring(random.Random(11))
    join_piece(pad, bm, me, ((RING_C[0], RING_C[1], 1.0), (0, 0, -1)))
    wire_stain(bpy.data.materials[pad.material_slots[0].material.name])


def wire_stain(mat):
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    if any(n.label == 'coffee_stain' for n in nt.nodes):
        return
    attr = nt.nodes.new('ShaderNodeAttribute')
    attr.attribute_name, attr.label = 'stain', 'coffee_stain'
    mix = nt.nodes.new('ShaderNodeMix')
    mix.data_type, mix.blend_type, mix.label = 'RGBA', 'MULTIPLY', 'coffee_stain'
    mix.inputs[7].default_value = (0.30, 0.15, 0.05, 1)
    nt.links.new(attr.outputs['Fac'], mix.inputs[0])
    nt.links.new(bsdf.inputs['Base Color'].links[0].from_socket, mix.inputs[6])
    nt.links.new(mix.outputs[2], bsdf.inputs['Base Color'])


def grime_bezel():
    """Grime in the bezel's crevices (where it meets the glass, round the button, LED and
    badge) and slow yellowing patches. Monitor only (Material.018); it feeds plastic_detail,
    whose note, ink and LED tints still paint over it."""
    nt = bpy.data.materials['Material.018'].node_tree
    if any(n.label == 'bezel_grime' for n in nt.nodes):
        return
    group = next(n for n in nt.nodes if n.type == 'GROUP' and n.node_tree.name == 'plastic_detail')
    src = group.inputs['Color'].links[0].from_socket

    def new(kind, **inputs):
        node = nt.nodes.new(kind)
        node.label = 'bezel_grime'
        for k, v in inputs.items():
            sock = node.inputs[int(k) if k.isdigit() else k]
            if isinstance(v, bpy.types.NodeSocket):
                nt.links.new(v, sock)
            else:
                sock.default_value = v
        return node

    obj = new('ShaderNodeTexCoord').outputs['Object']
    patches = new('ShaderNodeTexNoise', Vector=obj, Scale=6.0, Detail=2.0)
    age = new('ShaderNodeMapRange', Value=patches.outputs[0], **{'From Min': 0.42, 'From Max': 0.62, 'To Max': 0.16})
    yellow = new('ShaderNodeMix', Factor=age.outputs[0])
    yellow.data_type, yellow.blend_type = 'RGBA', 'MULTIPLY'
    nt.links.new(src, yellow.inputs[6])
    yellow.inputs[7].default_value = (1.0, 0.88, 0.62, 1)

    ao = new('ShaderNodeAmbientOcclusion', Distance=0.012)  # the glass counts, so its edge collects grime
    ao.samples = 16
    crevice = new('ShaderNodeMapRange', Value=ao.outputs['AO'], **{'From Min': 0.5, 'From Max': 0.92, 'To Min': 1.0, 'To Max': 0.0})
    speck = new('ShaderNodeTexNoise', Vector=obj, Scale=140.0, Detail=4.0)
    breakup = new('ShaderNodeMapRange', Value=speck.outputs[0], **{'From Min': 0.35, 'From Max': 0.65, 'To Min': 0.35, 'To Max': 1.0})
    mask = new('ShaderNodeMath', **{'0': crevice.outputs[0], '1': breakup.outputs[0]})
    mask.operation = 'MULTIPLY'
    amount = new('ShaderNodeMath', **{'0': mask.outputs[0], '1': 0.55})
    amount.operation = 'MULTIPLY'
    grime = new('ShaderNodeMix', Factor=amount.outputs[0])
    grime.data_type, grime.blend_type = 'RGBA', 'MULTIPLY'
    nt.links.new(yellow.outputs[2], grime.inputs[6])
    grime.inputs[7].default_value = (0.42, 0.34, 0.24, 1)
    nt.links.new(grime.outputs[2], group.inputs['Color'])


def dust_glass():
    """Smudge streaks and sparse dust: they spread the reflection, nothing else."""
    mat = bpy.data.materials['crt_glass']
    nt = mat.node_tree
    if any(n.label == 'dust' for n in nt.nodes):
        return
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    def new(kind):
        node = nt.nodes.new(kind)
        node.label = 'dust'
        return node

    coord = new('ShaderNodeTexCoord')

    smudge = new('ShaderNodeTexNoise')  # wipe marks: stretched along x
    smudge.inputs['Scale'].default_value, smudge.inputs['Detail'].default_value = 14.0, 4.0
    stretch = new('ShaderNodeMapping')
    stretch.inputs['Scale'].default_value = (0.35, 1.0, 1.0)
    nt.links.new(coord.outputs['Object'], stretch.inputs['Vector'])
    nt.links.new(stretch.outputs[0], smudge.inputs['Vector'])
    ramp = new('ShaderNodeMapRange')
    ramp.inputs[1].default_value, ramp.inputs[2].default_value = 0.52, 0.72
    nt.links.new(smudge.outputs['Fac'], ramp.inputs[0])

    speck = new('ShaderNodeTexVoronoi')  # dust: sparse pin-point cells
    speck.inputs['Scale'].default_value = 900.0
    nt.links.new(coord.outputs['Object'], speck.inputs['Vector'])
    dots = new('ShaderNodeMapRange')
    dots.inputs[1].default_value, dots.inputs[2].default_value = 0.12, 0.0
    nt.links.new(speck.outputs['Distance'], dots.inputs[0])
    sparse = new('ShaderNodeTexNoise')  # keeps the dust in drifts, not uniform
    sparse.inputs['Scale'].default_value = 25.0
    nt.links.new(coord.outputs['Object'], sparse.inputs['Vector'])
    drift = new('ShaderNodeMapRange')
    drift.inputs[1].default_value, drift.inputs[2].default_value = 0.5, 0.75
    nt.links.new(sparse.outputs['Fac'], drift.inputs[0])
    dust = new('ShaderNodeMath')
    dust.operation = 'MULTIPLY'
    nt.links.new(dots.outputs[0], dust.inputs[0])
    nt.links.new(drift.outputs[0], dust.inputs[1])

    both = new('ShaderNodeMath')
    both.operation, both.use_clamp = 'ADD', True
    nt.links.new(ramp.outputs[0], both.inputs[0])
    nt.links.new(dust.outputs[0], both.inputs[1])
    rough = new('ShaderNodeMapRange')
    rough.inputs[3].default_value, rough.inputs[4].default_value = 0.05, 0.42
    nt.links.new(both.outputs[0], rough.inputs[0])
    nt.links.new(rough.outputs[0], bsdf.inputs['Roughness'])
    alpha = new('ShaderNodeMapRange')  # dust catches a little light
    alpha.inputs[3].default_value, alpha.inputs[4].default_value = 0.12, 0.2
    nt.links.new(both.outputs[0], alpha.inputs[0])
    nt.links.new(alpha.outputs[0], bsdf.inputs['Alpha'])
    tint = new('ShaderNodeMix')
    tint.data_type = 'RGBA'
    tint.inputs[6].default_value = (0.02, 0.03, 0.03, 1)
    tint.inputs[7].default_value = (0.35, 0.34, 0.3, 1)
    nt.links.new(dust.outputs[0], tint.inputs[0])
    nt.links.new(tint.outputs[2], bsdf.inputs['Base Color'])


add_note()
add_ring()
grime_bezel()
dust_glass()
