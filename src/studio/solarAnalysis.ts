import * as SunCalc from 'suncalc';
import { solarInstant, solarPosition, type SolarStudy } from './solar';
import type { Site } from './site';
import type { Vec3 } from '../model';

/** Solar apparent longitude, Meeus ch. 25 (the same low-order solar series used
 * by SunCalc 2). For seasonal DATE presets, not a high-precision ephemeris. */
function longitude(time: number) {
  const year = new Date(time).getUTCFullYear();
  const u = year - 2000;
  const deltaT =
    year < 2050
      ? 62.92 + 0.32217 * u + 0.005589 * u * u
      : -20 + 32 * ((year - 1820) / 100) ** 2 - 0.5628 * (2150 - year);
  const t = (time / 86400000 + 2440587.5 + deltaT / 86400 - 2451545) / 36525;
  const rad = Math.PI / 180;
  const m = (357.52911 + t * (35999.05029 - 0.0001537 * t)) * rad;
  const l = 280.46646 + t * (36000.76983 + 0.0003032 * t);
  const c =
    (1.914602 - 0.004817 * t - 0.000014 * t * t) * Math.sin(m) +
    (0.019993 - 0.000101 * t) * Math.sin(2 * m) +
    0.000289 * Math.sin(3 * m);
  return (
    (((l + c - 0.00569 - 0.00478 * Math.sin((125.04 - 1934.136 * t) * rad)) %
      360) +
      360) %
    360
  );
}
export function seasonalDates(year: number, utcOffset: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return [];
  return [0, 1, 2, 3].map((index) => {
    let low = Date.UTC(year, 2 + index * 3, 17),
      high = Date.UTC(year, 2 + index * 3, 25);
    const target = index * 90;
    for (let i = 0; i < 35; i++) {
      const mid = (low + high) / 2,
        error = ((longitude(mid) - target + 540) % 360) - 180;
      if (error < 0) low = mid;
      else high = mid;
    }
    return {
      name: [
        'March equinox',
        'June solstice',
        'September equinox',
        'December solstice',
      ][index],
      date: new Date((low + high) / 2 + utcOffset * 3600000)
        .toISOString()
        .slice(0, 10),
      instant: new Date((low + high) / 2),
    };
  });
}

/** Split at the horizon; never draw a false chord connecting sunset to sunrise
 * when a civil day begins in daylight (polar/offset edge cases). */
export function dailySunPaths(site: Site, study: SolarStudy): Vec3[][] {
  const paths: Vec3[][] = [];
  let path: Vec3[] = [],
    previous: ReturnType<typeof solarPosition> | undefined;
  for (let minutes = 0; minutes <= 1440; minutes += 5) {
    const p = solarPosition(site, { ...study, minutes });
    if (previous && previous.altitude > 0 !== p.altitude > 0) {
      const a = previous.direction,
        b = p.direction,
        t = -a.y / (b.y - a.y);
      const x = a.x + (b.x - a.x) * t,
        z = a.z + (b.z - a.z) * t,
        length = Math.hypot(x, z);
      const horizon = { x: x / length, y: 0, z: z / length };
      if (p.altitude > 0) path = [horizon];
      else {
        path.push(horizon);
        if (path.length > 1) paths.push(path);
        path = [];
      }
    }
    if (p.altitude > 0) path.push(p.direction);
    previous = p;
  }
  if (path.length > 1) paths.push(path);
  return paths;
}

export function solarDay(site: Site, study: SolarStudy) {
  const times = SunCalc.getTimes(
    solarInstant({ ...study, minutes: 720 }),
    site.latitude,
    site.longitude,
    0,
    study.utcOffset * 60,
  );
  const civilTime = (date: Date | null) =>
    date && Number.isFinite(date.getTime())
      ? new Date(date.getTime() + study.utcOffset * 3600000)
          .toISOString()
          .slice(11, 16)
      : null;
  return {
    sunrise: civilTime(times.sunrise),
    sunset: civilTime(times.sunset),
    noon: civilTime(times.solarNoon),
    polar: times.alwaysUp ? 'day' : times.alwaysDown ? 'night' : null,
  };
}

export function shadowOnLevelGround(
  site: Site,
  study: SolarStudy,
  height: number,
) {
  const sun = solarPosition(site, study);
  if (sun.altitude <= 0 || height < 0) return null;
  const x = (-sun.direction.x / sun.direction.y) * height,
    z = (-sun.direction.z / sun.direction.y) * height;
  return { x, z, length: Math.hypot(x, z) };
}
