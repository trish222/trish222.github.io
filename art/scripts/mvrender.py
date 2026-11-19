# blender -b art/<variant>.blend -P art/scripts/mvrender.py -- <outprefix>   (the .blend must sit in art/)
# cam_overview as the site opens, a three-quarter from front-left like crt-convex-side-ref.png, and the screen-edge close-up.
import os, sys, bpy
from mathutils import Vector
out = sys.argv[sys.argv.index('--') + 1]
sc = bpy.context.scene; r = sc.render
r.resolution_x, r.resolution_y, r.resolution_percentage = 1280, 720, 100
sc.cycles.samples = 64; sc.cycles.use_denoising = True; r.image_settings.file_format = 'PNG'
sc.camera = bpy.data.objects['cam_overview']
r.filepath = out + '-overview.png'; bpy.ops.render.render(write_still=True); print('rendered', r.filepath)
# close views show the tube switched off, like the references, so the dome reads through its shading and reflections
bsdf = next(n for n in bpy.data.materials['screen_win98'].node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
bsdf.inputs['Emission Strength'].default_value = 0.0
bsdf.inputs['Base Color'].default_value = (0.06, 0.075, 0.068, 1); bsdf.inputs['Roughness'].default_value = 0.35  # grey-green phosphor
# and a soft broad highlight across the dome from the upper left, where the site's glare spot sits
nt = bpy.data.materials['crt_glass'].node_tree; gb = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
geo, dot, soft = nt.nodes.new('ShaderNodeNewGeometry'), nt.nodes.new('ShaderNodeVectorMath'), nt.nodes.new('ShaderNodeMapRange')
dot.operation = 'DOT_PRODUCT'; dot.inputs[1].default_value = Vector((-0.35, -0.75, 0.55)).normalized()
soft.interpolation_type = 'SMOOTHSTEP'; soft.inputs[1].default_value, soft.inputs[2].default_value, soft.inputs[4].default_value = 0.80, 1.0, 0.35
nt.links.new(geo.outputs['Normal'], dot.inputs[0]); nt.links.new(dot.outputs['Value'], soft.inputs[0])
nt.links.new(soft.outputs[0], gb.inputs['Emission Strength']); gb.inputs['Emission Color'].default_value = (1.0, 0.93, 0.84, 1)
for o in bpy.data.objects:  # the lamp stands between this camera and the monitor
    if o.name.startswith('baked_lamp') or o.name == 'lamp_bulb': o.hide_render = True
cd = bpy.data.cameras.new('tq'); cd.lens = 50; cam = bpy.data.objects.new('tq', cd); sc.collection.objects.link(cam)
target = Vector((-0.01, 0.01, 1.075)); d = Vector((-0.75, -1.0, 0.3)).normalized()  # like crt-convex-side-ref.png
cam.location = target + d * 0.95
cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
sc.camera = cam; r.resolution_x, r.resolution_y = 1000, 1000
r.filepath = out + '-threequarter.png'; bpy.ops.render.render(write_still=True); print('rendered', r.filepath)
exec(open(os.path.join(os.path.dirname(bpy.data.filepath), 'scripts', 'edgeview.py')).read())
edge_view(out)
