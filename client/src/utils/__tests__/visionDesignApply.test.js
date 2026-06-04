import { describe, expect, it } from 'vitest';
import {
  buildVisionDesignPlan,
  computeVisionDesignRevision,
  deriveInteriorFromVision,
  deriveStyleHintFromVision,
  pickVisionStarterPlacements,
} from '@/utils/visionDesignApply';
import { isInteriorUserEdited, markInteriorUserPatch, normalizeRoomInterior } from '@/data/roomInterior';

const gv = {
  moodTags: ['Warm', 'Modern'],
  priorities: ['Better flow', 'Hosting guests'],
  constraints: ['Pet-friendly'],
  roomSpecificNeeds: { 'z-dining': ['Hosting'] },
};

describe('visionDesignApply', () => {
  it('derives style hint from mood tags', () => {
    expect(deriveStyleHintFromVision(gv)).toBe('cozy');
  });

  it('maps vision to interior wall color and layout intent', () => {
    const interior = deriveInteriorFromVision(gv, {});
    expect(interior.wallColor).toBeTruthy();
    expect(interior.layoutIntent).toBe('open-flow');
    expect(interior.source).toBe('vision');
    expect(interior.visionRevision).toBe(computeVisionDesignRevision(gv));
  });

  it('does not overwrite manual interior when user edited', () => {
    const userInterior = markInteriorUserPatch({
      wallColor: '#d4ddd0',
      wallpaperId: 'stripe',
    });
    const plan = buildVisionDesignPlan({
      globalVision: gv,
      room: { id: 'r1', interior: userInterior, width: 240, depth: 180 },
      zones: [{ id: 'z-dining', bbox: [200, 0, 320, 150], width: 120, depth: 150, name: 'Dining' }],
      activeZone: { id: 'z-dining', bbox: [200, 0, 320, 150], name: 'Dining' },
      furniture: [],
    });
    expect(plan.interiorPatch).toBeNull();
    expect(isInteriorUserEdited(userInterior)).toBe(true);
  });

  it('buildVisionDesignPlan includes furniture with zone_id for empty zones', () => {
    const plan = buildVisionDesignPlan({
      globalVision: gv,
      room: { id: 'r1', width: 320, depth: 150, height: 96 },
      zones: [{ id: 'z-dining', bbox: [200, 0, 320, 150], width: 120, depth: 150, name: 'Dining Room' }],
      activeZone: { id: 'z-dining', bbox: [200, 0, 320, 150], name: 'Dining Room' },
      activeSpace: { name: 'Dining Room', category: 'Dining' },
      furniture: [],
    });
    expect(plan.furniturePlan.placements.length).toBeGreaterThan(0);
    expect(plan.furniturePlan.placements[0].zone_id).toBe('z-dining');
  });

  it('skips furniture plan when zone already has items', () => {
    const plan = buildVisionDesignPlan({
      globalVision: gv,
      room: { id: 'r1', width: 320, depth: 150 },
      zones: [{ id: 'z-dining', bbox: [200, 0, 320, 150], width: 120, depth: 150 }],
      activeZone: { id: 'z-dining', bbox: [200, 0, 320, 150] },
      furniture: [
        {
          id: 'p1',
          zone_id: 'z-dining',
          x_inches: 250,
          y_inches: 60,
          width: 48,
          depth: 30,
        },
      ],
    });
    expect(plan.furniturePlan.placements).toHaveLength(0);
  });

  it('pickVisionStarterPlacements returns placements for empty zone', () => {
    const zone = { id: 'z-dining', bbox: [200, 0, 320, 150], width: 120, depth: 150, name: 'Dining' };
    const picks = pickVisionStarterPlacements({
      globalVision: gv,
      room: { width: 320, depth: 150, height: 96 },
      zone,
      existingFurniture: [],
    });
    expect(picks.length).toBeGreaterThan(0);
    expect(picks[0].zone_id).toBe('z-dining');
  });
});

describe('roomInterior user edit protection', () => {
  it('markInteriorUserPatch sets source and timestamp', () => {
    const n = normalizeRoomInterior(markInteriorUserPatch({ wallColor: '#abcabc' }));
    expect(n.source).toBe('user');
    expect(n.userEditedAt).toBeTruthy();
  });
});
