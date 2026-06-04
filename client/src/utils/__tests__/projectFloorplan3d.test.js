import { describe, expect, it } from 'vitest';
import { buildProject3dSpaces, getProjectOverviewCamera } from '@/utils/projectFloorplan3d';

const project = {
  id: 'p1',
  floorplan: {
    zones: [
      {
        id: 'z-living',
        name: 'Living',
        geometry: { type: 'rect', bbox: { x: 0, y: 0, width: 200, height: 150 } },
      },
      {
        id: 'z-dining',
        name: 'Dining',
        geometry: { type: 'rect', bbox: { x: 200, y: 0, width: 120, height: 150 } },
      },
    ],
  },
  spaces: [
    { id: 'sp-living', name: 'Living Room', zoneId: 'z-living', type: 'interior' },
    { id: 'sp-dining', name: 'Dining Room', zoneId: 'z-dining', type: 'interior' },
  ],
};

const zones = [
  { id: 'z-living', name: 'Living', bbox: [0, 0, 200, 150], width: 200, depth: 150 },
  { id: 'z-dining', name: 'Dining', bbox: [200, 0, 320, 150], width: 120, depth: 150 },
];

describe('projectFloorplan3d', () => {
  it('builds spaced shells from floorplan geometry (not stacked blocks)', () => {
    const { spaces, worldW, worldD } = buildProject3dSpaces(project, zones);
    expect(spaces).toHaveLength(2);
    expect(spaces[0].leftIn).toBe(0);
    expect(spaces[1].leftIn).toBe(200);
    expect(worldW).toBeGreaterThan(5);
    expect(worldD).toBeGreaterThan(3);
  });

  it('overview camera targets floorplan center above floor', () => {
    const layout = buildProject3dSpaces(project, zones);
    const cam = getProjectOverviewCamera(layout);
    expect(cam.position[1]).toBeGreaterThan(cam.target[1]);
    expect(cam.target[0]).toBeCloseTo(layout.worldW / 2, 1);
  });
});
