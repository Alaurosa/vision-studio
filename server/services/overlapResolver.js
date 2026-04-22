/**
 * Shared overlap resolver — greedy spiral placement algorithm.
 * Extracted from chat.js (arrange_room) and layout.js (auto-place) where
 * it was duplicated with identical logic.
 */

/**
 * Compute effective width/depth after rotation.
 * @param {{ width: number, depth: number }} item
 * @param {number} rotation - 0, 90, 180, 270
 * @returns {{ effW: number, effD: number }}
 */
export function getEffectiveDims(item, rotation) {
  const swapped = rotation === 90 || rotation === 270;
  return { effW: swapped ? item.depth : item.width, effD: swapped ? item.width : item.depth };
}

/**
 * Check if two axis-aligned bounding boxes overlap.
 */
function boxOverlaps(a, b) {
  return !(a.x + a.effW <= b.x || b.x + b.effW <= a.x || a.y + a.effD <= b.y || b.y + b.effD <= a.y);
}

/**
 * Given a set of candidate placements from the LLM, resolve overlaps by
 * greedy spiral nudging on a grid. Each candidate is placed in order; if it
 * overlaps an already-placed item, we spiral outward until a valid position is
 * found, then fall back to a full linear scan.
 *
 * @param {Array<{ placement: object, rotation: number, x: number, y: number, effW: number, effD: number }>} candidates
 * @param {number} roomWidth
 * @param {number} roomDepth
 * @param {number} [gridStep=6]
 * @returns {Array<{ placement: object, rotation: number, x: number, y: number, effW: number, effD: number, resolved: boolean }>}
 */
export function resolveOverlaps(candidates, roomWidth, roomDepth, gridStep = 6) {
  const placed = [];

  for (const c of candidates) {
    let bestX = c.x, bestY = c.y, found = false;

    const tryPlace = (tx, ty) => {
      if (tx < 0 || ty < 0 || tx + c.effW > roomWidth || ty + c.effD > roomDepth) return false;
      const test = { x: tx, y: ty, effW: c.effW, effD: c.effD };
      return !placed.some((o) => boxOverlaps(test, o));
    };

    // Try original position first
    if (tryPlace(c.x, c.y)) {
      found = true;
    } else {
      // Spiral outward on the grid to find nearest free spot
      outer: for (let r = gridStep; r <= Math.max(roomWidth, roomDepth); r += gridStep) {
        for (let dx = -r; dx <= r; dx += gridStep) {
          for (let dy = -r; dy <= r; dy += gridStep) {
            if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
            const tx = Math.round((c.x + dx) / gridStep) * gridStep;
            const ty = Math.round((c.y + dy) / gridStep) * gridStep;
            if (tryPlace(tx, ty)) { bestX = tx; bestY = ty; found = true; break outer; }
          }
        }
      }
    }

    // Last resort: linear scan for any valid position in the room
    if (!found) {
      for (let tx = 0; tx + c.effW <= roomWidth; tx += gridStep) {
        for (let ty = 0; ty + c.effD <= roomDepth; ty += gridStep) {
          if (tryPlace(tx, ty)) { bestX = tx; bestY = ty; found = true; break; }
        }
        if (found) break;
      }
    }

    placed.push({ ...c, x: found ? bestX : c.x, y: found ? bestY : c.y });
  }

  return placed;
}

/**
 * Validate placements for overlaps and room bounds.
 * Extracted from chat.js (validate_layout) and layout.js (/validate).
 *
 * @param {Array} placements - Array of placement objects with x_inches, y_inches, width, depth, rotation, name
 * @param {{ width?: number, depth?: number }} room
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateLayout(placements, room) {
  const errors = [];

  for (let i = 0; i < placements.length; i++) {
    const a = placements[i];
    const ad = getEffectiveDims(a, a.rotation || 0);

    // Check room bounds
    if (room?.width && room?.depth) {
      if (a.x_inches < 0 || a.y_inches < 0 || a.x_inches + ad.effW > room.width || a.y_inches + ad.effD > room.depth) {
        errors.push(`${a.name || 'Item'} extends outside the room`);
      }
    }

    // Check overlaps with subsequent items
    for (let j = i + 1; j < placements.length; j++) {
      const b = placements[j];
      const bd = getEffectiveDims(b, b.rotation || 0);
      const ax2 = a.x_inches + ad.effW, ay2 = a.y_inches + ad.effD;
      const bx2 = b.x_inches + bd.effW, by2 = b.y_inches + bd.effD;
      if (!(ax2 <= b.x_inches || bx2 <= a.x_inches || ay2 <= b.y_inches || by2 <= a.y_inches)) {
        errors.push(`${a.name} overlaps with ${b.name}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
