"""Shared by bake_albedo, bake_details and bake_lightmaps: Cycles setup,
resumable one-map bakes with progress and time estimates, OIDN denoise,
Smart UV and PNG encoding."""
import math
import os
import time

import bmesh
import bpy
import numpy as np

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
_rates = {}  # bake type -> seconds per (megapixel x sample), measured this run
_step = {'name': '', 'i': 0, 'n': 0}
LOG = []  # (step, map, kind, size, spp, seconds or None when reused)


class Opts:
    def __init__(self, preview, force, force_map, relight=()):
        self.preview, self.force, self.force_maps, self.relight = preview, force, set(force_map), list(relight)
        self.out = os.path.join(ROOT, 'bakes', 'preview') if preview else os.path.join(ROOT, 'bakes')
        os.makedirs(self.out, exist_ok=True)

    def forced(self, name):
        return self.force or name in self.force_maps

    def px(self, size):
        return size // 2 if self.preview else size

    def spp(self, samples):
        return samples // 2 if self.preview else samples


def setup_cycles():
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'
    prefs.get_devices()
    for d in prefs.devices:
        d.use = True
    sc.cycles.device = 'GPU'
    sc.render.bake.use_clear = True


def begin(step, n):
    _step.update(name=step, i=0, n=n)
    print(f'\n== {step}: {n} maps')


def bsdf(mat):
    return next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')


def materials(objs):
    return list(dict.fromkeys(s.material for o in objs for s in o.material_slots if s.material))


def bake(opts, name, objs, size, kind, spp, uv, colorspace='sRGB', hdr=False, margin=8,
         pass_filter=frozenset()):
    """Bake one map onto each object's `uv` layer, or reuse the saved file unless forced.
    hdr=True bakes float and saves EXR (denoised for DIFFUSE); otherwise saves PNG."""
    _step['i'] += 1
    path = os.path.join(opts.out, name + ('.exr' if hdr else '.png'))
    tag = f"[{_step['name']} {_step['i']}/{_step['n']}] {name} {size}x{size} {spp} spp"
    if os.path.exists(path) and not opts.forced(name):
        img = load(path, colorspace)
        if tuple(img.size) == (size, size):
            print(f'{tag}: reused {os.path.relpath(path, ROOT)}')
            LOG.append((_step['name'], name, kind, size, spp, None))
            return img
        bpy.data.images.remove(img)  # saved at another size: bake it again
    work = size * size / 1e6 * spp
    eta = f'~{_rates[kind] * work:.0f}s' if kind in _rates else 'n/a (first of its type)'
    print(f'{tag}: est {eta}', flush=True)
    t = time.time()

    img = bpy.data.images.new(name, size, size, float_buffer=hdr)
    img.colorspace_settings.name = colorspace
    added = []
    for m in materials(objs):
        n = m.node_tree.nodes.new('ShaderNodeTexImage')
        n.image = img
        m.node_tree.nodes.active = n
        added.append((m, n))
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.data.uv_layers.active = o.data.uv_layers[uv]
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.context.scene.cycles.samples = spp
    bpy.ops.object.bake(type=kind, pass_filter=set(pass_filter), margin=margin, target='IMAGE_TEXTURES')
    for m, n in added:
        m.node_tree.nodes.remove(n)

    if hdr and kind == 'DIFFUSE':
        img = denoise(img, path)
    elif hdr:
        img.filepath_raw, img.file_format = path, 'OPEN_EXR'
        img.save()
    else:
        img.filepath_raw, img.file_format = path, 'PNG'
        img.save()
    dt = time.time() - t
    _rates[kind] = dt / work
    LOG.append((_step['name'], name, kind, size, spp, dt))
    print(f'{tag}: done in {dt:.1f}s', flush=True)
    return img


def load(path, colorspace='sRGB'):
    img = bpy.data.images.load(path, check_existing=True)
    img.colorspace_settings.name = colorspace
    return img


def denoise(img, path):
    """OIDN through the compositor of a throwaway scene; keeps HDR values, writes EXR."""
    sc = bpy.data.scenes.new('tmp_denoise')
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.render.resolution_x, sc.render.resolution_y = img.size
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = 'OPEN_EXR'
    sc.render.filepath = path
    g = bpy.data.node_groups.new('tmp_denoise', 'CompositorNodeTree')
    g.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
    src, dn, out = (g.nodes.new(t) for t in ('CompositorNodeImage', 'CompositorNodeDenoise', 'NodeGroupOutput'))
    src.image = img
    g.links.new(src.outputs[0], dn.inputs['Image'])
    g.links.new(dn.outputs[0], out.inputs[0])
    sc.compositing_node_group = g
    with bpy.context.temp_override(scene=sc):
        bpy.ops.render.render(write_still=True, scene=sc.name)
    bpy.data.scenes.remove(sc)
    bpy.data.node_groups.remove(g)
    bpy.data.images.remove(img)
    return load(path, 'Linear Rec.709')


