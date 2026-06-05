/**
 * Guided Project Vision intake — step chips, readiness, and chat API payload.
 */

import { buildSpacesContextFromProject, dedupeTags, normalizeGlobalVision } from '@/utils/projectVision';

export const VISION_MOOD_OPTIONS = [
  'Warm',
  'Modern',
  'Minimal',
  'Coastal',
  'Organic',
  'Cozy',
  'Bright',
  'Sophisticated',
];

export const VISION_PRIORITY_OPTIONS = [
  'More storage',
  'Better flow',
  'Hosting guests',
  'Family-friendly',
  'Relaxing',
  'Productivity',
  'Budget-conscious',
  'Multi-functional rooms',
];

export const VISION_CONSTRAINT_OPTIONS = [
  'Small space',
  'Rental-safe',
  'Keep existing furniture',
  'Pet-friendly',
  'Kid-friendly',
  'Natural light',
  'Easy to clean',
  'Low budget',
];

export const NO_MAJOR_CONSTRAINTS = 'No major constraints';
export const USE_ALL_ROOMS_EVENLY = 'Use all rooms evenly';

export const GUIDED_VISION_STEP_PROMPTS = {
  mood: 'What should the home feel like overall?',
  priorities: 'What matters most for the layout?',
  constraints: 'Any constraints I should design around?',
  room_focus: 'Which room should I prioritize first?',
  room_needs: 'What should this room support?',
};

export const ROOM_SPECIFIC_OPTIONS_BY_TYPE = {
  living: [
    'Conversation seating',
    'TV watching',
    'Hosting',
    'Reading nook',
    'Open walkway',
    'Hidden storage',
  ],
  dining: [
    'Comfortable seating',
    'Hosting dinners',
    'Open to kitchen',
    'Compact dining',
    'Natural light',
    'Easy cleanup',
  ],
  kitchen: [
    'More counter space',
    'Better storage',
    'Easy cooking flow',
    'Breakfast seating',
    'Bright and clean',
    'Family-friendly',
  ],
  bedroom: [
    'Calm sleeping area',
    'More storage',
    'Reading corner',
    'Minimal clutter',
    'Soft lighting',
    'Workstation',
  ],
  office: [
    'Productivity',
    'Video call background',
    'Storage',
    'Natural light',
    'Minimal distractions',
    'Dual-purpose room',
  ],
  default: [
    'Comfortable layout',
    'Good storage',
    'Natural light',
    'Flexible use',
    'Easy circulation',
    'Calm atmosphere',
  ],
};

const MIN_MOOD = 2;
const MIN_PRIORITIES = 2;
const MIN_CONSTRAINTS = 1;
const MIN_ROOM_NEEDS_GLOBAL_PRIORITIES = 3;

/**
 * @param {{ name?: string, category?: string, type?: string }} space
 */
export function inferRoomChipType(space) {
  const label = `${space?.name || ''} ${space?.category || ''}`.toLowerCase();
  if (/\bkitchen\b/.test(label)) return 'kitchen';
  if (/\b(bed|bedroom|primary suite)\b/.test(label)) return 'bedroom';
  if (/\b(office|study|work|desk)\b/.test(label)) return 'office';
  if (/\b(dining|eat)\b/.test(label)) return 'dining';
  if (/\b(living|lounge|family|great)\b/.test(label)) return 'living';
  return 'default';
}

/**
 * @param {{ id: string, name: string, type?: string, category?: string }[]} spaces
 */
export function getRoomSpecificOptionsForSpace(space) {
  const type = inferRoomChipType(space);
  return ROOM_SPECIFIC_OPTIONS_BY_TYPE[type] || ROOM_SPECIFIC_OPTIONS_BY_TYPE.default;
}

/**
 * @param {object | null | undefined} gv
 */
