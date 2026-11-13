// Lamp toggle state: a target (on/off) and an eased level that chases it.
export function createLampState({ startOn = true, fadeS = 0.4, onLevel }) {
  let on = startOn;
  let p = on ? 1 : 0;
  const ease = (v) => (on ? 1 - (1 - v) * (1 - v) : v * v);
  return {
    get on() { return on; },
    get moving() { return p !== (on ? 1 : 0); },
    get progress() { return p; },
    set(next, jump) {
      on = !!next;
      if (jump) { p = on ? 1 : 0; onLevel(p); }
    },
    tick(dt) {
      const target = on ? 1 : 0;
      if (p === target) return;
      p = on ? Math.min(1, p + dt / fadeS) : Math.max(0, p - dt / fadeS);
      onLevel(ease(p));
    },
    reset() { on = startOn; p = on ? 1 : 0; },
  };
}
