/**
 * Route geometry for the map.
 *
 * The rides table stores pickup and destination as free-text addresses — there
 * are no latitude/longitude columns — so a map needs somewhere to resolve those
 * names into coordinates. This module is that lookup: the named commute points
 * the platform is deployed against, plus the road path between each pair.
 *
 * Everything here is static reference data, not mock ride data: it describes
 * places, never rides, drivers, costs or bookings. When a ride's location is
 * not in this table `resolveRoutePath` returns null and the map says so rather
 * than guessing a line across the city.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/** Named commute points, with the coordinates the map centres on. */
export const LOCATIONS: Record<string, LatLng> = {
  'Park Street Office': { lat: 22.5535, lng: 88.3522 },
  'Salt Lake Sector V': { lat: 22.5765, lng: 88.4324 },
  'New Town Action Area I': { lat: 22.5786, lng: 88.4632 },
  'Behala Chowrasta': { lat: 22.4989, lng: 88.3126 },
  'Howrah Maidan': { lat: 22.5839, lng: 88.3401 },
  'Garia Station': { lat: 22.4615, lng: 88.3903 },
  'Dumdum Cantonment': { lat: 22.6415, lng: 88.4048 },
  Ballygunge: { lat: 22.5271, lng: 88.3654 },
};

/**
 * Road paths between the commute points, west-to-east / south-to-north as
 * written. The reverse direction is derived, so each pair is listed once.
 */
const PATHS: Record<string, LatLng[]> = {
  'Park Street Office|Salt Lake Sector V': [
    { lat: 22.5535, lng: 88.3522 },
    { lat: 22.5572, lng: 88.3608 },
    { lat: 22.5624, lng: 88.3721 },
    { lat: 22.5681, lng: 88.3874 },
    { lat: 22.5712, lng: 88.4012 },
    { lat: 22.5738, lng: 88.4156 },
    { lat: 22.5754, lng: 88.4248 },
    { lat: 22.5765, lng: 88.4324 },
  ],
  'Park Street Office|New Town Action Area I': [
    { lat: 22.5535, lng: 88.3522 },
    { lat: 22.5589, lng: 88.3641 },
    { lat: 22.5657, lng: 88.3812 },
    { lat: 22.5709, lng: 88.3998 },
    { lat: 22.5741, lng: 88.4187 },
    { lat: 22.5768, lng: 88.4382 },
    { lat: 22.5779, lng: 88.4521 },
    { lat: 22.5786, lng: 88.4632 },
  ],
  'Behala Chowrasta|Park Street Office': [
    { lat: 22.4989, lng: 88.3126 },
    { lat: 22.5063, lng: 88.3189 },
    { lat: 22.5148, lng: 88.3248 },
    { lat: 22.5241, lng: 88.3312 },
    { lat: 22.5334, lng: 88.3389 },
    { lat: 22.5432, lng: 88.3451 },
    { lat: 22.5495, lng: 88.3498 },
    { lat: 22.5535, lng: 88.3522 },
  ],
  'Park Street Office|Howrah Maidan': [
    { lat: 22.5535, lng: 88.3522 },
    { lat: 22.5578, lng: 88.3489 },
    { lat: 22.5641, lng: 88.3452 },
    { lat: 22.5702, lng: 88.3421 },
    { lat: 22.5763, lng: 88.3408 },
    { lat: 22.5811, lng: 88.3402 },
    { lat: 22.5839, lng: 88.3401 },
  ],
  'Garia Station|Park Street Office': [
    { lat: 22.4615, lng: 88.3903 },
    { lat: 22.4728, lng: 88.3861 },
    { lat: 22.4861, lng: 88.3798 },
    { lat: 22.4994, lng: 88.3724 },
    { lat: 22.5127, lng: 88.3661 },
    { lat: 22.5268, lng: 88.3602 },
    { lat: 22.5412, lng: 88.3552 },
    { lat: 22.5535, lng: 88.3522 },
  ],
  'Park Street Office|Dumdum Cantonment': [
    { lat: 22.5535, lng: 88.3522 },
    { lat: 22.5648, lng: 88.3591 },
    { lat: 22.5772, lng: 88.3672 },
    { lat: 22.5901, lng: 88.3751 },
    { lat: 22.6042, lng: 88.3838 },
    { lat: 22.6178, lng: 88.3921 },
    { lat: 22.6312, lng: 88.3994 },
    { lat: 22.6415, lng: 88.4048 },
  ],
  'Ballygunge|Park Street Office': [
    { lat: 22.5271, lng: 88.3654 },
    { lat: 22.5334, lng: 88.3616 },
    { lat: 22.5412, lng: 88.3572 },
    { lat: 22.5482, lng: 88.3541 },
    { lat: 22.5535, lng: 88.3522 },
  ],
  'Salt Lake Sector V|New Town Action Area I': [
    { lat: 22.5765, lng: 88.4324 },
    { lat: 22.5772, lng: 88.4412 },
    { lat: 22.578, lng: 88.4521 },
    { lat: 22.5786, lng: 88.4632 },
  ],
};

