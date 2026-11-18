# Blender scene contract

The handoff between the Blender scene and the site code. If public/models/scene.glb follows this, the code can wire everything without guessing. Blender work is done by Claude Code through Blender MCP (Blender 5.x).

| Object name in Blender | Type | Code uses it for |
| --- | --- | --- |
| screen_plane | Flat quad, UVs 0–1, sits just behind the glass | Projection corners, CRT shader, snapshot texture |
| screen_glass | Convex cap in front of screen_plane: rim 0.5 mm in front, centre sag `CRT.bulge` × half-height (7.2 mm); UV0 spans the plane 0–1 like screen_plane | Reflection and glare only, transparent (`crt_glass`, alpha 0.12) |
| click_crt | Low-poly invisible proxy around the monitor | Raycast target to zoom in |
| click_lamp_chain | Proxy around the pull chain | Lamp toggle |
| click_project_01 … click_project_06 | Proxies on each floppy or CD | Open that project's window |
| click_nameplate, click_treehouse | Proxies | Easter eggs or About window |
| window_view | Quad behind the window glass | Night-city video texture; until P5, its emissive texture is the baked city view, already display-referred (AgX), so show it unlit with tone mapping off |
| lamp_bulb, crt_glow | Emissive meshes | Bloom sources; intensity tied to lamp state |
| cam_overview, cam_screen, cam_mobile | Empties (or cameras) | Camera positions and look targets |
| baked_* | All static scene meshes | Use the baked lightmap texture set |

## Floppy labels

`baked_floppy_labels` is one quad per disk, textured by the `floppy_labels` atlas (`art/scripts/floppy_labels.py`). The atlas is 3×2 cells of 512×384 px, numbered row-major from the image's top-left. Cell *i* sits on the disk under `click_project_0i`, so cells 1–3 fill UV v 0.5–1 and cells 4–6 fill v 0–0.5, each spanning a third of u. Each quad maps u along the label's width and v toward the back of the desk, so a cell drawn upright reads upright from `cam_overview`. The atlas holds only blank paper and a coloured band; project titles are drawn into the cells at runtime from `FLOPPIES` in `src/content/content.js`.

## Bake rules

1. Join static props into a few objects grouped by material type (wood, plastic, metal, paper) to cut draw calls.
2. Bake lighting into a second UV map (UVMap_Light) as a few atlases, not one per object.
3. Bake two sets: lightmap_lampOn and lightmap_lampOff.
4. Keep the original albedo/roughness textures; the lightmap multiplies over them. Metal and glass keep a small real-time environment reflection so they still glint.
5. Apply all transforms before export. Export glTF Binary, Y-up, with custom properties enabled.

## Lightmaps

`art/scripts/bake.py` bakes them and `npm run assets` packs them into the GLB as unreferenced images named `lightmap_lampOn`, `lightmap_lampOff` and `lightmap_screen` (UASTC KTX2). They hold Cycles diffuse irradiance (direct + indirect, no albedo), so the code multiplies albedo by them.

- All `baked_*` meshes share one atlas. Each node's `lightmap_uv` extra gives the glTF texture-coordinate index of `UVMap_Light`: 1 normally, 0 on meshes without their own UVs (treehouse, window glass).
- Values are 8-bit `sqrt(sRGB(irradiance / range))`, quantised with ±0.5-code dither so dark falloffs don't band. Load them as non-colour data (`NoColorSpace`, never `SRGBColorSpace`). Decode: square the sample, convert sRGB to linear, then multiply by the scene extra `lightmap_range` (lamp maps) or `lightmap_screen_range` (screen map). `art/scripts/preview_baked.py` implements the same decode.
- `lightmap_lampOn` includes everything lit with the lamp on, and `lightmap_lampOff` everything with the lamp off. Neither includes the screen.
- `lightmap_screen` is greyscale: only the CRT screen's light, baked with neutral white emitters. Multiply it by the screen's current colour and add it. The authored Blender look uses `light_screen` teal (0.25, 0.85, 0.85).
- Light = mix(lampOff, lampOn, lampMix) × lightmap_range + screenColour × screen × lightmap_screen_range.
- Islands are packed tightly (2 texels apart at 2048 with a 1-texel bake margin), so sample the lightmaps without mipmaps, or the lower mips blend neighbouring islands.
- Sizes differ per build: desktop ships lampOn 2048 and lampOff/screen 1024; mobile ships lampOn 1024, lampOff 512 and screen 1024 (at 512 the CRT and keyboard blotch in lamp-off). lampOff is UASTC RDO; lampOn and screen are not. Read the size from the texture, never hard-code it.
- The PNGs are tagged linear (gAMA 1.0) before KTX2 encoding (`scripts/assets.mjs`): Blender tags them sRGB, and `ktx create` would otherwise convert the codes to linear and crush the darks.

