# Asset credits

Every third-party asset in `art/scene.blend`, `public/models/scene*.glb` and `public/fonts/`. The CC BY and OFL rows also appear in the site's Credits window (`CREDITS` in `src/content/content.js`); `tests/credits.mjs` checks they match.

## CC BY 4.0 (attribution required)

| Asset | Used as | Author | Source |
| --- | --- | --- | --- |
| old computer | Case, keyboard, keycaps, mouse, cables (`baked_crt_*`) | ivsn | https://sketchfab.com/models/8183647717084f008969c22b7fcd1b8a |
| CRT Computer Monitor | CRT monitor (`baked_crt_monitor`; source in `art/sources/masterview/`) | fizyman | https://sketchfab.com/3d-models/crt-computer-monitor-f2ff0013f86e4cd0a2aee183a23bdfee |
| Desk lamp | Banker's lamp (`baked_lamp`) | 7ASSAN | https://sketchfab.com/models/b9458e04d30e4b6284d46d35880a9b95 |
| Verbatim Floppy Disk 3.5" | Project floppies (`baked_floppies`) | Timescade | https://sketchfab.com/models/f055312452cb4b5f87898a9beb312cbe |
| Ice Coffee | Iced coffee (`baked_icedcoffee_drink`, `baked_icedcoffee_glass`) | ponchoguy | https://sketchfab.com/models/fd2e9142168d4f31ba99bf4d9b1165b4 |
| Coffee Mug (School Project) | Mug (`baked_mug`) | FrenchBaguette | https://sketchfab.com/models/5f5ccee1514c440887c072fae8e0d699 |

Modifications: decimated, rescaled, re-oriented, materials simplified (normal and roughness maps removed); the floppies are joined into one mesh. Ice Coffee was decimated from 406k to about 6k faces: coffee, ice and straw are one mesh with vertex colours, the glass keeps a generated condensation mask instead of the scanned water-drop meshes.

## CC0 (Poly Haven, no attribution required)

| Asset | Used as | Author | Source |
| --- | --- | --- | --- |
| Wooden Table 01 | Desk (`baked_desk`) | Ethan Place | https://polyhaven.com/a/WoodenTable_01 |
| Painted Plaster Wall | Wall texture | Amal Kumar | https://polyhaven.com/a/painted_plaster_wall |
| Plank Flooring 04 | Floor, nameplate base | Dimitrios Savva | https://polyhaven.com/a/plank_flooring_04 |
| Book Encyclopedia Set 01 | Books (`baked_books`) | John Malcolm | https://polyhaven.com/a/book_encyclopedia_set_01 |
| Office Notepads | Papers and legal pad | Ulan Cabanilla | https://polyhaven.com/a/office_notepads |
| Stationery Supplies | Pencil cup, pencil, pen | Mateusz Sadek | https://polyhaven.com/a/stationery_supplies |
| Shanghai Bund (HDRI) | Blender world light (4k) and the `window_view` night city in previews (a crop of the 8k, `shanghai_bund_8k_city.hdr`); not exported | Greg Zaal | https://polyhaven.com/a/shanghai_bund |

## SIL Open Font License 1.1

| Asset | Used as | Author | Source |
| --- | --- | --- | --- |
| Departure Mono | Floppy label text (`art/textures/floppy_labels.png`, via `art/scripts/floppy_labels.py`) and the resume (`public/fonts/`) | Helena Zhang | https://departuremono.com |
| Cinzel | Nameplate engraving (`art/fonts/`, OFL alongside) | Natanael Gama | https://fonts.google.com/specimen/Cinzel |
| Atkinson Hyperlegible | Body copy in windows (`public/fonts/`) | Braille Institute | https://brailleinstitute.org/freefont |
| Martian Mono | Corner "menu" label (`public/fonts/`) | Evil Martians | https://github.com/evilmartians/mono |
| Playfair Display | Display face (`public/fonts/`) | Claus Eggers Sørensen | https://fonts.google.com/specimen/Playfair+Display |

## ITF Free Font License (FFL) 2.0

Free for personal and commercial use. Its license forbids redistributing the font file, so it is not in this repo (`public/fonts/rx100*` is git-ignored): `index.html` loads it from Fontshare's CSS (`api.fontshare.com`). The license text is `art/fonts/RX100-FFL.txt`.

| Asset | Used as | Author | Source |
| --- | --- | --- | --- |
| RX100 | Hover labels over the lamp, computer and floppies (loaded from Fontshare) | Anurag Gautam, Indian Type Foundry | https://www.fontshare.com/fonts/rx-100 |

## Made in Blender Python (no third-party license)

Room shell (wall, floor, window frame, sill, glass, `window_view`), sheer curtains (`baked_curtains`), floppy label quads, `screen_plane`, `crt_glow`, `lamp_bulb`, the lamp pull chain, the nameplate, the LEGO-style treehouse (`art/scripts/treehouse.py`), and all `click_*` proxies. The pixel ▶ menu cursor (`src/ui/menuCursor.js`) is hand-drawn for this site, so no third-party license applies.