export function normalizeGuidedVisionFields(gv = {}) {
  const useAllRoomsEvenly = gv.useAllRoomsEvenly === true;
  const prioritizedRooms = dedupeTags(
    Array.isArray(gv.prioritizedRooms) ? gv.prioritizedRooms : [],
  );
  const roomSpecificNeeds =
    gv.roomSpecificNeeds && typeof gv.roomSpecificNeeds === 'object' && !Array.isArray(gv.roomSpecificNeeds)
      ? Object.fromEntries(
          Object.entries(gv.roomSpecificNeeds).map(([id, needs]) => [
            id,
            dedupeTags(Array.isArray(needs) ? needs : []),
          ]),
        )
      : {};
  return {
    moodTags: dedupeTags(gv.moodTags || gv.styleKeywords || []),
    priorities: dedupeTags(gv.priorities || []),
    constraints: dedupeTags(gv.constraints || []),
    prioritizedRooms,
    roomSpecificNeeds,
    useAllRoomsEvenly,
    notes: (gv.notes || '').trim(),
  };
}

/**
 * @param {object} fields
 * @param {{ spaces?: object[] } | null} [project]
 */
export function hasRoomNeedsSatisfied(fields, project = null) {
  if (fields.useAllRoomsEvenly) return true;
  const needsMap = fields.roomSpecificNeeds || {};
  const hasAnyNeed = Object.values(needsMap).some((arr) => Array.isArray(arr) && arr.length > 0);
  if (hasAnyNeed) return true;
  if (fields.priorities.length >= MIN_ROOM_NEEDS_GLOBAL_PRIORITIES && fields.moodTags.length >= MIN_MOOD) {
    return true;
  }
  const spaces = buildSpacesContextFromProject(project);
  if (spaces.length === 0 && fields.priorities.length >= MIN_PRIORITIES) return true;
  return false;
}

/**
 * @param {object | null | undefined} gv
 * @param {{ spaces?: object[] } | null} [project]
 */
export function evaluateGuidedVisionReadiness(gv, project = null) {
  const fields = normalizeGuidedVisionFields(normalizeGlobalVision(gv, project));
  const spaces = buildSpacesContextFromProject(project);
  const hasSpaces = spaces.length > 0;

  const hasConstraints =
    fields.constraints.length >= MIN_CONSTRAINTS ||
    fields.constraints.some((c) => c.toLowerCase() === NO_MAJOR_CONSTRAINTS.toLowerCase());

  const roomFocusOk =
    !hasSpaces ||
    fields.useAllRoomsEvenly ||
    fields.prioritizedRooms.length >= 1;

  const roomNeedsOk = hasRoomNeedsSatisfied(fields, project);

  const checklist = {
    style: fields.moodTags.length >= MIN_MOOD,
    priorities: fields.priorities.length >= MIN_PRIORITIES,
    constraints: hasConstraints,
    roomFocus: roomFocusOk,
    roomNeeds: roomNeedsOk,
  };

  const missing = [];
  if (!checklist.style) {
    const need = MIN_MOOD - fields.moodTags.length;
    missing.push(need === 1 ? 'one more style direction' : `${need} more style directions`);
  }
  if (!checklist.priorities) {
    const need = MIN_PRIORITIES - fields.priorities.length;
    missing.push(need === 1 ? 'one more layout priority' : `${need} more layout priorities`);
  }
  if (!checklist.constraints) {
    missing.push('at least one constraint (or choose “No major constraints”)');
  }
  if (hasSpaces && !checklist.roomFocus) {
    missing.push('one room to focus on (or “Use all rooms evenly”)');
  }
  if (hasSpaces && checklist.roomFocus && !checklist.roomNeeds) {
    missing.push('at least one need for your focused room');
  }

  const ready = Object.values(checklist).every(Boolean);

  let helperText = '';
  if (ready) {
    helperText = 'Ready — I’ll carry this context into the Studio.';
  } else if (missing.length === 1) {
    helperText = `Choose ${missing[0]}.`;
  } else if (missing.length === 2) {
    helperText = `Choose ${missing[0]} and ${missing[1]}.`;
  } else {
    helperText = `Still needed: ${missing.join(', ')}.`;
  }

  return { ready, checklist, missing, helperText, fields, spaces };
}

/**
 * Active guided step for one-question-at-a-time UI.
 * @param {object | null | undefined} gv
 * @param {{ spaces?: object[] } | null} [project]
 */
