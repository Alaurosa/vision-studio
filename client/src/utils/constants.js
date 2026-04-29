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

export const ROOM_ZONE_COLORS = ['#2563eb', '#22c55e', '#a855f7', '#f59e0b', '#14b8a6', '#f43f5e'];

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

export const DEMO_PROJECTS = [
  {
    id: 'modern-living',
    name: 'Modern Living Room',
    description: 'Contemporary 3-seater sofa with minimalist coffee table and accent chairs',
    template: 'living',
    furniture: [
      { name: 'KIVIK 3-seat sofa', category: 'sofa', provider: 'ikea', provider_id: 's49282816', width: 90, depth: 37, height: 32, x_inches: 24, y_inches: 24, rotation: 0, color: '#2d3748' },
      { name: 'HEMNES Coffee table', category: 'coffee_table', provider: 'ikea', provider_id: 's80176212', width: 45.5, depth: 23.5, height: 18.5, x_inches: 60, y_inches: 60, rotation: 0, color: '#4a5568' },
      { name: 'POÄNG Armchair', category: 'armchair', provider: 'ikea', provider_id: 's29281789', width: 26.5, depth: 32, height: 39.5, x_inches: 120, y_inches: 30, rotation: 0, color: '#2d3748' },
      { name: 'BILLY Bookcase', category: 'bookshelf', provider: 'ikea', provider_id: 's0263832', width: 31.5, depth: 11, height: 79.5, x_inches: 180, y_inches: 12, rotation: 0, color: '#8b4513' },
    ]
  },
  {
    id: 'minimal-bedroom',
    name: 'Minimal Bedroom',
    description: 'Clean lines with platform bed, floating nightstands, and wardrobe',
    template: 'bedroom',
    furniture: [
      { name: 'MALM Bed Frame (Queen)', category: 'bed', provider: 'ikea', provider_id: 's39280887', width: 63, depth: 83, height: 15, x_inches: 36, y_inches: 24, rotation: 0, color: '#f7fafc' },
      { name: 'HEMNES Nightstand', category: 'nightstand', provider: 'ikea', provider_id: 's30176323', width: 18.5, depth: 13.5, height: 27.5, x_inches: 12, y_inches: 60, rotation: 0, color: '#8b4513' },
      { name: 'HEMNES Nightstand', category: 'nightstand', provider: 'ikea', provider_id: 's30176323', width: 18.5, depth: 13.5, height: 27.5, x_inches: 114, y_inches: 60, rotation: 0, color: '#8b4513' },
      { name: 'HEMNES 8-drawer dresser', category: 'dresser', provider: 'ikea', provider_id: 's10176325', width: 63, depth: 19.5, height: 59.5, x_inches: 36, y_inches: 120, rotation: 0, color: '#8b4513' },
    ]
  },
  {
    id: 'home-office',
    name: 'Home Office',
    description: 'Ergonomic desk setup with storage and comfortable seating',
    template: 'office',
    furniture: [
      { name: 'MICKE Desk', category: 'desk', provider: 'ikea', provider_id: 's80213074', width: 56, depth: 20, height: 30, x_inches: 24, y_inches: 36, rotation: 0, color: '#f7fafc' },
      { name: 'STRANDMON Wing Chair', category: 'armchair', provider: 'ikea', provider_id: 's29281971', width: 33, depth: 37, height: 43.5, x_inches: 72, y_inches: 24, rotation: 45, color: '#2d3748' },
      { name: 'KALLAX Shelf Unit', category: 'bookshelf', provider: 'ikea', provider_id: 's10275971', width: 57.5, depth: 15.5, height: 57.5, x_inches: 12, y_inches: 72, rotation: 0, color: '#f7fafc' },
      { name: 'BESTA TV Unit', category: 'tv_stand', provider: 'ikea', provider_id: 's99298433', width: 70.5, depth: 16.5, height: 15, x_inches: 24, y_inches: 96, rotation: 0, color: '#2d3748' },
    ]
  },
  {
    id: 'luxury-apartment',
    name: 'Luxury Apartment',
    description: 'High-end furniture with premium materials and elegant proportions',
    template: 'studio',
    furniture: [
      { name: 'Darcy Sofa', category: 'sofa', provider: 'ashley', provider_id: 'ash-7500138', width: 87, depth: 38, height: 38, x_inches: 36, y_inches: 48, rotation: 0, color: '#2d3748' },
      { name: 'Brookhaven Dining Table', category: 'dining_table', provider: 'ashley', provider_id: 'ash-d319-25', width: 60, depth: 38, height: 30, x_inches: 120, y_inches: 60, rotation: 0, color: '#8b4513' },
      { name: 'Maribel Dresser', category: 'dresser', provider: 'ashley', provider_id: 'ash-b138-31', width: 60, depth: 15.5, height: 36, x_inches: 180, y_inches: 24, rotation: 0, color: '#8b4513' },
      { name: 'Benchcraft Alenya Sofa', category: 'sofa', provider: 'ashley', provider_id: 'ash-1660038', width: 89, depth: 37, height: 39, x_inches: 36, y_inches: 120, rotation: 0, color: '#4a5568' },
    ]
  }
];
