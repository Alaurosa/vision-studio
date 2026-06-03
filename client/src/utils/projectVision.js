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
  const notes = dedupeSummaryText(gv.notes || '');
  const spacesContext =
    Array.isArray(gv.spacesContext) && gv.spacesContext.length > 0
      ? gv.spacesContext
      : buildSpacesContextFromProject(project);

  return {
    ...gv,
    summary,
    propertyVision: summary,
    moodTags,
    styleKeywords: moodTags,
    moodVibe: (gv.moodVibe || '').trim() || moodTags[0] || '',
    priorities,
    constraints,
    notes,
    spacesContext,
  };
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
  if (n.moodTags.length > 0 && n.summary) {
    segments.push(`Style direction: ${n.moodTags.join(', ')}.`);
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