export function getActiveGuidedVisionStep(gv, project = null) {
  const { checklist, fields, spaces } = evaluateGuidedVisionReadiness(gv, project);
  if (checklist.style === false) return 'mood';
  if (checklist.priorities === false) return 'priorities';
  if (checklist.constraints === false) return 'constraints';
  if (spaces.length > 0 && !fields.useAllRoomsEvenly && fields.prioritizedRooms.length === 0) {
    return 'room_focus';
  }
  if (spaces.length > 0 && !hasRoomNeedsSatisfied(fields, project)) {
    if (fields.prioritizedRooms.length > 0 && !fields.useAllRoomsEvenly) return 'room_needs';
    if (!fields.useAllRoomsEvenly) return 'room_needs';
  }
  if (!checklist.roomNeeds && spaces.length > 0) return 'room_needs';
  return 'complete';
}

/**
 * Chips shown for the active step (4–8 options).
 */
export function getOptionsForGuidedStep(step, project = null, gv = {}) {
  const fields = normalizeGuidedVisionFields(gv);
  const spaces = buildSpacesContextFromProject(project);

  switch (step) {
    case 'mood':
      return [...VISION_MOOD_OPTIONS];
    case 'priorities':
      return [...VISION_PRIORITY_OPTIONS];
    case 'constraints':
      return [...VISION_CONSTRAINT_OPTIONS, NO_MAJOR_CONSTRAINTS];
    case 'room_focus':
      return [...spaces.map((s) => s.name), USE_ALL_ROOMS_EVENLY];
    case 'room_needs': {
      const space = getFocusedSpaceForVision(project, fields);
      if (!space) return [];
      return getRoomSpecificOptionsForSpace(space);
    }
    default:
      return [];
  }
}

/**
 * Compact summary for save + display (not appended repeatedly).
 */
export function buildCompactVisionSummary(gv, project = null) {
  const f = normalizeGuidedVisionFields(normalizeGlobalVision(gv, project));
  const parts = [];
  if (f.moodTags.length) parts.push(`Style: ${f.moodTags.join(', ')}.`);
  if (f.priorities.length) parts.push(`Priorities: ${f.priorities.join(', ')}.`);
  if (f.constraints.length) parts.push(`Constraints: ${f.constraints.join(', ')}.`);
  if (f.useAllRoomsEvenly) {
    parts.push('Room focus: all rooms evenly.');
  } else if (f.prioritizedRooms.length) {
    parts.push(`Room focus: ${f.prioritizedRooms.join(', ')}.`);
  }
  const needEntries = Object.entries(f.roomSpecificNeeds).filter(([, v]) => v?.length);
  if (needEntries.length) {
    const roomBits = needEntries.map(([id, needs]) => {
      const name =
        buildSpacesContextFromProject(project).find((s) => s.id === id)?.name || 'Room';
      return `${name}: ${needs.join(', ')}`;
    });
    parts.push(`Room needs: ${roomBits.join('; ')}.`);
  }
  if (f.notes) parts.push(f.notes.endsWith('.') ? f.notes : `${f.notes}.`);
  return parts.join(' ').trim();
}

/**
 * Payload for POST /api/chat/message global_vision.
 */
export function buildChatGlobalVisionPayload(gv, project = null) {
  const n = normalizeGlobalVision(gv, project);
  const fields = normalizeGuidedVisionFields(n);
  const readiness = evaluateGuidedVisionReadiness(n, project);
  return {
    moodTags: fields.moodTags,
    priorities: fields.priorities,
    constraints: fields.constraints,
    prioritizedRooms: fields.prioritizedRooms,
    roomSpecificNeeds: fields.roomSpecificNeeds,
    useAllRoomsEvenly: fields.useAllRoomsEvenly,
    spacesContext: n.spacesContext,
    notes: fields.notes,
    summary: buildCompactVisionSummary(n, project),
    styleKeywords: fields.moodTags,
    readiness: {
      ready: readiness.ready,
      checklist: readiness.checklist,
    },
  };
}

/**
 * @param {{ spaces?: object[] } | null} project
 * @param {object} fields
 */
export function getFocusedSpaceForVision(project, fields) {
  const spaces = buildSpacesContextFromProject(project);
  const name = fields.prioritizedRooms?.[0];
  return spaces.find((s) => s.name === name) || spaces[0] || null;
}

/**
 * @param {object} gv
 * @param {string} label
 * @param {'mood'|'priorities'|'constraints'} kind
 */
