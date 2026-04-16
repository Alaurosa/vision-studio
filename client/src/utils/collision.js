export function getAABB(item) {
  if (item.rotation === 0 || item.rotation === 180) {
    return { left: item.x_inches, top: item.y_inches, right: item.x_inches + item.width, bottom: item.y_inches + item.depth };
  }
  if (item.rotation === 90 || item.rotation === 270) {
    // Rotation occurs around center — compute center, then calculate AABB with swapped w/d
    const cx = item.x_inches + item.width / 2;
    const cy = item.y_inches + item.depth / 2;
    return {
      left: cx - item.depth / 2,
      top: cy - item.width / 2,
      right: cx + item.depth / 2,
      bottom: cy + item.width / 2,
    };
  }

  const rad = (item.rotation * Math.PI) / 180;
  const corners = [
    [0, 0],
    [item.width, 0],
    [item.width, item.depth],
    [0, item.depth],
  ].map(([cx, cy]) => [
    item.x_inches + cx * Math.cos(rad) - cy * Math.sin(rad),
    item.y_inches + cx * Math.sin(rad) + cy * Math.cos(rad),
  ]);

  return {
    left: Math.min(...corners.map((c) => c[0])),
    top: Math.min(...corners.map((c) => c[1])),
    right: Math.max(...corners.map((c) => c[0])),
    bottom: Math.max(...corners.map((c) => c[1])),
  };
}

export function overlaps(a, b) {
  return !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
}

export function withinRoom(itemAABB, room) {
  return itemAABB.left >= 0 && itemAABB.top >= 0 && itemAABB.right <= room.width && itemAABB.bottom <= room.depth;
}

export function validateAll(movingItem, allItems, room) {
  const errors = [];
  const box = getAABB(movingItem);

  if (!withinRoom(box, room)) {
    errors.push(`${movingItem.name} extends outside the room.`);
  }

  for (const other of allItems) {
    if (other.id === movingItem.id) continue;
    if (overlaps(box, getAABB(other))) {
      errors.push(`${movingItem.name} overlaps with ${other.name}.`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * When the moving item overlaps any other item, resolve the overlap
 * by snapping to the nearest edge of the colliding item.
 * Returns the corrected { x_inches, y_inches } or the original if no overlap.
 */
export function snapToEdge(movingItem, allItems, room) {
  const movingBox = getAABB(movingItem);
  const movingW = movingBox.right - movingBox.left;
  const movingD = movingBox.bottom - movingBox.top;

  let bestX = movingItem.x_inches;
  let bestY = movingItem.y_inches;
  let snapped = false;

  for (const other of allItems) {
    if (other.id === movingItem.id) continue;
    const otherBox = getAABB(other);
    if (!overlaps(movingBox, otherBox)) continue;

    // Calculate the 4 possible snap positions (place moving item on each edge of other)
    const candidates = [
      // Snap to left edge of other (moving item's right edge aligns with other's left edge)
      { x: otherBox.left - movingW, y: movingItem.y_inches },
      // Snap to right edge of other
      { x: otherBox.right, y: movingItem.y_inches },
      // Snap to top edge of other (moving item's bottom edge aligns with other's top)
      { x: movingItem.x_inches, y: otherBox.top - movingD },
      // Snap to bottom edge of other
      { x: movingItem.x_inches, y: otherBox.bottom },
    ];

    // Pick the candidate that requires the smallest movement
    let minDist = Infinity;
    for (const c of candidates) {
      const dx = c.x - movingItem.x_inches;
      const dy = c.y - movingItem.y_inches;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) {
        // Verify this candidate doesn't overlap the same item
        const testBox = {
          left: c.x,
          top: c.y,
          right: c.x + movingW,
          bottom: c.y + movingD,
        };
        if (!overlaps(testBox, otherBox)) {
          minDist = dist;
          bestX = c.x;
          bestY = c.y;
          snapped = true;
        }
      }
    }
  }

  // Clamp within room bounds if room is provided
  if (snapped && room) {
    bestX = Math.max(0, Math.min(bestX, (room.width || 9999) - movingW));
    bestY = Math.max(0, Math.min(bestY, (room.depth || 9999) - movingD));
  }

  return { x_inches: bestX, y_inches: bestY, snapped };
}
