// Resize in desktop coordinates, using the same mapping as window dragging.
export function initWindowResizing({ point, focus, isFullscreen, signal }) {
  document.querySelectorAll('.window').forEach(win => {
    const handle = document.createElement('button');
    handle.className = 'window-resize';
    handle.type = 'button';
    handle.setAttribute('aria-label', 'Resize window');
    win.append(handle);
    let gesture = null;
    const resize = (width, height) => {
      const desktop = document.getElementById('desktop');
      const maxWidth = Math.max(1, desktop.clientWidth - win.offsetLeft);
      const maxHeight = Math.max(1, desktop.clientHeight - win.offsetTop);
      win.style.width = `${Math.min(maxWidth, Math.max(240, width))}px`;
      win.style.height = `${Math.min(maxHeight, Math.max(160, height))}px`;
    };
    handle.addEventListener('pointerdown', e => {
      if (e.button !== 0 || win.dataset.maximized === 'true' || isFullscreen()) return;
      e.preventDefault();
      e.stopPropagation();
      focus(win.id.replace('window-', ''));
      gesture = { id: e.pointerId, point: point(e), width: win.offsetWidth, height: win.offsetHeight };
      handle.setPointerCapture(e.pointerId);
    }, { signal });
    handle.addEventListener('pointermove', e => {
      if (!gesture || e.pointerId !== gesture.id) return;
      const p = point(e);
      resize(gesture.width + p.x - gesture.point.x, gesture.height + p.y - gesture.point.y);
    }, { signal });
    const end = () => { gesture = null; };
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      handle.addEventListener(type, end, { signal });
    }
    handle.addEventListener('keydown', e => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
      e.preventDefault();
      const step = e.shiftKey ? 40 : 10;
      resize(win.offsetWidth + (e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0),
        win.offsetHeight + (e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0));
    }, { signal });
    signal?.addEventListener('abort', () => handle.remove(), { once: true });
  });
}
