import { buildNightScenery } from '../nightwindow.js';

// Add a builder with the same local-space contract to swap only the view outside.
export const SCENERY_PRESETS = Object.freeze({ night: buildNightScenery });
export const WINDOW_SCENERY = 'night';
