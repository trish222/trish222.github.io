// DOM listeners and timers belonging to one initialization of the desktop.
export function createLifecycle() {
  let controller = new AbortController();
  const timeouts = new Set();
  const intervals = new Set();
  function dispose() {
    controller.abort();
    timeouts.forEach(clearTimeout);
    intervals.forEach(clearInterval);
    timeouts.clear();
    intervals.clear();
  }
  return {
    get signal() { return controller.signal; },
    on(target, type, handler, options = {}) {
      target.addEventListener(type, handler, { ...(typeof options === 'boolean' ? { capture: options } : options), signal: controller.signal });
    },
    timeout(callback, delay) {
      const id = setTimeout(() => { timeouts.delete(id); callback(); }, delay);
      timeouts.add(id);
      return id;
    },
    interval(callback, delay) {
      const id = setInterval(callback, delay);
      intervals.add(id);
      return id;
    },
    reset() { dispose(); controller = new AbortController(); },
    dispose,
  };
}
