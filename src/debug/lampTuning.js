import * as THREE from 'three';
import { LOOK } from '../config/look.js';
import { applyScreenFx } from '../overlay/crtFx.js';

// Dev-only (`npm run dev`, ?debug): live sliders for src/config/look.js, matched
// against the Cycles r14 renders. "Copy" puts the values on the clipboard to paste back.
const SLIDERS = [
  ['envIntensity', 0, 4, 0.05],
  ['glassEnvIntensity', 0, 8, 0.05],
  ['specIntensity', 0, 300, 1],
  ['specOffset', -1, 1, 0.01, 0], ['specOffset', -1, 1, 0.01, 1], ['specOffset', -1, 1, 0.01, 2],
  ['shadeColor', 0, 1.5, 0.01, 0], ['shadeColor', 0, 1.5, 0.01, 1], ['shadeColor', 0, 1.5, 0.01, 2],
  ['shadeSaturation', 0, 2, 0.01],
  ['shadeEnvIntensity', 0, 8, 0.05],
  ['shadeRoughness', 0, 1, 0.01],
  ['clearcoat', 0, 1, 0.01],
  ['clearcoatRoughness', 0, 1, 0.01],
  ['shadeEmissive', 0, 5, 0.01],
  ['lampOffGain', 0, 4, 0.05],
  ['windowGain', 0, 2, 0.01],
  ['windowSaturation', 0, 2, 0.01],
  ['windowContrast', 0.5, 1.5, 0.01],
  ['overviewZoom', 0.9, 1.3, 0.005],
  ['overviewHeight', -0.2, 0.3, 0.005],
  ['overviewPitch', -5, 15, 0.1],
  ['mobileFitMargin', 0.8, 1.5, 0.005], ['mobileFov', 30, 80, 0.5],
  ['mobileOffsetX', -0.5, 0.5, 0.005], ['mobileOffsetY', -0.5, 0.5, 0.005],
  ['mobileYaw', -45, 45, 0.5], ['mobilePitch', -20, 30, 0.5], ['mobileHeight', -0.4, 0.4, 0.005],
  ['parallaxStrength', 0, 1.5, 0.05],
  ['pivotDepth', 0.2, 2, 0.01],
  ['yawLimit', 0, 40, 0.5],
  ['pitchUpLimit', 0, 25, 0.5],
  ['pitchDownLimit', 0, 25, 0.5],
  ['crtBarrel', 0, 0.3, 0.005],
  ['crtGlow', 0, 0.6, 0.01],
  ['crtMask', 0, 0.5, 0.01],
  ['crtFlicker', 0, 0.06, 0.001],
  ['crtTint', 0, 1, 0.01],
  ['screenEdge', 0, 1, 0.01],
  ['screenBrightness', 0.5, 2, 0.01],
  ['screenLift', 0, 0.3, 0.005],
  ['screenGlow', 0, 1, 0.01],
  ['screenCA', 0, 4, 0.05],
  ['screenGrain', 0, 0.4, 0.005],
  ['screenGlare', 0, 1, 0.01],
  ['rainAmount', 0, 1.5, 0.01],
  ['rainSpeed', 0, 4, 0.05],
  ['rainRefraction', 0, 0.08, 0.001],
  ['rainStreaks', 0, 2, 0.01],
  ['plasticBrightness', 0.5, 1.2, 0.01],
  ...['keyboardTint', 'keycapTint'].flatMap((k) => [0, 1, 2].map((i) => [k, 0.5, 3, 0.01, i])),
  ['plasticEnvIntensity', 0, 2, 0.01],
  ['plasticSpec', 0, 2, 0.01],
  ['standLift', 0, 2, 0.01, 0], ['standLift', 0, 2, 0.01, 1], ['standLift', 0, 2, 0.01, 2], ['standSpec', 0, 2, 0.01],
  ['glassSpec', 0, 1, 0.01],
  ['screenEnv', 0, 8, 0.05],
  ['screenRim', 0, 6, 0.05],
  ['screenSheen', 0, 1, 0.01],
  ['monitorTint', 0.5, 1.2, 0.01, 0], ['monitorTint', 0.5, 1.2, 0.01, 1], ['monitorTint', 0.5, 1.2, 0.01, 2],
  ['caseTint', 0.5, 3, 0.01, 0], ['caseTint', 0.5, 3, 0.01, 1], ['caseTint', 0.5, 3, 0.01, 2],
  ['msaaHandheld', 0, 4, 2],
  ['exposure', 0.25, 3, 0.01],
  ['bloomIntensity', 0, 4, 0.01], ['bloomThreshold', 0, 2, 0.01], ['displayGlow', 0, 2, 0.01], ['displayThreshold', 0, 1, 0.01],
  ['halation', 0, 2, 0.01], ['halationThreshold', 0, 4, 0.01], ['glowRadius', 0, 1, 0.01],
  ...[0, 1, 2].map((i) => ['halationTint', 0, 1, 0.01, i]),
  ['soften', 0, 1, 0.01], ['ca', 0, 6, 0.05], ['caStart', 0, 1, 0.01],
  ['vignette', 0, 1, 0.01], ['vignetteOffset', 0, 1, 0.01], ['grain', 0, 0.2, 0.002],
  ['lift', 0, 0.2, 0.002], ...[0, 1, 2].map((i) => ['liftColor', 0, 1, 0.01, i]),
  ['fade', 0, 0.5, 0.005], ['warmth', -0.2, 0.2, 0.002], ['saturation', 0, 2, 0.01],
  ['shadowFloor', 0, 1, 0.01], ...[0, 1, 2].map((i) => ['shadowFloorColor', 0, 1, 0.01, i]),
];
const CAMERA = ['overviewZoom', 'overviewHeight', 'overviewPitch', 'lookMode', 'lookModeHandheld', 'pivotDepth',
  'mobileFitMargin', 'mobileFov', 'mobileOffsetX', 'mobileOffsetY', 'mobileYaw', 'mobilePitch', 'mobileHeight'];
