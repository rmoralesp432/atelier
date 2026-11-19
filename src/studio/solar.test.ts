import { it, expect } from 'vitest';
import { solarInstant, solarPosition, defaultSolar } from './solar';
it('uses SunCalc degree conventions and known equinox noon geometry', () => {
  const study = {
    ...defaultSolar,
    date: '2026-03-20',
    minutes: 12 * 60,
    utcOffset: 0,
  };
  const site = { latitude: 51.5, longitude: 0, bearing: 0 };
  const sun = solarPosition(site, study);
  expect(sun.altitude).toBeGreaterThan(37);
  expect(sun.altitude).toBeLessThan(40);
  expect(sun.azimuth).toBeGreaterThan(175);
  expect(sun.azimuth).toBeLessThan(185);
  expect(sun.direction.z).toBeGreaterThan(0.7); // noon sun south, not north
  expect(Math.hypot(...Object.values(sun.direction))).toBeCloseTo(1, 8);
  const rotated = solarPosition({ ...site, bearing: 90 }, study);
  expect(rotated.direction.x).toBeCloseTo(sun.direction.z, 8);
  expect(rotated.direction.z).toBeCloseTo(-sun.direction.x, 8);
  expect(rotated.altitude).toBe(sun.altitude);
  expect(solarPosition(site, { ...study, minutes: 0 }).altitude).toBeLessThan(
    0,
  );
});
it('converts explicit site civil time and UTC offset without using browser timezone', () => {
  expect(
    solarInstant({
      ...defaultSolar,
      date: '2026-06-21',
      minutes: 8 * 60,
      utcOffset: -6,
    }).toISOString(),
  ).toBe('2026-06-21T14:00:00.000Z');
});
