# Camera and navigation

The current camera is perspective, 28° FOV, seated at a 12° downward angle and 10° around the monitor front. Monitor exit returns to this seated pose. The old 20°/37° overview is historical, not the navigation destination.

`src/scene/camera.js` owns the target, screen fits, Catmull–Rom path and logarithmic zoom. `src/scene/navigation.js` owns OrbitControls, ±7° horizontal / ±4° vertical limits, return tween and wall safety constraints. `src/scene/parallax.js` temporarily offsets the presented pose, then restores it. The existing algorithms and calibration are preserved.

See [architecture.md](architecture.md) for ownership and replacement contracts, [screen-overlay.md](screen-overlay.md) for projection background, and [history/camera-before-refactor.md](history/camera-before-refactor.md) for previous calibration decisions. Run the interaction suite after changing camera math.
