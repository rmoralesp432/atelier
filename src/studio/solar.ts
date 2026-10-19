import * as SunCalc from 'suncalc';
import type { Site } from './site';
export type SolarStudy = {
  enabled: boolean;
  date: string;
  minutes: number;
  utcOffset: number;
  path: boolean;
};
export const defaultSolar: SolarStudy = {
  enabled: false,
  date: new Date().toISOString().slice(0, 10),
  minutes: 12 * 60,
  utcOffset: -new Date().getTimezoneOffset() / 60,
  path: true,
};
export function solarInstant(study: SolarStudy) {
  return new Date(
    Date.parse(`${study.date}T00:00:00Z`) +
      (study.minutes - study.utcOffset * 60) * 60000,
  );
}
export function solarPosition(site: Site, study: SolarStudy) {
  const p = SunCalc.getPosition(
      solarInstant(study),
      site.latitude,
      site.longitude,
    ),
    altitude = (p.altitude * Math.PI) / 180,
    azimuth = (p.azimuth * Math.PI) / 180,
    c = Math.cos(altitude),
    a = (site.bearing * Math.PI) / 180;
  const x = Math.sin(azimuth) * c,
    z = -Math.cos(azimuth) * c;
  return {
    altitude: p.altitude,
    azimuth: p.azimuth,
    direction: {
      x: x * Math.cos(a) + z * Math.sin(a),
      y: Math.sin(altitude),
      z: -x * Math.sin(a) + z * Math.cos(a),
    },
  };
}
