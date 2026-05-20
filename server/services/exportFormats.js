import { DEFAULTS } from '../config/defaults.js';

export function buildLayoutJSON(room, placements) {
  return {
    schema_version: DEFAULTS.export.schemaVersion,
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
      image_url: p.image_url || null,
      model_url: p.model_url || null,
    })),
  };
}

// Convert walls to line segments regardless of format
function wallsToSegments(walls) {
  if (!walls || !Array.isArray(walls) || walls.length === 0) return [];

  // Check if walls are {start, end} objects
  if (walls[0]?.start && walls[0]?.end) {
    return walls.map(w => ({ x1: w.start[0], y1: w.start[1], x2: w.end[0], y2: w.end[1] }));
  }

  // Check if walls is a polygon array [[x,y], [x,y], ...]
  if (Array.isArray(walls[0]) && walls[0].length === 2) {
    const segments = [];
    for (let i = 0; i < walls.length; i++) {
      const next = (i + 1) % walls.length;
      segments.push({ x1: walls[i][0], y1: walls[i][1], x2: walls[next][0], y2: walls[next][1] });
    }
    return segments;
  }

  return [];
}

export function buildSVG(room, placements, svgWidth = 800) {
  const scale = svgWidth / (room.width || 120);
  const svgH = (room.depth || 100) * scale;
  const padding = 20;

  const segments = wallsToSegments(room.walls);
  const walls = segments.length > 0
    ? segments
        .map(s =>
          `<line x1="${s.x1 * scale + padding}" y1="${s.y1 * scale + padding}" ` +
          `x2="${s.x2 * scale + padding}" y2="${s.y2 * scale + padding}" ` +
          `stroke="#333" stroke-width="2"/>`
        )
        .join('\n')
    : `<rect x="${padding}" y="${padding}" width="${(room.width || 120) * scale}" height="${(room.depth || 100) * scale}" fill="none" stroke="#333" stroke-width="2"/>`;

  const furniture = placements
    .map((p) => {
      const x = (p.x_inches || 0) * scale + padding;
      const y = (p.y_inches || 0) * scale + padding;
      const w = (p.width || 0) * scale;
      const d = (p.depth || 0) * scale;
      // Sanitize name to prevent XSS in SVG
      const safeName = (p.name || '').replace(/[<>&"']/g, '');
      return `<rect x="${x}" y="${y}" width="${w}" height="${d}" fill="${p.color || '#d4a27a'}" stroke="#555" stroke-width="1" opacity="0.8"/>
            <text x="${x + w / 2}" y="${y + d / 2}" text-anchor="middle" dominant-baseline="middle" font-size="${Math.min(12, w / 4)}" fill="#333">${safeName}</text>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth + padding * 2}" height="${svgH + padding * 2}">
  <rect width="100%" height="100%" fill="#f5f4f0"/>
  ${walls}
  ${furniture}
</svg>`;
}

export function buildDXF(room, placements) {
  // Minimal DXF generation without external dependency
  const lines = [];
  lines.push('0', 'SECTION', '2', 'ENTITIES');

  // Room boundary
  const rw = room.width || 120;
  const rd = room.depth || 100;
  const drawLine = (x1, y1, x2, y2) => {
    lines.push('0', 'LINE', '8', 'WALLS', '10', String(x1), '20', String(y1), '11', String(x2), '21', String(y2));
  };

  if (room.walls && Array.isArray(room.walls) && room.walls.length > 0) {
    const segments = wallsToSegments(room.walls);
    for (const s of segments) {
      drawLine(s.x1, s.y1, s.x2, s.y2);
    }
  } else {
    drawLine(0, 0, rw, 0);
    drawLine(rw, 0, rw, rd);
    drawLine(rw, rd, 0, rd);
    drawLine(0, rd, 0, 0);
  }

  // Furniture rectangles
  for (const p of placements) {
    const x = p.x_inches || 0;
    const y = p.y_inches || 0;
    // Account for rotation: swap width/depth when rotated 90° or 270°
    const rot = p.rotation || 0;
    const w = (rot === 90 || rot === 270) ? (p.depth || 0) : (p.width || 0);
    const d = (rot === 90 || rot === 270) ? (p.width || 0) : (p.depth || 0);
    lines.push('0', 'LINE', '8', 'FURNITURE', '10', String(x), '20', String(y), '11', String(x + w), '21', String(y));
    lines.push('0', 'LINE', '8', 'FURNITURE', '10', String(x + w), '20', String(y), '11', String(x + w), '21', String(y + d));
    lines.push('0', 'LINE', '8', 'FURNITURE', '10', String(x + w), '20', String(y + d), '11', String(x), '21', String(y + d));
    lines.push('0', 'LINE', '8', 'FURNITURE', '10', String(x), '20', String(y + d), '11', String(x), '21', String(y));
  }

  lines.push('0', 'ENDSEC', '0', 'EOF');
  return lines.join('\n');
}
