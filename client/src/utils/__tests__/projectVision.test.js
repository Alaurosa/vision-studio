import { beforeEach, describe, expect, it } from 'vitest';
import {
  dedupeSummaryText,
  dedupeTags,
  formatProjectVisionSummary,
  mergeGlobalVisionSources,
  normalizeGlobalVision,
  prepareGlobalVisionForSave,
  tagsFromChips,
} from '@/utils/projectVision';
import { getProjectById, upsertProject } from '@/utils/projectCompat';

const STORAGE_KEY = 'vs-projects-v1';

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

  it('prepareGlobalVisionForSave does not duplicate summary when saved twice with same text', () => {
    const project = { id: 'p-save', spaces: [] };
    const sentence = 'Design a modern coastal home with indoor-outdoor flow.';
    const once = prepareGlobalVisionForSave({ summary: sentence }, {}, project);
    const twice = prepareGlobalVisionForSave({ summary: sentence }, once, project);
    expect(twice.summary).toBe(sentence);
    expect(twice.summary.match(/Design a modern coastal/g)?.length).toBe(1);
    expect(twice.propertyVision).toBe(twice.summary);
  });

  it('prepareGlobalVisionForSave overwrites notes instead of appending duplicate notes', () => {
    const project = { id: 'p-notes', spaces: [] };
    const first = prepareGlobalVisionForSave({ notes: 'Hosting and family-friendly.' }, {}, project);
    const second = prepareGlobalVisionForSave({ notes: 'Hosting and family-friendly.' }, first, project);
    expect(second.notes).toBe('Hosting and family-friendly.');
    expect(second.notes.match(/Hosting and family-friendly/g)?.length).toBe(1);
  });

  it('selecting the same chip twice does not duplicate moodTags on save', () => {
    const chips = new Set(['Warm', 'Warm', 'Coastal']);
    const { moodTags } = tagsFromChips(chips, ['hosting', 'storage', 'family', 'rental']);
    const saved = prepareGlobalVisionForSave({ moodTags }, {}, { id: 'p-chips', spaces: [] });
    expect(saved.moodTags).toEqual(['Warm', 'Coastal']);
    const again = prepareGlobalVisionForSave({ moodTags: ['Warm', 'Warm', 'Coastal'] }, saved, {
      id: 'p-chips',
      spaces: [],
    });
    expect(again.moodTags).toEqual(['Warm', 'Coastal']);
  });

  it('mergeGlobalVisionSources dedupes duplicated local/API propertyVision', () => {
    const merged = mergeGlobalVisionSources(
      { propertyVision: 'Calm family home. Calm family home.' },
      { propertyVision: 'Calm family home. Calm family home.', styleKeywords: ['Warm', 'warm'] },
      { id: 'p-merge', spaces: [] },
    );
    expect(merged.summary).toBe('Calm family home.');
    expect(merged.styleKeywords).toEqual(['Warm']);
  });

  it('formatProjectVisionSummary returns one concise block for display', () => {
    const text = formatProjectVisionSummary({
      propertyVision:
        'Design a modern coastal home with indoor-outdoor flow. Design a modern coastal home with indoor-outdoor flow.',
      styleKeywords: ['Coastal', 'Modern'],
      priorities: ['Hosting-focused'],
      moodTags: ['Coastal', 'Modern'],
    });
    expect(text.match(/Design a modern coastal/g)?.length).toBe(1);
    expect(text).toContain('Priorities');
    expect(text).toContain('Style direction');
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

describe('upsertProject vision persistence', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  it('normalizes duplicated globalVision at save time in localStorage', () => {
    upsertProject({
      id: 'persist-dedupe',
      name: 'Test',
      globalVision: {
        propertyVision: 'Modern coastal flow. Modern coastal flow.',
        styleKeywords: ['Coastal', 'coastal', 'Modern'],
        notes: 'Family-friendly. Family-friendly.',
      },
      spaces: [{ id: 's1', name: 'Living Room', type: 'interior' }],
    });

    const loaded = getProjectById('persist-dedupe');
    expect(loaded.globalVision.summary).toBe('Modern coastal flow.');
    expect(loaded.globalVision.styleKeywords).toEqual(['Coastal', 'Modern']);
    expect(loaded.globalVision.notes).toBe('Family-friendly.');

    upsertProject({
      ...loaded,
      globalVision: {
        ...loaded.globalVision,
        summary: 'Modern coastal flow.',
        moodTags: ['Coastal', 'Coastal', 'Modern'],
      },
    });
    const reloaded = getProjectById('persist-dedupe');
    expect(reloaded.globalVision.summary.match(/Modern coastal flow/g)?.length).toBe(1);
    expect(reloaded.globalVision.moodTags).toEqual(['Coastal', 'Modern']);
  });
});
