export type Site = { latitude: number; longitude: number; bearing: number };
const circumference = 40075016.68557849;
export function validateSite(site: Site) {
  if (
    !site ||
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
        url: `https://tile.openstreetmap.org/${zoom}/${((x % n) + n) % n}/${y}.png`,
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
