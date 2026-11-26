import { desktopEvents } from './session.js';

/* ==========================================
   THE RECYCLE BIN

   The one window carrying state. Its rows are hidden rather than
   removed, so Start > Log Off can put them back — which makes emptying
   it reversible, and makes it testable more than once per load.
   ========================================== */

function binRows() {
  return [...document.querySelectorAll('#bin-list .bin-item')];
}

function updateBin() {
  const left = binRows().filter(r => !r.hidden);
  const empty = document.getElementById('bin-empty');
  const count = document.getElementById('bin-count');
  const btn   = document.getElementById('bin-empty-btn');
  if (empty) empty.hidden = left.length > 0;
  if (count) count.textContent = `${left.length} object(s)`;
  /* Nothing to empty is a disabled button, not a button that does
     nothing when pressed. */
  if (btn) btn.disabled = left.length === 0;
}

function selectBinRow(row) {
  binRows().forEach(r => r.classList.toggle('selected', r === row));
}

export function initRecycleBin() {
  const list = document.getElementById('bin-list');
  if (!list) return;

  /* Single selection, the way a 98 list view did it. Click and focus
     both, so the rows answer to the keyboard as well — they carry
     tabindex, and selection following focus is what a list view does. */
  desktopEvents.on(list, 'click', e => selectBinRow(e.target.closest('.bin-item')));
  desktopEvents.on(list, 'focusin', e => selectBinRow(e.target.closest('.bin-item')));

  desktopEvents.on(document.getElementById('bin-empty-btn'), 'click', () => {
    const left = binRows().filter(r => !r.hidden);
    if (!left.length) return;
    if (!confirm(`Are you sure you want to delete these ${left.length} items?`)) return;
    left.forEach(r => { r.hidden = true; r.classList.remove('selected'); });
    updateBin();
  });

  updateBin();
}

export function refillBin() {
  binRows().forEach(r => { r.hidden = false; r.classList.remove('selected'); });
  updateBin();
}
