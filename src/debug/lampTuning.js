import * as THREE from 'three';
import { LOOK } from '../config/look.js';

// Dev-only (`npm run dev`, ?debug): live sliders for src/config/look.js, matched
// against the Cycles r14 renders. "Copy" puts the values on the clipboard to paste back.
const SLIDERS = [
  ['envIntensity', 0, 4, 0.05],
  ['glassEnvIntensity', 0, 8, 0.05],
  ['specIntensity', 0, 4, 0.01],
  ['specOffset', -0.3, 0.3, 0.005, 0], ['specOffset', -0.3, 0.3, 0.005, 1], ['specOffset', -0.3, 0.3, 0.005, 2],
  ['shadeRoughness', 0, 1, 0.01],
  ['clearcoat', 0, 1, 0.01],
  ['clearcoatRoughness', 0, 1, 0.01],
  ['shadeEmissive', 0, 5, 0.01],
  ['lampOffGain', 0, 4, 0.05],
  ['windowGain', 0, 1, 0.005],
  ['overviewZoom', 0.9, 1.3, 0.005],
];
// Frames the lamp like the r14 lamp panel (art/previews/b2-lamp-before-after.png).
const CLOSE_UP = { position: new THREE.Vector3(-0.45, 1.12, 0.85), target: new THREE.Vector3(-0.54, 0.93, -0.04) };

export function installLampTuning(context, stage) {
  const panel = Object.assign(document.createElement('form'), { id: 'look-panel' });
  panel.style.cssText = 'position:fixed;top:8px;right:8px;z-index:9999;padding:8px;width:260px;'
    + 'font:11px/1.3 monospace;color:#eee;background:#000c;border-radius:4px';
  panel.addEventListener('pointerdown', (e) => e.stopPropagation());

  // A resize re-poses the camera but keeps the orbit radius, so scale that with the dolly.
  let zoom = LOOK.overviewZoom;
  function apply() {
    stage.applyLook();
    if (zoom === LOOK.overviewZoom) return;
    context.navigation.home.radius *= LOOK.overviewZoom / zoom;
    zoom = LOOK.overviewZoom;
    window.dispatchEvent(new Event('resize'));
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
    panel.append(label);
  }

  const button = (name, onClick) => {
    const b = Object.assign(document.createElement('button'), { type: 'button', textContent: name });
    b.addEventListener('click', onClick);
    panel.append(b, ' ');
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
  button('copy', () => {
    const json = JSON.stringify(LOOK, null, 2);
    navigator.clipboard?.writeText(json);
    console.log(json);
  });

  document.body.append(panel);
  window.__look = { LOOK, apply };
  return () => { panel.remove(); delete window.__look; };
}
