import { Uniform, Vector3 } from 'three';
import { BlendFunction, Effect, EffectAttribute } from 'postprocessing';

// Alpha marks what each pixel holds: 1 scene light (HDR, tone-mapped here; 2 for the emitters, which
// post.js blooms), 0.5 a picture that is
// already display-referred (the CRT and the bake's AgX-mapped city: graded, never mapped twice),
// 0 the void (left exactly #1c1a2a for --scene-void). `strength` fades the whole film look out as the
// camera arrives at the screen, so the hand-over to the live DOM sees the CRT's own picture.
const fragmentShader = `#include <tonemapping_pars_fragment>
uniform sampler2D glowMap;
uniform vec3 liftColor;
uniform float strength, exposure, soften, ca, caStart, lift, fade, warmth, saturation, vignette, vignetteOffset, grain, seed;
float hash(vec2 p) { p = fract(p * vec2(123.34, 345.45)); p += dot(p, p + 34.345); return fract(p.x * p.y); }
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 c = uv - 0.5;
  float a = inputColor.a, scene = clamp(2.0 * a - 1.0, 0.0, 1.0), look = clamp(2.0 * a, 0.0, 1.0) * strength;
  // Softness: a half-texel diagonal tent (bilinear taps), not a blur.
  vec2 h = texelSize * 0.5;
  vec3 tent = 0.25 * (texture2D(inputBuffer, uv + h).rgb + texture2D(inputBuffer, uv - h).rgb
    + texture2D(inputBuffer, uv + vec2(h.x, -h.y)).rgb + texture2D(inputBuffer, uv - vec2(h.x, -h.y)).rgb);
  vec3 col = mix(inputColor.rgb, tent, soften * look);
  // Chromatic aberration only toward the edges: none inside caStart (0 centre, 1 corner); ca is px at the corner.
  vec2 shift = c * texelSize * ca * look * smoothstep(caStart, 1.0, length(c) * 1.41421) / max(length(c), 1e-4);
  col.r = mix(col.r, texture2D(inputBuffer, uv + shift).r, step(1e-6, ca * look));
  col.b = mix(col.b, texture2D(inputBuffer, uv - shift).b, step(1e-6, ca * look));
  // Light adds before the curve: bloom from the emitters and halation around anything bright (post.js).
  col += texture2D(glowMap, uv).rgb * look;
  col = mix(col, AgXToneMapping(col * exposure), scene);
  // The grade, in display (sRGB) values: warm highlights, saturation, faded shoulder, blacks lifted toward liftColor.
  vec3 s = sRGBTransferOETF(vec4(clamp(col, 0.0, 1.0), 1.0)).rgb;
  vec3 g = s * mix(vec3(1.0), vec3(1.0 + warmth, 1.0, 1.0 - warmth), dot(s, vec3(0.2126, 0.7152, 0.0722)));
  g = mix(vec3(dot(g, vec3(0.2126, 0.7152, 0.0722))), g, saturation);
  g -= fade * g * g;
  g = liftColor * lift + g * (1.0 - lift);
  g *= 1.0 - vignette * smoothstep(vignetteOffset, 1.0, length(c) * 1.41421);
  g += (hash(uv * resolution + seed) - 0.5) * grain;
  s = mix(s, clamp(g, 0.0, 1.0), look);
  outputColor = vec4(mix(col, sRGBTransferEOTF(vec4(s, 1.0)).rgb, look), 1.0);
}`;

const KEYS = ['exposure', 'soften', 'ca', 'caStart', 'lift', 'fade', 'warmth', 'saturation', 'vignette', 'vignetteOffset', 'grain'];

// drawGlow(renderer, inputBuffer) fills glowMap before the pass draws.
export class FilmEffect extends Effect {
  constructor(glowMap, drawGlow) {
    super('FilmEffect', fragmentShader, {
      blendFunction: BlendFunction.SRC,
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map([
        ['glowMap', new Uniform(glowMap)], ['liftColor', new Uniform(new Vector3())],
        ['strength', new Uniform(1)], ['seed', new Uniform(0)],
        ...KEYS.map((k) => [k, new Uniform(0)]),
      ]),
    });
    this.drawGlow = drawGlow;
  }

  update(renderer, inputBuffer) { this.drawGlow(renderer, inputBuffer); }

  applyLook(look) {
    const u = this.uniforms;
    for (const k of KEYS) u.get(k).value = look[k];
    u.get('liftColor').value.fromArray(look.liftColor);
  }

  set strength(v) { this.uniforms.get('strength').value = v; }
  set seed(v) { this.uniforms.get('seed').value = v; }
}