export function toggleGuidedListSelection(gv, label, kind) {
  const fields = normalizeGuidedVisionFields(gv);
  const list =
    kind === 'mood'
      ? [...fields.moodTags]
      : kind === 'priorities'
        ? [...fields.priorities]
        : [...fields.constraints];
  const key = label.toLowerCase();
  const idx = list.findIndex((t) => t.toLowerCase() === key);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(label);

  if (kind === 'constraints' && label === NO_MAJOR_CONSTRAINTS) {
    return {
      ...fields,
      constraints: list.includes(NO_MAJOR_CONSTRAINTS) ? [NO_MAJOR_CONSTRAINTS] : list.filter(
        (c) => c !== NO_MAJOR_CONSTRAINTS,
      ),
    };
  }
  if (kind === 'constraints') {
    return {
      ...fields,
      constraints: list.filter((c) => c !== NO_MAJOR_CONSTRAINTS),
    };
  }

  return {
    ...fields,
    moodTags: kind === 'mood' ? list : fields.moodTags,
    priorities: kind === 'priorities' ? list : fields.priorities,
    constraints: kind === 'constraints' ? list : fields.constraints,
  };
}

/**
 * @param {object} gv
 * @param {string} roomName
 */
export function applyRoomFocusSelection(gv, roomName) {
  const fields = normalizeGuidedVisionFields(gv);
  if (roomName === USE_ALL_ROOMS_EVENLY) {
    return {
      ...fields,
      useAllRoomsEvenly: true,
      prioritizedRooms: [],
      roomSpecificNeeds: {},
    };
  }
  return {
    ...fields,
    useAllRoomsEvenly: false,
    prioritizedRooms: [roomName],
    roomSpecificNeeds: {},
  };
}

/**
 * @param {object} gv
 * @param {{ id: string, name: string }} space
 * @param {string} needLabel
 */
export function toggleRoomSpecificNeed(gv, space, needLabel) {
  const fields = normalizeGuidedVisionFields(gv);
  const map = { ...fields.roomSpecificNeeds };
  const current = [...(map[space.id] || [])];
  const key = needLabel.toLowerCase();
  const idx = current.findIndex((n) => n.toLowerCase() === key);
  if (idx >= 0) current.splice(idx, 1);
  else current.push(needLabel);
  map[space.id] = current;
  return { ...fields, roomSpecificNeeds: map, useAllRoomsEvenly: false };
}

import { GUIDED_STEP_SUMMARY_MESSAGE_ID } from '@/utils/projectVisionIntakeChat';

export { GUIDED_STEP_SUMMARY_MESSAGE_ID };

/**
 * Natural one-line assistant ack after a chip step (upserted in UI).
 */
export function buildGuidedStepSummaryText(step, gv, project = null) {
  const f = normalizeGuidedVisionFields(normalizeGlobalVision(gv, project));
  switch (step) {
    case 'mood':
      return f.moodTags.length
        ? `Got it — overall feeling: ${f.moodTags.join(', ')}.`
        : 'Pick at least two styles that fit the home.';
    case 'priorities':
      return f.priorities.length
        ? `Layout priorities noted: ${f.priorities.join(', ')}.`
        : 'Choose what matters most for the layout.';
    case 'constraints':
      return f.constraints.length
        ? `I’ll design around: ${f.constraints.join(', ')}.`
        : 'Let me know any constraints (or choose none).';
    case 'room_focus':
      if (f.useAllRoomsEvenly) return 'I’ll balance all rooms evenly as we plan.';
      return f.prioritizedRooms.length
        ? `I’ll prioritize ${f.prioritizedRooms.join(', ')} first.`
        : 'Pick a room to focus on, or use all rooms evenly.';
    case 'room_needs': {
      const focus = f.prioritizedRooms[0];
      const needs = focus
        ? f.roomSpecificNeeds[
            buildSpacesContextFromProject(project).find((s) => s.name === focus)?.id
          ]
        : null;
      if (needs?.length) return `For ${focus}: ${needs.join(', ')}.`;
      return 'Add at least one need for this room, or keep going with your global priorities.';
    }
    default:
      return buildCompactVisionSummary(gv, project) || 'Your project vision is taking shape.';
  }
}
