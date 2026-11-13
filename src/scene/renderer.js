import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

export function createComposer({ renderer, scene, camera }) {
  const c = new EffectComposer(renderer);
  c.addPass(new RenderPass(scene, camera));
  c.addPass(new OutputPass());
  return c;
}
