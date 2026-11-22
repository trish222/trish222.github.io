import * as THREE from 'three';

// Diagnostic commands use live accessors so tuning cannot leave cached state behind.
export function installExperienceDiagnostics(context) {
  window.__scene = context.scene;
  /* Exposed for the same reason the scene is: a review script that
     wants to project its own points — `_tightfit.mjs` reads the
     model's true corners rather than the conservative box `__fit`
     reports — needs the camera `__fit` projects against. */
  window.__camera = context.camera;
  window.__stillReady = () => !!context.snapshot.canvas;
  /* Where the furniture lands in the frame, in NDC — ±1 is the edge.
     This is the knob FRUSTUM and ISO_TARGET are set against: "does the
     desk fit" is a question about eight projected corners, not
     something to judge off a screenshot. `_deskfit.mjs` is the pass
     that reads it on both viewports. */

  window.__orbit = (swing, rise) => {
    if (!context.navigation.controls) return null;
    if (swing !== undefined) {
      /* Park exactly where asked, and *stay* there: kill a walk home in
         progress, spend the glide, and clear the idle timer so the next
         one does not reclaim the camera out from under a screenshot. */
      context.navigation.killReturn();
      context.navigation.cancelIdle();
      context.navigation.spendGlide();
      context.navigation.setAngles(
        /* The *resting* range, not the stretched one: a pose parked
           inside the spring's band would unwind out of it on the next
           tick, under whatever is being shot. */
        THREE.MathUtils.clamp(
          context.navigation.home.theta + THREE.MathUtils.degToRad(swing),
          context.navigation.leash.softMin,
          context.navigation.leash.softMax,
        ),
        THREE.MathUtils.clamp(
          context.navigation.home.phi - THREE.MathUtils.degToRad(rise || 0),
          context.navigation.controls.minPolarAngle,
          context.navigation.controls.maxPolarAngle,
        ),
      );
      context.navigation.controls.update();
      context.updateScreenOverlay();
      context.render();
    }
    const deg = THREE.MathUtils.radToDeg;
    // During a return tween the navigation.controls intentionally stand down; read
    // the real camera pose rather than their last cached spherical angles.
    context.navigation.spherical.setFromVector3(context.flyOffset.copy(context.camera.position).sub(context.navigation.controls.target));
    const theta = context.navigation.spherical.theta;
    return {
      swing: deg(theta - context.navigation.home.theta), // off home
      front: deg(theta - context.FACING), // off the monitor's front
      rise: deg(context.navigation.home.phi - context.navigation.spherical.phi),
      enabled: context.navigation.controls.enabled,
      facing: context.screenFacing(),
      limits: {
        front: [
          deg(context.navigation.leash.softMin - context.FACING),
          deg(context.navigation.leash.softMax - context.FACING),
        ],
        swing: [
          deg(context.navigation.leash.softMin - context.navigation.home.theta),
          deg(context.navigation.leash.softMax - context.navigation.home.theta),
        ],
        // How far past the resting pair the spring allows.
        stretch: [
          deg(context.navigation.leash.min - context.navigation.home.theta),
          deg(context.navigation.leash.max - context.navigation.home.theta),
        ],
        rise: context.navigation.riseLimits,
      },
    };
  };
  /* The camera itself, in the terms the perspective conversion is
     argued in: what the FOV is, how far back that stands the camera,
     and what frustum height it therefore frames at the target. `_persp.mjs`
     prints it beside each shot. */
  window.__cam = () => ({
    kind: `persp ${context.fov}°`,
    fov: context.fov,
    near: context.camera.near,
    far: context.camera.far,
    dist: context.camera.position.distanceTo(context.flyTarget),
    eyeY: context.camera.position.y,
    frustum: 2 * context.camera.position.distanceTo(context.flyTarget) * context.tanHalfFov,
  });
  /* Switches the field of view and re-derives everything downstream of
     it — see setFov. No argument just reports. */
  window.__fov = (deg) => {
    if (deg !== undefined) context.setFov(deg);
    return { fov: context.fov };
  };
  window.__lamp = (next = {}) => {
    if (next.on !== undefined) context.setLampOn(next.on, next.jump !== false);
    return {
      on: context.lampOn,
      level: Number(context.lampLevel.toFixed(4)),
      mix: context.lampMix(),
      p: Number(context.lampP.toFixed(4)),
      fadeSeconds: context.LAMP_FADE_S,
      exposure: context.renderer.toneMappingExposure,
      button: context.lampBtn
        ? { pressed: context.lampBtn.getAttribute("aria-pressed"), hidden: context.lampBtn.hidden }
        : null,
    };
  };

  window.__pick = (x, y) => {
    const r = context.canvasEl?.getBoundingClientRect();
    if (!r) return null;
    return context.pickTarget({ clientX: r.left + x, clientY: r.top + y });
  };
  /* "current" starts the flight from wherever the camera has been
     swung to; "home" walks it back first. See FLY_FROM. */
  window.__flyFrom = (mode) => {
    if (mode === "current" || mode === "home") context.flyFrom = mode;
    return context.flyFrom;
  };
  /* The flight exactly as a press on the machine starts it — the
     refit of the curve's first knot, or the walk home, included.
     flyToScreen skips both; this is the one the review scripts want. */
  window.__enter = () => context.enterScreen();
  // Parks the camera at a close-up for review captures; the overlay follows.
  window.__view = (position, target) => {
    context.navigation.killReturn();
    context.navigation.cancelIdle();
    context.navigation.setEnabled(false);
    context.camera.position.fromArray(position);
    context.camera.lookAt(...target);
    context.camera.updateMatrixWorld();
    context.updateScreenOverlay();
    context.render();
  };

  window.__flyTo = (x) => {
    if (!context.flyTl) return null;
    const t = context.clamp01(x);
    context.flyTl.pause();
    /* The flight's parameter means nothing while the second move is
       off its endpoint, so park that first. Straight to 0 rather than
       animated: this is a review handle, not a transition. */
    if (context.dive.value !== 0) {
      context.diveTl?.pause();
      context.diveState.q = 0;
      context.dive.dir = 0;
      context.setDive(0);
    }
    const moving = t > 0 && t < 1;
    document.body.classList.toggle("screen-active", t > 0);
    document.body.classList.toggle("screen-zooming", moving);
    context.fly.dir = 0; // parked: --scan and --blur resolve exactly
    /* Parked anywhere but the establishing shot, the camera is the
       flight's — same as during a real one, so the hint and the
       canvas's pointer events park with it. (Seeking to 0 fires the
       timeline's onReverseComplete, which hands them back.) */
    context.navigation.setEnabled(t === 0);
    context.flyTl.progress(t, false);
    context.render();
    return {
      position: context.camera.position.toArray(),
      target: context.flyTarget.toArray(),
      /* Read back off the pose rather than off the projection: there is
         no camera.top to subtract from any more, and the frustum height
         a perspective camera frames is its distance times the FOV. */
      frustumHeight: 2 * context.camera.position.distanceTo(context.flyTarget) * context.tanHalfFov,
      dist: context.camera.position.distanceTo(context.flyTarget),
      fov: context.fov,
      fade: context.flyState.fade,
    };
  };

  window.__diveTo = (x) => {
    if (!context.diveTl) return null;
    const t = context.clamp01(x);
    if (context.fly.value !== 1) window.__flyTo(1);
    context.diveTl.pause();
    const moving = t > 0 && t < 1;
    document.body.classList.toggle("screen-zooming", moving);
    document.body.classList.toggle("screen-focused", !moving);
    context.applyFade(moving ? 0 : 1);
    context.dive.dir = 0; // parked
    /* Timeline progress, like __flyTo — so the two differ from the
       geometric parameter by the same easing, and what this shows is
       what the move shows there. */
    context.diveTl.progress(t, false);
    context.setDive(context.diveState.q);
    context.render();
    return {
      position: context.camera.position.toArray(),
      target: context.flyTarget.toArray(),
      frustumHeight: 2 * context.camera.position.distanceTo(context.flyTarget) * context.tanHalfFov,
      dist: context.camera.position.distanceTo(context.flyTarget),
      /* What covering this viewport asks for, beside what the login's
         framing asks for — the whole of what the move is between. */
      arriveFrustum: context.screenFrustum(context.canvasEl.clientWidth / context.canvasEl.clientHeight),
      coverFrustum: context.coverFrustum(context.canvasEl.clientWidth / context.canvasEl.clientHeight),
      brokenOut: document.body.classList.contains("glass-fullscreen"),
      fov: context.fov,
    };
  };


}
