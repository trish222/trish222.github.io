import * as THREE from 'three';
import { LOOK } from '../config/look.js';

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
  ['yawLimit', 0, 40, 0.5],
  ['pitchUpLimit', 0, 25, 0.5],
  ['pitchDownLimit', 0, 25, 0.5],
  ['crtBarrel', 0, 0.3, 0.005],
  ['crtGlow', 0, 0.6, 0.01],
  ['crtMask', 0, 0.5, 0.01],
  ['crtFlicker', 0, 0.06, 0.001],
  ['rainAmount', 0, 1.5, 0.01],
  ['rainSpeed', 0, 4, 0.05],
  ['rainRefraction', 0, 0.08, 0.001],
  ['rainStreaks', 0, 2, 0.01],
  ['plasticBrightness', 0.5, 1.2, 0.01],
  ['plasticTint', 0.5, 1.2, 0.01, 0], ['plasticTint', 0.5, 1.2, 0.01, 1], ['plasticTint', 0.5, 1.2, 0.01, 2],
  ['plasticEnvIntensity', 0, 2, 0.01],
  ['plasticSpec', 0, 2, 0.01],
];
const CAMERA = ['overviewZoom', 'overviewHeight', 'overviewPitch'];
// Frames the lamp like the r14 lamp panel (art/previews/b2-lamp-before-after.png).
const CLOSE_UP = { position: new THREE.Vector3(-0.45, 1.12, 0.85), target: new THREE.Vector3(-0.54, 0.93, -0.04) };

export function installLampTuning(context, stage) {
  const panel = Object.assign(document.createElement('form'), { id: 'look-panel' });
  panel.style.cssText = 'position:fixed;top:8px;right:8px;z-index:9999;padding:8px;width:260px;'
    + 'font:11px/1.3 monospace;color:#eee;background:#000c;border-radius:4px';
  panel.addEventListener('pointerdown', (e) => e.stopPropagation());

  // Camera keys re-frame the home pose (and the orbit around it).
  let pose = CAMERA.map((k) => LOOK[k]).join();
  function apply() {
    stage.applyLook();
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
  button('lamp', () => context.setLampOn(!context.lampOn, false));

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
