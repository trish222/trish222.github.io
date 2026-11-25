# Credits

Every third-party resource the site ships or was built from: `art/scene.blend`, `public/models/scene*.glb`, `public/fonts/`, the Fontshare stylesheet in `index.html`, and the npm code bundled into `dist/`. The site's Credits window (`CREDITS` in `src/content/credits.js`) lists the same rows, and `tests/credits.mjs` checks they match. Licenses were checked against the Sketchfab and Poly Haven APIs, the fonts' own name tables and license files, and each package's `package.json` and LICENSE (2026-11-24).

## Inspired by

- https://seanaiux.com/computer
- https://felixrieseberg.com

## 3D models & textures

### CC BY 4.0 (attribution required)

| Asset | Used as | Author | Source |
| --- | --- | --- | --- |
| old computer | Case, keyboard, keycaps, mouse, cables (`baked_crt_*`) | ivsn | https://sketchfab.com/models/8183647717084f008969c22b7fcd1b8a |
| CRT Computer Monitor | CRT monitor (`baked_crt_monitor`; source in `art/sources/masterview/`) | fizyman | https://sketchfab.com/3d-models/crt-computer-monitor-f2ff0013f86e4cd0a2aee183a23bdfee |
| Desk lamp | Banker's lamp (`baked_lamp`) | 7ASSAN | https://sketchfab.com/models/b9458e04d30e4b6284d46d35880a9b95 |
| Verbatim Floppy Disk 3.5" | Project floppies (`baked_floppies`) | Timescade | https://sketchfab.com/models/f055312452cb4b5f87898a9beb312cbe |
| Ice Coffee | Iced coffee (`baked_icedcoffee_drink`, `baked_icedcoffee_glass`) | ponchoguy | https://sketchfab.com/models/fd2e9142168d4f31ba99bf4d9b1165b4 |
| Coffee Mug (School Project) | Mug (`baked_mug`) | FrenchBaguette | https://sketchfab.com/models/5f5ccee1514c440887c072fae8e0d699 |

Modifications: decimated, rescaled, re-oriented, materials simplified (normal and roughness maps removed); the floppies are joined into one mesh. Ice Coffee was decimated from 406k to about 6k faces: coffee, ice and straw are one mesh with vertex colours, the glass keeps a generated condensation mask instead of the scanned water-drop meshes.

### CC0 (Poly Haven, no attribution required)

| Asset | Used as | Author | Source |
| --- | --- | --- | --- |
| Wooden Table 01 | Desk (`baked_desk`) | Ethan Place | https://polyhaven.com/a/WoodenTable_01 |
| Painted Plaster Wall | Wall texture | Amal Kumar | https://polyhaven.com/a/painted_plaster_wall |
| Plank Flooring 04 | Floor, nameplate base | Dimitrios Savva | https://polyhaven.com/a/plank_flooring_04 |
| Book Encyclopedia Set 01 | Books (`baked_books`) | John Malcolm | https://polyhaven.com/a/book_encyclopedia_set_01 |
| Office Notepads | Papers and legal pad | Ulan Cabanilla | https://polyhaven.com/a/office_notepads |
| Stationery Supplies | Pencil cup, pencil, pen | Mateusz Sadek | https://polyhaven.com/a/stationery_supplies |
| Shanghai Bund | Blender world light for the bakes (4k), and the night city behind the window: a crop of the 8k (`shanghai_bund_8k_city.hdr`) baked into the shipped `emit_window_view` | Greg Zaal | https://polyhaven.com/a/shanghai_bund |

## Fonts

### SIL Open Font License 1.1

