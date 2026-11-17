import * as THREE from 'three';
import { LOOK } from '../config/look.js';

const hash = `float h21(vec2 p) { p = fract(p * vec2(123.34, 345.45)); p += dot(p, p + 34.345); return fract(p.x * p.y); }`;

// Droplets that grow and fade in place, and gentle streaks sliding down; returns (uv offset, highlight).
const rainFunction = `${hash}
vec3 rain(vec2 uv, float t) {
  vec2 off = vec2(0.0);
  float light = 0.0;
  vec2 g = uv * vec2(22.0, 12.0), id = floor(g), f = fract(g) - 0.5;
  float n = h21(id), life = fract(t * 0.04 + n * 3.0);
  float r = 0.12 + 0.1 * n;
  vec2 d = f - (vec2(h21(id + 1.7), h21(id + 4.1)) - 0.5) * 0.5;
  float fadeInOut = smoothstep(0.0, 0.15, life) * smoothstep(1.0, 0.75, life) * step(0.45, n);
  float drop = smoothstep(r, 0.0, length(d)) * fadeInOut;
  off -= d / r * drop;
  light += smoothstep(r * 0.22, 0.0, length(d - r * vec2(-0.3, 0.35))) * fadeInOut * 1.6;
  float cols = 38.0, cx = floor(uv.x * cols), h = h21(vec2(cx, 3.0));
  float head = 1.0 - fract(t * 0.025 * (0.5 + h) + h * 7.0);
  float below = uv.y - head, sx = fract(uv.x * cols) - 0.5 - (h - 0.5) * 0.4;
  float line = step(0.5, h) * step(0.0, below) * step(below, 0.4) * exp(-below * 7.0) * smoothstep(0.2, 0.0, abs(sx));
  float bead = step(0.5, h) * smoothstep(0.02, 0.0, abs(below)) * smoothstep(0.25, 0.0, abs(sx));
  off.x -= sx * 4.0 * line;
  light += line * 0.35 + bead * 0.7;
  return vec3(off, light);
}`;

// The bake's night city is already graded and AgX-mapped, so it bypasses lighting and tone mapping.
// The look adds saturation, a contrast curve pivoting on mid-grey, and rain on the glass in front.
export function createWindowView(mesh, animated) {
  const map = mesh.material.emissiveMap;
  mesh.material.dispose();
  const material = mesh.material = new THREE.MeshBasicMaterial({ map, toneMapped: false });
  const u = { windowSaturation: { value: 1 }, windowContrast: { value: 1 }, rainTime: { value: 0 },
    rainAmount: { value: 0 }, rainRefraction: { value: 0 }, rainStreaks: { value: 0 } };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.fragmentShader = `uniform float windowSaturation, windowContrast, rainTime, rainAmount, rainRefraction, rainStreaks;\n`
      + `${rainFunction}\n${shader.fragmentShader}`.replace('#include <map_fragment>', `
  vec3 wet = rain(vMapUv, rainTime);
  vec4 sampledDiffuseColor = texture2D(map, vMapUv + wet.xy * rainRefraction * rainAmount);
  diffuseColor *= sampledDiffuseColor;
  diffuseColor.rgb += vec3(0.55, 0.65, 0.8) * wet.z * rainStreaks * rainAmount * 0.12;
  diffuseColor.rgb = max(mix(vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), diffuseColor.rgb, windowSaturation), 0.0);
  diffuseColor.rgb = 0.18 * pow(diffuseColor.rgb / 0.18, vec3(windowContrast));`);
  };
  return {
    applyLook() {
      material.color.setScalar(LOOK.windowGain);
      u.windowSaturation.value = LOOK.windowSaturation;
      u.windowContrast.value = LOOK.windowContrast;
      u.rainAmount.value = animated ? LOOK.rainAmount : 0;
      u.rainRefraction.value = LOOK.rainRefraction;
      u.rainStreaks.value = LOOK.rainStreaks;
    },
    setTime(t) { u.rainTime.value = t * LOOK.rainSpeed; },
  };
}
