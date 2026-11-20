"""Partial lightmap re-bakes (bake.py --relight): every object keeps its UVMap_Light islands from the saved
atlas, and only objects whose mesh changed are unwrapped again and packed into the free texels, at the
atlas's own texel density, so the lightmaps of everything else stay valid.
Blender's packer keeps locked islands in place but doesn't pack around them, hence the bitmap packer here.
"""
import math
import os

import bmesh
import numpy as np

import bake_common as bc

ATLAS = os.path.join(bc.ROOT, 'bakes', 'lightmap_atlas.npz')  # UVMap_Light per loop, as packed
DENSITY_REF = ['baked_crt_case', 'baked_crt_keyboard', 'baked_crt_cables']  # hero weight 1.0 throughout
MARGIN = 2  # texels
_covered = {}  # (objects, size) -> island texels


def save(objs):
    np.savez_compressed(ATLAS, **{o.name: uvs(o) for o in objs})


def composite(opts, name, relit, targets, objs):
    """Writes the relit targets' texels over the saved full-atlas EXR `name`, then carries them MARGIN texels
    on into the free texels around them: the screen map bakes with no margin and narrow strips got too
    little, so sampling at an island's edge read the black beyond it as dark specks."""
    img = bc.load(os.path.join(opts.out, name + '.exr'), 'Linear Rec.709')
    base, new = bc.pixels(img), bc.pixels(relit)
    size = new.shape[0]
    mine, others = coverage(targets, size), coverage([o for o in objs if o not in targets], size)
    done = grow(mine, 1)[1:-1, 1:-1] & (new[..., :3].max(-1) > 0) & ~others  # the bake's own margin included
    base[done] = new[done]
    for _ in range(MARGIN):
        ring = grow(done, 1)[1:-1, 1:-1] & ~done & ~others
        acc, n = np.zeros_like(base), np.zeros(done.shape + (1,), np.float32)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                m = np.roll(done, (dy, dx), (0, 1))[..., None]
                acc += np.roll(base, (dy, dx), (0, 1)) * m
                n += m
        base[ring] = (acc / np.maximum(n, 1))[ring]
        done |= ring
    r = MARGIN + 1
    base[~grow(mine | others, r)[r:-r, r:-r]] = 0  # nothing samples these: a replaced mesh's old islands
    img.pixels.foreach_set(base.ravel())
    img.save()
    print(f'  {name}: {done.mean():.1%} of texels relit')
    return img


def coverage(objs, size):
    key = (tuple(o.name for o in objs), size)
    if key not in _covered:
        m = np.zeros((size, size), bool)
        for o in objs:
            o.data.calc_loop_triangles()
            m |= raster(uvs(o)[[list(lt.loops) for lt in o.data.loop_triangles]] * size, m.shape)
        _covered[key] = m
    return _covered[key]


def uvs(o):
    a = np.empty(len(o.data.loops) * 2, np.float32)
    o.data.uv_layers['UVMap_Light'].data.foreach_get('uv', a)
    return a.reshape(-1, 2)


def density(objs, weight):
    """UV area per weighted world area."""
    uv_area = area = 0.0
    for o in objs:
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bm.transform(o.matrix_world)
        uv = bm.loops.layers.uv['UVMap_Light']
        for f in bm.faces:
            c = [lp[uv].uv for lp in f.loops]
            uv_area += abs(sum(a.x * b.y - b.x * a.y for a, b in zip(c, c[1:] + c[:1]))) / 2
            area += f.calc_area() * weight(o, f) ** 2
        bm.free()
    return uv_area / area


def raster(tris, shape):
    """Texel centres covered by any of the (n, 3, 2) triangles given in texel units."""
    m = np.zeros(shape, bool)
    for p in tris - 0.5:
        (x0, y0), (x1, y1) = np.maximum(np.floor(p.min(0)), 0).astype(int), np.ceil(p.max(0)).astype(int) + 1
        ys, xs = np.mgrid[y0:min(y1, shape[0]), x0:min(x1, shape[1])]
        a, b, c = p
        d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
        if d:
            l1 = ((b[1] - c[1]) * (xs - c[0]) + (c[0] - b[0]) * (ys - c[1])) / d
            l2 = ((c[1] - a[1]) * (xs - c[0]) + (a[0] - c[0]) * (ys - c[1])) / d
            m[ys, xs] |= (l1 >= -1e-6) & (l2 >= -1e-6) & (l1 + l2 <= 1 + 1e-6)
    return m


