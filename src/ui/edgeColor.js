// Safari tints its status bar and toolbar from the page edges and <meta name="theme-color">. The CSS owns
// the colours (the state map in edgeColor.css); this keeps the meta equal to the top colour (the bottom edge has no meta).
export function syncThemeColor() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  const apply = () => meta.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--edge-top-to').trim());
  new MutationObserver(apply).observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true });
  matchMedia('(max-width: 760px), (max-height: 520px) and (pointer: coarse)').addEventListener('change', apply);
  apply();
}
