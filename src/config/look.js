// Real-time look on top of the bake, matched to the Cycles r14 renders with the
// ?debug tuning panel (src/debug/lampTuning.js). The panel edits this object live.
export const LOOK = {
  envIntensity: 1.8,
  glassEnvIntensity: 4.6,
  specIntensity: 77,
  specOffset: [0.04, 0.53, 0.74],
  shadeColor: [0.92, 0.53, 0.32],
  shadeSaturation: 1.74,
  shadeEnvIntensity: 4,
  shadeRoughness: 0.04,
  clearcoat: 0.35,
  clearcoatRoughness: 0.04,
  shadeEmissive: 2.12,
  lampOffGain: 1,
  windowGain: 1.63,
  windowSaturation: 1.3,
  windowContrast: 1.19,
  overviewZoom: 1.21,
  overviewHeight: 0.045,
  overviewPitch: 2.3,
  // Handheld home view (camera.js): margin 1 = monitor and keyboard edge to edge, the lens capped at mobileFov
  // degrees, the framing slid mobileOffsetX / Y metres right / up in the image.
  mobileFitMargin: 1.36,
  mobileFov: 52.5,
  mobileOffsetX: 0.02,
  mobileOffsetY: -0.1,
  // Handheld home pose, measured from the straight-on view: yaw (deg, + looks toward the left wall) rotates
  // it around the monitor, pitch (deg, + looks down more), height (m) lifts the camera. The fit still centres
  // on the screen; the drag limits are measured from this pose.
  mobileYaw: 0,
  mobilePitch: 0,
  mobileHeight: 0,  plasticBrightness: 0.9,
  // Matched to the monitor's cream as seen from the overview, lamp on (their albedos are darker and yellower, and they sit lower in the lamp's light)
  monitorTint: [0.78, 0.67, 0.56],
  caseTint: [2.33, 2.05, 1.8],
  keyboardTint: [1.7, 1.62, 2.68], // keyboard and mouse
  keycapTint: [1.93, 1.8, 2.36],
  crtBarrel: 0,
  crtGlow: 0,
  crtMask: 0.04,
  crtFlicker: 0.005,
  crtTint: 0.33,
  screenEdge: 0.27,
  screenBrightness: 1.13,
  screenLift: 0.05,
  screenGlow: 0,
  screenCA: 0.6,
  screenGrain: 0.005,
  screenGlare: 0.08,
  rainAmount: 0,
  rainSpeed: 0,
  rainRefraction: 0,
  rainStreaks: 0,
  parallaxStrength: 0.7,
  // Drag look-around: "orbit" swings the camera around a pivot pivotDepth times as far out as the screen
  // (1: the monitor), "turn" rotates it in place (camera.js). lookMode is for desktops, lookModeHandheld for
  // phones and tablets (usesMobileScene), as are the *Handheld pivot and limits.
  lookMode: 'orbit',
  lookModeHandheld: 'orbit',
  pivotDepth: 1.17,
  yawLimit: 30.5,
  pitchUpLimit: 25,
  pitchDownLimit: 16,
  pivotDepthHandheld: 0.65,
  yawLimitHandheld: 30.5,
  pitchUpLimitHandheld: 20,
  pitchDownLimitHandheld: 16,
  // A pivot behind the screen (pivotDepth > 1) moves the desk with the finger; one in front moves it against,
  // so invertDrag flips both drag axes back to grab-style.
  invertDrag: false,
  invertDragHandheld: true,
  plasticEnvIntensity: 0.2,
  plasticSpec: 0.85,
  standLift: [0.41, 0.25, 0.14], // the monitor's stand, in the chin's shadow (bakedMaterial.js)
  standSpec: 0.5,
  glassSpec: 0.03,
  screenEnv: 1,
  screenRim: 2.5,
  screenSheen: 0.35,
  // The post chain (src/scene/post.js, filmEffect.js): bloom and halation in linear light before AgX,
  // the grade after it in sRGB values. ca is px at the corners; caStart and vignetteOffset are radii (0 centre, 1 corner).
  exposure: 0.92,
  msaaHandheld: 2, // samples on phones (DPR capped at 1.5); desktops below DPR 2 use 4, DPR 2 none (post.js)
  bloomIntensity: 1,
  bloomThreshold: 0.2,
  displayGlow: 0.25,
  displayThreshold: 0.15,
  halation: 1.15,
  halationThreshold: 0.94,
  glowRadius: 0.7, // bloom and halation share one blur
  halationTint: [0.67, 0.59, 0.46],
  soften: 0.25,
  ca: 1.45,
  caStart: 0.55,
  vignette: 0.62,
  vignetteOffset: 0.35,
  grain: 0.062,
  lift: 0.03,
  liftColor: [0.75, 0.71, 1], // slightly cool shadows against the warm highlights
  fade: 0.015,
  warmth: -0.086,
  saturation: 1.17,
  // Baked floor, walls and desk underside: lightmap values darker than shadowFloor x shadowFloorColor
  // (linear, per channel) lift toward it, so the shadow under the desk stays a dim warm grey.
  shadowFloor: 0.2,
  shadowFloorColor: [0.5, 0.42, 0.34],
};
