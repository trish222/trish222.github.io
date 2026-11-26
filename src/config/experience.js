import { LOOK } from './look.js';
// Keep the fullscreen query identical to THE PHONE'S DESKTOP in style.css.
export const DESKTOP_FULLSCREEN_QUERY = '(max-width: 760px), (max-height: 520px) and (pointer: coarse)';
export function isDesktopFullscreen() {
  return window.matchMedia(DESKTOP_FULLSCREEN_QUERY).matches;
}
// Phones and tablets get scene-mobile.glb (smaller hero maps); the choice is made once, at load.
export function usesMobileScene() {
  return isDesktopFullscreen() || window.matchMedia('(pointer: coarse)').matches;
}

// Whether this browser can make a WebGL2 context, probed on a throwaway canvas and released at once, so a
// visitor without one never downloads three.js or the scene (main.js, desktop.js).
export function hasWebGL() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return !!gl;
  } catch {
    return false;
  }
}

// A look-around setting for this device: phones and tablets read its *Handheld twin.
export const lookFor = (key) => LOOK[usesMobileScene() ? `${key}Handheld` : key];
export const lookMode = () => lookFor('lookMode');
