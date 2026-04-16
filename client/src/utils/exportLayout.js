export function buildLayoutJSON(room, placements) {
  return {
    schema_version: '1.0',
    layout_id: room.id,
    created_at: new Date().toISOString(),
    room: {
      name: room.name,
      unit: room.unit || 'inches',
      width: room.width,
      depth: room.depth,
      height: room.height || 96,
      walls: room.walls || [],
      scale_px_per_inch: room.scale_px_per_inch,
    },
    furniture: placements.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      provider: p.provider,
      provider_id: p.provider_id,
      width: p.width,
      depth: p.depth,
      height: p.height,
      x: p.x_inches,
      y: p.y_inches,
      rotation: p.rotation,
      color: p.color,
      custom: p.custom,
      model_url: p.model_url || null,
    })),
  };
}
