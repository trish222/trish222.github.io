// Tuning constants for the scene's experience state; scene.js owns the state that uses them.

export const MOBILE_BP = 760;

export const LAMP_START_ON = true;

export const LAMP_FADE_S = 0.3; // P4 done-when: the crossfade lands in under 400 ms

export const BACKGROUND = "#1c1a2a";

export const HOVER_RATE = 7; // hover easing, per second

export const MAX_DPR = 2;
export const HANDHELD_MAX_DPR = 1.5;

// LOOKING AROUND

export const FLY_FROM = "current";

export const FACE_MIN = 0.17; // ~80° off the normal

// FLYING INTO THE SCREEN

export const FLY_S = 1.6; // seconds, the whole camera move

export const FADE_S = 0.3;
export const FLY_EASE = "power3.inOut";
export const FADE_EASE = "power1.inOut";

export const FADE_SCALE = 0.015;

// THE SECOND MOVE — the bezel framing in to a full viewport

export const DIVE_S = 0.9; // seconds; the flight's 1.6s would drag over a dolly this short
export const DIVE_EASE = FLY_EASE;

export const SCREEN_BASE_W = 900;
