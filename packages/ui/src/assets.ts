/**
 * Every image used by the four applications, resolved through the bundler so
 * each app emits its own hashed copy and nothing is fetched from a remote host
 * at runtime. Files live in packages/ui/assets/img and were pulled from the
 * Rido reference design with tools/design-sync.
 */

const url = (file: string) => new URL(`../assets/img/${file}`, import.meta.url).href;

/** Isometric vehicle renders on transparent backgrounds. */
export const VEHICLE_RENDER = {
  sedan: url('car-sedan.png'),
  suv: url('car-suv.png'),
  van: url('car-van.png'),
  minivan: url('car-minivan.png'),
  pair: url('car-pair.png'),
  topDown: url('car-topdown.png'),
} as const;

/** Line-drawn vehicle marks — used at small sizes next to labels. */
export const VEHICLE_OUTLINE = {
  hatchback: url('outline-hatchback.svg'),
  sedan: url('outline-sedan.svg'),
  suv: url('outline-suv.svg'),
  van: url('outline-van.svg'),
} as const;

/**
 * Diagram parts. Only the two line-drawn connectors are kept — the reference's
 * pictorial marks were emoji glyphs, which the icon set replaces.
 */
export const DIAGRAM = {
  branch: url('connector-branch.svg'),
  arrow: url('connector-arrow.svg'),
} as const;

/** Photography. */
export const PHOTO = {
  interchange: url('photo-interchange.png'),
  highwayAerial: url('photo-highway-aerial.jpg'),
  openRoad: url('photo-open-road.jpg'),
  motion: url('photo-motion.jpg'),
  cityStreet: url('photo-city-street.png'),
  lightTrails: url('photo-light-trails.png'),
  night: url('photo-night.jpg'),
  parkedSuv: url('photo-parked-suv.jpg'),
  carPark: url('photo-car-park.jpg'),
  driverWheel: url('photo-driver-wheel.png'),
  passenger: url('photo-passenger.jpg'),
  boarding: url('photo-boarding.png'),
  doorOpen: url('photo-door-open.jpg'),
  lot: url('photo-lot.jpg'),
  phoneMap: url('phone-map.png'),
} as const;

/** Portraits for testimonial and people cards. */
export const PORTRAIT = [
  url('person-1.webp'),
  url('person-2.webp'),
  url('person-3.webp'),
  url('person-4.png'),
  url('person-5.png'),
  url('person-6.png'),
  url('person-7.png'),
  url('person-8.png'),
  url('person-9.jpg'),
  url('person-10.jpg'),
  url('person-11.png'),
  url('person-12.png'),
] as const;

/** Stable portrait for a given person, so the same employee keeps the same face. */
export function portraitFor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) % 100000;
  return PORTRAIT[hash % PORTRAIT.length];
}

/** Render matching a vehicle type from the domain constants. */
export function renderForVehicleType(type: string): string {
  if (type === 'suv') return VEHICLE_RENDER.suv;
  if (type === 'van' || type === 'minibus') return VEHICLE_RENDER.van;
  if (type === 'hatchback') return VEHICLE_RENDER.sedan;
  return VEHICLE_RENDER.sedan;
}

/** Outline mark matching a vehicle type. */
export function outlineForVehicleType(type: string): string {
  if (type === 'suv') return VEHICLE_OUTLINE.suv;
  if (type === 'van' || type === 'minibus') return VEHICLE_OUTLINE.van;
  if (type === 'hatchback') return VEHICLE_OUTLINE.hatchback;
  return VEHICLE_OUTLINE.sedan;
}
