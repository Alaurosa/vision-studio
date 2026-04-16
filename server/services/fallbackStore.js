/**
 * In-memory fallback store for when Supabase tables aren't set up yet.
 * This allows the app to run in "demo mode" with local state.
 * Data is lost on server restart.
 */
import { randomUUID } from 'crypto';

// Embedded catalog data (same as seedFurniture.js)
const CATALOG = [
  { id: randomUUID(), category: 'sofa', name: 'SÖDERHAMN 3-seat sofa', provider: 'ikea', provider_id: 's49302521', width: 93, depth: 39, height: 33, price_usd: 699, url: 'https://www.ikea.com/us/en/p/soederhamn-sofa-fridtuna-light-beige-s39429618/', image_url: 'https://www.ikea.com/us/en/images/products/soederhamn-sofa-fridtuna-light-beige__1057770_pe848964_s5.jpg', available: true },
  { id: randomUUID(), category: 'sofa', name: 'KIVIK 3-seat sofa', provider: 'ikea', provider_id: 's49282816', width: 90, depth: 37, height: 32, price_usd: 799, url: 'https://www.ikea.com/us/en/p/kivik-sofa-tibbleby-beige-gray-s49282816/', image_url: 'https://www.ikea.com/us/en/images/products/kivik-sofa-tibbleby-beige-gray__1056144_pe848277_s5.jpg', available: true },
  { id: randomUUID(), category: 'sofa', name: 'BACKSÄLEN sofa', provider: 'ikea', provider_id: 's09518258', width: 88, depth: 36, height: 34, price_usd: 549, url: 'https://www.ikea.com/us/en/p/backsalen-sofa-katorp-natural-s09518258/', image_url: 'https://www.ikea.com/us/en/images/products/backsalen-sofa-katorp-natural__1063588_pe851528_s5.jpg', available: true },
  { id: randomUUID(), category: 'bed', name: 'MALM Bed Frame (Queen)', provider: 'ikea', provider_id: 's39280887', width: 63, depth: 83, height: 15, price_usd: 329, url: 'https://www.ikea.com/us/en/p/malm-bed-frame-high-white-luroey-s39280887/', image_url: 'https://www.ikea.com/us/en/images/products/malm-bed-frame-high-white-luroey__0749130_pe745499_s5.jpg', available: true },
  { id: randomUUID(), category: 'bed', name: 'HEMNES Bed Frame (Queen)', provider: 'ikea', provider_id: 's19180534', width: 64, depth: 85, height: 20, price_usd: 449, url: 'https://www.ikea.com/us/en/p/hemnes-bed-frame-white-stain-luroey-s19180534/', image_url: 'https://www.ikea.com/us/en/images/products/hemnes-bed-frame-white-stain-luroey__0355811_pe383063_s5.jpg', available: true },
  { id: randomUUID(), category: 'bed', name: 'BRIMNES Bed Frame (Full)', provider: 'ikea', provider_id: 's39157412', width: 57, depth: 82, height: 17, price_usd: 299, url: 'https://www.ikea.com/us/en/p/brimnes-bed-frame-with-storage-headboard-white-luroey-s39157412/', image_url: 'https://www.ikea.com/us/en/images/products/brimnes-bed-frame-with-storage-headboard-white-luroey__1151032_pe884763_s5.jpg', available: true },
  { id: randomUUID(), category: 'desk', name: 'LAGKAPTEN/ADILS Desk', provider: 'ikea', provider_id: 's49417564', width: 55, depth: 24, height: 29, price_usd: 74, url: 'https://www.ikea.com/us/en/p/lagkapten-adils-desk-white-s49417564/', image_url: 'https://www.ikea.com/us/en/images/products/lagkapten-adils-desk-white__0976080_pe812978_s5.jpg', available: true },
  { id: randomUUID(), category: 'desk', name: 'MICKE Desk', provider: 'ikea', provider_id: 's80213074', width: 56, depth: 20, height: 30, price_usd: 129, url: 'https://www.ikea.com/us/en/p/micke-desk-white-s80213074/', image_url: 'https://www.ikea.com/us/en/images/products/micke-desk-white__0736018_pe740345_s5.jpg', available: true },
  { id: randomUUID(), category: 'desk', name: 'ALEX Desk', provider: 'ikea', provider_id: 's00473546', width: 52, depth: 23, height: 30, price_usd: 269, url: 'https://www.ikea.com/us/en/p/alex-desk-white-s00473546/', image_url: 'https://www.ikea.com/us/en/images/products/alex-desk-white__0977666_pe813729_s5.jpg', available: true },
  { id: randomUUID(), category: 'bookshelf', name: 'BILLY Bookcase', provider: 'ikea', provider_id: 's0263832', width: 31.5, depth: 11, height: 79.5, price_usd: 79, url: 'https://www.ikea.com/us/en/p/billy-bookcase-white-00263850/', image_url: 'https://www.ikea.com/us/en/images/products/billy-bookcase-white__0625599_pe692385_s5.jpg', available: true },
  { id: randomUUID(), category: 'bookshelf', name: 'KALLAX Shelf Unit (4x4)', provider: 'ikea', provider_id: 's10275971', width: 57.5, depth: 15.5, height: 57.5, price_usd: 189, url: 'https://www.ikea.com/us/en/p/kallax-shelf-unit-white-s10275971/', image_url: 'https://www.ikea.com/us/en/images/products/kallax-shelf-unit-white__0644757_pe702939_s5.jpg', available: true },
  { id: randomUUID(), category: 'dining_table', name: 'EKEDALEN Dining Table', provider: 'ikea', provider_id: 's29041169', width: 70, depth: 35, height: 29, price_usd: 449, url: 'https://www.ikea.com/us/en/p/ekedalen-extendable-table-white-s29041169/', image_url: 'https://www.ikea.com/us/en/images/products/ekedalen-extendable-table-white__0736965_pe740829_s5.jpg', available: true },
  { id: randomUUID(), category: 'dining_table', name: 'LISABO Dining Table', provider: 'ikea', provider_id: 's09257608', width: 55, depth: 31, height: 29, price_usd: 249, url: 'https://www.ikea.com/us/en/p/lisabo-table-ash-veneer-s09257608/', image_url: 'https://www.ikea.com/us/en/images/products/lisabo-table-ash-veneer__0644156_pe702451_s5.jpg', available: true },
  { id: randomUUID(), category: 'dresser', name: 'HEMNES 8-drawer dresser', provider: 'ikea', provider_id: 's10176325', width: 63, depth: 19.5, height: 59.5, price_usd: 349, url: 'https://www.ikea.com/us/en/p/hemnes-8-drawer-dresser-white-stain-s10176325/', image_url: 'https://www.ikea.com/us/en/images/products/hemnes-8-drawer-dresser-white-stain__0627346_pe693299_s5.jpg', available: true },
  { id: randomUUID(), category: 'coffee_table', name: 'HEMNES Coffee table', provider: 'ikea', provider_id: 's80176212', width: 45.5, depth: 23.5, height: 18.5, price_usd: 199, url: 'https://www.ikea.com/us/en/p/hemnes-coffee-table-white-stain-light-brown-s80176212/', image_url: 'https://www.ikea.com/us/en/images/products/hemnes-coffee-table-white-stain-light-brown__0735559_pe740009_s5.jpg', available: true },
  { id: randomUUID(), category: 'coffee_table', name: 'LACK Coffee table', provider: 'ikea', provider_id: 's30173961', width: 35.5, depth: 21.5, height: 17.75, price_usd: 29, url: 'https://www.ikea.com/us/en/p/lack-coffee-table-white-s30173961/', image_url: 'https://www.ikea.com/us/en/images/products/lack-coffee-table-white__0750652_pe746803_s5.jpg', available: true },
  { id: randomUUID(), category: 'nightstand', name: 'STORKLINTA Nightstand', provider: 'ikea', provider_id: 's50551352', width: 18.5, depth: 15.75, height: 22, price_usd: 79, url: 'https://www.ikea.com/us/en/p/storklinta-nightstand-white-with-2-drawers-s50551352/', image_url: 'https://www.ikea.com/us/en/images/products/storklinta-nightstand-white-with-2-drawers__1283590_pe932547_s5.jpg', available: true },
  { id: randomUUID(), category: 'nightstand', name: 'HEMNES Nightstand', provider: 'ikea', provider_id: 's30176323', width: 18.5, depth: 13.5, height: 27.5, price_usd: 119, url: 'https://www.ikea.com/us/en/p/hemnes-2-drawer-chest-white-stain-s30176323/', image_url: 'https://www.ikea.com/us/en/images/products/hemnes-2-drawer-chest-white-stain__0651108_pe706676_s5.jpg', available: true },
  { id: randomUUID(), category: 'armchair', name: 'STRANDMON Wing Chair', provider: 'ikea', provider_id: 's29281971', width: 33, depth: 37, height: 43.5, price_usd: 349, url: 'https://www.ikea.com/us/en/p/strandmon-wing-chair-skiftebo-yellow-s29281971/', image_url: 'https://www.ikea.com/us/en/images/products/strandmon-wing-chair-skiftebo-yellow__0325450_pe517970_s5.jpg', available: true },
  { id: randomUUID(), category: 'armchair', name: 'POÄNG Armchair', provider: 'ikea', provider_id: 's29281789', width: 26.5, depth: 32, height: 39.5, price_usd: 119, url: 'https://www.ikea.com/us/en/p/poaeng-armchair-birch-veneer-knisa-light-beige-s29281789/', image_url: 'https://www.ikea.com/us/en/images/products/poaeng-armchair-birch-veneer-knisa-light-beige__0571500_pe666933_s5.jpg', available: true },
  { id: randomUUID(), category: 'tv_stand', name: 'BESTÅ TV Unit', provider: 'ikea', provider_id: 's99298433', width: 70.5, depth: 16.5, height: 15, price_usd: 319, url: 'https://www.ikea.com/us/en/p/besta-tv-unit-white-s99298433/', image_url: 'https://www.ikea.com/us/en/images/products/besta-tv-unit-white__0376997_pe516837_s5.jpg', available: true },
  { id: randomUUID(), category: 'sofa', name: 'Darcy Sofa', provider: 'ashley', provider_id: 'ash-7500138', width: 87, depth: 38, height: 38, price_usd: 550, url: 'https://www.ashleyfurniture.com/p/darcy-sofa/7500138.html', image_url: 'https://ashleyfurniture.scene7.com/is/image/AshleyFurniture/75001-38-10X8-QUARTZ?$QUARTZ$', available: true },
  { id: randomUUID(), category: 'sofa', name: 'Alenya Sofa', provider: 'ashley', provider_id: 'ash-1660038', width: 89, depth: 37, height: 39, price_usd: 699, url: 'https://www.ashleyfurniture.com/p/alenya-sofa/1660138.html', image_url: 'https://ashleyfurniture.scene7.com/is/image/AshleyFurniture/16601-38-10X8-QUARTZ?$QUARTZ$', available: true },
  { id: randomUUID(), category: 'bed', name: 'Alisdair Queen Bed', provider: 'ashley', provider_id: 'ash-b376-81', width: 65, depth: 86, height: 58, price_usd: 399, url: 'https://www.ashleyfurniture.com/p/alisdair-queen-sleigh-bed/APK-B376-QSB.html', image_url: 'https://ashleyfurniture.scene7.com/is/image/AshleyFurniture/B376-81-quartz?$QUARTZ$', available: true },
  { id: randomUUID(), category: 'dining_table', name: 'Owingsville Dining Table', provider: 'ashley', provider_id: 'ash-d580-25', width: 60, depth: 36, height: 30, price_usd: 449, url: 'https://www.ashleyfurniture.com/p/owingsville-dining-table/D580-25.html', image_url: 'https://ashleyfurniture.scene7.com/is/image/AshleyFurniture/D580-25-quartz?$QUARTZ$', available: true },
  { id: randomUUID(), category: 'dresser', name: 'Maribel Dresser', provider: 'ashley', provider_id: 'ash-b138-31', width: 60, depth: 15.5, height: 36, price_usd: 499, url: 'https://www.ashleyfurniture.com/p/maribel-dresser/B138-31.html', image_url: 'https://ashleyfurniture.scene7.com/is/image/AshleyFurniture/B138-31-quartz?$QUARTZ$', available: true },
];

