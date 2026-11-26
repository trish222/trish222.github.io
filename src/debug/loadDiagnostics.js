// Installs the review diagnostics and, with ?debug in development, the lamp tuning panel.
// Returns one disposer for everything it installed, or null if the scene was replaced while loading.
export async function loadDiagnostics({ geometry, diagnostics, stage, isCurrent }) {
  const [{ installGeometryDiagnostics }, { installExperienceDiagnostics }] = await Promise.all([
    import('./geometry.js'), import('./experience.js'),
  ]);
  if (!isCurrent()) return null;
  let dispose = installGeometryDiagnostics(geometry);
  installExperienceDiagnostics(diagnostics);
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('debug')) {
    try {
      const { installLampTuning } = await import('./lampTuning.js');
      if (!isCurrent()) return dispose;
      const disposeGeometry = dispose;
      const disposeTuning = installLampTuning(diagnostics, stage);
      dispose = () => { disposeTuning(); disposeGeometry?.(); };
    } catch (error) {
      console.error('Debug panel failed; continuing without it.', error);
    }
  }
  return dispose;
}
