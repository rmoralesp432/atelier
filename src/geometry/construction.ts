// Visual-only choreography. These values never enter the modeling transaction.
export function constructionFrame(elapsed: number, duration = 3000) {
  const t = Math.max(0, Math.min(1, elapsed / duration));
  const rise = Math.max(0, Math.min(1, (t - 0.24) / 0.66));
  const ease = rise * rise * (3 - 2 * rise);
  return {
    trace: Math.min(1, t / 0.26),
    height: Math.max(0.002, ease),
    opacity: Math.min(1, t / 0.5),
    guideOpacity: t < 0.75 ? 0.85 : (0.85 * (1 - t)) / 0.25,
    done: t === 1,
    phase: t < 0.24 ? 'footprint' : t < 0.9 ? 'extruding' : 'settling',
  };
}
