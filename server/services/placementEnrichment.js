import { supabaseAdmin, fallback } from './db.js';

function enrichList(placements, catalogById) {
  return placements.map((p) => {
    if (!p.catalog_id) return p;
    const cat = catalogById[p.catalog_id];
    if (!cat) return p;
    return {
      ...p,
      image_url: p.image_url || cat.image_url || null,
      model_url: p.model_url || cat.model_url || null,
    };
  });
}

async function fetchCatalogMap(catalogIds, dbEnabled) {
  if (!catalogIds.length) return {};
  if (dbEnabled) {
    const { data } = await supabaseAdmin
      .from('furniture_catalog')
      .select('id, image_url, model_url')
      .in('id', catalogIds);
    return Object.fromEntries((data || []).map((c) => [c.id, c]));
  }
  const map = {};
  for (const id of catalogIds) {
    const item = fallback.getCatalogItem(id);
    if (item) map[id] = item;
  }
  return map;
}

/** Fill missing placement image/model URLs from linked catalog rows. */
export async function enrichRoomPlacements(room, dbEnabled) {
  if (!room?.placements?.length) return room;
  const ids = [...new Set(room.placements.map((p) => p.catalog_id).filter(Boolean))];
  const catalogById = await fetchCatalogMap(ids, dbEnabled);
  return { ...room, placements: enrichList(room.placements, catalogById) };
}

export async function enrichRoomsPlacements(rooms, dbEnabled) {
  if (!rooms?.length) return rooms;
  const ids = [
    ...new Set(
      rooms.flatMap((r) => (r.placements || []).map((p) => p.catalog_id).filter(Boolean)),
    ),
  ];
  const catalogById = await fetchCatalogMap(ids, dbEnabled);
  return rooms.map((r) =>
    r.placements?.length
      ? { ...r, placements: enrichList(r.placements, catalogById) }
      : r,
  );
}
