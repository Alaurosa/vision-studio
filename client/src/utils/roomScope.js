/**
 * Pure helpers for scoping the 3D view to a single room (zone).
 *
 * The 2D editor already crops/zooms to the active zone (RoomCanvas `focusBox`);
 * these mirror that math so the 3D viewer can render only the selected room.
 * No React / three.js imports — unit-testable in node/jsdom.
 *
 * Coordinates: furniture `x_inches`/`y_inches` and zone bounds are in
 * room-origin inches (0,0 = room corner). "Zone-local" means relative to the
 * zone's top-left corner.
 */

/**
 * Dimensions (inches) + origin offset for the 3D shell.
 * @param {{width?:number, depth?:number, height?:number}|null|undefined} room
 * @param {{left:number, top:number, right:number, bottom:number}|null|undefined} bounds
 *   Active zone bounds, or null/undefined for the whole floor plan.
 * @returns {{ widthIn:number, depthIn:number, heightIn:number, originX:number, originY:number }}
 */
const MIN_ROOM_IN = 12; // floor so a degenerate/zero-size zone can't break the camera/grid

export function zoneScopedDimensions(room, bounds) {
  const widthIn = Math.max(MIN_ROOM_IN, bounds ? bounds.right - bounds.left : room?.width || 180);
  const depthIn = Math.max(MIN_ROOM_IN, bounds ? bounds.bottom - bounds.top : room?.depth || 144);
  const heightIn = Math.max(MIN_ROOM_IN, room?.height || 96);
  const originX = bounds ? bounds.left : 0;
  const originY = bounds ? bounds.top : 0;
  return { widthIn, depthIn, heightIn, originX, originY };
}

/**
 * Translate furniture from room-origin coords into zone-local coords by
 * subtracting the zone's top-left origin. Returns the original array reference
 * when there's nothing to shift (whole-floor view), keeping memo identity stable.
 * @param {Array<object>} furniture
 * @param {number} originX
 * @param {number} originY
 */
export function scopeFurnitureToOrigin(furniture, originX, originY) {
  if (!originX && !originY) return furniture || [];
  return (furniture || []).map((item) => ({
    ...item,
    x_inches: (item?.x_inches || 0) - originX,
    y_inches: (item?.y_inches || 0) - originY,
  }));
}
