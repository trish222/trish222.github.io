import { UI } from '../content/content.js';

// The Resume window's and the lo-fi page's "Save as PDF" button share this markup and label.
// iOS and Android ignore the download attribute or save the file somewhere
// unfindable, so there the PDF opens in a tab and is saved or shared from it.
const MOBILE = /iPhone|iPad|iPod|Android/i;

export const resumeSaveHtml = () => `<a class="win-button resume-save" href="/resume.pdf" download="Trish-Nguyen-Resume.pdf">
  <img src="/icons/floppy.svg" width="16" height="16" alt="">${UI.saveResume}
</a>`;

export function initResumeSave() {
  const toolbar = document.querySelector('#window-resume .window-toolbar');
  if (toolbar) toolbar.innerHTML = resumeSaveHtml();
  if (!MOBILE.test(navigator.userAgent)) return;
  for (const link of document.querySelectorAll('.resume-save')) {
    link.removeAttribute('download');
    link.target = '_blank';
    link.rel = 'noopener';
  }
}
