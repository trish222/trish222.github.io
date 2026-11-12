import { Clock } from 'three';

// Own the scheduled frame and visibility listener; the scene owns what a frame does.
export function createAnimationLoop(update) {
  const clock = new Clock();
  let frame = null;
  function tick() {
    frame = requestAnimationFrame(tick);
    update(clock.getDelta());
  }
  function stop() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
  }
  function visibility() {
    if (document.hidden) stop();
    else if (frame === null) {
      clock.getDelta(); // discard time spent hidden
      tick();
    }
  }
  return {
    get running() { return frame !== null; },
    start() {
      if (frame !== null) return;
      document.addEventListener('visibilitychange', visibility);
      tick();
    },
    dispose() {
      stop();
      document.removeEventListener('visibilitychange', visibility);
      clock.stop();
    },
  };
}
