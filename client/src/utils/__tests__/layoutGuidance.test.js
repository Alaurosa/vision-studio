import { describe, expect, it } from 'vitest';
import { evaluateLayoutGuidance } from '@/utils/layoutGuidance';

describe('evaluateLayoutGuidance', () => {
  const room = { width: 180, depth: 144 };

  it('asks for room dimensions when missing', () => {
    const result = evaluateLayoutGuidance({ room: null, furniture: [] });
    expect(result.score).toBe(0);
    expect(result.tips[0]).toMatch(/dimensions/i);
  });

  it('warns when open-flow intent has center clutter', () => {
    const result = evaluateLayoutGuidance({
      room,
      layoutIntent: 'open-flow',
      furniture: [
        {
          id: '1',
          name: 'Block',
          category: 'tables',
          width: 48,
          depth: 48,
          x_inches: 66,
          y_inches: 48,
          rotation: 0,
        },
      ],
    });
    expect(result.warnings.some((w) => /center/i.test(w))).toBe(true);
  });

  it('rewards commanding intent when desk is against a wall', () => {
    const result = evaluateLayoutGuidance({
      room,
      layoutIntent: 'commanding',
      furniture: [
        {
          id: 'd1',
          name: 'Desk',
          category: 'desk',
          width: 48,
          depth: 24,
          x_inches: 0,
          y_inches: 60,
          rotation: 0,
        },
      ],
    });
    expect(result.tips.some((t) => /wall/i.test(t))).toBe(true);
  });
});
