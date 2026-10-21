export const CITY_CENTER = { lat: 18.53, lng: 73.87 };

export function distanceKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function nearest(point, places = []) {
  let best = null;
  let bestD = Infinity;
  for (const p of places) {
    const d = distanceKm(point, p);
    if (d < bestD) [best, bestD] = [p, d];
  }
  return best;
}
