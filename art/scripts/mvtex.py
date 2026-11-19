# Texture lookup on mv_shell's front: 3D (x, z) on the bezel -> UV -> base colour texel.
import bpy, numpy as np
from mathutils import Vector
from mathutils.geometry import barycentric_transform
SH = bpy.data.objects.get('mv_shell') or bpy.data.objects.get('baked_crt_monitor')
def tex_array(name):
    im = bpy.data.images[name]; w, h = im.size
    a = np.empty(w * h * 4, np.float32); im.pixels.foreach_get(a); return a.reshape(h, w, 4), w, h
def uv_at(x, z, layer='UVMap'):
    me = SH.data
    ok, loc, _, fi = SH.ray_cast(Vector((x, -0.5, z)), Vector((0, 1, 0)))
    if not ok: return None, None
    p = me.polygons[fi]; vs = [me.vertices[i].co for i in p.vertices]
    uvs = [me.uv_layers[layer].data[li].uv for li in p.loop_indices]
    uv = barycentric_transform(loc, *vs, Vector((*uvs[0], 0)), Vector((*uvs[1], 0)), Vector((*uvs[2], 0)))
    return (uv.x, uv.y), loc.y
