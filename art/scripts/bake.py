"""Bake art/scene.blend for the site, then export art/export/scene-raw.glb.

  blender -b art/scene.blend -P art/scripts/bake.py -- [--preview] [--force] [--force-map NAME ...] [--relight OBJ ...]
         [--lightmap-spp N]

Order matters: restored normals and albedo first so the lightmaps see them.
Each map is saved as it finishes and reused on the next run unless --force (all) or --force-map NAME (one map,
repeatable, e.g. --force-map emit_window_view). Lightmaps re-bake by themselves
when the UVMap_Light atlas changes. --relight OBJ (repeatable) keeps the saved atlas and lightmaps and re-bakes
those objects only; objects whose mesh changed are packed into the free texels.
--preview bakes small and fast into art/bakes/preview/ and scene-raw-preview.glb.
The .blend is never saved, so the procedural sources stay editable.
"""
import argparse
import os
import sys
import time
import traceback

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bake_albedo  # noqa: E402
import bake_common as bc  # noqa: E402
import bake_details  # noqa: E402
import bake_lightmaps  # noqa: E402


def report(when):
    issues = bake_lightmaps.name_report()
    print(f'\n== Name report ({when}): ' + (f'{len(issues)} mismatch(es)' if issues else 'clean'))
    for issue in issues:
        print('  ' + issue)
    if issues:
        sys.exit(1)


parser = argparse.ArgumentParser(prog='bake.py')
parser.add_argument('--preview', action='store_true', help='512 px / 32 spp lightmaps, half-size maps')
parser.add_argument('--force', action='store_true', help='re-bake maps that already exist')
parser.add_argument('--force-map', action='append', default=[], metavar='NAME', help='re-bake this map only')
parser.add_argument('--relight', action='append', default=[], metavar='OBJ',
                    help='re-bake the lightmaps of this object only, over the saved ones (see lightmap_lock.py)')
parser.add_argument('--lightmap-spp', type=int, metavar='N', help='lightmap samples (default 256; 32 with --preview)')
opts = bc.Opts(**vars(parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])))

report('before bake')
bc.setup_cycles()
stages = []
for step in (bake_albedo, bake_details, bake_lightmaps):
    t = time.time()
    try:
        step.run(opts)
    except Exception:  # Blender's -P swallows exceptions and exits 0
        traceback.print_exc()
        sys.exit(1)
    stages.append((step.__name__, time.time() - t))
bc.summary()
for name, dt in stages:
    print(f'  stage {name}: {dt:.0f}s')
report('after export')
