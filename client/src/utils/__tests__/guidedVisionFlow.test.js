import { describe, expect, it } from 'vitest';
import {
  applyRoomFocusSelection,
  buildChatGlobalVisionPayload,
  buildGuidedStepSummaryText,
  evaluateGuidedVisionReadiness,
  getActiveGuidedVisionStep,
  getOptionsForGuidedStep,
  getRoomSpecificOptionsForSpace,
  NO_MAJOR_CONSTRAINTS,
  normalizeGuidedVisionFields,
  toggleGuidedListSelection,
  USE_ALL_ROOMS_EVENLY,
  VISION_MOOD_OPTIONS,
} from '@/utils/guidedVisionFlow';
import { GUIDED_STEP_SUMMARY_MESSAGE_ID, upsertGuidedStepSummaryMessage } from '@/utils/projectVisionIntakeChat';
import { prepareGlobalVisionForSave } from '@/utils/projectVision';

const projectWithSpaces = {
  id: 'p1',
  spaces: [
    { id: 's-living', name: 'Living Room', type: 'interior', category: 'Living' },
    { id: 's-bed', name: 'Bedroom', type: 'interior', category: 'Bedroom' },
  ],
};

function buildReadyGv(overrides = {}) {
  return {
    moodTags: ['Warm', 'Modern'],
    priorities: ['Better flow', 'Hosting guests'],
    constraints: ['Pet-friendly'],
    prioritizedRooms: ['Living Room'],
    roomSpecificNeeds: { 's-living': ['Hosting'] },
    ...overrides,
  };
}

describe('guidedVisionFlow readiness', () => {
  it('does not require a paragraph of text to become ready', () => {
    const gv = buildReadyGv({ summary: '', propertyVision: '' });
    const { ready } = evaluateGuidedVisionReadiness(gv, projectWithSpaces);
    expect(ready).toBe(true);
  });

  it('enables continue when 2 moods, 2 priorities, 1 constraint, and room focus are set', () => {
    const { ready, checklist } = evaluateGuidedVisionReadiness(
      buildReadyGv(),
      projectWithSpaces,
    );
    expect(ready).toBe(true);
    expect(checklist.style).toBe(true);
    expect(checklist.priorities).toBe(true);
    expect(checklist.constraints).toBe(true);
    expect(checklist.roomFocus).toBe(true);
    expect(checklist.roomNeeds).toBe(true);
  });

  it('keeps continue disabled and explains missing priority', () => {
    const gv = buildReadyGv({ priorities: ['Better flow'] });
    const { ready, helperText } = evaluateGuidedVisionReadiness(gv, projectWithSpaces);
    expect(ready).toBe(false);
    expect(helperText.toLowerCase()).toMatch(/priority/);
  });

  it('treats “No major constraints” as satisfying constraints', () => {
    const gv = buildReadyGv({
      constraints: [NO_MAJOR_CONSTRAINTS],
      roomSpecificNeeds: { 's-living': ['TV watching'] },
    });
    const { ready, checklist } = evaluateGuidedVisionReadiness(gv, projectWithSpaces);
    expect(checklist.constraints).toBe(true);
    expect(ready).toBe(true);
  });

  it('generates room focus options from project spaces', () => {
    const options = getOptionsForGuidedStep('room_focus', projectWithSpaces, {});
    expect(options).toContain('Living Room');
    expect(options).toContain('Bedroom');
    expect(options).toContain(USE_ALL_ROOMS_EVENLY);
    expect(options.length).toBeLessThanOrEqual(9);
  });

  it('shows room-specific chips after a room is chosen', () => {
    const gv = applyRoomFocusSelection({}, 'Living Room');
    const step = getActiveGuidedVisionStep(
      { ...gv, moodTags: ['Warm', 'Modern'], priorities: ['Better flow', 'Hosting guests'], constraints: ['Pet-friendly'] },
      projectWithSpaces,
    );
    expect(step).toBe('room_needs');
    const chips = getOptionsForGuidedStep('room_needs', projectWithSpaces, gv);
    expect(chips).toEqual(getRoomSpecificOptionsForSpace({ name: 'Living Room', category: 'Living' }));
    expect(chips.length).toBeGreaterThanOrEqual(4);
    expect(chips.length).toBeLessThanOrEqual(8);
  });

  it('passes structured context to chat global_vision payload', () => {
    const gv = buildReadyGv({ notes: 'Keep it bright.' });
    const payload = buildChatGlobalVisionPayload(gv, projectWithSpaces);
    expect(payload.moodTags).toEqual(['Warm', 'Modern']);
    expect(payload.priorities).toContain('Better flow');
    expect(payload.constraints).toContain('Pet-friendly');
    expect(payload.prioritizedRooms).toContain('Living Room');
    expect(payload.roomSpecificNeeds['s-living']).toContain('Hosting');
    expect(payload.spacesContext.length).toBe(2);
    expect(payload.notes).toBe('Keep it bright.');
    expect(payload.readiness.ready).toBe(true);
  });

  it('shows 8 mood options per step (within 4–8 range)', () => {
    expect(VISION_MOOD_OPTIONS.length).toBe(8);
    const moodOpts = getOptionsForGuidedStep('mood', projectWithSpaces, {});
    expect(moodOpts.length).toBe(8);
  });
});

describe('guidedVisionFlow summaries', () => {
  it('upserts a single guided step summary card (no duplicates)', () => {
    const first = upsertGuidedStepSummaryMessage([], 'Step one summary.');
    const second = upsertGuidedStepSummaryMessage(first, 'Step two summary.');
    const assistantCards = second.filter((m) => m.role === 'assistant');
    expect(assistantCards).toHaveLength(1);
    expect(assistantCards[0].id).toBe(GUIDED_STEP_SUMMARY_MESSAGE_ID);
    expect(assistantCards[0].content).toBe('Step two summary.');
  });

  it('buildGuidedStepSummaryText reflects mood selections', () => {
    const text = buildGuidedStepSummaryText(
      'mood',
      { moodTags: ['Warm', 'Coastal'] },
      projectWithSpaces,
    );
    expect(text).toMatch(/Warm/);
    expect(text).toMatch(/Coastal/);
  });
});

describe('guidedVisionFlow with projectVision save', () => {
  it('prepareGlobalVisionForSave still dedupes when chip fields saved twice', () => {
    const patch = toggleGuidedListSelection(
      normalizeGuidedVisionFields({}),
      'Warm',
      'mood',
    );
    const once = prepareGlobalVisionForSave(
      { moodTags: patch.moodTags, priorities: [], constraints: [] },
      {},
      projectWithSpaces,
    );
    const twice = prepareGlobalVisionForSave(
      { moodTags: ['Warm', 'Warm', 'Modern'], priorities: ['Better flow', 'Better flow'] },
      once,
      projectWithSpaces,
    );
    expect(twice.moodTags).toEqual(['Warm', 'Modern']);
    expect(twice.priorities).toEqual(['Better flow']);
  });
});
