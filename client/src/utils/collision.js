import { getItemCenter, normalizeRotation } from '@/utils/scale';

// AABB collision in inches for an arbitrarily rotated rectangle.
export function getAABB(item) {
  const width = item.width || 0;
  const depth = item.depth || 0;
  const center = getItemCenter(item);
  const angle = normalizeRotation(item.rotation || 0) * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const halfW = width / 2;
  const halfD = depth / 2;
  const corners = [
    [-halfW, -halfD],
    [halfW, -halfD],
    [halfW, halfD],
    [-halfW, halfD],
  ].map(([x, y]) => ({
    x: center.x + x * cos - y * sin,
    y: center.y + x * sin + y * cos,
  }));

  return {
    left: Math.min(...corners.map((corner) => corner.x)),
    top: Math.min(...corners.map((corner) => corner.y)),
    right: Math.max(...corners.map((corner) => corner.x)),
    bottom: Math.max(...corners.map((corner) => corner.y)),
  };
}

export function overlaps(a, b) {
  return !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
}

export function withinRoom(box, room) {
  if (!room?.width || !room?.depth) return true;
  return box.left >= 0 && box.top >= 0 && box.right <= room.width && box.bottom <= room.depth;
}

export function validateAll(items, room) {
  const errors = [];
  const boxes = items.map((it) => ({ it, box: getAABB(it) }));
  for (const { it, box } of boxes) {
    if (!withinRoom(box, room)) errors.push(`${it.name || 'Item'} extends outside the room.`);
  }
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (overlaps(boxes[i].box, boxes[j].box)) {
        errors.push(`${boxes[i].it.name} overlaps ${boxes[j].it.name}.`);
      }
    }
  }
  return { valid: errors.length === 0, errors };
}
