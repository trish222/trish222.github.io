import { HalfFloatType, ShaderMaterial, Uniform, Vector3, WebGLRenderTarget } from 'three';
import { EffectComposer, EffectPass, MipmapBlurPass, RenderPass, ShaderPass } from 'postprocessing';
import { FilmEffect } from './filmEffect.js';
import { LOOK } from '../config/look.js';

const MSAA = 4;
const GLOW_LEVELS = 8; // mip levels of the glow blur, as BloomEffect's default
const GLOW_DIV = 4; // the glow source's resolution divisor; it is blurred wide anyway
// At DPR 2 the pixels are small and the film softness hides the steps; MSAA there costs ~5.5 ms (1440x900, M1).
const msaaFor = (ratio) => (ratio < 2 ? MSAA : 0);

// The glow source, at quarter resolution: the emitters (alpha 2, see markEmitters) over bloomThreshold
// for bloom, the display-referred pictures (alpha 0.5: the CRT, the city) over displayThreshold, and
// anything over halationThreshold, tinted, for halation. One blur serves all three.
const glowSource = new ShaderMaterial({
  uniforms: { inputBuffer: new Uniform(null), bloom: new Uniform(0), bloomThreshold: new Uniform(0),
    displayGlow: new Uniform(0), displayThreshold: new Uniform(0),
    halation: new Uniform(0), halationThreshold: new Uniform(0), haloTint: new Uniform(new Vector3()) },
  vertexShader: 'varying vec2 vUv; void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 1.0, 1.0); }',
  fragmentShader: `uniform sampler2D inputBuffer;
uniform float bloom, bloomThreshold, displayGlow, displayThreshold, halation, halationThreshold;
uniform vec3 haloTint;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(inputBuffer, vUv);
  float l = max(dot(c.rgb, vec3(0.2126, 0.7152, 0.0722)), 1e-4);
  vec3 glow = c.rgb * clamp(c.a - 1.0, 0.0, 1.0) * bloom * smoothstep(bloomThreshold, bloomThreshold + 0.1, l);
  float display = 1.0 - clamp(abs(c.a - 0.5) * 4.0, 0.0, 1.0);
  glow += c.rgb * display * displayGlow * smoothstep(displayThreshold, displayThreshold + 0.2, l);
  glow += c.rgb * haloTint * halation * max(l - halationThreshold, 0.0) / l;
  gl_FragColor = vec4(glow, 1.0);
}`,
  depthWrite: false, depthTest: false,
});

// Bloom is selective by marker rather than by a re-render: lamp_bulb and crt_glow write alpha 2
// (the HalfFloat buffer keeps it), so only their visible pixels glow.
export function markEmitters(meshes) {
  for (const { material } of meshes) {
    material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n  gl_FragColor.a = 2.0;');
    };
    material.needsUpdate = true;
  }
}

// One merged EffectPass (the film effect); its update draws the glow first.
export function createPost(renderer, scene, camera) {
  const composer = new EffectComposer(renderer, { frameBufferType: HalfFloatType, multisampling: msaaFor(renderer.getPixelRatio()) });
  const glowTarget = new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthBuffer: false });
  const source = new ShaderPass(glowSource);
  const blur = new MipmapBlurPass();
  blur.levels = GLOW_LEVELS;
  blur.initialize(renderer, false, HalfFloatType);
  const film = new FilmEffect(blur.texture, (r, input) => {
    source.render(r, input, glowTarget);
    blur.render(r, glowTarget);
  });
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new EffectPass(camera, film));

  const resize = () => {
    composer.multisampling = msaaFor(renderer.getPixelRatio());
    composer.setSize();
    const { width, height } = composer.inputBuffer;
    glowTarget.setSize(Math.ceil(width / GLOW_DIV), Math.ceil(height / GLOW_DIV));
    blur.setSize(width / GLOW_DIV, height / GLOW_DIV);
  };
  resize();

  const applyLook = () => {
    film.applyLook(LOOK);
    const u = glowSource.uniforms;
    u.bloom.value = LOOK.bloomIntensity;
    u.bloomThreshold.value = LOOK.bloomThreshold;
    u.displayGlow.value = LOOK.displayGlow;
    u.displayThreshold.value = LOOK.displayThreshold;
    u.halation.value = LOOK.halation;
    u.halationThreshold.value = LOOK.halationThreshold;
    u.haloTint.value.fromArray(LOOK.halationTint);
    blur.radius = LOOK.glowRadius;
  };
  applyLook();

  return {
    applyLook,
    render(seconds) {
      film.seed = seconds % 1000;
      composer.render();
    },
    resize, // after the renderer's size or pixel ratio changes
    // The CRT's own arrival curve (crtMaterial.js): at the screen the look is gone.
    setZoom(p) {
      const t = Math.min(Math.max((p - 0.5) / 0.5, 0), 1);
      film.strength = 1 - t * t * (3 - 2 * t);
    },
    dispose() { composer.dispose(); glowTarget.dispose(); blur.dispose(); },
  };
}
