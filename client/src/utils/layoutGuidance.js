/**
 * Lightweight layout guidance (feng shui–inspired flow checks) for the studio.
 */

import { getAABB } from '@/utils/collision';

const BEDLIKE = new Set(['bed', 'beds']);
const DESKLIKE = new Set(['desk', 'tables']);
const SEATING = new Set(['sofa', 'seating', 'armchair', 'chair', 'loveseat']);

function roomCenter(room) {
  return {
    x: (Number(room?.width) || 0) / 2,
    y: (Number(room?.depth) || 0) / 2,
  };
}

function placementCenter(item) {
  const box = getAABB(item);
  return { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 };
}

function isCategory(item, set) {
  const cat = (item?.category || '').toLowerCase();
  return set.has(cat) || (item?.tags || []).some((t) => set.has(String(t).toLowerCase()));
}

function distanceToWall(item, wall, room) {
  const box = getAABB(item);
  const w = Number(room?.width) || 0;
  const d = Number(room?.depth) || 0;
  switch (wall) {
    case 'north':
      return box.top;
    case 'south':
      return d - box.bottom;
    case 'west':
      return box.left;
    case 'east':
      return w - box.right;
    default:
      return Infinity;
  }
}

function nearestWall(item, room) {
  const walls = ['north', 'south', 'east', 'west'];
  let best = walls[0];
  let bestDist = distanceToWall(item, best, room);
  for (const wall of walls.slice(1)) {
    const dist = distanceToWall(item, wall, room);
    if (dist < bestDist) {
      best = wall;
      bestDist = dist;
    }
  }
  return { wall: best, distance: bestDist };
}

/**
 * @param {{
 *   room: { width?: number, depth?: number } | null,
 *   furniture?: Array<object>,
 *   layoutIntent?: string,
 * }} params
 * @returns {{ score: number, tips: string[], warnings: string[] }}
 */
export function evaluateLayoutGuidance({ room, furniture = [], layoutIntent = 'balanced' }) {
  const tips = [];
  const warnings = [];
  let score = 70;

  const rw = Number(room?.width) || 0;
  const rd = Number(room?.depth) || 0;
  if (!(rw > 0 && rd > 0)) {
    return {
      score: 0,
      tips: ['Set room dimensions to get layout guidance.'],
      warnings: [],
    };
  }

  const center = roomCenter(room);
  const placements = furniture.filter(Boolean);

  const centerBlockers = placements.filter((item) => {
    const c = placementCenter(item);
    const dx = Math.abs(c.x - center.x);
    const dy = Math.abs(c.y - center.y);
    return dx < rw * 0.15 && dy < rd * 0.15;
  });

  if (layoutIntent === 'open-flow') {
    if (centerBlockers.length > 0) {
      score -= 15;
      warnings.push('Open flow works best with the center of the room kept clear.');
    } else {
      score += 10;
      tips.push('Center is open — good for circulation and an airy feel.');
    }
  }

  if (layoutIntent === 'cozy-nook') {
    const seats = placements.filter((p) => isCategory(p, SEATING));
    if (seats.length >= 2) {
      const c0 = placementCenter(seats[0]);
      const c1 = placementCenter(seats[1]);
      const dist = Math.hypot(c0.x - c1.x, c0.y - c1.y);
      if (dist < Math.min(rw, rd) * 0.45) {
        score += 10;
        tips.push('Seating is grouped — nice for conversation.');
      } else {
        warnings.push('Pull seating closer together for a cozier nook.');
        score -= 8;
      }
    } else if (seats.length === 0) {
      tips.push('Add a sofa or chairs to build a cozy zone.');
    }
  }

  if (layoutIntent === 'commanding') {
    const anchors = placements.filter((p) => isCategory(p, BEDLIKE) || isCategory(p, DESKLIKE));
    for (const item of anchors) {
      const { wall, distance } = nearestWall(item, room);
      if (distance <= 18) {
        score += 8;
        tips.push(`${item.name || 'Piece'} has solid support along the ${wall} wall.`);
      } else {
        score -= 10;
        warnings.push(
          `Move ${item.name || 'bed or desk'} closer to a wall so your back is supported.`,
        );
      }
    }
    if (anchors.length === 0) {
      tips.push('Place a bed or desk with its back toward a wall for a commanding position.');
    }
  }

  if (layoutIntent === 'balanced') {
    const quadrants = [0, 0, 0, 0];
    for (const item of placements) {
      const c = placementCenter(item);
      const qi = (c.x >= center.x ? 1 : 0) + (c.y >= center.y ? 2 : 0);
      quadrants[qi] += 1;
    }
    const occupied = quadrants.filter((n) => n > 0).length;
    if (occupied >= 3) {
      score += 8;
      tips.push('Furniture is spread across the room — balanced visual weight.');
    } else if (placements.length > 2) {
      warnings.push('Try distributing pieces into more areas for balance.');
      score -= 6;
    }
  }

  const perimeterClear = placements.every((item) => {
    const box = getAABB(item);
    return box.left >= 12 && box.top >= 12 && box.right <= rw - 12 && box.bottom <= rd - 12;
  });
  if (!perimeterClear && placements.length > 0) {
    warnings.push('Leave a few inches of clearance along walls for walkways.');
    score -= 5;
  } else if (placements.length > 0) {
    tips.push('Walkways along the walls look clear.');
  }

  if (score > 100) score = 100;
  if (score < 0) score = 0;

  if (tips.length === 0 && warnings.length === 0) {
    tips.push('Add furniture to see tailored layout suggestions.');
  }

  return { score, tips, warnings };
}
