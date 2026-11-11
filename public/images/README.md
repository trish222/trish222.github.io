# Room startup images

Original captures of this portfolio's own procedural Three.js scene,
at 1440×900 and 390×844, converted to JPEG at quality 78.
No external imagery is used. These provide a first view before JavaScript
and WebGL finish starting; `src/main.js` removes the picture after scene
initialization or when entering the no-WebGL fallback.

Refresh both images when the opening room composition changes. Match
the home camera and viewport, and keep the mobile source breakpoint
in `index.html` aligned with `MOBILE_BP` in `src/scene.js`.
