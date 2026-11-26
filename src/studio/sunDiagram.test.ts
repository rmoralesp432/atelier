import { it, expect } from 'vitest';
import { seasonalSunDiagram } from './sunDiagram';
import { defaultSolar } from './solar';
import { solarDay, seasonalDates } from './solarAnalysis';
import { solarPosition } from './solar';
it('constructs a non-planar solar band with unit-radius curves above the horizon', () => {
  const d = seasonalSunDiagram(
    { latitude: 40, longitude: -105, bearing: 30 },
    { ...defaultSolar, date: '2026-03-20', utcOffset: -7 },
  );
  expect(d.paths.length).toBeGreaterThan(15);
  expect(d.surface.length).toBeGreaterThan(1000);
  for (const p of d.paths.flat()) {
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(1, 10);
  }
  expect(Math.max(...d.paths.flat().map((p) => p.y))).toBeGreaterThan(0.9);
  expect(d.paths.some((p) => p.length > 30)).toBe(true);
});
it('seasonal presets have a visible sun at solar noon instead of inheriting midnight', () => {
  const site = { latitude: 41.6, longitude: -88.5, bearing: 0 };
  for (const event of seasonalDates(2026, -6)) {
    const study = {
      ...defaultSolar,
      date: event.date,
      utcOffset: -6,
      minutes: 0,
    };
    expect(solarPosition(site, study).altitude).toBeLessThan(0);
    const [h, m] = solarDay(site, study).noon!.split(':').map(Number);
    expect(
      solarPosition(site, { ...study, minutes: h * 60 + m }).altitude,
    ).toBeGreaterThan(0);
  }
});
it('rotating project north rotates the diagram without changing solar altitude', () => {
  const study = { ...defaultSolar, date: '2026-06-21', utcOffset: 0 };
  const a = seasonalSunDiagram(
    { latitude: -33, longitude: 18, bearing: 0 },
    study,
  );
  const b = seasonalSunDiagram(
    { latitude: -33, longitude: 18, bearing: 90 },
    study,
  );
  a.paths.flat().forEach((p, i) => {
    const q = b.paths.flat()[i];
    expect(q.y).toBeCloseTo(p.y);
    expect(q.x).toBeCloseTo(p.z);
    expect(q.z).toBeCloseTo(-p.x);
  });
});
