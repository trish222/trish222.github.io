import * as THREE from 'three';
import { CRT } from '../config/crt.js';
import { LOOK } from '../config/look.js';

const vertexShader = `varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// Barrel (centre magnified, edges pinned) and glow fade out as `zoom` reaches 1, where the flat live DOM takes over
// with the same tint, mask, scanlines, vignette and edge darkening (src/overlay/crt.css).
// Pointer over the computer: only the picture brightens (no highlight on the case).
const HOVER_GLOW = 0.3;
// The boot screen's bar fill and cursor are left out of the still and drawn here, so they move without
// a redraw: `fill` is a rect in uv, optionally striped like .boot-bar (10 of every 13 px) or blinking.
const fragmentShader = `#define HOVER_GLOW ${HOVER_GLOW.toFixed(2)}
#include <tonemapping_pars_fragment>
uniform sampler2D map;
uniform vec3 idle, tint, fillColor;
uniform vec4 fill;
uniform float fillStripe, fillBlink;
uniform float bright, hover, lift, hasMap, zoom, time, flicker, barrel, glow, bloom, grain, mask, lines, edge, scanDark, vignette, edgeShade, soft;
varying vec2 vUv;
float fade(float cycles) { return 1.0 - smoothstep(0.3, 0.7, fwidth(cycles)); }
float rim(float a) { return 1.0 - edgeShade * clamp((a - 0.88) / 0.12, 0.0, 1.0); }
vec3 toS(vec3 c) { return sRGBTransferOETF(vec4(c, 1.0)).rgb; }
vec3 toL(vec3 c) { return sRGBTransferEOTF(vec4(c, 1.0)).rgb; }
void main() {
  vec2 c = vUv * 2.0 - 1.0;
  float k = barrel * (1.0 - zoom);
  vec2 uv = clamp(c * (1.0 + k * (dot(c, c) - 1.0)) * 0.5 + 0.5, 0.0, 1.0);
  float inside = pow(abs(c.x), edge) + pow(abs(c.y), edge);
  float d = pow(inside, 1.0 / edge);
  vec3 col = hasMap > 0.5 ? texture2D(map, uv).rgb : idle;
  vec2 f = uv - fill.xy;
  float lit = step(0.0, min(f.x, f.y)) * step(max(f.x - fill.z, f.y - fill.w), 0.0);
  lit *= fillStripe > 0.0 ? step(fract(f.x / fillStripe), 10.0 / 13.0) : 1.0;
  lit *= fillBlink > 0.0 ? step(fract(time / fillBlink), 0.5) : 1.0;
  col = mix(col, fillColor, lit * hasMap);
  col += hasMap > 0.5 ? textureLod(map, uv, 4.0).rgb * glow * (1.0 - zoom) : vec3(0.0);
  col *= bright * (1.0 + HOVER_GLOW * hover);
  float row = vUv.y * lines, cols = vUv.x * lines * 1.3;
  float wave = 0.5 + 0.5 * sin(row * 6.2832);
  float scan = 1.0 - scanDark * wave * fade(row);
  // The DOM's lines, too fine to resolve, still darken by their mean.
  float scanDom = 1.0 - scanDark * mix(0.5, wave, fade(row));
  float shade = rim(abs(c.x)) * rim(abs(c.y)) * (1.0 - vignette * smoothstep(0.35, 1.6, dot(c, c)));
  // The DOM's mask: R, G, B stripes at alpha mask * 1.5, linearly blended between, over the tint.
  vec3 p = fract(cols - vec3(0.0, 1.0, 2.0) / 3.0) * 3.0;
  float m = 1.5 * mask * fade(cols);
  vec3 tintS = toS(tint);
  vec3 stripes = tintS * (1.0 - m) + m * max(1.0 - min(p, 3.0 - p), 0.0);
  // From the desk: the tuned linear-light look (lift as a screen blend, as .crt-lift in crt.css).
  vec3 desk = pow(1.0 - (1.0 - pow(col, vec3(1.0 / 2.2))) * (1.0 - lift), vec3(2.2)) * scan * stripes / tintS * tint * shade;
  // On arrival: the DOM's own steps in sRGB. Chrome mixes .crt-bloom's backdrop-filter (brightness 0.7,
  // contrast 4, blur 5px) in at its opacity, which darkens mid-tones; the multiply blends (raster) and the
  // black grain specks (mean alpha ~0.22) and flicker veil (flicker * 3 at ~50%) all darken in sRGB.
  // brightness() scales sRGB values, which near black is not the linear gain bright = B^2.2, and above 1
  // it clips white before the multiply layers darken it.
  float brightS = pow(bright, 1.0 / 2.2);
  vec3 s = min(toS(col / bright) * brightS, 1.0);
  vec3 blurred = min(toS(mix(textureLod(map, uv, 2.0).rgb, fillColor, lit)) * brightS, 1.0); // the still has no fill
  s = mix(s, clamp((blurred * 0.7 - 0.5) * 4.0 + 0.5, 0.0, 1.0), bloom * hasMap);
  s = 1.0 - (1.0 - s) * (1.0 - lift);
  vec3 dom = toL(s * scanDom * stripes * shade * (1.0 - 0.22 * grain - 1.5 * flicker));
  float arrival = smoothstep(0.5, 1.0, zoom);
  col = mix(desk, dom, arrival);
  col *= 1.0 + flicker * sin(time * 47.0) * sin(time * 3.1);
  gl_FragColor = vec4(col * (1.0 - smoothstep(1.0 - soft - fwidth(d), 1.0, d)), 1.0);
  // The live DOM is never tone-mapped, so AgX fades out on the way in; at arrival the picture matches it.
  // Alpha 0.5 marks the result display-referred, so the post chain does not map it again (filmEffect.js).
  gl_FragColor = vec4(mix(AgXToneMapping(gl_FragColor.rgb), gl_FragColor.rgb, arrival), 0.5);
  #include <colorspace_fragment>
}`;

export function createCrtMaterial(idle, boxHeight) {
  const uniforms = {
    map: { value: null }, bright: { value: 1 }, hover: { value: 0 }, lift: { value: 0 }, idle: { value: idle }, hasMap: { value: 0 }, zoom: { value: 0 }, time: { value: 0 },
    flicker: { value: 0 }, barrel: { value: 0 }, glow: { value: 0 }, bloom: { value: 0 }, grain: { value: 0 }, mask: { value: 0 },
    tint: { value: new THREE.Color() }, edgeShade: { value: 0 },
    fill: { value: new THREE.Vector4(-1, -1, 0, 0) }, fillColor: { value: new THREE.Color() }, fillStripe: { value: 0 }, fillBlink: { value: 0 },
    lines: { value: boxHeight / CRT.scanPx }, edge: { value: CRT.edge }, soft: { value: CRT.soft },
    scanDark: { value: CRT.scanDark }, vignette: { value: CRT.vignette },
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader });
  const applyLook = () => {
    uniforms.flicker.value = LOOK.crtFlicker;
    uniforms.barrel.value = LOOK.crtBarrel;
    uniforms.glow.value = LOOK.crtGlow;
    uniforms.bloom.value = LOOK.screenGlow;
    uniforms.grain.value = LOOK.screenGrain;
    uniforms.mask.value = LOOK.crtMask;
    uniforms.edgeShade.value = LOOK.screenEdge;
    uniforms.bright.value = LOOK.screenBrightness ** 2.2;
    uniforms.lift.value = LOOK.screenLift;
    // CRT.tint is display (sRGB) white, like the DOM's; the shader multiplies before tone mapping.
    uniforms.tint.value.setRGB(...CRT.tint.map((c) => 1 + (c - 1) * LOOK.crtTint), THREE.SRGBColorSpace);
  };
  applyLook();
  return {
    material, applyLook,
    setMap(texture) { uniforms.map.value = texture; uniforms.hasMap.value = texture ? 1 : 0; },
    setZoom(z) { uniforms.zoom.value = z; },
    setTime(t) { uniforms.time.value = t; },
    setHover(h) { uniforms.hover.value = h; },
    // rect [x, y, w, h] in uv, or null for none; color a CSS colour; stripe in uv; blink in seconds.
    setFill(rect, { color = '#000', stripe = 0, blink = 0 } = {}) {
      uniforms.fill.value.fromArray(rect ?? [-1, -1, 0, 0]);
      uniforms.fillColor.value.set(color);
      uniforms.fillStripe.value = stripe;
      uniforms.fillBlink.value = blink;
    },
  };
}
