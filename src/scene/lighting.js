import * as THREE from 'three';

// Calibrated night rig. Presets change lighting inputs, never model geometry.
export const NIGHT_LIGHTING = Object.freeze({
  moonColour: 0x8fa3d8, moonIntensity: 2.6,
  hemiSky: 0x3e3b52, hemiGround: 0x3c3422, hemiIntensity: 15,
  environmentIntensity: 0,
  workstationReflections: 0.5,
});
export function createLighting(s, { from: MOON_FROM, at: MOON_AT, preset = NIGHT_LIGHTING }) {
  const { moonColour: MOON_COLOUR, moonIntensity: MOON_INTENSITY,
    hemiSky: HEMI_SKY, hemiGround: HEMI_GROUND, hemiIntensity: HEMI_INTENSITY,
    environmentIntensity: ENV_INTENSITY } = preset;
  const moon = new THREE.DirectionalLight(MOON_COLOUR, MOON_INTENSITY);
  moon.position.copy(MOON_FROM);
  moon.target.position.copy(MOON_AT);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.radius = 4;
  moon.shadow.blurSamples = 16;
  moon.shadow.bias = 0;
  moon.shadow.normalBias = 0.035;
  const cam = moon.shadow.camera;
  cam.left = -16;
  cam.right = 31;
  cam.bottom = -17.5;
  cam.top = 28.5;
  cam.near = 11;
  cam.far = 64;
  cam.updateProjectionMatrix();
  s.add(moon, moon.target);
  const hemi = new THREE.HemisphereLight(HEMI_SKY, HEMI_GROUND, HEMI_INTENSITY);
  s.add(hemi);
  s.environmentIntensity = ENV_INTENSITY;
  return { moon, hemi };
}

// One static, prefiltered reflection of the actual room, shared by workstation
// materials. Exclude nearby props and lamp illumination to avoid self-reflection
// and a baked lamp-on pool surviving a visitor's lamp toggle. The lamp/nameplate
// retain their existing local environments. No per-frame capture or global fill.
export function createWorkstationEnvironment(renderer, scene, { room, desk, computer }) {
  const hidden = scene.children.filter(o => !o.isLight && o !== room && o !== desk);
  const visibility = hidden.map(o => o.visible);
  const previousEnvironment = scene.environment;
  const shadowUpdate = renderer.shadowMap.needsUpdate;
  const pmrem = new THREE.PMREMGenerator(renderer);
  let target;
  try {
    hidden.forEach(o => { o.visible = false; });
    scene.environment = null;
    // The complete scene's shadows were warmed before capture. Never replace
    // those frozen maps with maps computed while their casters are hidden.
    renderer.shadowMap.needsUpdate = false;
    const position = computer.position.clone().add(new THREE.Vector3(0, 4, 0));
    target = pmrem.fromScene(scene, 0, .1, 120, { size: 128, position });
  } finally {
    hidden.forEach((o, i) => { o.visible = visibility[i]; });
    scene.environment = previousEnvironment;
    renderer.shadowMap.needsUpdate = shadowUpdate;
    pmrem.dispose();
  }
  const materials = new Set();
  for (const root of [desk, computer]) root.traverse(o => {
    for (const material of o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []) {
      if (material.isMeshStandardMaterial && !material.envMap) materials.add(material);
    }
  });
  for (const material of materials) {
    material.envMap = target.texture;
    material.envMapIntensity *= NIGHT_LIGHTING.workstationReflections;
    material.needsUpdate = true;
  }
  return target;
}
