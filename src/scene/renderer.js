import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

// AO density is independent of color-buffer density. At DPR 2 this uses
// 14% of the color image's pixels, preserving the calibrated contact radius
// without paying for full-resolution depth/normals and AO on Retina screens.
const AO_PIXEL_RATIO = 0.75;
class ContactGTAOPass extends GTAOPass {
  constructor(scene, camera, width, height, renderer) {
    super(scene, camera, width, height);
    this.renderer = renderer;
  }

  setSize(width, height) {
    const scale = Math.min(1, AO_PIXEL_RATIO / this.renderer.getPixelRatio());
    super.setSize(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
  }
}

export function createComposer({ renderer, scene, camera, width, height, objects, blend, margin }) {
  const c = new EffectComposer(renderer);
  c.addPass(new RenderPass(scene, camera));

  const gtao = new ContactGTAOPass(scene, camera, width, height, renderer);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = blend;
  /* **The AO is bounded to the furniture, and the perspective camera is
     why.** GTAO decides occlusion by stepping `radius` world units
     along the screen and asking whether what it lands on is within
     `thickness` of where the surface should be. On a plane seen at a
     grazing angle that test answers yes to the plane itself, so the
     floor shades itself — and a perspective camera at the flat end of
     the leash sees the floor run all the way to a horizon, which an
     orthographic one never did. The result was a band of false
     occlusion across the haze above the desk, ending in a hard line
     where the plane's far edge stopped supplying it: ~10% down against
     a background it is supposed to dissolve into.

     Outside this box the shader takes AO to be 1 over a `radius`-wide
     fade and then stops sampling altogether. That is not a
     compromise — open floor *is* unoccluded, and the AO was only ever
     paying for the creases on the desk and the machine. The box is
     their world bounds plus GTAO_BOX_MARGIN, so the fade lands on bare
     ground well clear of the feet. */
  const clip = new THREE.Box3();
  for (const object of objects) if (object) clip.union(new THREE.Box3().setFromObject(object));
  clip.expandByScalar(margin);
  gtao.setSceneClipBox(clip);
  gtao.updateGtaoMaterial({
    radius: 1.15, // world units — keep it to creases, not the whole floor
    distanceExponent: 1.4,
    thickness: 1.0,
    scale: 1.15, // deeper than neutral; past ~1.35 the noise shows on the bezel
    samples: 12, // compared at the capped AO density; retain the 16-sample denoiser
  });
  c.addPass(gtao);
  c.addPass(new OutputPass());
  return { composer: c, gtao };
}

export function createMotionComposer(renderer, scene, camera, pixelRatio) {
  const c = new EffectComposer(renderer);
  // Same RenderPass -> OutputPass path and motion resolution as before,
  // with its buffers retained while the full-resolution AO composer rests.
  c.setPixelRatio(Math.min(pixelRatio, 1));
  c.addPass(new RenderPass(scene, camera));
  const output = new OutputPass();
  // The final pass writes straight to the canvas. Keep reading the same
  // target instead of allocating the unused ping-pong target on frame two.
  output.needsSwap = false;
  c.addPass(output);
  return c;
}

