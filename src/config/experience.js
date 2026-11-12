// Keep the fullscreen query identical to THE PHONE'S DESKTOP in style.css.
export const DESKTOP_FULLSCREEN_QUERY = '(max-width: 760px), (max-height: 520px) and (pointer: coarse)';
export function isDesktopFullscreen() {
  return window.matchMedia(DESKTOP_FULLSCREEN_QUERY).matches;
}
