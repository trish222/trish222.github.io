import * as THREE from 'three';

// Placeholder fill until baked materials land (P4); hemisphere only, no shadows.
export const NIGHT_LIGHTING = Object.freeze({
  hemiSky: 0x3e3b52, hemiGround: 0x3c3422, hemiIntensity: 15,
});

export function createLighting(s, preset = NIGHT_LIGHTING) {
  const hemi = new THREE.HemisphereLight(preset.hemiSky, preset.hemiGround, preset.hemiIntensity);
  s.add(hemi);
  return { hemi };
}
