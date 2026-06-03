import { describe, expect, it } from 'vitest';
import {
  VISION_SAVE_STATUS_MESSAGE_ID,
  buildVisionSaveStatusMessage,
  dedupeAssistantFallbackMessages,
  isVisionSaveStatusMessage,
  normalizeVisionIntakeThread,
  upsertAssistantStatusMessage,
} from '@/utils/projectVisionIntakeChat';

describe('projectVisionIntakeChat', () => {
  const status = buildVisionSaveStatusMessage(['Focus on a Minimal mood', 'Set a budget range']);

  it('isVisionSaveStatusMessage detects stable id and legacy content', () => {
    expect(isVisionSaveStatusMessage(status)).toBe(true);
    expect(
      isVisionSaveStatusMessage({
        id: 'old-fallback',
        role: 'assistant',
        content: 'Your direction is saved. Quick suggestions:\n\n- one',
      }),
    ).toBe(true);
    expect(isVisionSaveStatusMessage({ id: 'u-1', role: 'user', content: 'hello' })).toBe(false);
  });

  it('upsertAssistantStatusMessage replaces prior status card', () => {
    const first = upsertAssistantStatusMessage(
      [{ id: 'u-1', role: 'user', content: 'host-focused' }],
      status,
    );
    expect(first.filter(isVisionSaveStatusMessage)).toHaveLength(1);
    const updated = buildVisionSaveStatusMessage(['New tip']);
    const second = upsertAssistantStatusMessage(
      [...first, { id: 'u-2', role: 'user', content: 'storage area' }],
      updated,
    );
    const statusCards = second.filter(isVisionSaveStatusMessage);
    expect(statusCards).toHaveLength(1);
    expect(statusCards[0].id).toBe(VISION_SAVE_STATUS_MESSAGE_ID);
    expect(second.filter((m) => m.role === 'user')).toHaveLength(2);
  });

  it('normalizeVisionIntakeThread dedupes persisted legacy threads', () => {
    const thread = normalizeVisionIntakeThread([
      { id: 'u-1', role: 'user', content: 'first note' },
      { id: 'a-old-1', role: 'assistant', content: 'Your direction is saved. Quick suggestions:\n\n- one' },
      { id: 'u-2', role: 'user', content: 'second note' },
      { id: 'a-old-2', role: 'assistant', content: 'Your direction is saved. Quick suggestions:\n\n- two' },
    ]);
    expect(thread.filter(isVisionSaveStatusMessage)).toHaveLength(1);
    expect(thread.filter((m) => m.role === 'user')).toHaveLength(2);
  });

  it('dedupeAssistantFallbackMessages keeps one status card', () => {
    const dupes = [
      { id: 'u-1', role: 'user', content: 'a' },
      { id: 'a-1', role: 'assistant', content: 'Your direction is saved. Quick suggestions:\n\n- x' },
      { id: 'u-2', role: 'user', content: 'b' },
      { id: 'a-2', role: 'assistant', content: 'Your direction is saved. Quick suggestions:\n\n- y' },
    ];
    const deduped = dedupeAssistantFallbackMessages(dupes);
    expect(deduped.filter(isVisionSaveStatusMessage)).toHaveLength(1);
    expect(deduped.filter((m) => m.role === 'user')).toHaveLength(2);
  });
});
