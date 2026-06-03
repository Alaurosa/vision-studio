import { describe, expect, it } from 'vitest';
import {
  computeVisionDesignRevision,
  deriveInteriorFromVision,
  deriveStyleHintFromVision,
  pickVisionStarterPlacements,
} from '@/utils/visionDesignApply';

describe('visionDesignApply', () => {
  const gv = {
    moodTags: ['Warm', 'Modern'],
    priorities: ['Better flow', 'Hosting guests'],
    constraints: ['Pet-friendly'],
    roomSpecificNeeds: { 'z-dining': ['Hosting'] },
  };

  it('derives style hint from mood tags', () => {
    expect(deriveStyleHintFromVision(gv)).toBe('cozy');
  });

  it('maps vision to interior wall color and layout intent', () => {
    const interior = deriveInteriorFromVision(gv, {});
    expect(interior.wallColor).toBeTruthy();
    expect(interior.layoutIntent).toBe('open-flow');
    expect(interior.visionRevision).toBe(computeVisionDesignRevision(gv));
  });

  it('suggests starter placements for empty zones', () => {
    const zone = { id: 'z-dining', bbox: [200, 0, 320, 150], width: 120, depth: 150 };
    const picks = pickVisionStarterPlacements({
      globalVision: gv,
      room: { width: 320, depth: 150, height: 96 },
      zone,
      existingFurniture: [],
    });
    expect(picks.length).toBeGreaterThan(0);
    expect(picks[0].zone_id).toBe('z-dining');
  });

  it('does not add starters when zone already has furniture', () => {
    const zone = { id: 'z-dining', bbox: [200, 0, 320, 150], width: 120, depth: 150 };
    const picks = pickVisionStarterPlacements({
      globalVision: gv,
      room: { width: 320, depth: 150, height: 96 },
      zone,
      existingFurniture: [
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
    expect(picks).toHaveLength(0);
  });
});
