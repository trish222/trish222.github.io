import * as THREE from 'three';

// Light = mix(lampOff, lampOn, lampMix) × range + screenTint × screen × screenRange
// (docs/scene-contract.md, "Lightmaps"). Texels hold sqrt(sRGB(v / range)).
const DECODE = /* glsl */`
uniform sampler2D lmOn, lmOff, lmScreen;
uniform float lampMix, lmRange, lmScreenRange;
uniform vec3 screenTint;
vec3 lmDecode(sampler2D map, vec2 uv) {
  vec3 s = texture2D(map, uv).rgb;
  s *= s;
  return mix(s / 12.92, pow((s + 0.055) / 1.055, vec3(2.4)), step(0.04045, s));
}
`;
const LIGHT = /* glsl */`
reflectedLight.indirectDiffuse += mix(lmDecode(lmOff, vLightMapUv), lmDecode(lmOn, vLightMapUv), lampMix) * lmRange
  + screenTint * lmDecode(lmScreen, vLightMapUv) * lmScreenRange;
`;

// The authored Blender look: light_screen in Win98 teal (linear).
const SCREEN_TINT = new THREE.Color(0.25, 0.85, 0.85);

export function createBakedLighting({ lightmap_lampOn, lightmap_lampOff, lightmap_screen }, extras) {
  if (!(extras.lightmap_range > 0 && extras.lightmap_screen_range > 0)) {
    throw new Error('scene.glb is missing the lightmap_range extras');
  }
  const uniforms = {
    lmOn: { value: lightmap_lampOn },
    lmOff: { value: lightmap_lampOff },
    lmScreen: { value: lightmap_screen },
    lampMix: { value: 1 },
    lmRange: { value: extras.lightmap_range },
    lmScreenRange: { value: extras.lightmap_screen_range },
    screenTint: { value: SCREEN_TINT.clone() },
  };
  // lightMap only switches on USE_LIGHTMAP and vLightMapUv; its channel picks the UV set.
  const channels = [0, 1].map((channel) => Object.assign(lightmap_lampOn.clone(), { channel }));

  // Flat albedo × lightmap; keeps the GLB's map, tint, vertex colours and alpha.
  function bake(mesh, channel) {
    const { map, color, vertexColors, transparent, opacity, alphaTest, side } = mesh.material;
    mesh.material.dispose();
    const material = new THREE.MeshBasicMaterial({ map, color, vertexColors, transparent, opacity, alphaTest, side,
      lightMap: channels[channel] });
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <lightmap_pars_fragment>', `#include <lightmap_pars_fragment>\n${DECODE}`)
        .replace(/vec4 lightMapTexel[^\n]*\n[^\n]*RECIPROCAL_PI;/, LIGHT);
    };
    material.customProgramCacheKey = () => 'baked';
    mesh.material = material;
    return material;
  }

  return {
    bake,
    uniforms,
    setLampMix(v) { uniforms.lampMix.value = v; },
    dispose() { for (const t of [...channels, lightmap_lampOn, lightmap_lampOff, lightmap_screen]) t.dispose(); },
  };
}