export function locationCoordinates(name: string | null | undefined): LatLng | null {
  if (!name) return null;
  return LOCATIONS[name.trim()] ?? null;
}

/**
 * The drawable path between two named places.
 *
 * Falls back through three levels, and returns null rather than inventing
 * geometry:
 *   1. a stored road path for the pair, reversed when needed;
 *   2. a straight line, when both endpoints are known but the pair is not;
 *   3. null, when either endpoint is unknown.
 */
export function resolveRoutePath(
  from: string | null | undefined,
  to: string | null | undefined,
): LatLng[] | null {
  const start = from?.trim() ?? '';
  const end = to?.trim() ?? '';
  if (!start || !end) return null;

  const forward = PATHS[`${start}|${end}`];
  if (forward) return forward;

  const reverse = PATHS[`${end}|${start}`];
  if (reverse) return [...reverse].reverse();

  const startPoint = locationCoordinates(start);
  const endPoint = locationCoordinates(end);
  if (startPoint && endPoint) return [startPoint, endPoint];

  return null;
}

/** True when the path came from stored road geometry rather than a straight line. */
export function hasRoadPath(from: string | null | undefined, to: string | null | undefined): boolean {
  const start = from?.trim() ?? '';
  const end = to?.trim() ?? '';
  return Boolean(PATHS[`${start}|${end}`] ?? PATHS[`${end}|${start}`]);
}

/** Centre and span for fitting a path on screen. */
export function pathBounds(path: LatLng[]): { center: LatLng; south: number; north: number; west: number; east: number } | null {
  if (path.length === 0) return null;
  const lats = path.map((point) => point.lat);
  const lngs = path.map((point) => point.lng);
  const south = Math.min(...lats);
  const north = Math.max(...lats);
  const west = Math.min(...lngs);
  const east = Math.max(...lngs);
  return {
    center: { lat: (south + north) / 2, lng: (west + east) / 2 },
    south,
    north,
    west,
    east,
  };
}

/**
 * Point along the path at `fraction` (0–1), used to place a vehicle marker on
 * a trip that is under way. Interpolates between the two path points either
 * side of the fraction — it does not simulate movement on its own.
 */
export function pointAlongPath(path: LatLng[], fraction: number): LatLng | null {
  if (path.length === 0) return null;
  if (path.length === 1) return path[0]!;

  const clamped = Math.max(0, Math.min(1, fraction));
  const scaled = clamped * (path.length - 1);
  const index = Math.floor(scaled);
  if (index >= path.length - 1) return path[path.length - 1]!;

  const start = path[index]!;
  const end = path[index + 1]!;
  const t = scaled - index;
  return {
    lat: start.lat + (end.lat - start.lat) * t,
    lng: start.lng + (end.lng - start.lng) * t,
  };
}