// In-memory rooms and placements (keyed by user id)
const rooms = new Map();       // roomId -> room object
const placements = new Map();  // placementId -> placement object

let dbAvailable = null; // null = unknown, true/false

export async function checkDbAvailable(supabaseAdmin) {
  if (dbAvailable !== null) return dbAvailable;
  const { error } = await supabaseAdmin.from('rooms').select('*').limit(0);
  dbAvailable = !error;
  if (!dbAvailable) {
    console.log('⚠️  Database tables not found — running in demo mode with in-memory data');
  }
  return dbAvailable;
}

export function resetDbCheck() {
  dbAvailable = null;
}

export function getCatalog({ category, provider, q, limit = 50, offset = 0 } = {}) {
  let items = [...CATALOG];
  if (category) items = items.filter(i => i.category === category);
  if (provider) items = items.filter(i => i.provider === provider);
  if (q) items = items.filter(i => i.name.toLowerCase().includes(q.toLowerCase()));
  return { items: items.slice(offset, offset + limit), total: items.length };
}

export function getCategories() {
  return [...new Set(CATALOG.map(i => i.category))].sort();
}

export function getCatalogItem(id) {
  return CATALOG.find(i => i.id === id);
}

export function createRoom(userId, { name, unit, width, depth } = {}) {
  const room = {
    id: randomUUID(),
    user_id: userId,
    name: name || 'My Room',
    unit: unit || 'inches',
    width: width || null,
    depth: depth || null,
    height: 96,
    walls: null,
    scale_px_per_inch: null,
    floor_plan_url: null,
    room_photo_url: null,
    detected_objects: null,
    zones: [],
    placements: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  rooms.set(room.id, room);
  return room;
}

export function getRooms(userId) {
  return [...rooms.values()]
    .filter(r => r.user_id === userId)
    .map(r => ({ ...r, placements: getPlacementsForRoom(r.id) }))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export function getRoom(roomId, userId) {
  const room = rooms.get(roomId);
  if (!room || room.user_id !== userId) return null;
  return { ...room, placements: getPlacementsForRoom(roomId) };
}

export function updateRoom(roomId, userId, updates) {
  const room = rooms.get(roomId);
  if (!room || room.user_id !== userId) return null;
  Object.assign(room, updates, { updated_at: new Date().toISOString() });
  rooms.set(roomId, room);
  return { ...room, placements: getPlacementsForRoom(roomId) };
}

export function deleteRoom(roomId, userId) {
  const room = rooms.get(roomId);
  if (!room || room.user_id !== userId) return false;
  rooms.delete(roomId);
  // Delete associated placements
  for (const [pid, p] of placements) {
    if (p.room_id === roomId) placements.delete(pid);
  }
  return true;
}

export function addPlacement(data) {
  const placement = {
    id: randomUUID(),
    ...data,
    x_inches: data.x_inches || 0,
    y_inches: data.y_inches || 0,
    rotation: data.rotation || 0,
    color: data.color || '#d4a27a',
    custom: data.custom || false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  placements.set(placement.id, placement);
  return placement;
}

export function updatePlacement(id, updates) {
  const p = placements.get(id);
  if (!p) return null;
  Object.assign(p, updates, { updated_at: new Date().toISOString() });
  return p;
}

export function deletePlacement(id) {
  return placements.delete(id);
}

function getPlacementsForRoom(roomId) {
  return [...placements.values()].filter(p => p.room_id === roomId);
}

export function getPlacement(id) {
  return placements.get(id);
}

// Chat history (in-memory per room)
const chatMessages = new Map(); // roomId -> [{role, content, tool_calls, created_at}]

export function getChatHistory(roomId, limit = 20) {
  const msgs = chatMessages.get(roomId) || [];
  return msgs.slice(-limit);
}

export function addChatMessage(roomId, { role, content, tool_calls = null }) {
  if (!chatMessages.has(roomId)) chatMessages.set(roomId, []);
  const msg = { id: randomUUID(), room_id: roomId, role, content, tool_calls, created_at: new Date().toISOString() };
  chatMessages.get(roomId).push(msg);
  return msg;
}

// Search catalog by name (fuzzy match for chatbot)
export function searchCatalogByName(name) {
  return CATALOG.filter(i => i.name.toLowerCase().includes(name.toLowerCase()));
}

// Layout exports (in-memory)
const layoutExports = new Map(); // roomId -> [{id, layout_json, created_at}]

export function addLayoutExport(roomId, layoutJson) {
  if (!layoutExports.has(roomId)) layoutExports.set(roomId, []);
  const exp = { id: randomUUID(), room_id: roomId, layout_json: layoutJson, created_at: new Date().toISOString() };
  layoutExports.get(roomId).push(exp);
  return exp;
}

export function getLatestExport(roomId) {
  const exports = layoutExports.get(roomId) || [];
  return exports.length > 0 ? exports[exports.length - 1] : null;
}
