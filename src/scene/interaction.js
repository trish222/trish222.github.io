import * as THREE from 'three';

// One gesture stream and one nearest-hit picker for every 3D action.
export function createInteraction({ canvas, camera, computer, lamp, parallax,
  canOrbit, isDragging, canLeaveScreen, overScreen, beginParallax, endParallax,
  setHover, onLamp, onEnter, onExit }) {
  const CLICK_SLOP = 5;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  let press = { id: -1, x: 0, y: 0, target: null };
  let onCanvasDown, onCanvasUp, onCanvasCancel, onPointerMove, onPointerLeave;
  const pickNdc = new THREE.Vector2();
  const pickRay = new THREE.Raycaster();

  function pickTarget(e) {
    if (!computer || !canvas || !camera) return null;
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    pickNdc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pickNdc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    const shifted = beginParallax();
    pickRay.setFromCamera(pickNdc, camera);
    if (shifted) endParallax();

    const roots = lamp ? [lamp.root, computer.root] : [computer.root];
    const hits = pickRay.intersectObjects(roots, true);
    if (!hits.length) return null;
    for (let o = hits[0].object; o; o = o.parent) {
      if (lamp && o === lamp.root) return "lamp";
      if (o === computer.root) return "machine";
    }
    return null;
  }


  function initCanvasPress() {
    onCanvasDown = (e) => {
      press.id = -1;
      if (!e.isPrimary) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (canOrbit()) {
        press = {
          id: e.pointerId,
          x: e.clientX,
          y: e.clientY,
          target: pickTarget(e),
        };
        return;
      }

      if (!canLeaveScreen() || overScreen(e.clientX, e.clientY)) return;
      press = { id: e.pointerId, x: e.clientX, y: e.clientY, target: "room" };

      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {

      }
    };

    onCanvasUp = (e) => {
      if (e.pointerId !== press.id) return;
      const moved = Math.hypot(e.clientX - press.x, e.clientY - press.y);
      const target = press.target;
      press.id = -1;
      if (target === "room") {
        if (canvas.hasPointerCapture?.(e.pointerId)) {
          canvas.releasePointerCapture(e.pointerId);
        }

        if (moved > CLICK_SLOP || overScreen(e.clientX, e.clientY)) return;
        if (canLeaveScreen()) onExit();
        return;
      }
      if (!target || moved > CLICK_SLOP || !canOrbit()) return;

      if (target === "lamp") onLamp();
      else onEnter();
    };
    onCanvasCancel = () => {
      press.id = -1;
    };
    canvas.addEventListener("pointerdown", onCanvasDown);
    canvas.addEventListener("pointerup", onCanvasUp);
    canvas.addEventListener("pointercancel", onCanvasCancel);
  }


  function initPointer() {

    onPointerMove = (e) => {
      if (e.pointerType === 'mouse') {
        const rect = canvas.getBoundingClientRect();
        if (rect.width && rect.height) parallax.pointer.set(
          THREE.MathUtils.clamp(2 * (e.clientX - rect.left) / rect.width - 1, -1, 1),
          THREE.MathUtils.clamp(1 - 2 * (e.clientY - rect.top) / rect.height, -1, 1),
        );
      }

      if (!canOrbit()) {
        setHover(0);
        return;
      }
      // A drag already owns the gesture; raycasting every coalesced move
      // cannot change its action and competes with drawing the next frame.
      if (isDragging()) {
        setHover(0);
        canvas.style.cursor = "grabbing";
        return;
      }
      if (e.target?.closest?.(".window, #taskbar, #start-menu")) {
        setHover(0);
        return;
      }
      const target = pickTarget(e);

      setHover(target === "machine" ? 1 : 0);
      canvas.style.cursor = isDragging()
        ? "grabbing"
        : target
          ? "pointer"
          : "grab";
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    onPointerLeave = () => parallax.pointer.set(0, 0);
    document.documentElement.addEventListener('pointerleave', onPointerLeave);
    window.addEventListener('blur', onPointerLeave);
  }


  initPointer();
  initCanvasPress();
  return {
    pick: pickTarget,
    cancel() { press.id = -1; },
    get finePointer() { return finePointer.matches; },
    dispose() {
      if (press.id !== -1 && canvas.hasPointerCapture?.(press.id)) canvas.releasePointerCapture(press.id);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('blur', onPointerLeave);
      document.documentElement.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('pointerdown', onCanvasDown);
      canvas.removeEventListener('pointerup', onCanvasUp);
      canvas.removeEventListener('pointercancel', onCanvasCancel);
      canvas.style.cursor = '';
      parallax.reset();
      press.id = -1;
    },
  };
}