## Real-time reflections

These are metal or glass, so in three.js they keep a small real-time environment reflection on top of their lightmap (bake rule 4):

| Mesh | Material |
| --- | --- |
| `baked_lamp` | `DefaultMaterial` (stand and base) |
| `baked_lamp` | `lamp_trim_brass` (shade fittings) |
| `baked_lamp_chain` | `brass` |
| `baked_nameplate_brass` | `nameplate_brass` |
| `screen_glass` | `crt_glass` |
| `baked_icedcoffee_glass` | `icedcoffee_glass` |
| `baked_window_glass` | `window_glass` |

The CRT plastics (`Material.018` monitor, `Material.017` case, `Material.021` keyboard and mouse, `Material.022` keycaps) take the same lit path, so their baked `normal_crt_*` grain and `rough_crt_*` satin catch the room capture and the spec light, scaled down by `LOOK.plasticEnvIntensity` / `plasticSpec`. They stay in the room capture rather than being hidden from it.

glTF drops procedural roughness and metallic (they export as 1.0), so `art/scripts/export_fixes.py` sets export-only constants on these materials (the Cycles source keeps its noise). The lamp shade's lamp-on glow ships as `emit_lamp` on `lamp_shade`; scale it by `lampMix`.

## Screen OS themes

Everything on the CRT is an OS theme drawn over one content file. A theme changes how the screen looks and behaves; it never changes what it says, and it never touches the 3D scene. Win98 is the only theme today (`index.html` `#screen` markup, `src/desktop/`, `src/style.css`, `src/vendor/98.scoped.css`).

**Content** (`src/content/content.js`, theme-agnostic, plain strings): `CONTENT.owner`, `about`, `projects` (`id`, `title`, `icon`, `description`, `tags`), `contact`, `resume`, and `FLOPPIES` (floppy *i* = `click_project_0i`: `title`, `window`, optional `card`). The floppy labels and the lo-fi page (P7) read the same file.

**What the scene gives a theme** (fixed; a theme must not change it):

- The `#screen` box, `SCREEN_BASE_W` × the plane's aspect in px, mapped onto `screen_plane` by `scene.js`, with the tube layers in `src/overlay/crt.css` (tube glass, `#screen-glass` clip, bloom, raster, glare). The theme's markup goes inside `#screen-glass`. Keep the edges and corners clear of the rounded outline (about 28 box px in the bottom corners).
- Body classes it can style against: `screen-active` (flying to or parked at the screen), `screen-focused` (arrived; the page takes input), `signed-in`, `glass-fullscreen` (narrow viewport: the desktop leaves the glass and fills the page), `no-scene` (no WebGL: flat page, no tube).
- A `desk:open` event on `document` with `detail = { window, card }` when a floppy lands; a theme opens that window, waiting for sign-in if needed (`src/desktop/projects.js`).
- `scene.js` exports a theme calls: `syncDesktopOverlay()` after a layer change, `refreshLoginStill()` after the picture changes outside an `input` event, `diveToDesktop(done)` / `riseFromDesktop()` around sign-in and log-off on phones.

**What a theme provides:**

| Part | Win98 today | Contract |
| --- | --- | --- |
| Boot | none (the login is the first picture) | Optional. Runs inside `#screen-page` before the login and must end on the login without input. |
| Login | `#screen-page` (`.login-dialog`) | The picture before sign-in, and the only layer the snapshot draws while signed out. Adds `signed-in` to the body on success, through the scene's `diveToDesktop`. |
| Desktop | `#screen-shell` (`#desktop`, `#taskbar`, `#start-menu`) | The picture after sign-in, the layer the snapshot draws when signed in. Must offer a way to log off (remove `signed-in`). |
| Windows | `.window#window-<id>` for `projects`, `about`, `resume`, `contact` (plus theme extras like `recycle`) | One per content section, opened by id (`openWindow`) from icons, menus and `desk:open`. Bodies render from `CONTENT` (`src/desktop/windowContent.js`); `[data-project=<id>]` marks a project's card. |
| Window chrome | `.window-titlebar`, `.window-controls`, menus, status bars in `index.html`; 98.css | Title from the theme's window list (`WINDOWS` in `src/desktop/windows.js`). Drag and resize go through the glass mapping in `windows.js`. |

To add a theme: new markup for `#screen-page` and `#screen-shell`, its own CSS and window renderer reading `CONTENT`, and the same window ids. `content.js`, `src/overlay/`, `src/scene/` and the GLB stay as they are.

## Rules

- Name mismatches are fixed in Blender and re-exported, never aliased in code.
- No procedural geometry in JavaScript; all scene objects come from the GLB.
