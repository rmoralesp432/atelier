export type MapStyle = 'street' | 'satellite';
export type Site = {
  latitude: number;
  longitude: number;
  bearing: number;
  style?: MapStyle;
  /** Exact square coverage in local meters. Omitted preserves legacy tile coverage. */
  coverage?: number;
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
    (site.coverage !== undefined &&
      (!Number.isFinite(site.coverage) ||
        site.coverage < 250 ||
        site.coverage > 5000)) ||
    !Number.isFinite(site.latitude) ||
    Math.abs(site.latitude) > 85 ||
    !Number.isFinite(site.longitude) ||
    Math.abs(site.longitude) > 180 ||
    !Number.isFinite(site.bearing) ||
    Math.abs(site.bearing) > 360
  )
    throw new Error(
      'Use latitude −85 to 85, longitude −180 to 180, orientation −360° to 360°, and map coverage 250–5000 m.',
    );
}
// Local metric approximation to Web Mercator over a small architectural site.
// World +X is east, world -Z is north before clockwise site bearing.
export function siteTiles(site: Site, zoom = 17) {
  validateSite(site);
  const lat = (site.latitude * Math.PI) / 180;
  // A larger area uses fewer, lower-zoom tiles, never bulk-prefetches imagery.
  // At most five tiles per axis (25 total), with the boundary tiles cropped.
  if (site.coverage !== undefined)
    zoom = Math.max(
      0,
      Math.min(
        19,
        Math.floor(
          Math.log2((circumference * Math.cos(lat) * 4) / site.coverage),
        ),
      ),
    );
  const n = 2 ** zoom;
  const tx = ((site.longitude + 180) / 360) * n,
    ty = ((1 - Math.asinh(Math.tan(lat)) / Math.PI) / 2) * n;
  const size = (circumference * Math.cos(lat)) / n;
  const half = site.coverage === undefined ? null : site.coverage / 2;
  const minX =
    half === null ? Math.floor(tx) - 1 : Math.floor(tx - half / size);
  const maxX =
    half === null ? Math.floor(tx) + 1 : Math.ceil(tx + half / size) - 1;
  const minY =
    half === null ? Math.floor(ty) - 1 : Math.floor(ty - half / size);
  const maxY =
    half === null ? Math.floor(ty) + 1 : Math.ceil(ty + half / size) - 1;
  const tiles = [];
  for (let y = minY; y <= maxY; y++)
    for (let x = minX; x <= maxX; x++) {
      if (y < 0 || y >= n) continue;
      const left = (x - tx) * size,
        top = (y - ty) * size;
      const x0 = half === null ? left : Math.max(-half, left);
      const z0 = half === null ? top : Math.max(-half, top);
      const x1 = half === null ? left + size : Math.min(half, left + size);
      const z1 = half === null ? top + size : Math.min(half, top + size);
      tiles.push({
        url: mapSources[site.style ?? 'street'].url
          .replace('{z}', String(zoom))
          .replace('{x}', String(((x % n) + n) % n))
          .replace('{y}', String(y)),
        x: (x0 + x1) / 2,
        z: (z0 + z1) / 2,
        size,
        width: x1 - x0,
        depth: z1 - z0,
        uv: {
          u0: (x0 - left) / size,
          u1: (x1 - left) / size,
          v0: 1 - (z1 - top) / size,
          v1: 1 - (z0 - top) / size,
        },
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
