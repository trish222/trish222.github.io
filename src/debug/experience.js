import * as THREE from 'three';

// Diagnostic commands use live accessors so tuning cannot leave cached state behind.
export function installExperienceDiagnostics(context) {
  window.__scene = context.scene;
  /* The room's own plan, so the fit scripts can read the opening
     instead of restating it. Three of them hardcoded WINDOW_Z, the
     sill and the opening's two sides, and all three went stale the
     first time the window was re-sized. */
  window.__room = context.ROOM_PLAN;
  /* Exposed for the same reason the scene is: a review script that
     wants to project its own points — `_tightfit.mjs` reads the
     model's true corners rather than the conservative box `__fit`
     reports — needs the camera `__fit` projects against. */
  window.__camera = context.camera;
  window.__composer = context.composer;
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
        /* How far past the resting pair the spring allows, and where
           the walls themselves are — the first is what a drag can
           reach, the second is what it is being kept off. */
        stretch: [
          deg(context.navigation.leash.min - context.navigation.home.theta),
          deg(context.navigation.leash.max - context.navigation.home.theta),
        ],
        walls: (() => {
          const w = context.navigation.wallRange(
            context.navigation.home.radius,
            context.navigation.home.phi + context.navigation.downAngle,
          );
          return [deg(w.lo - context.FACING), deg(w.hi - context.FACING)];
        })(),
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
    homeDist: context.camDist(),
    homeFrustum: context.frustumFor(),
    fog: context.scene.fog ? [context.scene.fog.near, context.scene.fog.far] : null,
  });
  /* Switches the field of view and re-derives everything downstream of
     it — see setFov. No argument just reports. */
  window.__fov = (deg) => {
    if (deg !== undefined) context.setFov(deg);
    return { fov: context.fov, dist: context.camDist(), frustum: context.frustumFor() };
  };
  /* Switches the tone-mapping operator on a live page and re-derives
     the void's pre-image with it, which is what let AgX and ACES be
     compared off one build rather than two. No argument just reports.
     Materials recompile themselves: three's `setProgram` treats
     `renderer.toneMapping` as part of the program cache key. */
  window.__tonemap = (name) => {
    if (name !== undefined) {
      const m = context.TONE_MAPPINGS[name];
      if (m === undefined) return { error: `unknown: ${name}`, known: Object.keys(context.TONE_MAPPINGS) };
      context.renderer.toneMapping = m;
      context.applyVoidColor();
      context.render();
    }
    const found = Object.entries(context.TONE_MAPPINGS)
      .find(([, v]) => v === context.renderer.toneMapping);
    const target = new THREE.Color(context.VOID);
    return {
      tonemap: found ? found[0] : context.renderer.toneMapping,
      exposure: context.renderer.toneMappingExposure,
      path: context.composer ? "composer" : "direct",
      void: context.VOID,
      /* What the clear is actually set to, and what the void would
         have come out as with no pre-image — the error this is all
         here to remove. */
      background: `#${context.scene.background.getHexString()}`,
      untreated: `#${context.tonemapForward(target, context.composer ? context.renderer.toneMapping : THREE.NoToneMapping, context.renderer.toneMappingExposure).getHexString()}`,
    };
  };

  window.__lights = (next = {}) => {
    if (next.moon !== undefined) context.lights.moon.intensity = next.moon;
    /* The **base**, for the reason the exposure's is: the lamp scales
       the fill as it goes out (OFF_DARKNESS), so writing
       `hemi.intensity` here would be reverted by the next toggle.
       `applyLampLevel` is what puts the figure on the light, at this
       instant's lamp level. */
    if (next.hemi !== undefined) {
      context.hemiBase = next.hemi;
      context.applyLampLevel(context.lampLevel);
    }
    /* The off state's two knobs, so the pair can be judged against one
       picture the way the rig's four were. `off` is OFF_DARKNESS; it
       takes effect on the next frame of a fade, or now if the lamp is
       already out. */
    if (next.off !== undefined) {
      context.offDarkness = next.off;
      context.applyLampLevel(context.lampLevel);
    }
    if (next.env !== undefined) context.scene.environmentIntensity = next.env;
    if (next.at !== undefined) context.setMoonAt(...next.at);
    /* The operator's exposure, which in a night scene is a lighting
       control rather than a finishing one — see TONE_EXPOSURE. */
    if (next.exposure !== undefined) {
      /* The **base**, not the live value: the lamp lifts the exposure
         as it goes out, and the loop writes `toneBase + lift` every
         frame it moves. Writing `toneMappingExposure` here instead
         would be silently reverted the next time the lamp was
         switched. */
      context.toneBase = next.exposure;
      context.toneWritten = -1; // force the re-solve below
      context.applyLampLevel(context.lampLevel); // writes the exposure and the pre-image
    }
    if (next.glow !== undefined) {
      context.screenGlowBase = next.glow;
      /* The loop would pick this up on its next frame, but the point
         of the handle is to see it now — and under reduced motion
         there is no next frame. `bright` is 1 at rest, so this is what
         the loop would have written anyway. */
      context.computer.screenGlow.intensity = context.screenGlowBase;
    }
    if (Object.keys(next).length) context.render();
    return {
      moon: context.lights.moon.intensity,
      /* What the fill is running at this instant, and the figure it
         would be at with the lamp on — which is the one HEMI_INTENSITY
         names. They differ only while the lamp is off or fading. */
      hemi: context.lights.hemi.intensity,
      hemiBase: context.hemiBase,
      off: context.offDarkness,
      hemiGround: `#${context.lights.hemi.groundColor.getHexString()}`,
      env: context.scene.environmentIntensity,
      /* Without this the `env` figure above is a number about nothing:
         ENV_INTENSITY is 0, so no HDRI is fetched at all. */
      envMap: !!context.envMap,
      glow: context.screenGlowBase,
      /* What the operator is running at this instant, and the figure
         it would be at with the lamp on — which is the one
         TONE_EXPOSURE names. They differ only while the lamp is off or
         fading. */
      exposure: context.renderer.toneMappingExposure,
      exposureBase: context.toneBase,
      moonFrom: context.lights.moon.position.toArray().map((v) => Number(v.toFixed(2))),
      moonAt: context.MOON_AT.toArray(),
      /* Degrees below the horizon, which is the figure the shadow's
         length is argued in. */
      elevation: Number(
        THREE.MathUtils.radToDeg(Math.asin(-context.moonDirection().y)).toFixed(2),
      ),
    };
  };

  window.__lamp = (next = {}) => {
    if (next.on !== undefined) context.setLampOn(next.on, next.jump !== false);
    /* Re-aiming moves the light, which is the one change in this scene
       that invalidates the frozen shadow map — so this is the only
       place outside `window.__lights` that sets `needsUpdate`. */
    const aim =
      next.tilt !== undefined
        ? (context.renderer.shadowMap.needsUpdate = true,
          context.lampMod.aimLamp(next.tilt, next.swing))
        : context.lampMod.aimLamp();
    const levels = context.lampMod.lampLevels(next);
    if (
      next.point !== undefined ||
      next.spot !== undefined ||
      next.spillBase !== undefined ||
      next.spillArm !== undefined ||
      next.rim !== undefined ||
      next.warm !== undefined ||
      next.tilt !== undefined
    )
      context.render();
    return {
      on: context.lampOn,
      level: Number(context.lampLevel.toFixed(4)),
      p: Number(context.lampP.toFixed(4)),
      fadeSeconds: context.LAMP_FADE_S,

      curve: Array.from({ length: 21 }, (_, i) => {
        const u = i / 20;
        return [
          Number((u * context.LAMP_FADE_S).toFixed(3)),
          Number((1 - (1 - u) * (1 - u)).toFixed(3)),
        ];
      }),
      exposure: context.renderer.toneMappingExposure,
      exposureBase: context.toneBase,
      exposureLift: context.LAMP_EXPOSURE_LIFT,
      colour: levels.colour,
      lights: levels,
      /* Where the beam lands on the desk top, in world coordinates —
         which is what "aimed at the keyboard" or "aimed at bare
         walnut" is actually a statement about. */
      aim,
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
  /* The rain on the window: where its clock stands, how fast it is
     running and whether reduced motion caught it. A speed in
     cell-runs per second re-tunes it on a live page, which is how the
     streaks were set without a rebuild per candidate. */
  window.__rain = (speed) => {
    const r = context.rainState(speed);
    if (speed !== undefined) context.render();
    return r;
  };

  /* See the comment at the call site. Returns nothing at all if the
     lamp is not up, rather than a point about somewhere else. */
  const lampProbes = () => {
    if (!context.lamp) return {};
    const aim = context.lampMod.aimLamp();
    const mouth = context.lamp.spot.getWorldPosition(new THREE.Vector3());
    return {
      ...(aim?.pool
        ? { "lamp pool": [aim.pool[0], aim.pool[1] + 0.02, aim.pool[2]] }
        : {}),
      "lamp shade": mouth.toArray(),
    };
  };
  window.__probes = (extra) => {
    const pts = {
      /* Inside the pool the window throws, and outside it — the two
         numbers the whole rig is set between. */
      "floor pool": [-4.0, 0.02, 12.0],
      "floor dark": [9.0, 0.02, 13.5],
      "floor bare": [14.0, 0.02, 2.0],
      "wall far": [6.0, 13.0, -8.85],
      "wall left": [-12.9, 13.0, 6.0],
      "desk pool": [-6.0, context.DESK_TOP_Y + 0.02, 0.0],
      "desk dark": [7.6, context.DESK_TOP_Y + 0.02, -4.0],
      "keyboard": [0.1, context.DESK_TOP_Y + 0.55, 2.6],

      ...lampProbes(),
      ...(extra || {}),
    };
    context.render();
    const gl = context.renderer.getContext();
    const v = new THREE.Vector3();
    const px = new Uint8Array(4);
    const out = {};
    for (const [name, p] of Object.entries(pts)) {
      v.set(p[0], p[1], p[2]).project(context.camera);
      const x = Math.round(((v.x + 1) / 2) * gl.drawingBufferWidth);
      /* NDC y is up and so is gl's read origin, so no flip here. */
      const y = Math.round(((v.y + 1) / 2) * gl.drawingBufferHeight);
      if (x < 0 || y < 0 || x >= gl.drawingBufferWidth || y >= gl.drawingBufferHeight) {
        out[name] = { hex: "(off frame)", rgb: [], luma: 0 };
        continue;
      }
      gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const rgb = [px[0], px[1], px[2]];
      out[name] = {
        hex: "#" + rgb.map((c) => c.toString(16).padStart(2, "0")).join(""),
        rgb,
        luma: Math.round(0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]),
      };
    }
    return out;
  };

  /* One pixel by *screen* fraction — (0,0) top-left. The world probes
     above follow the geometry, which is what you want for "is this
     surface lit"; this is for "is that part of the picture black",
     where the question is about the frame and a world point can
     quietly land on the wrong surface. */

  window.__gtao = (blend, margin) => {
    if (context.gtaoPass && blend !== undefined) {
      context.gtaoPass.blendIntensity = blend;
      context.render();
    }
    return { blend: context.gtaoPass ? context.gtaoPass.blendIntensity : null, margin };
  };

  /* Scales the establishing shot and re-derives everything downstream
     of it — see setHomeZoom. No argument just reports. */
  window.__zoom = (f) => {
    if (f !== undefined) context.setHomeZoom(f);
    return { zoom: context.homeZoom, dist: context.camDist(), frustum: context.frustumFor() };
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
    context.showStill(moving);
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
    context.showStill(moving);
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
