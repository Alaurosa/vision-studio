export const GRID_SNAP_INCHES = 6;
export const MIN_CLEARANCE_IN = 24;
export const DEFAULT_HEIGHT_IN = 96;
export const DEFAULT_SCALE = 4.0;

export const CATEGORY_COLORS = {
  sofa:         '#b8875a',
  loveseat:     '#c9a279',
  bed:          '#94a8b4',
  desk:         '#b8a46f',
  bookshelf:    '#7e5230',
  dining_table: '#a88560',
  coffee_table: '#b89673',
  dresser:      '#a89079',
  nightstand:   '#b8a08f',
  armchair:     '#c7a079',
  tv_stand:     '#6d6e6e',
  cabinet:      '#927b66',
  chair:        '#c3a074',
  default:      '#a89370',
};

export const CATEGORY_LABELS = {
  sofa: 'Sofa', loveseat: 'Loveseat', bed: 'Bed', desk: 'Desk',
  bookshelf: 'Bookshelf', dining_table: 'Dining Table',
  coffee_table: 'Coffee Table', dresser: 'Dresser', nightstand: 'Nightstand',
  armchair: 'Armchair', tv_stand: 'TV Stand', cabinet: 'Cabinet', chair: 'Chair',
};

export const ROOM_TEMPLATES = [
  { id: 'bedroom',    name: 'Bedroom',     width: 144, depth: 132, height: 96 },
  { id: 'living',     name: 'Living Room', width: 216, depth: 168, height: 96 },
  { id: 'studio',     name: 'Studio',      width: 240, depth: 180, height: 96 },
  { id: 'office',     name: 'Home Office', width: 120, depth: 108, height: 96 },
  { id: 'dining',     name: 'Dining Room', width: 168, depth: 144, height: 96 },
];

export const ROOM_ZONE_COLORS = [
  '#c58d45',
  '#4f8f6b',
  '#4273b7',
  '#9858a6',
  '#b35c42',
  '#5f7d4f',
  '#c06b8f',
  '#7b6cc7',
];
