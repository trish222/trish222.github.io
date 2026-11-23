import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { LOOK } from '../config/look.js';
import { PLASTIC } from './bakedMaterial.js';

const TINT = { 'Material.018': 'monitorTint', 'Material.017': 'caseTint', 'Material.021': 'keyboardTint', 'Material.022': 'keycapTint' };

const CUBE_SIZE = 128;
// The room is open behind the camera; reflections see this dim warm fill there, not black.
const UNMODELED = new THREE.Color(0.05, 0.03, 0.018);

// Metals and glass reflect the lit room, not an HDRI (decided at B2): the
// lightmapped scene is captured from the bulb with the lamp on and off, once,
// and the lit materials blend the two by lampMix, so a toggle costs no renders.
export function createReflections({ renderer, scene, bulb, materials, lighting }) {
  const shade = materials.find((m) => m.name === 'lamp_shade');
  const bulbAt = bulb.getWorldPosition(new THREE.Vector3());
  // Blender's light_shade_spec: a 25 x 12 cm softbox front-above the lamp. Its long,
  // sharp streak on the shade needs an area light; a point light only gives a dot.
  RectAreaLightUniformsLib.init();
  const spec = new THREE.RectAreaLight(0xffedd1, 0, 0.25, 0.12);
  scene.add(spec);

  const cubeTarget = new THREE.WebGLCubeRenderTarget(CUBE_SIZE, { type: THREE.HalfFloatType });
  const cubeCamera = new THREE.CubeCamera(0.02, 20, cubeTarget);
  cubeCamera.position.copy(bulbAt);
  const pmrem = new THREE.PMREMGenerator(renderer);

  // Hidden while capturing; the plastics stay, as part of the room the metals reflect.
  const meshes = [];
  scene.traverse((o) => { if (o.isMesh && materials.includes(o.material) && !PLASTIC.has(o.material.name)) meshes.push(o); });
  const plastics = materials.filter((m) => PLASTIC.has(m.name));

  function capture(mix) {
    lighting.setLampMix(mix);
    cubeCamera.update(renderer, scene);
    return pmrem.fromCubemap(cubeTarget.texture);
  }
  const keepMix = lighting.uniforms.lampMix.value;
  lighting.uniforms.lmOffGain.value = LOOK.lampOffGain;
  for (const m of meshes) m.visible = false;
  bulb.visible = false;
  const background = scene.background;
  scene.background = UNMODELED;
  const envOn = capture(1);
  const envOff = capture(0);
  for (const m of meshes) m.visible = true;
  bulb.visible = true;
  scene.background = background;
  lighting.setLampMix(keepMix);
  cubeTarget.dispose();
  pmrem.dispose();

  lighting.uniforms.envMapOff.value = envOff.texture;
  for (const m of materials) m.envMap = envOn.texture;

  const bulbGlow = bulb.material.emissiveIntensity;
  function setLampMix(v) {
    lighting.setLampMix(v);
    bulb.material.emissiveIntensity = bulbGlow * v; // its bloom (post.js) fades with the lamp
    spec.intensity = LOOK.specIntensity * v;
    if (shade) shade.emissiveIntensity = LOOK.shadeEmissive * v;
  }

  function applyLook() {
    spec.position.copy(bulbAt).add(new THREE.Vector3(...LOOK.specOffset));
    spec.lookAt(bulbAt);
    lighting.uniforms.lmOffGain.value = LOOK.lampOffGain;
    for (const m of materials) m.envMapIntensity = m.transparent ? LOOK.glassEnvIntensity : LOOK.envIntensity;
    for (const m of plastics) {
      m.envMapIntensity = LOOK.plasticEnvIntensity;
      // Each plastic's albedo differs (the keyboard's is yellower); its tint matches it to the monitor's cream.
      m.color.setRGB(...LOOK[TINT[m.name]]).multiplyScalar(LOOK.plasticBrightness);
    }
    lighting.uniforms.plasticSpec.value = LOOK.plasticSpec;
    lighting.uniforms.shadowFloorLevel.value.setRGB(...LOOK.shadowFloorColor).multiplyScalar(LOOK.shadowFloor);
    lighting.uniforms.standLift.value.setRGB(...LOOK.standLift);
    lighting.uniforms.standSpec.value = LOOK.standSpec;
    lighting.uniforms.glassSpec.value = LOOK.glassSpec;
    lighting.uniforms.screenRim.value = LOOK.screenRim;
    lighting.uniforms.screenSheen.value = LOOK.screenSheen;
    lighting.uniforms.shadeSaturation.value = LOOK.shadeSaturation;
    if (shade) {
      shade.color.setRGB(...LOOK.shadeColor);
      shade.envMapIntensity = LOOK.shadeEnvIntensity;
      shade.roughness = LOOK.shadeRoughness;
      shade.clearcoat = LOOK.clearcoat;
      shade.clearcoatRoughness = LOOK.clearcoatRoughness;
    }
    setLampMix(lighting.uniforms.lampMix.value);
  }
  applyLook();

  return { setLampMix, applyLook, dispose() { envOn.dispose(); envOff.dispose(); scene.remove(spec); } };
}