def grow(m, r):
    out = np.pad(m, r)
    for ax in (0, 1):
        out = np.logical_or.reduce([np.roll(out, k, ax) for k in range(-r, r + 1)])
    return out


def islands(o):
    """[(loop indices, (n, 3, 2) loop-index triangles)] per UV island of o."""
    me = o.data
    me.calc_loop_triangles()
    uv = uvs(o)
    parent = list(range(len(me.polygons)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    corner = {}  # (vertex, rounded uv) -> polygon: polygons meeting at a vertex with the same UV are one island
    for p in me.polygons:
        for li in p.loop_indices:
            k = (me.loops[li].vertex_index, *np.round(uv[li], 6))
            if k in corner:
                parent[find(p.index)] = find(corner[k])
            corner[k] = p.index
    groups = {}
    for lt in me.loop_triangles:
        groups.setdefault(find(lt.polygon_index), []).append(list(lt.loops))
    return [(np.unique(t), np.array(t)) for t in groups.values()]


def pack(objs, size, gap, weight, relight, seamed=()):
    """Objects whose loops match the saved atlas get its UVs back; the rest, and the relit ones (so a texel weight
    change takes), are unwrapped and packed around them. Raises if they can't fit."""
    saved = np.load(ATLAS)
    fresh = [o for o in objs if o.name in relight or o.name not in saved or saved[o.name].size != 2 * len(o.data.loops)]
    locked = [o for o in objs if o not in fresh]
    for o in objs:
        uvl = o.data.uv_layers
        uvl.get('UVMap_Light') or uvl.new(name='UVMap_Light')
    for o in locked:
        o.data.uv_layers['UVMap_Light'].data.foreach_set('uv', saved[o.name].ravel())
    if not fresh:
        return
    ref = density([o for o in locked if o.name in DENSITY_REF], weight)
    bc.smart_uv(fresh, 'UVMap_Light', gap / size, weight, [o for o in seamed if o in fresh])
    k = math.sqrt(ref / density(fresh, weight))
    taken = coverage(locked, size).copy()
    free = 1 - taken.mean()
    todo = [(o, loops, tri) for o in fresh for loops, tri in islands(o)]
    uv = {o.name: uvs(o) * k * size for o in fresh}  # texel units at the atlas density
    todo.sort(key=lambda t: -np.ptp(uv[t[0].name][t[1]], 0).prod())
    for n, (o, loops, tri) in enumerate(todo):
        best = None
        for rot in (False, True):
            p = uv[o.name][loops][:, ::-1] * (1, -1) if rot else uv[o.name][loops]
            p = p - np.floor(p.min(0))
            remap = dict(zip(loops, range(len(loops))))
            shape = tuple(np.ceil(p.max(0)[::-1]).astype(int) + 1)
            mask = grow(raster(p[np.vectorize(remap.get)(tri)], shape), gap)
            # overlap with the taken texels at every offset, as one FFT correlation
            hit = np.fft.irfft2(np.fft.rfft2(taken.astype(np.float32)) * np.conj(np.fft.rfft2(mask, taken.shape)),
                                taken.shape)
            h, w = mask.shape
            ok = hit[:size - h + 1, :size - w + 1] < 0.5
            if ok.any():
                y, x = np.unravel_index(np.argmax(ok), ok.shape)
                if best is None or (y, x) < best[:2]:
                    best = (y, x, p, mask)
        if best is None:
            raise RuntimeError(f'{o.name}: island {n + 1} of {len(todo)} ({len(loops)} loops) does not fit the free '
                               f'texels ({1 - taken.mean():.0%} free) at the atlas density')
        y, x, p, mask = best
        taken[y:y + mask.shape[0], x:x + mask.shape[1]] |= mask
        uv[o.name][loops] = p + (x + gap, y + gap)  # grow() padded the mask by gap
    for o in fresh:
        o.data.uv_layers['UVMap_Light'].data.foreach_set('uv', (uv[o.name] / size).ravel())
    print(f'  locked atlas: packed {len(todo)} islands of {", ".join(o.name for o in fresh)} at '
          f'{math.sqrt(ref) * size / 100:.2f} px/cm into {free:.0%} free texels, now {1 - taken.mean():.0%} free')
