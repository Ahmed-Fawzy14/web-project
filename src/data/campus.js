/** Schematic, fictional campus map. x and y are percentages of the map area. */
export const BUILDINGS = [
  { id: 'waleed', name: 'Waleed', x: 18, y: 26 },
  { id: 'sse', name: 'SSE', x: 76, y: 22 },
  { id: 'huss', name: 'HUSS', x: 30, y: 58 },
  { id: 'bus', name: 'School of Business', x: 80, y: 56 },
  { id: 'library', name: 'Library', x: 50, y: 18 },
  { id: 'campus-center', name: 'Campus Center', x: 52, y: 48 },
  { id: 'dorms', name: 'Dorms', x: 14, y: 84 },
  { id: 'plaza', name: 'Main Plaza', x: 58, y: 80 },
];

export const getBuilding = (id) => BUILDINGS.find((b) => b.id === id);

export const walkingMinutes = (from, to) =>
  Math.max(2, Math.round(Math.hypot(from.x - to.x, from.y - to.y) / 5));

export const MINIMUM_DELIVERY_FEE = 10;
const FEE_PER_WALKING_MINUTE = 1.5;

/** FR-06: a minimum fee plus a walking-distance charge. Final amounts are still undecided. */
export const suggestDeliveryFee = (minutes) =>
  MINIMUM_DELIVERY_FEE + Math.round(minutes * FEE_PER_WALKING_MINUTE);
