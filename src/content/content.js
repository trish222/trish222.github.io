// Everything the screen says about Trish, independent of the OS theme that shows it
// (docs/scene-contract.md, "Screen OS themes"). Plain strings only: the theme escapes them.
import { owner, about } from './about.js';
import { projects } from './projects.js';
import { contact, resume } from './resume.js';

export const CONTENT = { owner, about, projects, contact, resume };

export { FLOPPIES } from './projects.js';
export { CREDITS } from './credits.js';

// Every word the room itself says (labels, hints, buttons, the intro), in one place to edit.
export const UI = {
  introCta: "click me",
  hint: "drag to look around · click things on the desk",
  back: "desk",
  backLabel: "Back to desk",
  menu: "menu",
  credits: "credits",
  lofi: "skip 3D",
  lofiBack: "back to 3D",
  objects: {
    crt: "use computer",
    lamp: "lamp",
  },
  menuItems: [
    ["about", "About"],
    ["projects", "Projects"],
    ["resume", "Resume"],
    ["contact", "Contact"],
    ["credits", "Credits"],
  ],
};
