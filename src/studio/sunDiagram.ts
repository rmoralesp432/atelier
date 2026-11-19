import { solarPosition, type SolarStudy } from './solar';
import { seasonalDates } from './solarAnalysis';
import type { Site } from './site';
import type { Vec3 } from '../model';

let cached:
  { key: string; value: { paths: Vec3[][]; surface: number[] } } | undefined;

/** A true solar-declination band, sampled from winter to summer solstice.
 * Every vertex uses the same astronomical solver and project-north rotation
 * as the light. Hour curves are civil times at the chosen UTC offset. */
export function seasonalSunDiagram(site: Site, study: SolarStudy) {
  const year = Number(study.date.slice(0, 4));
  const key = [
    site.latitude,
    site.longitude,
    site.bearing,
    year,
    study.utcOffset,
  ].join(':');
  if (cached?.key === key) return cached.value;
  const start = seasonalDates(year - 1, study.utcOffset)[3]?.date;
  const end = seasonalDates(year, study.utcOffset)[1]?.date;
  if (!start || !end) return { paths: [] as Vec3[][], surface: [] as number[] };
  const low = Date.parse(start),
    high = Date.parse(end);
  const rows = Array.from({ length: 25 }, (_, i) => {
    const date = new Date(low + ((high - low) * i) / 24)
      .toISOString()
      .slice(0, 10);
    return Array.from(
      { length: 97 },
      (_, j) =>
        solarPosition(site, { ...study, date, minutes: j * 15 }).direction,
    );
  });
  const paths: Vec3[][] = [],
    surface: number[] = [];
  const segments = (points: Vec3[]) => {
    let line: Vec3[] = [];
    for (const p of points) {
      if (p.y >= 0) line.push(p);
      else {
        if (line.length > 1) paths.push(line);
        line = [];
      }
    }
    if (line.length > 1) paths.push(line);
  };
  rows.forEach((row, i) => {
    if (i % 4 === 0) segments(row);
  });
  for (let hour = 0; hour < 24; hour++)
    segments(rows.map((row) => row[hour * 4]));
  const triangle = (a: Vec3, b: Vec3, c: Vec3) => {
    if ([a, b, c].every((p) => p.y >= 0))
      surface.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  };
  for (let i = 0; i < 24; i++)
    for (let j = 0; j < 96; j++) {
      triangle(rows[i][j], rows[i + 1][j], rows[i][j + 1]);
      triangle(rows[i + 1][j], rows[i + 1][j + 1], rows[i][j + 1]);
    }
  const value = { paths, surface };
  cached = { key, value };
  return value;
}