// Frames the lamp like the r14 lamp panel (art/previews/b2-lamp-before-after.png).
const CLOSE_UP = { position: new THREE.Vector3(-0.45, 1.12, 0.85), target: new THREE.Vector3(-0.54, 0.93, -0.04) };

export function installLampTuning(context, stage) {
  const panel = Object.assign(document.createElement('form'), { id: 'look-panel' });
  panel.style.cssText = 'position:fixed;top:8px;right:8px;z-index:9999;padding:8px;width:min(260px,calc(100vw - 16px));'
    + 'box-sizing:border-box;font:11px/1.3 monospace;color:#eee;background:#000c;border-radius:4px';
  // Keep the panel's gestures away from the scene's look-around and zoom handlers.
  for (const type of ['wheel', 'pointerdown', 'pointermove', 'pointerup', 'touchstart', 'touchmove', 'touchend']) {
    panel.addEventListener(type, (e) => e.stopPropagation(), { passive: true });
  }
  const bar = document.createElement('div');
  const list = document.createElement('div');
  list.id = 'look-list';
  list.style.cssText = 'overflow-y:auto;max-height:calc(100dvh - 80px);overscroll-behavior:contain;touch-action:pan-y;-webkit-overflow-scrolling:touch';
  panel.append(bar, list);

  // Camera keys re-frame the home pose (and the orbit around it).
  let pose = CAMERA.map((k) => LOOK[k]).join();
  function apply() {
    stage.applyLook();
    context.post.applyLook();
    applyScreenFx();
    context.navigation.applyLimits();
    context.render();
    if (pose === CAMERA.map((k) => LOOK[k]).join()) return;
    pose = CAMERA.map((k) => LOOK[k]).join();
    context.setFov(null);
  }

  for (const [key, min, max, step, index] of SLIDERS) {
    const label = document.createElement('label');
    label.style.display = 'block';
    const value = () => (index === undefined ? LOOK[key] : LOOK[key][index]);
    const input = Object.assign(document.createElement('input'), { type: 'range', min, max, step, value: value() });
    input.style.width = '100%';
    const text = () => `${key}${index === undefined ? '' : `[${index}]`} ${value()}`;
    const caption = document.createTextNode(text());
    input.addEventListener('input', () => {
      if (index === undefined) LOOK[key] = +input.value; else LOOK[key][index] = +input.value;
      caption.textContent = text();
      apply();
    });
    label.append(caption, input);
    list.append(label);
  }

  const button = (name, onClick) => {
    const b = Object.assign(document.createElement('button'), { type: 'button', textContent: name });
    b.addEventListener('click', onClick);
    bar.append(b, ' ');
    return b;
  };
  // Collapsed to the button bar on a phone, so the panel does not cover the scene it tunes.
  const collapse = button('', () => {
    list.hidden = !list.hidden;
    collapse.textContent = list.hidden ? 'show' : 'hide';
  });
  list.hidden = matchMedia('(max-width: 760px)').matches;
  collapse.textContent = list.hidden ? 'show' : 'hide';
  button('lamp', () => context.setLampOn(!context.lampOn, false));
  for (const key of ['lookMode', 'lookModeHandheld']) {
    const toggle = button(`${key}: ${LOOK[key]}`, () => {
      LOOK[key] = LOOK[key] === 'turn' ? 'orbit' : 'turn';
      toggle.textContent = `${key}: ${LOOK[key]}`;
      apply();
    });
  }

  let saved = null;
  button('close-up', () => {
    const { camera, navigation } = context;
    if (saved) {
      camera.position.copy(saved.position);
      camera.quaternion.copy(saved.quaternion);
      saved = null;
    } else {
      navigation.killReturn();
      navigation.cancelIdle();
      saved = { position: camera.position.clone(), quaternion: camera.quaternion.clone() };
      camera.position.copy(CLOSE_UP.position);
      camera.lookAt(CLOSE_UP.target);
    }
    camera.updateMatrixWorld();
    context.updateScreenOverlay();
    context.render();
  });
  const copy = button('copy', async () => {
    const json = JSON.stringify(LOOK, null, 2);
    console.log(json);
    try {
      await navigator.clipboard.writeText(json);
      copy.textContent = 'copied';
    } catch {
      copy.textContent = 'copy failed (see console)';
    }
    setTimeout(() => { copy.textContent = 'copy'; }, 1500);
  });

  document.body.append(panel);
  window.__look = { LOOK, apply };
  return () => { panel.remove(); delete window.__look; };
}
