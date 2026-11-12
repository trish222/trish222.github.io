import * as THREE from 'three';

// Calibrated night rig. Presets change lighting inputs, never model geometry.
export const NIGHT_LIGHTING = Object.freeze({
  moonColour: 0x8fa3d8, moonIntensity: 2.2,
  hemiSky: 0x3e3b52, hemiGround: 0x3c3422, hemiIntensity: 19,
  environmentIntensity: 0,
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