def pixels(img):
    a = np.empty(img.size[0] * img.size[1] * 4, np.float32)
    img.pixels.foreach_get(a)
    return a.reshape(img.size[1], img.size[0], 4)


def srgb(x):
    x = np.clip(x, 0, 1)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(x, 1 / 2.4) - 0.055)


def quantise(x):
    """0-1 -> codes/255 with ±0.5-code dither (one value per texel, seeded) so 8-bit
    falloffs break into noise instead of plateaus."""
    noise = np.random.default_rng(0).uniform(-0.5, 0.5, x.shape[:2] + (1,)).astype(np.float32)
    return np.clip(np.round(x * 255 + noise), 0, 255) / 255


def save_png(name, rgb, path):
    """Write already-encoded 0-1 values to an 8-bit PNG without colour conversion."""
    h, w = rgb.shape[:2]
    img = bpy.data.images.get(name) or bpy.data.images.new(name, w, h)
    img.scale(w, h)
    img.colorspace_settings.name = 'Non-Color'
    rgba = np.concatenate([rgb, np.ones((h, w, 1), np.float32)], axis=2)
    img.pixels.foreach_set(rgba.astype(np.float32).ravel())
    img.filepath_raw, img.file_format = path, 'PNG'
    img.save()
    return img


def select(objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]


def uv_per_area(objs, layer):
    uv_area = area = 0.0
    for o in objs:
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bm.transform(o.matrix_world)
        uv = bm.loops.layers.uv[layer]
        for f in bm.faces:
            c = [loop[uv].uv for loop in f.loops]
            uv_area += abs(sum(a.x * b.y - b.x * a.y for a, b in zip(c, c[1:] + c[:1]))) / 2
            area += f.calc_area()
        bm.free()
    return uv_area / area


def smart_uv(objs, layer, margin, weight=None, seamed=()):
    """One joint Smart UV Project into `layer` (created if missing) across objs.
    weight(obj, face) -> relative texel density; islands are rescaled and repacked.
    `seamed` objects are unwrapped along their marked seams instead, at the same density."""
    for o in objs:
        uvs = o.data.uv_layers
        uvs.active = uvs.get(layer) or uvs.new(name=layer)
    select(objs)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=margin, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    density = uv_per_area([o for o in objs if o not in seamed], layer) if seamed else 0
    for o in seamed:
        select([o])
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.unwrap(method='ANGLE_BASED', margin=0)
        bpy.ops.object.mode_set(mode='OBJECT')
        k = math.sqrt(density / uv_per_area([o], layer))
        for d in o.data.uv_layers[layer].data:
            d.uv *= k
    select(objs)
    if not weight:
        return
    for o in objs:
        bm = bmesh.new()
        bm.from_mesh(o.data)
        uv = bm.loops.layers.uv[layer]
        for f in bm.faces:
            w = weight(o, f)
            for loop in f.loops:
                loop[uv].uv *= w
        bm.to_mesh(o.data)
        bm.free()
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.uv.select_all(action='SELECT')
    bpy.ops.uv.pack_islands(rotate=True, scale=True, margin_method='FRACTION', margin=margin)
    bpy.ops.object.mode_set(mode='OBJECT')


def zero_uv_faces(obj):
    """Indices of faces with no area on the render UV map (details added without UVs)."""
    me = obj.data
    uv = next(u for u in me.uv_layers if u.active_render).data
    out = set()
    for p in me.polygons:
        c = [uv[i].uv for i in p.loop_indices]
        if abs(sum(a.x * b.y - b.x * a.y for a, b in zip(c, c[1:] + c[:1]))) < 1e-12:
            out.add(p.index)
    return out


def summary():
    print('\n== Bake times')
    for step, name, kind, size, spp, dt in LOG:
        print(f'  {step:10} {name:28} {kind:9} {size:5}px {spp:4}spp ' + ('reused' if dt is None else f'{dt:7.1f}s'))
    baked = [r for r in LOG if r[5] is not None]
    print(f'  total baked {sum(r[5] for r in baked):.0f}s over {len(baked)} maps')
    for kind, rate in _rates.items():
        print(f'  rate {kind}: {rate:.3f} s per MP*spp')
