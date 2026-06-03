/** Stable id for the offline/save-status assistant card (upserted, not stacked). */
export const VISION_SAVE_STATUS_MESSAGE_ID = 'vision-save-status';

const SAVE_STATUS_PREFIX = 'Your direction is saved.';

/**
 * @param {string[]} bullets
 */
export function buildVisionSaveStatusContent(bullets) {
  return `${SAVE_STATUS_PREFIX} Quick suggestions:\n\n- ${bullets.join('\n- ')}\n\nAdd chips or a short note, then review project & spaces when ready.`;
}

/**
 * @param {string[]} bullets
 * @returns {{ id: string, role: string, type: string, content: string }}
 */
export function buildVisionSaveStatusMessage(bullets) {
  return {
    id: VISION_SAVE_STATUS_MESSAGE_ID,
    role: 'assistant',
    type: 'assistant_status',
    content: buildVisionSaveStatusContent(bullets),
  };
}

/**
 * @param {object | null | undefined} message
 */
export function isVisionSaveStatusMessage(message) {
  if (!message || message.role !== 'assistant') return false;
  if (message.id === VISION_SAVE_STATUS_MESSAGE_ID) return true;
  if (message.type === 'assistant_status') return true;
  return (
    typeof message.content === 'string' && message.content.trimStart().startsWith(SAVE_STATUS_PREFIX)
  );
}

/**
 * Replace any existing save-status assistant card with the latest one.
 * @param {Array<{ id?: string, role: string, content: string, type?: string }>} messages
 * @param {object} statusMessage
 */
export function upsertAssistantStatusMessage(messages, statusMessage) {
  const withoutStatus = (messages || []).filter((m) => !isVisionSaveStatusMessage(m));
  return [...withoutStatus, statusMessage];
}

/**
 * Keep at most one save-status assistant card (e.g. when rehydrating thread).
 * @param {Array<{ id?: string, role: string, content: string, type?: string }>} messages
 */
export function dedupeAssistantFallbackMessages(messages) {
  let seenStatus = false;
  return (messages || []).filter((m) => {
    if (!isVisionSaveStatusMessage(m)) return true;
    if (seenStatus) return false;
    seenStatus = true;
    return true;
  });
}

/**
 * Normalize persisted vision intake thread (dedupe legacy stacked status cards).
 * @param {unknown} raw
 */
export function normalizeVisionIntakeThread(raw) {
  if (!Array.isArray(raw)) return [];
  const mapped = raw
    .filter((m) => m && typeof m.content === 'string')
    .map((m, i) => ({
      id: m.id || `m-${i}-${m.role}`,
      role: m.role,
      type: m.type,
      content: m.content,
    }));
  return dedupeAssistantFallbackMessages(mapped);
}
