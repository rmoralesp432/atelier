export type MapStyle = 'street' | 'satellite';
export type Site = {
  latitude: number;
  longitude: number;
  bearing: number;
  style?: MapStyle;
};
export const mapSources = {
  street: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    credit: '© OpenStreetMap contributors',
    link: 'https://www.openstreetmap.org/copyright',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    credit: 'Tiles © Esri · Maxar · Earthstar Geographics · GIS User Community',
    link: 'https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9',
  },
};
export const trueNorth = (bearing: number) => ({
  x: -Math.sin((bearing * Math.PI) / 180),
  y: 0,
  z: -Math.cos((bearing * Math.PI) / 180),
});

const circumference = 40075016.68557849;
export function validateSite(site: Site) {
  if (
    !site ||
    (site.style !== undefined &&
      !['street', 'satellite'].includes(site.style)) ||
    !Number.isFinite(site.latitude) ||
    Math.abs(site.latitude) > 85 ||
    !Number.isFinite(site.longitude) ||
    Math.abs(site.longitude) > 180 ||
    !Number.isFinite(site.bearing) ||
    Math.abs(site.bearing) > 360
  )
    throw new Error(
      'Use latitude −85 to 85, longitude −180 to 180, and orientation −360° to 360°.',
    );
}
// Local metric approximation to Web Mercator over a small architectural site.
// World +X is east, world -Z is north before clockwise site bearing.
export function siteTiles(site: Site, zoom = 17) {
  validateSite(site);
  const n = 2 ** zoom,
    lat = (site.latitude * Math.PI) / 180;
  const tx = ((site.longitude + 180) / 360) * n,
    ty = ((1 - Math.asinh(Math.tan(lat)) / Math.PI) / 2) * n;
  const size = (circumference * Math.cos(lat)) / n;
  const tiles = [];
  // Only the displayed, bounded 3 × 3 site; no panning prefetch or offline download.
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const x = Math.floor(tx) + dx,
        y = Math.floor(ty) + dy;
      if (y < 0 || y >= n) continue;
      tiles.push({
        url: mapSources[site.style ?? 'street'].url
          .replace('{z}', String(zoom))
          .replace('{x}', String(((x % n) + n) % n))
          .replace('{y}', String(y)),
        x: (x + 0.5 - tx) * size,
        z: (y + 0.5 - ty) * size,
        size,
      });
    }
  return tiles;
}
export function googleMapsUrl(site: Site) {
  validateSite(site);
  return `https://www.google.com/maps/search/?api=1&query=${site.latitude},${site.longitude}`;
}

/** Move map imagery in fixed project axes; model coordinates and true north do not change. */
export function shiftMap(site: Site, dx: number, dz: number): Site {
  if (![dx, dz].every(Number.isFinite))
    throw new Error('Map movement must be finite.');
  const a = (site.bearing * Math.PI) / 180,
    metersPerDegree = circumference / 360;
  const east = dx * Math.cos(a) - dz * Math.sin(a);
  const south = dx * Math.sin(a) + dz * Math.cos(a);
  const latitude = site.latitude + south / metersPerDegree;
  const longitude =
    ((site.longitude -
      east / (metersPerDegree * Math.cos((site.latitude * Math.PI) / 180)) +
      540) %
      360) -
    180;
  const next = { ...site, latitude, longitude };
  validateSite(next);
  return next;
}
