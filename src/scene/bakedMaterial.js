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
vec3 lmAt(vec2 uv) {
  return mix(lmDecode(lmOff, uv) * lmOffGain, lmDecode(lmOn, uv), lampMix) * lmRange
    + screenTint * lmDecode(lmScreen, uv) * lmScreenRange;
}
#ifdef LM_SOFT
// The curtains sit at room texel density, where the bake's noise reads as warm/grey blotches
// on the folds: keep only blurred luminance, with the lamp's light given one warm hue
// (the screen's light barely reaches them).
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
vec3 lmSoftAt(vec2 uv) {
  return mix(vec3(dot(lmDecode(lmOff, uv), LUMA)) * lmOffGain, dot(lmDecode(lmOn, uv), LUMA) * vec3(1.2, 0.96, 0.8), lampMix);
}
// Four bilinear taps half a texel out on the diagonals cover the 3x3 neighbourhood.
vec3 lmLight() {
  vec2 t = 0.5 / vec2(textureSize(lmOn, 0));
  vec2 u = vec2(t.x, -t.y);
  return (lmSoftAt(vLightMapUv + t) + lmSoftAt(vLightMapUv - t) + lmSoftAt(vLightMapUv + u) + lmSoftAt(vLightMapUv - u))
    * 0.25 * lmRange;
}
#else
vec3 lmLight() { return lmAt(vLightMapUv); }
#endif
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
// The screen glass instead blends premultiplied (createScene.js): only its tint covers the
// picture, and reflections and glare add over it, so faint glints stay faint, not squared.
const GLASS_ALPHA = /* glsl */`
#if defined(LM_SCREEN_GLASS)
  // The dome reads as a gradient: coverage and reflections rise toward the grazing edges, plus a
  // broad warm sheen from up-left. Both scale with opacity, so they fade out with the tint at arrival.
  float rim = screenRim * pow(1.0 - saturate(dot(normal, geometryViewDir)), 2.0);
  float sheen = screenSheen * smoothstep(0.8, 0.0, length((vEmissiveMapUv - vec2(0.3, 0.28)) * vec2(1.0, 1.3)));
  vec3 glassLight = totalSpecular * (1.0 + rim) + totalEmissiveRadiance + opacity * sheen * vec3(1.0, 0.93, 0.84);
  diffuseColor.a = min(diffuseColor.a * (1.0 + rim), 1.0);
  outgoingLight = (outgoingLight - glassLight) * diffuseColor.a + glassLight;
#elif defined(LM_GLASS)
  diffuseColor.a = mix(diffuseColor.a, 1.0, clamp(max(max(totalSpecular.r, totalSpecular.g), totalSpecular.b), 0.0, 1.0));
#endif
#include <opaque_fragment>`;
const SHADE_SATURATION = /* glsl */`
#include <map_fragment>
#ifdef LM_SHADE
  diffuseColor.rgb = max(mix(vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), diffuseColor.rgb, shadeSaturation), 0.0);
#endif`;

// Old matte plastic, lit so its baked grain and roughness maps catch the room and the spec light:
// monitor (with the sticky note), case, keyboard (with the mouse) and keycaps.
export const PLASTIC = new Set(['Material.018', 'Material.017', 'Material.021', 'Material.022']);
// The light-reflecting materials from the contract's "Real-time reflections" table, the shade and the plastics.
export const LIT = new Set(['DefaultMaterial', 'lamp_trim_brass', 'brass', 'nameplate_brass',
  'icedcoffee_glass', 'window_glass', 'crt_glass', 'lamp_shade', ...PLASTIC]);

