/**
 * Shared overlap resolver — grid placement with mandatory clearance gaps.
 */

export const GRID_STEP_IN = 6;
export const CLEARANCE_IN = 6;

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
 * @param {{ x: number, y: number, effW: number, effD: number }} a
 * @param {{ x: number, y: number, effW: number, effD: number }} b
 * @param {number} clearance
 */
export function boxesConflict(a, b, clearance = CLEARANCE_IN) {
  return !(
    a.x + a.effW + clearance <= b.x ||
    b.x + b.effW + clearance <= a.x ||
    a.y + a.effD + clearance <= b.y ||
    b.y + b.effD + clearance <= a.y
  );
}

/** @deprecated use boxesConflict */
function boxOverlaps(a, b) {
  return boxesConflict(a, b, 0);
}

/**
 * Scan the grid for the first position that fits.
 */
export function findFirstFreeSlot(effW, effD, placed, roomWidth, roomDepth, gridStep = GRID_STEP_IN, options = {}) {
  const { clearance = CLEARANCE_IN, bounds = null } = options;
  const minX = bounds?.left ?? 0;
  const minY = bounds?.top ?? 0;
  const maxX = bounds?.right ?? roomWidth;
  const maxY = bounds?.bottom ?? roomDepth;
  const startX = Math.max(minX, Math.ceil(minX / gridStep) * gridStep);
  const startY = Math.max(minY, Math.ceil(minY / gridStep) * gridStep);

  for (let y = startY; y + effD <= maxY; y += gridStep) {
    for (let x = startX; x + effW <= maxX; x += gridStep) {
      const test = { x, y, effW, effD };
      if (!placed.some((o) => boxesConflict(test, o, clearance))) {
        return { x, y, found: true };
      }
    }
  }
  return { x: startX, y: startY, found: false };
}

/**
 * Given candidate placements, resolve overlaps by placing largest items first.
 * Never leaves an overlapping position when any free slot exists in bounds.
 *
 * @param {Array<{ placement: object, rotation: number, x: number, y: number, effW: number, effD: number }>} candidates
 * @param {number} roomWidth
 * @param {number} roomDepth
 * @param {number} [gridStep=6]
 * @param {{ clearance?: number, bounds?: { left: number, top: number, right: number, bottom: number } | null }} [options]
 */
export function resolveOverlaps(candidates, roomWidth, roomDepth, gridStep = GRID_STEP_IN, options = {}) {
  const { clearance = CLEARANCE_IN, bounds = null } = options;
  const minX = bounds?.left ?? 0;
  const minY = bounds?.top ?? 0;
  const maxX = bounds?.right ?? roomWidth;
  const maxY = bounds?.bottom ?? roomDepth;

  const sorted = [...candidates].sort((a, b) => b.effW * b.effD - a.effW * a.effD);
  const placed = [];

  for (const c of sorted) {
    let bestX = c.x;
    let bestY = c.y;
    let found = false;

    const tryPlace = (tx, ty) => {
      if (tx < minX || ty < minY || tx + c.effW > maxX || ty + c.effD > maxY) return false;
      const test = { x: tx, y: ty, effW: c.effW, effD: c.effD };
      return !placed.some((o) => boxesConflict(test, o, clearance));
    };

    const snappedX = Math.round(c.x / gridStep) * gridStep;
    const snappedY = Math.round(c.y / gridStep) * gridStep;

    if (tryPlace(snappedX, snappedY)) {
      bestX = snappedX;
      bestY = snappedY;
      found = true;
    } else {
      outer: for (let r = gridStep; r <= Math.max(maxX - minX, maxY - minY); r += gridStep) {
        for (let dx = -r; dx <= r; dx += gridStep) {
          for (let dy = -r; dy <= r; dy += gridStep) {
            if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
            const tx = Math.round((snappedX + dx) / gridStep) * gridStep;
            const ty = Math.round((snappedY + dy) / gridStep) * gridStep;
            if (tryPlace(tx, ty)) {
              bestX = tx;
              bestY = ty;
              found = true;
              break outer;
            }
          }
        }
      }
    }

    if (!found) {
      const slot = findFirstFreeSlot(c.effW, c.effD, placed, roomWidth, roomDepth, gridStep, {
        clearance,
        bounds,
      });
      if (slot.found) {
        bestX = slot.x;
        bestY = slot.y;
        found = true;
      }
    }

    placed.push({ ...c, x: bestX, y: bestY, resolved: found });
  }

  return placed;
}

/**
 * @param {Array} placements
 * @param {{ width?: number, depth?: number }} room
 * @param {{ clearance?: number, bounds?: object | null }} [options]
 */
export function validateLayout(placements, room, options = {}) {
  const { clearance = CLEARANCE_IN, bounds = null } = options;
  const errors = [];

  for (let i = 0; i < placements.length; i++) {
    const a = placements[i];
    const ad = getEffectiveDims(a, a.rotation || 0);
    const ax = Number(a.x_inches) || 0;
    const ay = Number(a.y_inches) || 0;

    const roomW = room?.width;
    const roomD = room?.depth;
    const minX = bounds?.left ?? 0;
    const minY = bounds?.top ?? 0;
    const maxX = bounds?.right ?? roomW;
    const maxY = bounds?.bottom ?? roomD;

    if (roomW && roomD) {
      if (ax < minX || ay < minY || ax + ad.effW > maxX || ay + ad.effD > maxY) {
        errors.push(`${a.name || 'Item'} extends outside the placement area`);
      }
    }

    for (let j = i + 1; j < placements.length; j++) {
      const b = placements[j];
      const bd = getEffectiveDims(b, b.rotation || 0);
      const bx = Number(b.x_inches) || 0;
      const by = Number(b.y_inches) || 0;
      if (
        boxesConflict(
          { x: ax, y: ay, effW: ad.effW, effD: ad.effD },
          { x: bx, y: by, effW: bd.effW, effD: bd.effD },
          clearance,
        )
      ) {
        errors.push(`${a.name} overlaps with ${b.name}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
