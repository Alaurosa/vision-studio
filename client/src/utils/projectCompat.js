import { normalizeGlobalVision } from '@/utils/projectVision';

const STORAGE_KEY = 'vs-projects-v1';

const uid = (prefix = 'id') =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function loadProjectState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { projects: [] };
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.projects)) return { projects: [] };
    return parsed;
  } catch {
    return { projects: [] };
  }
}

export function saveProjectState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function normalizeProjectForStorage(project) {
  if (!project || typeof project !== 'object') return project;
  if (!project.globalVision || typeof project.globalVision !== 'object') return project;
  return {
    ...project,
    globalVision: normalizeGlobalVision(project.globalVision, project),
  };
}

export function upsertProject(project) {
  const normalized = normalizeProjectForStorage(project);
  const state = loadProjectState();
  const idx = state.projects.findIndex((p) => p.id === normalized.id);
  if (idx >= 0) state.projects[idx] = normalized;
  else state.projects.push(normalized);
  saveProjectState(state);
  return normalized;
}

export function getProjectById(projectId) {
  return loadProjectState().projects.find((p) => p.id === projectId) || null;
}

export function deleteProjectById(projectId) {
  const state = loadProjectState();
  state.projects = (state.projects || []).filter((p) => p.id !== projectId);
  saveProjectState(state);
}

export function createProjectDraft({ name, propertyType, startMode }) {
  const now = new Date().toISOString();
  return {
    id: uid('project'),
    name: name || 'Untitled Project',
    propertyType: propertyType || 'House',
    scope: 'interior_exterior',
    startMode: startMode || 'blank',
    status: 'in_progress',
    globalVision: {
      summary: '',
      propertyVision: '',
      moodTags: [],
      styleKeywords: [],
      priorities: [],
      constraints: [],
      notes: '',
      moodVibe: '',
      budgetRange: '',
      inspirationNotes: '',
      exteriorGoals: '',
      interiorGoals: '',
      spacesContext: [],
    },
    theme: null,
    spaces: [],
    confirmationCompletedAt: null,
    visionIntakeCompletedAt: null,
    updatedAt: now,
    createdAt: now,
  };
}

export function createProjectSpaceDraft(project, type = 'interior', overrides = {}) {
  const spaces = Array.isArray(project?.spaces) ? project.spaces : [];
  const sameType = spaces.filter((s) => s.type === type).length;
  const defaultName =
    type === 'interior'
      ? sameType === 0
        ? 'Living Room'
        : `Interior Space ${sameType + 1}`
      : sameType === 0
        ? 'Front Yard'
        : `Exterior Area ${sameType + 1}`;

  return {
    id: uid('space'),
    name: overrides.name || defaultName,
    type,
    category: overrides.category || defaultName,
    roomId: null,
    zoneId: null,
    placeholderMode: type === 'exterior',
    spaceVision: {
      desiredVibe: '',
      purpose: '',
      furnitureGoals: '',
      constraints: '',
      notes: '',
    },
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
}

export function getMostRecentSpace(project) {
  const spaces = Array.isArray(project?.spaces) ? project.spaces : [];
  if (spaces.length === 0) return null;
  return [...spaces].sort((a, b) => {
    const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return bTime - aTime;
  })[0];
}

// Phase 2 planning reference only (frontend documentation object; no backend calls yet).
export const FUTURE_PROJECT_BACKEND_SCHEMA = {
  phase: 'Phase 2',
  projects: {
    id: 'uuid',
    user_id: 'uuid',
    name: 'text',
    property_type: 'text',
    scope: 'interior_only|exterior_only|interior_exterior',
    global_vision: 'jsonb',
    created_at: 'timestamptz',
    updated_at: 'timestamptz',
  },
  spaces: {
    id: 'uuid',
    project_id: 'uuid',
    type: 'interior|exterior',
    name: 'text',
    category: 'text',
    dimensions: 'jsonb',
    geometry: 'jsonb',
    space_vision: 'jsonb',
    created_at: 'timestamptz',
    updated_at: 'timestamptz',
  },
  chatbot_context: [
    'whole_project_vibe',
    'interior_wide_vibe',
    'exterior_wide_vibe',
    'space_level_vibe',
    'furniture_constraints',
    'budget',
    'inspiration_files',
    'prior_design_decisions',
  ],
};

export function countSpaces(project) {
  const spaces = Array.isArray(project?.spaces) ? project.spaces : [];
  return {
    interior: spaces.filter((s) => s.type === 'interior').length,
    exterior: spaces.filter((s) => s.type === 'exterior').length,
  };
}

export function toDashboardProjects(rooms) {
  const state = loadProjectState();
  const projects = Array.isArray(state.projects) ? [...state.projects] : [];

  if (projects.length === 0 && Array.isArray(rooms) && rooms.length > 0) {
    const synthetic = {
      id: 'project-default',
      name: 'My Floorplan',
      propertyType: 'House',
      scope: 'interior_exterior',
      status: 'in_progress',
      globalVision: {
        styleKeywords: [],
        moodVibe: '',
        budgetRange: '',
        inspirationNotes: '',
        exteriorGoals: '',
        interiorGoals: '',
      },
      theme: null,
      updatedAt: rooms[0]?.updated_at || rooms[0]?.created_at || new Date().toISOString(),
      createdAt: rooms[0]?.created_at || new Date().toISOString(),
      spaces: rooms.map((room, idx) => ({
        id: `space-room-${room.id}`,
        name: room.name || `Interior Space ${idx + 1}`,
        type: 'interior',
        category: 'Interior Space',
        roomId: room.id,
        updatedAt: room.updated_at || room.created_at || new Date().toISOString(),
        createdAt: room.created_at || new Date().toISOString(),
      })),
    };
    return [synthetic];
  }

  if (Array.isArray(rooms) && rooms.length > 0) {
    const roomIds = new Set(rooms.map((r) => r.id));
    for (const project of projects) {
      project.spaces = (project.spaces || []).map((space) => {
        const linkedRoomId = space.roomId ?? space.room_id ?? null;
        if (!linkedRoomId) return space;
        // Keep spaces visible even when their room link is stale after migrations/account changes.
        if (!roomIds.has(linkedRoomId)) return { ...space, missingLinkedRoom: true };
        return { ...space, missingLinkedRoom: false };
      });
    }
  }

  return projects;
}

