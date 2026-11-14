# Blender scene contract

The handoff between the Blender scene and the site code. If public/models/scene.glb follows this, the code can wire everything without guessing. Blender work is done by Claude Code through Blender MCP (Blender 5.x).

| Object name in Blender | Type | Code uses it for |
| --- | --- | --- |
| screen_plane | Flat quad, UVs 0–1, sits just behind the glass | Projection corners, CRT shader, snapshot texture |
| screen_glass | Curved mesh in front of screen_plane | Reflection and glare only, transparent |
| click_crt | Low-poly invisible proxy around the monitor | Raycast target to zoom in |
| click_lamp_chain | Proxy around the pull chain | Lamp toggle |
| click_project_01 … click_project_06 | Proxies on each floppy or CD | Open that project's window |
| click_nameplate, click_treehouse | Proxies | Easter eggs or About window |
| window_view | Quad behind the window glass | Night-city video texture |
| lamp_bulb, crt_glow | Emissive meshes | Bloom sources; intensity tied to lamp state |
| cam_overview, cam_screen, cam_mobile | Empties (or cameras) | Camera positions and look targets |
| baked_* | All static scene meshes | Use the baked lightmap texture set |

## Floppy labels

`baked_floppy_labels` is one quad per disk, textured by the `floppy_labels` atlas (`art/scripts/floppy_labels.py`). The atlas is 3×2 cells of 512×384 px, numbered row-major from the image's top-left. Cell *i* sits on the disk under `click_project_0i`, so cells 1–3 fill UV v 0.5–1 and cells 4–6 fill v 0–0.5, each spanning a third of u. Each quad maps u along the label's width and v toward the back of the desk, so a cell drawn upright reads upright from `cam_overview`. The atlas holds only blank paper and a coloured band; project titles are drawn into the cells at runtime.

## Bake rules

1. Join static props into a few objects grouped by material type (wood, plastic, metal, paper) to cut draw calls.
2. Bake lighting into a second UV map (UVMap_Light) as a few atlases, not one per object.
3. Bake two sets: lightmap_lampOn and lightmap_lampOff.
4. Keep the original albedo/roughness textures; the lightmap multiplies over them. Metal and glass keep a small real-time environment reflection so they still glint.
5. Apply all transforms before export. Export glTF Binary, Y-up, with custom properties enabled.

## Rules

- Name mismatches are fixed in Blender and re-exported, never aliased in code.
- No procedural geometry in JavaScript; all scene objects come from the GLB.
