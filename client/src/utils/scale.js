export const computeScale = (p1, p2, realInches) => {
  const dx = p2[0] - p1[0], dy = p2[1] - p1[1];
  const distPx = Math.sqrt(dx * dx + dy * dy);
  return realInches > 0 ? distPx / realInches : 4;
};

export const pxToInches = (px, scale) => px / (scale || 4);
export const inchesToPx = (inches, scale) => inches * (scale || 4);
export const snapToGrid = (val, gridSize) => Math.round(val / gridSize) * gridSize;

export const normalizeRotation = (rotation = 0) => {
  const normalized = rotation % 360;
  return normalized < 0 ? normalized + 360 : normalized;
};

export function getRotatedBoundingBox(width, depth, rotation = 0) {
  const angle = normalizeRotation(rotation) * Math.PI / 180;
  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));
  return {
    width: width * cos + depth * sin,
    depth: width * sin + depth * cos,
  };
}

export function getItemCenter(item) {
  const bbox = getRotatedBoundingBox(item.width || 0, item.depth || 0, item.rotation || 0);
  return {
    x: (item.x_inches || 0) + bbox.width / 2,
    y: (item.y_inches || 0) + bbox.depth / 2,
  };
}

/**
 * Compute rotation patch that preserves the item's center position.
 * Accepts either an explicit next rotation or defaults to a 90° clockwise step.
 */
export function computeRotation(item, nextRotation = null) {
  const newRot = normalizeRotation(nextRotation == null ? (item.rotation || 0) + 90 : nextRotation);
  const oldCenter = getItemCenter(item);
  const newBbox = getRotatedBoundingBox(item.width || 0, item.depth || 0, newRot);
  return {
    rotation: newRot,
    x_inches: Math.max(0, oldCenter.x - newBbox.width / 2),
    y_inches: Math.max(0, oldCenter.y - newBbox.depth / 2),
  };
}
