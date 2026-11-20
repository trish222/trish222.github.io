// A returning visitor gets no hint and no "click me" wait. Storage can be blocked or cleared,
// which reads as a first visit.
const KEY = 'trish-desk-visited';

export const firstVisit = (() => { try { return !localStorage.getItem(KEY); } catch { return true; } })();

export function markVisited() {
  try { localStorage.setItem(KEY, '1'); } catch { /* blocked storage: every visit is a first */ }
}
