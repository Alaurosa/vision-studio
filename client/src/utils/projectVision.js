/**
 * Normalize and display project.globalVision without duplicate summary text.
 */

/**
 * @param {string} text
 * @returns {string}
 */
export function dedupeSummaryText(text) {
  if (!text || typeof text !== 'string') return '';
  const trimmed = text.trim();
  const byParagraph = trimmed.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  const chunks =
    byParagraph.length > 1
      ? byParagraph
      : trimmed
          .split(/(?<=[.!?])\s+/)
          .map((s) => s.trim())
          .filter((s) => s.length > 4);
  const seen = new Set();
  const unique = [];
  for (const chunk of chunks) {
    const key = chunk
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[.!?]+$/, '')
      .trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(chunk.endsWith('.') || chunk.endsWith('!') || chunk.endsWith('?') ? chunk : `${chunk}.`);
  }
  if (unique.length === 0) return trimmed;
  return unique.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * @param {unknown} tags
 * @returns {string[]}
 */
export function dedupeTags(tags) {
  const seen = new Set();
  return (Array.isArray(tags) ? tags : [])
    .map((t) => String(t).trim())
    .filter(Boolean)
    .filter((t) => {
      const key = t.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/**
 * @param {object | null | undefined} project
 * @returns {{ id: string, name: string, type: string, category: string }[]}
 */
export function buildSpacesContextFromProject(project) {
  return (project?.spaces || []).map((space) => ({
    id: space.id,
    name: space.name || space.category || 'Space',
    type: space.type || 'interior',
    category: space.category || '',
  }));
}

/**
 * Merge legacy globalVision fields into a single normalized shape.
 * @param {object | null | undefined} gv
 * @param {object | null | undefined} [project]
 */
export function normalizeGlobalVision(gv = {}, project = null) {
  const moodTags = dedupeTags(gv.moodTags || gv.styleKeywords || []);
  const priorities = dedupeTags(gv.priorities || []);
  const constraints = dedupeTags(gv.constraints || []);
  const rawSummary = gv.summary || gv.propertyVision || '';
  const summary = dedupeSummaryText(rawSummary);
  const rawNotes = gv.notes || gv.inspirationNotes || '';
  const notes = dedupeSummaryText(rawNotes);
  const spacesContext =
    Array.isArray(gv.spacesContext) && gv.spacesContext.length > 0
      ? gv.spacesContext
      : buildSpacesContextFromProject(project);

  const prioritizedRooms = dedupeTags(gv.prioritizedRooms || []);
  const roomSpecificNeeds =
    gv.roomSpecificNeeds && typeof gv.roomSpecificNeeds === 'object' && !Array.isArray(gv.roomSpecificNeeds)
      ? gv.roomSpecificNeeds
      : {};

  return {
    ...gv,
    summary,
    propertyVision: summary,
    moodTags,
    styleKeywords: moodTags,
    moodVibe: (gv.moodVibe || '').trim() || moodTags[0] || '',
    priorities,
    constraints,
    prioritizedRooms,
    roomSpecificNeeds,
    useAllRoomsEvenly: gv.useAllRoomsEvenly === true,
    notes,
    spacesContext,
    inspirationNotes: notes,
  };
}

/**
 * Merge a vision patch onto existing data with overwrite semantics (never string-append).
 * Always run before persisting to localStorage/API payloads.
 *
 * @param {object} patch — fields to overwrite (summary, notes, moodTags, priorities, …)
 * @param {object | null | undefined} existingGv
 * @param {object | null | undefined} [project]
 */
export function prepareGlobalVisionForSave(patch = {}, existingGv = {}, project = null) {
  const base = normalizeGlobalVision(existingGv, project);
  const next = { ...base };

  if (typeof patch.summary === 'string' && patch.summary.trim()) {
    next.summary = patch.summary;
  } else if (typeof patch.propertyVision === 'string' && patch.propertyVision.trim()) {
    next.summary = patch.propertyVision;
  }

  if (typeof patch.notes === 'string') {
    next.notes = patch.notes;
  } else if (typeof patch.inspirationNotes === 'string') {
    next.notes = patch.inspirationNotes;
  }

  if (patch.moodTags !== undefined || patch.styleKeywords !== undefined) {
    next.moodTags = dedupeTags(patch.moodTags ?? patch.styleKeywords ?? base.moodTags);
  }
  if (patch.priorities !== undefined) {
    next.priorities = dedupeTags(patch.priorities);
  }
  if (patch.constraints !== undefined) {
    next.constraints = dedupeTags(patch.constraints);
  }
  if (patch.prioritizedRooms !== undefined) {
    next.prioritizedRooms = dedupeTags(patch.prioritizedRooms);
  }
  if (patch.roomSpecificNeeds !== undefined) {
    next.roomSpecificNeeds = patch.roomSpecificNeeds;
  }
  if (patch.useAllRoomsEvenly !== undefined) {
    next.useAllRoomsEvenly = patch.useAllRoomsEvenly === true;
  }

  if (patch.moodVibe !== undefined) next.moodVibe = patch.moodVibe;
  if (patch.budgetRange !== undefined) next.budgetRange = patch.budgetRange;
  if (patch.interiorGoals !== undefined) next.interiorGoals = patch.interiorGoals;
  if (patch.exteriorGoals !== undefined) next.exteriorGoals = patch.exteriorGoals;
  if (patch.spacesContext !== undefined) next.spacesContext = patch.spacesContext;
  if (patch.visionIntakeThread !== undefined) next.visionIntakeThread = patch.visionIntakeThread;
  if (patch.visionIntakeAssistantSummary !== undefined) {
    next.visionIntakeAssistantSummary = patch.visionIntakeAssistantSummary;
  }

  if (!next.summary?.trim()) {
    const parts = [];
    if (next.moodTags?.length) parts.push(`Style: ${next.moodTags.join(', ')}.`);
    if (next.priorities?.length) parts.push(`Priorities: ${next.priorities.join(', ')}.`);
    if (next.constraints?.length) parts.push(`Constraints: ${next.constraints.join(', ')}.`);
    if (next.useAllRoomsEvenly) {
      parts.push('Room focus: all rooms evenly.');
    } else if (next.prioritizedRooms?.length) {
      parts.push(`Room focus: ${next.prioritizedRooms.join(', ')}.`);
    }
    const compact = dedupeSummaryText(parts.join(' '));
    if (compact) next.summary = compact;
  }

  return normalizeGlobalVision(next, project);
}

/**
 * Merge API + local vision overlays, then normalize (no duplicated sentences).
 */
export function mergeGlobalVisionSources(apiGv, localGv, project = null) {
  const api = apiGv && typeof apiGv === 'object' ? apiGv : {};
  const local = localGv && typeof localGv === 'object' ? localGv : {};
  return prepareGlobalVisionForSave(
    {
      ...api,
      ...local,
      summary: local.summary || api.summary || local.propertyVision || api.propertyVision,
      notes: local.notes || api.notes || local.inspirationNotes || api.inspirationNotes,
      moodTags: local.moodTags || local.styleKeywords || api.moodTags || api.styleKeywords,
      priorities: local.priorities || api.priorities,
      constraints: local.constraints || api.constraints,
      spacesContext: local.spacesContext || api.spacesContext,
      visionIntakeThread: local.visionIntakeThread || api.visionIntakeThread,
    },
    {},
    project,
  );
}

/**
 * One concise paragraph for project hub / confirm read-only panels.
 * @param {object | null | undefined} gv
 * @param {object | null | undefined} [project]
 * @returns {string}
 */
export function formatProjectVisionSummary(gv, project = null) {
  const n = normalizeGlobalVision(gv, project);
  const segments = [];

  if (n.summary) {
    segments.push(n.summary.endsWith('.') ? n.summary : `${n.summary}.`);
  } else if (n.moodTags.length > 0) {
    segments.push(`Style direction: ${n.moodTags.join(', ')}.`);
  }

  if (n.priorities.length > 0) {
    segments.push(`Priorities: ${n.priorities.join(', ')}.`);
  }
  if (n.constraints.length > 0) {
    segments.push(`Constraints: ${n.constraints.join(', ')}.`);
  }
  if (n.notes && n.notes.toLowerCase() !== (n.summary || '').toLowerCase()) {
    segments.push(n.notes.endsWith('.') ? n.notes : `${n.notes}.`);
  }

  const combined = dedupeSummaryText(segments.join(' '));
  return combined || 'Your whole-property vision appears here.';
}

/**
 * @param {Set<string>} selectedChips
 * @param {string[]} priorityKeywords
 */
export function tagsFromChips(selectedChips, priorityKeywords = []) {
  const tags = dedupeTags([...selectedChips]);
  const priorities = dedupeTags(
    tags.filter((t) => priorityKeywords.some((p) => t.toLowerCase().includes(p))),
  );
  const moodTags = dedupeTags(tags.filter((t) => !priorities.includes(t)));
  return { moodTags, priorities };
}

export const PROJECT_VISION_MOOD_CHIPS = [
  'Warm',
  'Modern',
  'Minimal',
  'Coastal',
  'Organic',
  'Storage-focused',
  'Hosting-focused',
  'Family-friendly',
  'Rental-safe',
  'Bright',
  'Cozy',
];

export const PROJECT_VISION_PRIORITY_KEYWORDS = [
  'storage',
  'hosting',
  'family',
  'rental',
];
