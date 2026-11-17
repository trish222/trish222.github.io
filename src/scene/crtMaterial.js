import * as THREE from 'three';
import { CRT } from '../config/crt.js';
import { LOOK } from '../config/look.js';

const vertexShader = `varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// Barrel (centre magnified, edges pinned) and glow fade out as `zoom` reaches 1, where the flat live DOM takes over
// with the same mask, scanlines and vignette.
const fragmentShader = `uniform sampler2D map;
uniform vec3 idle;
uniform float hasMap, zoom, time, flicker, barrel, glow, mask, lines, edge, scanDark, vignette;
varying vec2 vUv;
float fade(float cycles) { return 1.0 - smoothstep(0.3, 0.7, fwidth(cycles)); }
void main() {
  vec2 c = vUv * 2.0 - 1.0;
  float k = barrel * (1.0 - zoom);
  vec2 uv = clamp(c * (1.0 + k * (dot(c, c) - 1.0)) * 0.5 + 0.5, 0.0, 1.0);
  float inside = pow(abs(c.x), edge) + pow(abs(c.y), edge);
  if (inside > 1.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  vec3 col = hasMap > 0.5 ? texture2D(map, uv).rgb : idle;
  col += hasMap > 0.5 ? textureLod(map, uv, 4.0).rgb * glow * (1.0 - zoom) : vec3(0.0);
  float row = vUv.y * lines;
  col *= 1.0 - scanDark * (0.5 + 0.5 * sin(row * 6.2832)) * fade(row);
  float cols = vUv.x * lines * 1.3;
  vec3 tri = 1.0 + mask * (vec3(0.5) - 0.5 * cos(vec3(0.0, 2.094, 4.189) + cols * 6.2832)) * fade(cols);
  col *= mix(vec3(1.0), tri, 1.0 - zoom);
  col *= 1.0 - vignette * smoothstep(0.35, 1.6, dot(c, c));
  col *= 1.0 + flicker * sin(time * 47.0) * sin(time * 3.1);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createCrtMaterial(idle, boxHeight) {
  const uniforms = {
    map: { value: null }, idle: { value: idle }, hasMap: { value: 0 }, zoom: { value: 0 }, time: { value: 0 },
    flicker: { value: 0 }, barrel: { value: 0 }, glow: { value: 0 }, mask: { value: 0 },
    lines: { value: boxHeight / CRT.scanPx }, edge: { value: CRT.edge },
    scanDark: { value: CRT.scanDark }, vignette: { value: CRT.vignette },
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader });
  const applyLook = () => {
    uniforms.flicker.value = LOOK.crtFlicker;
    uniforms.barrel.value = LOOK.crtBarrel;
    uniforms.glow.value = LOOK.crtGlow;
    uniforms.mask.value = LOOK.crtMask;
  };
  applyLook();
  return {
    material, applyLook,
    setMap(texture) { uniforms.map.value = texture; uniforms.hasMap.value = texture ? 1 : 0; },
    setZoom(z) { uniforms.zoom.value = z; },
    setTime(t) { uniforms.time.value = t; },
  };
}
