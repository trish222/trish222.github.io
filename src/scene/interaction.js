import * as THREE from 'three';

// One gesture stream and one nearest-hit picker for every 3D action.
export function createInteraction({ canvas, camera, proxies, parallax,
  canOrbit, isDragging, canLeaveScreen, overScreen, beginParallax, endParallax,
  onHoverTarget, onLamp, onEnter, onProject, onExit }) {
  const CLICK_SLOP = 5;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  let press = { id: -1, x: 0, y: 0, target: null };
  let armed = null; // touch: the first tap on an object shows its label, the second presses it
  let onCanvasDown, onCanvasUp, onCanvasCancel, onPointerMove, onPointerLeave;
  const pickNdc = new THREE.Vector2();
  const pickRay = new THREE.Raycaster();

  function pickTarget(e) {
    if (!proxies || !canvas || !camera) return null;
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    pickNdc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pickNdc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    const shifted = beginParallax();
    pickRay.setFromCamera(pickNdc, camera);
    if (shifted) endParallax();

    const { lampChain, crt, treehouse, projects } = proxies;
    const hits = pickRay.intersectObjects([lampChain, crt, treehouse, ...projects], false);
    if (!hits.length) return null;
    const hit = hits[0].object;
    const project = projects.indexOf(hit);
    if (project >= 0) return `project:${project}`;
    return { [lampChain.id]: "lamp", [treehouse.id]: "treehouse" }[hit.id] ?? "machine";
  }


  // Touch has no hover, so a first tap on an object only shows its label. The monitor is the exception:
  // one tap zooms in.
  function firstTap(e, target) {
    if (!e.pointerType || e.pointerType === "mouse" || target === armed || target === "machine") {
      armed = null;
      return false;
    }
    armed = target;
    onHoverTarget(target);
    return true;
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
      if (moved > CLICK_SLOP || !canOrbit()) return;
      if (firstTap(e, target) || !target) return;
      if (target === "lamp") onLamp();
      else if (target.startsWith("project:")) onProject(Number(target.slice(8)));
      else if (target === "machine") onEnter();
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

      if (e.pointerType !== 'mouse') return;
      if (!canOrbit()) {
        onHoverTarget(null);
        return;
      }
      // A drag already owns the gesture; raycasting every coalesced move
      // cannot change its action and competes with drawing the next frame.
      if (isDragging()) {
        onHoverTarget(null);
        canvas.style.cursor = "grabbing";
        return;
      }
      if (e.target?.closest?.(".window, #taskbar, #start-menu, .ux")) {
        onHoverTarget(null);
        return;
      }
      const target = pickTarget(e);
      onHoverTarget(target);
      // The treehouse is labelled but does nothing when pressed, so it gets no pointer.
      canvas.style.cursor = target && target !== "treehouse" ? "pointer" : "grab";
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
    firstTap,
    cancel() { press.id = -1; armed = null; },
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
