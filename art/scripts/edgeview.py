# Close-up of the screen's top-left edge (shared by mvrender.py and candrender.py).
import bpy
from mathutils import Vector
def edge_view(out):
    sc = bpy.context.scene; r = sc.render
    for o in bpy.data.objects:
        if o.name.startswith('baked_lamp') or o.name == 'lamp_bulb': o.hide_render = True
    cd = bpy.data.cameras.new('edge'); cd.lens = 50; cam = bpy.data.objects.new('edge', cd); sc.collection.objects.link(cam)
    target = Vector((-0.11, -0.17, 1.20)); d = Vector((-0.45, -1.0, 0.35)).normalized()
    cam.location = target + d * 0.36; cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.camera = cam; r.resolution_x, r.resolution_y = 1100, 760
    r.filepath = out + '-edge.png'; bpy.ops.render.render(write_still=True); print('rendered', r.filepath)
