// Visual-only choreography. These values never enter the modeling transaction.
export function constructionFrame(elapsed: number, duration = 1250) {
  const t = Math.max(0, Math.min(1, elapsed / duration));
  const rise = Math.max(0, Math.min(1, (t - 0.18) / 0.72));
  const ease = 1 - Math.pow(1 - rise, 3);
  return {
    trace: Math.min(1, t / 0.22),
    height: Math.max(0.002, ease),
    opacity: Math.min(1, t / 0.5),
    guideOpacity: t < 0.75 ? 0.85 : (0.85 * (1 - t)) / 0.25,
    done: t === 1,
    phase: t < 0.18 ? 'footprint' : t < 0.9 ? 'extruding' : 'settling',
  };
}
