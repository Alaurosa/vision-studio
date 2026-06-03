import { describe, expect, it } from 'vitest';
import {
  dedupeSummaryText,
  dedupeTags,
  formatProjectVisionSummary,
  normalizeGlobalVision,
  tagsFromChips,
} from '@/utils/projectVision';

describe('projectVision', () => {
  it('dedupes repeated summary sentences', () => {
    const raw =
      'Design a modern coastal house with indoor-outdoor flow. Design a modern coastal house with indoor-outdoor flow. Design a modern coastal house with indoor-outdoor flow.';
    const cleaned = dedupeSummaryText(raw);
    expect(cleaned.match(/Design a modern coastal/g)?.length).toBe(1);
  });

  it('dedupes tags case-insensitively', () => {
    expect(dedupeTags(['Warm', 'warm', 'Coastal'])).toEqual(['Warm', 'Coastal']);
  });

  it('formatProjectVisionSummary returns one concise block', () => {
    const text = formatProjectVisionSummary({
      propertyVision:
        'Design a modern coastal home with indoor-outdoor flow. Design a modern coastal home with indoor-outdoor flow.',
      styleKeywords: ['Coastal', 'Modern'],
      priorities: ['Hosting-focused'],
    });
    expect(text.match(/Design a modern coastal/g)?.length).toBe(1);
    expect(text).toContain('Priorities');
    expect(text).toContain('Style direction');
  });

  it('tagsFromChips does not duplicate when same chip toggled twice in set', () => {
    const chips = new Set(['Warm', 'Warm']);
    const { moodTags } = tagsFromChips(chips, ['hosting', 'storage', 'family', 'rental']);
    expect(moodTags).toEqual(['Warm']);
  });

  it('normalizeGlobalVision maps summary to propertyVision for legacy gate', () => {
    const n = normalizeGlobalVision({
      propertyVision: 'Calm family home. Calm family home.',
      styleKeywords: ['Warm', 'Warm'],
    });
    expect(n.propertyVision).toBe('Calm family home.');
    expect(n.styleKeywords).toEqual(['Warm']);
  });
});
