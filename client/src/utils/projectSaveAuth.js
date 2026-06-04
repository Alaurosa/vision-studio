/**
 * Guest → authenticated persistence for floorplan rooms during project finalization.
 */

import api from '@/lib/api';

const DRAFT_PREFIX = 'draft-';

export function isDraftRoomId(id) {
  return typeof id === 'string' && id.startsWith(DRAFT_PREFIX);
}

/**
 * Create or update a server room from confirmed floorplan review data.
 * @param {object} spaceReview
 * @param {string} [displayName]
 * @returns {Promise<string>} server room id
 */
export async function persistFloorplanRoomToServer(spaceReview, displayName) {
  const payload = {
    zones: spaceReview.normalizedZones,
    width: spaceReview.roomWidth,
    depth: spaceReview.roomDepth,
    scale_px_per_inch: spaceReview.scale,
  };

  let roomId = spaceReview.sourceRoomId;

  if (roomId && !isDraftRoomId(roomId)) {
    await api.put(`/api/rooms/${roomId}`, payload);
    return roomId;
  }

  const { data: serverRoom } = await api.post('/api/rooms', {
    name: displayName || 'Floorplan',
    unit: 'inches',
    width: spaceReview.roomWidth,
    depth: spaceReview.roomDepth,
    height: 96,
  });
  roomId = serverRoom.id;
  await api.put(`/api/rooms/${roomId}`, payload);
  return roomId;
}

/**
 * Best-effort sync local project metadata to API after sign-in.
 * @param {object} project
 */
export async function syncProjectToServerIfPossible(project) {
  if (!project?.id) return project;
  try {
    const { data } = await api.put(`/api/projects/${project.id}`, {
      name: project.name,
      property_type: project.propertyType ?? project.property_type,
      scope: project.scope,
      global_vision: project.globalVision ?? project.global_vision,
      status: project.status,
    });
    return data ? { ...project, ...data } : project;
  } catch {
    return project;
  }
}