| Asset | Used as | Author | Source |
| --- | --- | --- | --- |
| Atkinson Hyperlegible | Body copy in windows (`public/fonts/`) | Braille Institute | https://brailleinstitute.org/freefont |
| Departure Mono | Floppy label text (`art/textures/floppy_labels.png`, via `art/scripts/floppy_labels.py`) and the resume (`public/fonts/`) | Helena Zhang | https://departuremono.com |
| Martian Mono | Corner menu and UI labels (`public/fonts/`) | Evil Martians | https://github.com/evilmartians/mono |
| Playfair Display | The CRT's greeting (`public/fonts/`) | Claus Eggers Sørensen | https://fonts.google.com/specimen/Playfair+Display |
| Liberation Serif | The "T" favicon (Bold, outline converted to paths in `public/favicon.svg` and the PNGs; no font file shipped; OFL in `art/fonts/`) | Red Hat, Inc. | https://github.com/liberationfonts/liberation-fonts |
| Cinzel | Nameplate engraving (`art/fonts/`, OFL alongside) | Natanael Gama | https://fonts.google.com/specimen/Cinzel |

The OFL text and each shipped font's copyright line are in `public/fonts/LICENSE.txt`, which is copied to `dist/fonts/`.

### ITF Free Font License (FFL) 2.0

Free for personal and commercial use. Its license forbids redistributing the font file, so it is not in this repo (`public/fonts/rx100*` is git-ignored): `index.html` loads it from Fontshare's CSS (`api.fontshare.com`). The license text is `art/fonts/RX100-FFL.txt`.

| Asset | Used as | Author | Source |
| --- | --- | --- | --- |
| RX100 | Hover labels over the lamp, computer and floppies (loaded from Fontshare) | Anurag Gautam, Indian Type Foundry | https://www.fontshare.com/fonts/rx-100 |

The Win98 window chrome uses a local font stack (`--font` in `src/style.css`); no window font is shipped, and 98.css's bundled MS Sans Serif webfonts are stripped by `scripts/vendor-98css.mjs`.

## Code libraries

Bundled into `dist/` (npm `dependencies`, the vendored 98.css, Tailwind's generated CSS, the meshopt decoder and Basis transcoder that three.js's loaders use, and Vite's module-preload helper). `scripts/third-party-licenses.mjs` writes each full license text to `dist/third-party-licenses.txt`, linked from the Credits window. three.js, postprocessing, GSAP and Tailwind also keep their banner comments in the minified files.

| Asset | Used as | Author | Source | License |
| --- | --- | --- | --- | --- |
| three.js | Renderer, GLTFLoader, KTX2Loader, OrbitControls | three.js authors | https://threejs.org | MIT |
| postprocessing | Bloom, grain, vignette pass chain | Raoul van Rüschen | https://github.com/pmndrs/postprocessing | Zlib |
| GSAP | Camera and UI tweens (`gsap/gsap-core`) | GreenSock | https://gsap.com | GSAP Standard License |
| meshoptimizer | Mesh decoder (`three/examples/jsm/libs/meshopt_decoder.module.js`) | Arseny Kapoulkine | https://github.com/zeux/meshoptimizer | MIT |
| Basis Universal | KTX2 transcoder (`public/basis/`, Apache text alongside) | Binomial LLC | https://github.com/BinomialLLC/basis_universal | Apache-2.0 |
| 98.css | Win98 login chrome (`src/vendor/98.scoped.css`) | Jordan Scales | https://github.com/jdan/98.css | MIT |
| Tailwind CSS | Generated utility CSS and preflight | Tailwind Labs, Inc. | https://tailwindcss.com | MIT |
| Vite | Build tool; its module-preload helper ships in the bundle | VoidZero Inc. and Vite contributors | https://vite.dev | MIT |

Dev-only and not shipped: stats.js (the `?debug` perf meter, tree-shaken out of production), Playwright, glTF-Transform.

## Built with

Blender, Three.js and Vite.

## Made in Blender Python (no third-party license)

Room shell (wall, floor, window frame, sill, glass, `window_view`), sheer curtains (`baked_curtains`), floppy label quads, `screen_plane`, `crt_glow`, `lamp_bulb`, the lamp pull chain, the nameplate, the LEGO-style treehouse (`art/scripts/treehouse.py`), and all `click_*` proxies. The desktop icons (`scripts/make-icons.mjs`) and the pixel ▶ menu cursor (`src/ui/menuCursor.js`) are drawn for this site, so no third-party license applies.
