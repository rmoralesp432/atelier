import { it, expect } from 'vitest';
import {
  seasonalDates,
  solarDay,
  dailySunPaths,
  shadowOnLevelGround,
} from './solarAnalysis';
import { defaultSolar, solarPosition } from './solar';
import { parsePlan } from '../intelligence/plan';
import { applyPlan, directPlan, newSession } from '../intelligence/engine';
import { initialProject } from '../model';

const study = {
  ...defaultSolar,
  date: '2026-03-20',
  minutes: 720,
  utcOffset: 0,
  enabled: true,
  seasonal: true,
};
const site = { latitude: 51.5, longitude: 0, bearing: 0 };
it('calculates seasonal calendar presets with hemisphere-neutral names and site civil dates', () => {
  const events = seasonalDates(2026, 0);
  expect(events.map((e) => e.date)).toEqual([
    '2026-03-20',
    '2026-06-21',
    '2026-09-23',
    '2026-12-21',
  ]);
  // Published 2026 event times rounded to a minute. This low-order formula is
  // for date presets, not precise ephemerides: stay within 15 minutes.
  const known = [
    '2026-03-20T14:46Z',
    '2026-06-21T08:24Z',
    '2026-09-23T00:05Z',
    '2026-12-21T20:50Z',
  ];
  events.forEach((event, i) =>
    expect(
      Math.abs(event.instant.getTime() - Date.parse(known[i])),
    ).toBeLessThan(15 * 60000),
  );
  expect(seasonalDates(2026, -6)[2].date).toBe('2026-09-22');
  expect(seasonalDates(1800, 0)).toEqual([]);
});
it('calculates civil sunrise/noon/sunset, and polar day and night honestly', () => {
  const london = solarDay(site, study);
  expect(Number(london.sunrise!.slice(0, 2))).toBe(6);
  expect(Number(london.sunset!.slice(0, 2))).toBe(18);
  expect(
    solarDay(
      { latitude: 80, longitude: 0, bearing: 0 },
      { ...study, date: '2026-06-21' },
    ).polar,
  ).toBe('day');
  expect(
    solarDay(
      { latitude: 80, longitude: 0, bearing: 0 },
      { ...study, date: '2026-12-21' },
    ).polar,
  ).toBe('night');
  expect(solarDay(site, { ...study, utcOffset: 1 }).noon).toBe(
    `13${london.noon!.slice(2)}`,
  );
});
it('splits daylight paths rather than connecting across night, and respects both hemispheres', () => {
  // Deliberately different civil timezone: daylight spans both ends of the day.
  const segments = dailySunPaths(site, { ...study, utcOffset: 12 });
  expect(segments).toHaveLength(2);
  for (const segment of segments)
    for (let i = 0; i < segment.length; i++) {
      expect(segment[i].y).toBeGreaterThanOrEqual(0);
      expect(Math.hypot(...Object.values(segment[i]))).toBeCloseTo(1, 6);
      if (i)
        expect(
          Math.hypot(
            segment[i].x - segment[i - 1].x,
            segment[i].y - segment[i - 1].y,
            segment[i].z - segment[i - 1].z,
          ),
        ).toBeLessThan(0.1);
    }
  const south = { latitude: -33.8, longitude: 151.2, bearing: 0 };
  const june = solarPosition(south, {
    ...study,
    date: '2026-06-21',
    utcOffset: 10,
  });
  const december = solarPosition(south, {
    ...study,
    date: '2026-12-21',
    utcOffset: 10,
  });
  expect(december.altitude).toBeGreaterThan(june.altitude + 40);
});
it('projects shadow vectors into project axes without changing physical length', () => {
  const a = shadowOnLevelGround(site, study, 4)!;
  const b = shadowOnLevelGround({ ...site, bearing: 90 }, study, 4)!;
  expect(a.z).toBeLessThan(0);
  expect(a.length).toBeCloseTo(
    4 / Math.tan((solarPosition(site, study).altitude * Math.PI) / 180),
    8,
  );
  expect(b.length).toBeCloseTo(a.length, 8);
  expect(b.x).toBeCloseTo(a.z, 8);
  expect(shadowOnLevelGround(site, { ...study, minutes: 0 }, 4)).toBeNull();
});
it('supports solar instructions through the checked engine without modifying geometry or history', async () => {
  const source = newSession({ ...initialProject(), site });
  const plan = directPlan({
    type: 'solar_study',
    ...study,
    targets: ['$selected'],
  });
  const result = await applyPlan(source, plan);
  expect(result.session.project).toEqual(source.project);
  expect(result.session.past).toEqual([]);
  expect(result.message).toContain('Sunrise 06:');
  expect(result.message).toContain('Top-point shadow');
  await expect(applyPlan(newSession(initialProject()), plan)).rejects.toThrow(
    'site location',
  );
  expect(() =>
    parsePlan(
      directPlan({
        type: 'solar_study',
        ...study,
        date: '2026-02-31',
        targets: [],
      }),
    ),
  ).toThrow();
});
