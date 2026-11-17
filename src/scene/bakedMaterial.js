import * as THREE from 'three';

// Light = mix(lampOff × lampOffGain, lampOn, lampMix) × range + screenTint × screen × screenRange
// (docs/scene-contract.md, "Lightmaps"). Texels hold sqrt(sRGB(v / range)).
const DECODE = /* glsl */`
uniform float lampMix;
uniform sampler2D lmOn, lmOff, lmScreen;
uniform float lmRange, lmScreenRange, lmOffGain;
uniform vec3 screenTint;
vec3 lmDecode(sampler2D map, vec2 uv) {
  vec3 s = texture2D(map, uv).rgb;
  s *= s;
  return mix(s / 12.92, pow((s + 0.055) / 1.055, vec3(2.4)), step(0.04045, s));
}
vec3 lmLight() {
  return mix(lmDecode(lmOff, vLightMapUv) * lmOffGain, lmDecode(lmOn, vLightMapUv), lampMix) * lmRange
    + screenTint * lmDecode(lmScreen, vLightMapUv) * lmScreenRange;
}
`;
const BASIC_LIGHT = /vec4 lightMapTexel[^\n]*\n[^\n]*RECIPROCAL_PI;/;
const LIT_LIGHT = /vec4 lightMapTexel[^\n]*\n[^\n]*\n\s*irradiance \+= lightMapIrradiance;/;

// Reflections blend the lamp-on and lamp-off room captures (reflections.js) by lampMix.
const ENV_BLEND = /* glsl */`
uniform sampler2D envMapOff;
vec4 lmEnv(vec3 dir, float roughness) {
  return mix(textureCubeUV(envMapOff, dir, roughness), textureCubeUV(envMap, dir, roughness), lampMix);
}
`;
// Glass is mostly alpha, so strong reflections also raise its opacity or they'd vanish.
const GLASS_ALPHA = /* glsl */`
#ifdef LM_GLASS
  diffuseColor.a = mix(diffuseColor.a, 1.0, clamp(max(max(totalSpecular.r, totalSpecular.g), totalSpecular.b), 0.0, 1.0));
#endif
#include <opaque_fragment>`;

// The light-reflecting materials from the contract's "Real-time reflections" table, plus the shade.
export const LIT = new Set(['DefaultMaterial', 'lamp_trim_brass', 'brass', 'nameplate_brass',
  'icedcoffee_glass', 'window_glass', 'crt_glass', 'lamp_shade']);

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
    lmOffGain: { value: 1 },
    lmRange: { value: extras.lightmap_range },
    lmScreenRange: { value: extras.lightmap_screen_range },
    screenTint: { value: SCREEN_TINT.clone() },
    envMapOff: { value: null },
  };
  // lightMap only switches on USE_LIGHTMAP and vLightMapUv; its channel picks the UV set.
  const channels = [0, 1].map((channel) => Object.assign(lightmap_lampOn.clone(), { channel }));

  // Flat albedo × lightmap; keeps the GLB's map, tint, vertex colours and alpha.
  function bakeBasic(mesh, channel) {
    const { map, color, vertexColors, transparent, opacity, alphaTest, side } = mesh.material;
    mesh.material.dispose();
    const material = new THREE.MeshBasicMaterial({ map, color, vertexColors, transparent, opacity, alphaTest, side,
      lightMap: channels[channel] });
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <lightmap_pars_fragment>', `#include <lightmap_pars_fragment>\n${DECODE}`)
        .replace(BASIC_LIGHT, 'reflectedLight.indirectDiffuse += lmLight();');
    };
    material.customProgramCacheKey = () => 'baked';
    return material;
  }

  // The GLB's Standard/Physical material: the lightmap is its only diffuse light,
  // the room capture and the bulb's light add only specular.
  function litMaterial(material, channel) {
    material.aoMap = null; // the bake already holds the occlusion
    if (channel !== undefined) material.lightMap = channels[channel];
    if (material.transparent) material.defines = { LM_GLASS: '' };
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <lightmap_pars_fragment>', `#include <lightmap_pars_fragment>\n${channel === undefined ? 'uniform float lampMix;' : DECODE}`)
        .replace('#include <envmap_physical_pars_fragment>', THREE.ShaderChunk.envmap_physical_pars_fragment
          .replace('#ifdef USE_ENVMAP', `#ifdef USE_ENVMAP\n#ifdef ENVMAP_TYPE_CUBE_UV\n${ENV_BLEND}\n#endif`)
          .replaceAll('textureCubeUV( envMap,', 'lmEnv('))
        .replace('#include <lights_fragment_maps>', THREE.ShaderChunk.lights_fragment_maps
          .replace(LIT_LIGHT, 'irradiance += lmLight() * PI;') + '\niblIrradiance = vec3(0.0);')
        .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nreflectedLight.directDiffuse = vec3(0.0);')
        .replace('#include <opaque_fragment>', GLASS_ALPHA);
    };
    material.customProgramCacheKey = () => 'baked-lit';
    return material;
  }

  function bake(mesh, channel) {
    mesh.material = LIT.has(mesh.material.name) ? litMaterial(mesh.material, channel) : bakeBasic(mesh, channel);
    return mesh.material;
  }

  return {
    bake,
    litMaterial,
    uniforms,
    setLampMix(v) { uniforms.lampMix.value = v; },
    dispose() { for (const t of [...channels, lightmap_lampOn, lightmap_lampOff, lightmap_screen]) t.dispose(); },
  };
}