// The authored Blender look: light_screen in Win98 teal (linear).
const SCREEN_TINT = new THREE.Color(0.25, 0.85, 0.85);
// The plain Win98 desktop (#008080, linear) is what the authored tint was baked against; the bake's
// emission is about 4x the picture's own linear value.
const DESKTOP = new THREE.Color(0, 0.216, 0.216);
const EMISSION = 4.25;
// Below the monitor's bottom plate, baked_crt_monitor is its stand (art/scripts/mvstand.py). Deep in the chin's shadow its
// baked light is low and the lamp's specular greys it, so its shadows lift toward a warm floor and its specular
// scales down (LOOK.standLift/standSpec); lit parts (the foot's top) stay as baked. The floor is lamp light, so it
// fades with the lamp: a fixed floor outshone the dim lamp-off bake as a flat peach shape.
const STAND_TOP = 0.935;

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
    shadeSaturation: { value: 1 },
    plasticSpec: { value: 1 },
    standLift: { value: new THREE.Color(0, 0, 0) },
    standSpec: { value: 1 },
    glassSpec: { value: 1 },
    screenRim: { value: 0 },
    screenSheen: { value: 0 },
  };
  // lightMap only switches on USE_LIGHTMAP and vLightMapUv; its channel picks the UV set.
  const channels = [0, 1].map((channel) => Object.assign(lightmap_lampOn.clone(), { channel }));

  // Flat albedo × lightmap; keeps the GLB's map, tint, vertex colours and alpha.
  function bakeBasic(mesh, channel) {
    const { name, map, color, vertexColors, transparent, opacity, alphaTest, side } = mesh.material;
    mesh.material.dispose();
    const material = new THREE.MeshBasicMaterial({ name, map, color, vertexColors, transparent, opacity, alphaTest, side,
      lightMap: channels[channel] });
    if (name === 'curtain_sheer') material.defines = { LM_SOFT: '' };
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
    if (material.name === 'lamp_shade') material.defines = { LM_SHADE: '' };
    if (PLASTIC.has(material.name)) material.defines = { LM_PLASTIC: '' };
    if (material.name === 'Material.018') material.defines.LM_STAND = '';
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vWorldY;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorldY = (modelMatrix * vec4(transformed, 1.0)).y;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <lightmap_pars_fragment>', `#include <lightmap_pars_fragment>\nuniform float shadeSaturation, plasticSpec, glassSpec, screenRim, screenSheen, standSpec;\nuniform vec3 standLift;\nvarying float vWorldY;\n${channel === undefined ? 'uniform float lampMix;' : DECODE}`)
        .replace('#include <map_fragment>', SHADE_SATURATION)
        .replace('#include <envmap_physical_pars_fragment>', THREE.ShaderChunk.envmap_physical_pars_fragment
          .replace('#ifdef USE_ENVMAP', `#ifdef USE_ENVMAP\n#ifdef ENVMAP_TYPE_CUBE_UV\n${ENV_BLEND}\n#endif`)
          .replaceAll('textureCubeUV( envMap,', 'lmEnv('))
        .replace('#include <lights_fragment_maps>', THREE.ShaderChunk.lights_fragment_maps
          .replace(LIT_LIGHT, 'irradiance += lmLight() * PI;') + '\niblIrradiance = vec3(0.0);')
        .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nreflectedLight.directDiffuse = vec3(0.0);\n'
          + '#ifdef LM_PLASTIC\nreflectedLight.directSpecular *= plasticSpec;\n#endif\n'
          + `#ifdef LM_STAND\nif (vWorldY < ${STAND_TOP.toFixed(3)}) {\n  vec3 lift = material.diffuseColor * standLift * lampMix;\n  reflectedLight.indirectDiffuse += lift * lift / (reflectedLight.indirectDiffuse + lift + 1e-4);\n  reflectedLight.directSpecular *= standSpec;\n}\n#endif\n`
          + '#ifdef LM_SCREEN_GLASS\nreflectedLight.directSpecular *= glassSpec;\n#endif')
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
    // Authored teal, shifted by how far the picture's average colour is from the plain desktop.
    setScreenColor(average) {
      const t = uniforms.screenTint.value;
      t.copy(SCREEN_TINT).add(average.clone().sub(DESKTOP).multiplyScalar(EMISSION));
      t.r = Math.max(t.r, 0); t.g = Math.max(t.g, 0); t.b = Math.max(t.b, 0);
    },
    setLampMix(v) { uniforms.lampMix.value = v; },
    dispose() { for (const t of [...channels, lightmap_lampOn, lightmap_lampOff, lightmap_screen]) t.dispose(); },
  };
}
