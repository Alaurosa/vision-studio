import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams, useMatch, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useLayoutStore } from '@/store/layoutStore';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { fetchRoomsListOnce } from '@/lib/roomsFetchOnce';
import RoomCanvas from '@/components/canvas/RoomCanvas';
import ProjectCanvas from '@/components/canvas/ProjectCanvas';
import ChatPanel from '@/components/chatbot/ChatPanel';
import EditorWorkspaceSidebar from '@/components/studio/EditorWorkspaceSidebar';
import RoomViewer3D from '@/components/viewer/RoomViewer3D';
import ProjectViewer3D from '@/components/viewer/ProjectViewer3D';
import StudioToolbar from '@/components/studio/StudioToolbar';
import ZoneBottomBar from '@/components/studio/ZoneBottomBar';
import ProjectSpaceBottomBar from '@/components/studio/ProjectSpaceBottomBar';
import ErrorBoundary from '@/components/ErrorBoundary';
import { ROOM_TEMPLATES } from '@/utils/constants';
import { inchesToFeet } from '@/utils/scale';
import {
  countSpaces,
  createProjectSpaceDraft,
  deleteProjectById,
  getMostRecentSpace,
  getProjectById,
  toDashboardProjects,
  upsertProject,
} from '@/utils/projectCompat';
import { isProjectVisionComplete } from '@/utils/visionGate';
import ProjectVisionIntake from '@/components/project/ProjectVisionIntake';

const isConfirmationDone = (project) => Boolean(project?.confirmationCompletedAt);

const isDraftId = (id) => typeof id === 'string' && id.startsWith('draft-');
const INTERIOR_SPACE_TYPES = [
  'Living Room',
  'Kitchen',
  'Bedroom',
  'Bathroom',
  'Dining Room',
  'Office',
  'Hallway',
  'Custom',
];
const EXTERIOR_AREA_TYPES = [
  'Front Yard',
  'Backyard',
  'Patio',
  'Balcony',
  'Garden',
  'Garage',
  'Driveway',
  'Pool Area',
  'Custom',
];
const STATUS_OPTIONS = ['in_progress', 'draft', 'completed'];

function getSpaceRoomId(space) {
  return space?.roomId ?? space?.room_id ?? null;
}

function resolveSpaceByEditorId(project, editorSpaceId) {
  if (!project || !editorSpaceId) return null;
  const spaces = Array.isArray(project.spaces) ? project.spaces : [];
  const direct = spaces.find((s) => s.id === editorSpaceId);
  if (direct) return direct;
  // Legacy upload-derived ids (space-zone-0) should map to current API spaces by zone id.
  const legacyZoneId = editorSpaceId.startsWith('space-')
    ? editorSpaceId.slice('space-'.length)
    : editorSpaceId;
  return spaces.find((s) => s.zoneId === legacyZoneId) || null;
}

function getEditableSpaces(project, rooms = []) {
  const allSpaces = Array.isArray(project?.spaces) ? project.spaces : [];
  const roomIdSet = new Set((Array.isArray(rooms) ? rooms : []).map((r) => r.id));
  const withLinkedRoom = allSpaces.filter((space) => {
    const rid = getSpaceRoomId(space);
    if (!rid) return false;
    // If room list is loaded, only treat spaces as editable when the linked room actually exists.
    if (roomIdSet.size > 0) return roomIdSet.has(rid);
    return true;
  });
  const interior = withLinkedRoom.filter((s) => s.type !== 'exterior');
  const exterior = withLinkedRoom.filter((s) => s.type === 'exterior');
  return [...interior, ...exterior];
}

/** Align API snake_case + localStorage shapes; map room_id → roomId for spaces */
function normalizeProjectPayload(project) {
  if (!project) return null;
  const gvRaw = project.globalVision ?? project.global_vision;
  const gv =
    gvRaw && typeof gvRaw === 'object'
      ? {
          propertyVision: gvRaw.propertyVision ?? gvRaw.property_vision ?? '',
          ...gvRaw,
        }
      : {};
  return {
    ...project,
    propertyType: project.propertyType ?? project.property_type ?? 'House',
    globalVision: gv,
    spaces: (project.spaces || []).map((space) => {
      const rawType = space.type ?? space.space_type;
      const pm = space.placeholderMode ?? space.placeholder_mode;
      let typeNorm = 'interior';
      if (typeof rawType === 'string') {
        typeNorm = rawType.toLowerCase() === 'exterior' ? 'exterior' : 'interior';
      } else if (pm === true) {
        typeNorm = 'exterior';
      }
      return {
        ...space,
        type: typeNorm,
        roomId: space.roomId ?? space.room_id ?? null,
        placeholderMode: space.placeholderMode ?? space.placeholder_mode ?? false,
        spaceVision: space.spaceVision ?? space.space_vision ?? {},
      };
    }),
    updatedAt: project.updatedAt ?? project.updated_at,
    createdAt: project.createdAt ?? project.created_at,
    confirmationCompletedAt: project.confirmationCompletedAt ?? null,
    visionIntakeCompletedAt: project.visionIntakeCompletedAt ?? null,
  };
}

function mergeDashboardProjects(apiProjects, localProjects) {
  const apiList = (Array.isArray(apiProjects) ? apiProjects : []).map((p) =>
    normalizeProjectPayload(p),
  );
  const localList = (Array.isArray(localProjects) ? localProjects : []).map((p) =>
    normalizeProjectPayload(p),
  );
  const localById = new Map(localList.filter(Boolean).map((p) => [p.id, p]));
  const merged = apiList
    .filter(Boolean)
    .map((apiProject) => {
      const localProject = localById.get(apiProject.id);
      if (!localProject) return apiProject;
      return normalizeProjectPayload({
        ...apiProject,
        globalVision: {
          ...(typeof apiProject.globalVision === 'object' ? apiProject.globalVision : {}),
          ...(typeof localProject.globalVision === 'object' ? localProject.globalVision : {}),
        },
        confirmationCompletedAt:
          localProject.confirmationCompletedAt ?? apiProject.confirmationCompletedAt ?? null,
        visionIntakeCompletedAt:
          localProject.visionIntakeCompletedAt ?? apiProject.visionIntakeCompletedAt ?? null,
      });
    });
  const mergedIds = new Set(merged.map((p) => p.id));
  const localOnly = localList.filter((p) => p && !mergedIds.has(p.id));
  return [...merged, ...localOnly].sort((a, b) => {
    const aTime = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
    const bTime = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
    return bTime - aTime;
  });
}

export default function Studio() {
  const { roomId, projectId, editorSpaceId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { pathname: locationPath } = useLocation();
  const { user, loading: authLoading } = useAuth();
  const {
    room,
    loadRoom,
    viewMode,
    isChatOpen,
    createRoom,
    createDraftRoom,
    clearDraft,
    clearChat,
    setActiveZone,
    loadRoomFailed,
  } = useLayoutStore();
  const [rooms, setRooms] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [creatingInteriorSpace, setCreatingInteriorSpace] = useState(false);
  const [creatingExteriorSpace, setCreatingExteriorSpace] = useState(false);
  const [showSpaceTypeModal, setShowSpaceTypeModal] = useState(false);
  const [spaceTypeTarget, setSpaceTypeTarget] = useState(null);
  const [selectedSpaceCategory, setSelectedSpaceCategory] = useState('');
  const [customSpaceName, setCustomSpaceName] = useState('');
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [editorEntryIssue, setEditorEntryIssue] = useState(null);
  const draftRoom = useLayoutStore((s) => (isDraftId(s.room?.id) ? s.room : null));

  const matchDashboard = useMatch({ path: '/studio', end: true });
  const matchProjectHub = useMatch({ path: '/studio/project/:projectId', end: true });
  const matchConfirm = useMatch({ path: '/studio/project/:projectId/confirm', end: true });
  const matchVision = useMatch({ path: '/studio/project/:projectId/vision', end: true });
  const matchEditorRoot = useMatch({ path: '/studio/project/:projectId/editor', end: true });
  const isProjectEditorRoute = /^\/studio\/project\/[^/]+\/editor/.test(locationPath);

  const queryProjectId = searchParams.get('projectId');
  const confirmPhase = searchParams.get('phase');
  const querySpaceId = editorSpaceId || searchParams.get('spaceId');
  const currentProjectId = projectId || queryProjectId;
  const currentProject = useMemo(() => {
    if (!currentProjectId) return null;
    const fromApi = projects.find((p) => p.id === currentProjectId);
    const fromLocal = getProjectById(currentProjectId);
    let raw = fromApi || fromLocal;
    if (fromApi && fromLocal) {
      raw = {
        ...fromApi,
        ...fromLocal,
        name: fromLocal.name || fromApi.name,
        globalVision: {
          ...(typeof fromApi.globalVision === 'object' ? fromApi.globalVision : {}),
          ...(typeof fromApi.global_vision === 'object' ? fromApi.global_vision : {}),
          ...(fromLocal.globalVision && typeof fromLocal.globalVision === 'object' ? fromLocal.globalVision : {}),
        },
        spaces:
          Array.isArray(fromApi.spaces) && fromApi.spaces.length > 0
            ? fromApi.spaces
            : fromLocal.spaces || [],
        confirmationCompletedAt:
          fromLocal.confirmationCompletedAt ?? fromApi.confirmationCompletedAt ?? null,
        visionIntakeCompletedAt:
          fromLocal.visionIntakeCompletedAt ?? fromApi.visionIntakeCompletedAt ?? null,
      };
    }
    return normalizeProjectPayload(raw);
  }, [currentProjectId, projects]);

  const resolvedRoomId = useMemo(() => {
    if (roomId) return roomId;
    if (isProjectEditorRoute && editorSpaceId && currentProject?.spaces) {
      const sp = currentProject.spaces.find((s) => s.id === editorSpaceId);
      return getSpaceRoomId(sp);
    }
    return null;
  }, [roomId, editorSpaceId, currentProject, isProjectEditorRoute]);
  const activeSpace = useMemo(() => {
    if (!currentProject) return null;
    if (!querySpaceId) return null;
    return resolveSpaceByEditorId(currentProject, querySpaceId);
  }, [currentProject, querySpaceId]);
  const projectSpaces = useMemo(
    () => (Array.isArray(currentProject?.spaces) ? currentProject.spaces : []),
    [currentProject],
  );
  const selectedProjectSpaceId = activeSpace?.id || null;
  const selectedProjectSpace = activeSpace || null;

  useEffect(() => {
    if (!matchEditorRoot || !currentProject?.id || editorSpaceId) return;
    setEditorEntryIssue(null);
  }, [matchEditorRoot, currentProject, editorSpaceId]);

  useEffect(() => {
    if (!editorSpaceId || !currentProject?.id) return;
    const resolved = resolveSpaceByEditorId(currentProject, editorSpaceId);
    if (!resolved?.id) return;
    if (resolved.id === editorSpaceId) return;
    navigate(`/studio/project/${currentProject.id}/editor/${resolved.id}`, { replace: true });
  }, [editorSpaceId, currentProject, navigate]);

  useEffect(() => {
    if (!isProjectEditorRoute || !editorSpaceId || !currentProject) return;
    const maybeSpace = resolveSpaceByEditorId(currentProject, editorSpaceId);
    if (!maybeSpace) {
      setEditorEntryIssue(
        'This space is not part of this project. Choose another space from the bottom bar.',
      );
      return;
    }
    setEditorEntryIssue(
      getSpaceRoomId(maybeSpace)
        ? null
        : 'This space has no linked editable room yet. You can still plan it in the full floorplan view.',
    );
  }, [isProjectEditorRoute, editorSpaceId, currentProject]);

  // Load requested room or dashboard data.
  useEffect(() => {
    if (resolvedRoomId) {
      clearChat();
      loadRoom(resolvedRoomId);
      if (queryProjectId || projectId) {
        fetchRooms();
      }
    } else {
      fetchRooms();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedRoomId, user, projectId, queryProjectId]);

  useEffect(() => {
    if (!loadRoomFailed) return;
    useLayoutStore.setState({ loadRoomFailed: false });
    if (isProjectEditorRoute) {
      setEditorEntryIssue(
        'This space is missing a valid linked room. Review spaces or add a new space before opening the editor.',
      );
      return;
    }
    toast.error("Couldn't load this space. Returning to projects.");
    if (projectId) navigate(`/studio/project/${projectId}`, { replace: true });
    else navigate('/studio', { replace: true });
  }, [loadRoomFailed, navigate, projectId, isProjectEditorRoute]);

  const fetchRooms = async () => {
    setLoadingList(true);
    try {
      const nextRooms = await fetchRoomsListOnce();
      setRooms(nextRooms);
      try {
        const projectsRes = await api.get('/api/projects');
        const apiProjects = Array.isArray(projectsRes.data)
          ? projectsRes.data.map((p) => normalizeProjectPayload(p)).filter(Boolean)
          : [];
        const mergedProjects = mergeDashboardProjects(apiProjects, toDashboardProjects(nextRooms));
        if (mergedProjects.length > 0) {
          setProjects(mergedProjects);
          return;
        }
      } catch {
        // fall through to local compatibility layer
      }
      setProjects(toDashboardProjects(nextRooms));
    } catch (e) {
      toast.error('Failed to load rooms');
      setProjects(toDashboardProjects([]));
    } finally {
      setLoadingList(false);
    }
  };

  const openRoom = (id) => navigate(`/studio/${id}`); // legacy draft deep link
  const openProject = (id) => {
    navigate(`/studio/project/${id}`);
  };
  const continueProjectEditing = (project) => {
    if (!project?.id) return;
    const mostRecent = getMostRecentSpace(project);
    const rid = mostRecent?.roomId ?? mostRecent?.room_id;
    if (mostRecent?.id && rid) {
      navigate(`/studio/project/${project.id}/editor/${mostRecent.id}`);
      return;
    }
    navigate(`/studio/project/${project.id}`);
  };
  const renameProject = (project) => {
    setEditingProjectId(project.id);
    setEditingProjectName(project.name || '');
  };
  const saveRenamedProject = () => {
    const nextName = editingProjectName.trim();
    if (!editingProjectId || !nextName) {
      setEditingProjectId(null);
      setEditingProjectName('');
      return;
    }
    const project = projects.find((p) => p.id === editingProjectId) || getProjectById(editingProjectId);
    if (!project) return;
    const nextProject = { ...project, name: nextName, updatedAt: new Date().toISOString() };
    upsertProject(nextProject);
    setProjects((prev) => prev.map((p) => (p.id === nextProject.id ? nextProject : p)));
    setEditingProjectId(null);
    setEditingProjectName('');
    toast.success('Project name updated');
  };
  const deleteProject = (project) => {
    if (!project?.id) return;
    const ok = window.confirm('Remove this project from your dashboard? This does not delete backend room records.');
    if (!ok) return;
    deleteProjectById(project.id);
    setProjects((prev) => prev.filter((p) => p.id !== project.id));
    toast.success('Project removed from dashboard');
  };
  const setProjectStatus = (project, status) => {
    const nextProject = { ...project, status, updatedAt: new Date().toISOString() };
    upsertProject(nextProject);
    setProjects((prev) => prev.map((p) => (p.id === nextProject.id ? nextProject : p)));
  };
  const updateProjectVision = (project, patch) => {
    if (!project?.id) return;
    const nextProject = {
      ...project,
      globalVision: {
        propertyVision: '',
        styleKeywords: [],
        moodVibe: '',
        budgetRange: '',
        inspirationNotes: '',
        exteriorGoals: '',
        interiorGoals: '',
        ...(project.globalVision || {}),
        ...patch,
      },
      updatedAt: new Date().toISOString(),
    };
    upsertProject(nextProject);
    setProjects((prev) => {
      const has = prev.some((p) => p.id === project.id);
      if (!has) return prev;
      return prev.map((p) => (p.id === project.id ? nextProject : p));
    });
  };

  const selectProjectSpace = (project, space) => {
    navigate(`/studio/project/${project.id}/editor/${space.id}`);
  };

  const openEditorFromHub = (project) => {
    setEditorEntryIssue(null);
    navigate(`/studio/project/${project.id}/editor`);
  };

  const addProjectSpace = async (project, type = 'interior', options = {}) => {
    if (!project?.id) return;
    const { navigateToEditor = true, ...draftOptions } = options;
    // Prefer fresh API list over localStorage so space ↔ room links stay correct
    const projectBase =
      normalizeProjectPayload(projects.find((p) => p.id === project.id))
      || normalizeProjectPayload(getProjectById(project.id))
      || normalizeProjectPayload(project)
      || project;
    if (type === 'interior') setCreatingInteriorSpace(true);
    else setCreatingExteriorSpace(true);
    try {
      const draftSpace = createProjectSpaceDraft(projectBase, type, draftOptions);
      try {
        const { data } = await api.post(`/api/projects/${projectBase.id}/spaces`, {
          type,
          name: draftSpace.name,
          category: draftSpace.category,
          placeholder_mode: draftSpace.placeholderMode,
          space_vision: draftSpace.spaceVision,
          room_payload: {
            name: `${project.name} - ${draftSpace.name}`,
            width: type === 'interior' ? 240 : 300,
            depth: type === 'interior' ? 180 : 220,
            height: 96,
          },
        });
        const normalizedSpace = normalizeProjectPayload({ spaces: [data] })?.spaces?.[0];
        const nextProject = {
          ...projectBase,
          spaces: [...(projectBase.spaces || []), normalizedSpace],
          updatedAt: new Date().toISOString(),
        };
        upsertProject(nextProject);
        setProjects((prev) => prev.map((p) => (p.id === nextProject.id ? nextProject : p)));
        if (navigateToEditor) navigate(`/studio/project/${projectBase.id}/editor/${normalizedSpace.id}`);
        return;
      } catch {
        // Fallback to local compatibility behavior
      }

      const payload = {
        name: `${projectBase.name} - ${draftSpace.name}`,
        width: type === 'interior' ? 240 : 300,
        depth: type === 'interior' ? 180 : 220,
        height: 96,
      };
      const created = user ? await createRoom(payload) : createDraftRoom(payload);
      const nextProject = {
        ...projectBase,
        spaces: [...(projectBase.spaces || []), { ...draftSpace, roomId: created.id }],
        updatedAt: new Date().toISOString(),
      };
      upsertProject(nextProject);
      setProjects((prev) => {
        const hasProject = prev.some((p) => p.id === nextProject.id);
        if (!hasProject) return [...prev, nextProject];
        return prev.map((p) => (p.id === nextProject.id ? nextProject : p));
      });
      if (navigateToEditor) navigate(`/studio/project/${projectBase.id}/editor/${draftSpace.id}`);
    } catch {
      toast.error(`Failed to add ${type === 'interior' ? 'interior space' : 'exterior area'}`);
    } finally {
      if (type === 'interior') setCreatingInteriorSpace(false);
      else setCreatingExteriorSpace(false);
    }
  };

  const openSpaceTypeModal = (project, type) => {
    setSpaceTypeTarget({ project, type });
    const defaults = type === 'interior' ? INTERIOR_SPACE_TYPES[0] : EXTERIOR_AREA_TYPES[0];
    setSelectedSpaceCategory(defaults);
    setCustomSpaceName('');
    setShowSpaceTypeModal(true);
  };

  const closeSpaceTypeModal = () => {
    setShowSpaceTypeModal(false);
    setSpaceTypeTarget(null);
    setSelectedSpaceCategory('');
    setCustomSpaceName('');
  };

  const confirmAddSpaceType = async () => {
    if (!spaceTypeTarget?.project || !spaceTypeTarget?.type) return;
    const isCustom = selectedSpaceCategory === 'Custom';
    const normalizedCustomName = customSpaceName.trim();
    const finalName = isCustom
      ? normalizedCustomName || (spaceTypeTarget.type === 'interior' ? 'Interior Space' : 'Exterior Area')
      : selectedSpaceCategory;
    const finalCategory = isCustom ? 'Custom' : selectedSpaceCategory;
    await addProjectSpace(spaceTypeTarget.project, spaceTypeTarget.type, {
      name: finalName,
      category: finalCategory,
      navigateToEditor: !(matchConfirm || matchVision),
    });
    closeSpaceTypeModal();
  };

  useEffect(() => {
    if (!room || !currentProject || !querySpaceId) return;
    const activeSpace = resolveSpaceByEditorId(currentProject, querySpaceId);
    if (activeSpace?.zoneId) setActiveZone(activeSpace.zoneId);
  }, [room, currentProject, querySpaceId, setActiveZone]);

  const discardDraft = () => {
    if (!window.confirm('Discard your draft? This cannot be undone.')) return;
    clearDraft();
    toast.success('Draft discarded');
  };

  const syncProjectFromChild = (next) => {
    const norm = normalizeProjectPayload(next);
    if (!norm) return;
    upsertProject(norm);
    setProjects((prev) => {
      const i = prev.findIndex((p) => p.id === norm.id);
      if (i < 0) return [...prev, norm];
      return prev.map((p) => (p.id === norm.id ? norm : p));
    });
  };

  // -------- Project onboarding (full-page) --------
  if (matchConfirm) {
    const project = currentProject;
    if (!project) {
      return (
        <div className="h-[calc(100vh-4rem)] grid place-items-center">
          <span className="eyebrow text-ink-500">Loading project…</span>
        </div>
      );
    }
    const gv = project.globalVision || {};
    const interiorSpaces = (project?.spaces || []).filter((s) => s.type === 'interior');
    const exteriorSpaces = (project?.spaces || []).filter((s) => s.type === 'exterior');

    /** Upload-first path: confirm detected spaces before Project Vision Assistant. */
    if (confirmPhase === 'spaces') {
      return (
        <>
          <Helmet><title>Confirm spaces — {project?.name || 'Project'}</title></Helmet>
          <div className="mx-auto max-w-7xl bg-[#f6f3ee] px-6 py-16 text-[#171717] md:px-8 pb-24">
            <button
              type="button"
              className="text-[11px] uppercase tracking-editorial text-[#5b5b5b] hover:text-[#171717] mb-6"
              onClick={() => navigate('/studio')}
            >
              ← Back to projects
            </button>
            <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-vs-accent mb-3">Floorplan intake</p>
            <h1 className="display-lg mb-2">Confirm your spaces</h1>
            <p className="mt-2 text-sm text-[#5b5b5b] max-w-2xl leading-relaxed">
              Review interior rooms and exterior areas detected from your upload. Next, open the Project Vision Assistant
              with guided setup — after vision and confirmation you will land on the project hub (you can always return here
              later from the hub).
            </p>

            <div className="grid lg:grid-cols-2 gap-8 mt-10">
              <section className="panel p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="eyebrow text-vs-accent">Interior Spaces</div>
                  <button
                    type="button"
                    className="text-[10px] uppercase tracking-[0.2em] text-vs-accent"
                    onClick={() => openSpaceTypeModal(project, 'interior')}
                    disabled={creatingInteriorSpace || !project}
                  >
                    Add Interior Space
                  </button>
                </div>
                <div className="space-y-2">
                  {interiorSpaces.map((space) => (
                    <div key={space.id} className="rounded-lg border border-[rgba(0,0,0,0.08)] bg-[#f8f8f6] px-4 py-3 text-sm">
                      {space.name}
                    </div>
                  ))}
                  {interiorSpaces.length === 0 && (
                    <p className="text-xs text-[#5b5b5b] leading-relaxed">No interior spaces yet — add one or go back to the upload step.</p>
                  )}
                </div>
              </section>
              <section className="panel p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="eyebrow text-vs-accent">Exterior Areas</div>
                  <button
                    type="button"
                    className="text-[10px] uppercase tracking-[0.2em] text-vs-accent"
                    onClick={() => openSpaceTypeModal(project, 'exterior')}
                    disabled={creatingExteriorSpace || !project}
                  >
                    Add Exterior Area
                  </button>
                </div>
                <div className="space-y-2">
                  {exteriorSpaces.map((space) => (
                    <div key={space.id} className="rounded-lg border border-[rgba(0,0,0,0.08)] bg-[#f8f8f6] px-4 py-3 text-sm">
                      {space.name}
                    </div>
                  ))}
                  {exteriorSpaces.length === 0 && (
                    <p className="text-xs text-[#5b5b5b] leading-relaxed">No exterior areas yet — optional; add if you are planning outdoor work.</p>
                  )}
                </div>
              </section>
            </div>

            <AnimatePresence>
              {showSpaceTypeModal && spaceTypeTarget && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 bg-black/35 grid place-items-center px-4"
                >
                  <div className="w-full max-w-xl rounded-[22px] border border-[rgba(0,0,0,0.08)] bg-[#f8f8f6] p-8">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-vs-accent mb-3">
                      {spaceTypeTarget.type === 'interior' ? 'Add Interior Space' : 'Add Exterior Area'}
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-5">
                      {(spaceTypeTarget.type === 'interior' ? INTERIOR_SPACE_TYPES : EXTERIOR_AREA_TYPES).map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setSelectedSpaceCategory(option)}
                          className={`rounded-lg px-3 py-2 text-[11px] uppercase tracking-editorial border ${
                            selectedSpaceCategory === option
                              ? 'border-[#004aad] text-[#004aad] bg-[#eef4f7]'
                              : 'border-[rgba(0,0,0,0.08)] text-[#5b5b5b]'
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-end gap-3">
                      <button type="button" className="btn-ghost" onClick={closeSpaceTypeModal}>
                        Cancel
                      </button>
                      <button type="button" className="btn-ink" onClick={confirmAddSpaceType}>
                        Create
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-12 flex flex-wrap items-center gap-4">
              <button
                type="button"
                className="btn-ink px-8 py-3 text-[11px] uppercase tracking-[0.12em]"
                onClick={() => navigate(`/studio/project/${projectId}/vision?setup=new`)}
              >
                Continue to Project Vision Assistant
              </button>
            </div>
          </div>
        </>
      );
    }

    const openEditorAfterConfirmation = async () => {
      const next = {
        ...project,
        confirmationCompletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      upsertProject(next);
      setProjects((prev) => {
        const i = prev.findIndex((p) => p.id === next.id);
        if (i < 0) return [...prev, normalizeProjectPayload(next)];
        return prev.map((p) => (p.id === next.id ? normalizeProjectPayload(next) : p));
      });

      setEditorEntryIssue(null);
      navigate(`/studio/project/${projectId}/editor`);
    };

    return (
      <>
        <Helmet><title>Confirm project — {project?.name || 'Project'}</title></Helmet>
        <div className="mx-auto max-w-7xl bg-[#f6f3ee] px-6 py-16 text-[#171717] md:px-8 pb-24">
          <button
            type="button"
            className="text-[11px] uppercase tracking-editorial text-[#5b5b5b] hover:text-[#171717] mb-6"
            onClick={() => navigate(`/studio/project/${projectId}`)}
          >
            ← Back to Project Hub
          </button>
          <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-vs-accent mb-3">Confirmation</p>
          <h1 className="display-lg mb-2">Confirm project direction</h1>
          <p className="mt-2 text-sm text-[#5b5b5b] max-w-2xl leading-relaxed">
            Review your whole-property vision summary, spaces, and assumptions before moving into the editor.
            Next, you will enter the editor directly. Inside the editor, use the Space Assistant for room-specific changes.
          </p>

          <div className="grid lg:grid-cols-3 gap-6 mt-10">
            <section className="panel p-6 lg:col-span-1">
              <div className="eyebrow text-vs-accent mb-3">Project</div>
              <div className="font-display text-xl text-[#171717]">{project.name}</div>
              <div className="mt-2 text-sm text-[#5b5b5b]">
                {project.propertyType || 'House'} · {project.scope || 'interior_exterior'}
              </div>
              <div className="mt-6">
                <div className="text-[10px] uppercase tracking-[0.2em] text-[#5b5b5b] mb-2">Style & mood</div>
                <div className="flex flex-wrap gap-2">
                  {(gv.styleKeywords || []).length === 0 && !gv.moodVibe && (
                    <span className="text-xs text-[#9a9a9a]">—</span>
                  )}
                  {(gv.styleKeywords || []).map((k) => (
                    <span key={k} className="text-[10px] uppercase tracking-editorial px-2.5 py-1 rounded-full border border-[rgba(0,0,0,0.1)] bg-[#fffdf9]">
                      {k}
                    </span>
                  ))}
                  {gv.moodVibe ? (
                    <span className="text-[10px] uppercase tracking-editorial px-2.5 py-1 rounded-full border border-[#004aad]/25 bg-[#eef4f7] text-[#004aad]">
                      {gv.moodVibe}
                    </span>
                  ) : null}
                </div>
                {gv.budgetRange ? (
                  <p className="mt-3 text-xs text-[#5b5b5b]">Budget: {gv.budgetRange}</p>
                ) : null}
              </div>
            </section>

            <section className="panel p-6 lg:col-span-2">
              <div className="eyebrow text-vs-accent mb-3">Overall project vision</div>
              <div className="w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-[#fffdf9] px-4 py-3 text-sm text-[#2d2d2d] min-h-[140px] leading-relaxed whitespace-pre-wrap">
                {gv.propertyVision || 'No overall vision provided yet.'}
              </div>
              <p className="mt-2 text-[11px] text-[#8b7355]">
                This summary is read-only here. If you need to revise, use Project Vision Assistant from the project hub.
              </p>
            </section>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 mt-10">
            <section className="panel p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="eyebrow text-vs-accent">Interior Spaces</div>
              </div>
              <div className="space-y-2">
                {interiorSpaces.map((space) => (
                  <div key={space.id} className="rounded-lg border border-[rgba(0,0,0,0.08)] bg-[#f8f8f6] px-4 py-3 text-sm">
                    {space.name}
                  </div>
                ))}
                {interiorSpaces.length === 0 && (
                  <p className="text-xs text-[#5b5b5b] leading-relaxed">
                    No interior spaces yet. Add a room such as Living Room, Kitchen, Bedroom, or Office.
                  </p>
                )}
              </div>
            </section>
            <section className="panel p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="eyebrow text-vs-accent">Exterior Areas</div>
              </div>
              <div className="space-y-2">
                {exteriorSpaces.map((space) => (
                  <div key={space.id} className="rounded-lg border border-[rgba(0,0,0,0.08)] bg-[#f8f8f6] px-4 py-3 text-sm">
                    {space.name}
                  </div>
                ))}
                {exteriorSpaces.length === 0 && (
                  <p className="text-xs text-[#5b5b5b] leading-relaxed">
                    No exterior areas yet. Add an area such as Front Yard, Backyard, Patio, Entry, or Garden.
                  </p>
                )}
              </div>
            </section>
          </div>
          <section className="panel p-6 mt-8">
            <div className="eyebrow text-vs-accent mb-2">What happens next</div>
            <p className="text-sm text-[#2d2d2d] leading-relaxed">
              You will enter the editor next. Use the editor&apos;s Space Assistant for room-specific layout and furniture changes.
            </p>
          </section>

          <div className="mt-12 flex flex-wrap items-center gap-4">
            <button
              type="button"
              className="btn-ink px-8 py-3 text-[11px] uppercase tracking-[0.12em]"
              onClick={openEditorAfterConfirmation}
            >
              Open Editor
            </button>
            <button type="button" className="btn-ghost text-[11px] uppercase tracking-[0.15em]" onClick={() => navigate(`/studio/project/${projectId}`)}>
              Back to Project Hub
            </button>
          </div>
          {editorEntryIssue && (
            <div className="rounded-xl border border-sienna-500/35 bg-paper-100/90 px-5 py-4 mt-5">
              <p className="text-sm font-medium text-ink-900">{editorEntryIssue}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-ghost text-[10px]"
                  onClick={() => navigate(`/studio/project/${projectId}/confirm?from=hub`)}
                >
                  Review Spaces
                </button>
                <button
                  type="button"
                  className="btn-ghost text-[10px]"
                  onClick={() => openSpaceTypeModal(project, 'interior')}
                  disabled={creatingInteriorSpace || !project}
                >
                  Add Interior Space
                </button>
                <button
                  type="button"
                  className="btn-ghost text-[10px]"
                  onClick={() => openSpaceTypeModal(project, 'exterior')}
                  disabled={creatingExteriorSpace || !project}
                >
                  Add Exterior Area
                </button>
              </div>
            </div>
          )}
        </div>
      </>
    );
  }

  if (matchVision) {
    const project = currentProject;
    if (!project) {
      return (
        <div className="min-h-[60vh] grid place-items-center">
          <span className="eyebrow text-ink-500">Loading project…</span>
        </div>
      );
    }
    return (
      <ProjectVisionIntake project={project} onPersist={syncProjectFromChild} />
    );
  }

  // -------- No room selected and no project selected -> project dashboard --------
  if (matchDashboard) {
    const waitingForAuth = authLoading;
    const guest = !user && !authLoading;

    return (
      <>
        <Helmet>
          <title>Studio Projects — Vision Studio</title>
        </Helmet>
        <div className="mx-auto max-w-7xl bg-[#f6f3ee] px-6 py-20 text-[#171717] md:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-vs-accent mb-4">Projects</p>
          <div className="flex flex-wrap items-end justify-between gap-6 mb-12">
            <h1 className="display-lg max-w-3xl">
              {guest ? 'Start your floorplan project in seconds.' : 'Your floorplans and projects.'}
            </h1>
            <button type="button" className="btn-ink" onClick={() => navigate('/studio/new')}>+ New Project</button>
          </div>
          <p className="mb-10 max-w-3xl text-sm leading-relaxed text-[#2d2d2d]">
            Create or open a floorplan-level project. Each project contains interior spaces, exterior
            areas, layout geometry, design context, and room-specific edits.
          </p>
          <p className="mb-8 text-xs text-[#5b5b5b]">
            Projects organize your floorplan into interior spaces, exterior areas, and project-wide design context.
          </p>
          {!!queryProjectId && !currentProject && (
            <p className="mb-6 rounded-lg border border-[rgba(0,0,0,0.08)] bg-[#eef4f7] px-4 py-3 text-sm text-[#5b5b5b]">
              Project context unavailable. Showing saved spaces instead.
            </p>
          )}

          {/* Guest: show any in-progress draft prominently */}
          {guest && draftRoom && (
            <div className="panel p-8 mb-10 border-ink-900 flex flex-wrap items-center justify-between gap-6">
              <div>
                <div className="eyebrow mb-2 text-sienna-600">Your draft</div>
                <div className="display-md mb-2">{draftRoom.name}</div>
                <div className="text-sm text-ink-500">
                  {draftRoom.width ? `${inchesToFeet(draftRoom.width)} × ${inchesToFeet(draftRoom.depth)}` : 'Unsized'} · not saved to any account
                </div>
              </div>
              <div className="flex gap-3">
                <button className="btn-ink" onClick={() => openRoom(draftRoom.id)}>Continue space editing →</button>
                <button
                  onClick={discardDraft}
                  className="text-[11px] uppercase tracking-editorial text-ink-500 hover:text-ink-900 px-4"
                >
                  Discard
                </button>
              </div>
            </div>
          )}

          {/* Guest: no draft yet → show templates + upload CTA */}
          {guest && !draftRoom && (
            <div>
              <p className="mb-8 max-w-lg leading-relaxed text-[#5b5b5b]">
                No sign-in required. Pick a template to start from scratch, or upload a floorplan to design your real space.
                Save to your account whenever you're ready.
              </p>
              <div className="grid md:grid-cols-3 gap-6 mb-12">
                {ROOM_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => navigate(`/studio/new?startMode=template&templateId=${encodeURIComponent(t.id)}`)}
                    className="group text-left rounded-[20px] border border-[rgba(0,0,0,0.08)] bg-[#eef4f7] p-8 shadow-[0_14px_34px_rgba(4,12,46,0.05)] transition hover:bg-[#f8f8f6] hover:border-[#004aad]/35"
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-[0.26em] text-vs-accent mb-6">Template</div>
                    <div className="display-md mb-3 text-[#171717]">{t.name}</div>
                    <div className="text-sm text-[#5b5b5b]">
                      {inchesToFeet(t.width)} × {inchesToFeet(t.depth)}
                    </div>
                    <div className="mt-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-vs-dark/58">Open study</div>
                  </button>
                ))}
              </div>
              <div className="panel p-8 flex flex-wrap items-center justify-between gap-6">
                <div>
                  <div className="eyebrow mb-2 text-ink-500">Have a floorplan?</div>
                  <div className="display-md">Upload & auto-segment your spaces.</div>
                </div>
                <button
                  className="btn-ink"
                  type="button"
                  onClick={() => navigate('/studio/new?startMode=upload')}
                >
                  Upload floorplan →
                </button>
              </div>
            </div>
          )}

          {/* Project cards */}
          {!guest && !waitingForAuth && (
            loadingList ? (
              <div className="grid md:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => (
                  <div key={i} className="panel p-8 animate-pulse">
                    <div className="h-3 w-20 bg-ink-300/30 rounded mb-6" />
                    <div className="h-6 w-32 bg-ink-300/30 rounded mb-3" />
                    <div className="h-3 w-24 bg-ink-300/30 rounded" />
                  </div>
                ))}
              </div>
            ) : projects.length === 0 ? (
              <div>
                <div className="text-center py-16 mb-12">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-paper-200 grid place-items-center">
                    <span className="text-3xl">🏠</span>
                  </div>
                  <h2 className="display-md mb-3">No projects yet</h2>
                  <p className="text-ink-500 mb-8 max-w-md mx-auto leading-relaxed">
                    Create your first project and choose upload, blank, or template start.
                  </p>
                </div>
                <button type="button" className="btn-ink" onClick={() => navigate('/studio/new')}>Create Project</button>
              </div>
            ) : (
              <div className="grid md:grid-cols-3 gap-6">
                {projects.map((p) => {
                  const counts = countSpaces(p);
                  const statusLabel = p.status === 'completed' ? 'Completed' : p.status === 'draft' ? 'Draft' : 'In Progress';
                  return (
                  <article
                    key={p.id}
                    className="group relative rounded-[22px] border border-[rgba(0,0,0,0.08)] bg-[#eef4f7] p-7 shadow-[0_16px_34px_rgba(4,12,46,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#f8f8f6] hover:border-[#004aad]/35 hover:shadow-[0_20px_40px_rgba(4,12,46,0.10)]"
                  >
                    <div className="mb-5 rounded-xl border border-[rgba(0,0,0,0.08)] bg-[#f8f8f6] p-4">
                      <div className="h-14 rounded-lg border border-[rgba(0,0,0,0.07)] bg-[linear-gradient(135deg,#eef4f7_0%,#f8f8f6_60%)]" />
                      <div className="mt-3 flex items-center gap-2">
                        <span className="h-1.5 w-12 rounded-full bg-[#004aad]/25" />
                        <span className="h-1.5 w-7 rounded-full bg-[#004aad]/15" />
                      </div>
                    </div>
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-vs-accent">{p.propertyType}</div>
                      <span className="rounded-full border border-[rgba(0,0,0,0.08)] bg-[#f8f8f6] px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-[#5b5b5b]">
                        {statusLabel}
                      </span>
                    </div>
                    <div className="display-md mb-2 text-[#171717]">{p.name}</div>
                    <div className="grid grid-cols-3 gap-2 rounded-lg border border-[rgba(0,0,0,0.07)] bg-[#f8f8f6] px-3 py-2.5 mb-5">
                      <div>
                        <div className="text-[9px] uppercase tracking-[0.18em] text-[#5b5b5b]">Interior</div>
                        <div className="text-sm text-[#171717]">{counts.interior}</div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-[0.18em] text-[#5b5b5b]">Exterior</div>
                        <div className="text-sm text-[#171717]">{counts.exterior}</div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-[0.18em] text-[#5b5b5b]">Updated</div>
                        <div className="text-xs text-[#171717]">{new Date(p.updatedAt || p.createdAt || Date.now()).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openProject(p.id)}
                        className="btn-ink text-[10px] py-2 px-4"
                      >
                        Open project
                      </button>
                      <button
                        type="button"
                        onClick={() => continueProjectEditing(p)}
                        className="text-[10px] uppercase tracking-[0.2em] text-vs-accent hover:text-[#003a86] transition"
                      >
                        Continue editing
                      </button>
                    </div>
                    <div className="mt-4 flex items-center justify-between opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      <select
                        value={p.status || 'in_progress'}
                        onChange={(e) => setProjectStatus(p, e.target.value)}
                        className="rounded-full border border-[rgba(0,0,0,0.08)] bg-[#f8f8f6] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-[#5b5b5b]"
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status === 'in_progress' ? 'In Progress' : status === 'completed' ? 'Completed' : 'Draft'}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => renameProject(p)}
                        className="text-[10px] uppercase tracking-[0.2em] text-[#5b5b5b] hover:text-[#171717]"
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteProject(p)}
                        className="text-[10px] uppercase tracking-[0.2em] text-[#8f4d4d] hover:text-[#7a2f2f]"
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                );
                })}
              </div>
            )
          )}

          {waitingForAuth && (
            <div className="text-ink-500 eyebrow">Loading…</div>
          )}
          {!waitingForAuth && <p className="mt-14 text-xs uppercase tracking-[0.2em] text-vs-dark/52" />}

          {editingProjectId && (
            <div className="fixed inset-0 z-50 bg-black/35 grid place-items-center px-4">
              <div className="w-full max-w-md rounded-[18px] border border-[rgba(0,0,0,0.08)] bg-[#f8f8f6] p-6">
                <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-vs-accent mb-3">Rename Project</div>
                <input
                  className="input-field bg-[#fffdf9]"
                  value={editingProjectName}
                  onChange={(e) => setEditingProjectName(e.target.value)}
                  placeholder="Project name"
                />
                <div className="mt-5 flex justify-end gap-3">
                  <button className="btn-ghost" onClick={() => { setEditingProjectId(null); setEditingProjectName(''); }}>Cancel</button>
                  <button className="btn-ink" onClick={saveRenamedProject}>Save</button>
                </div>
              </div>
            </div>
          )}

        </div>
      </>
    );
  }

  if (matchProjectHub) {
    const project = currentProject;
    const interiorSpaces = (project?.spaces || []).filter((s) => s.type === 'interior');
    const exteriorSpaces = (project?.spaces || []).filter((s) => s.type === 'exterior');
    const gv = project?.globalVision || {};
    const visionOk = isProjectVisionComplete(gv);
    const confirmed = isConfirmationDone(project);
    const setupIncomplete = !visionOk || !confirmed;
    const continueSetupPath = !visionOk
      ? `/studio/project/${project?.id}/vision?setup=new`
      : `/studio/project/${project?.id}/confirm?from=hub`;
    return (
      <>
        <Helmet><title>{project?.name || 'Project'} — Vision Studio</title></Helmet>
        <div className="mx-auto max-w-7xl bg-[#f6f3ee] px-6 py-20 text-[#171717] md:px-8">
          <button type="button" className="text-[11px] uppercase tracking-editorial text-[#5b5b5b] hover:text-[#171717] mb-4" onClick={() => navigate('/studio')}>← Back to Projects</button>
          <div className="flex flex-wrap items-end justify-between gap-6 mb-8">
            <div>
              <h1 className="display-lg">{project?.name || 'Project'}</h1>
              <p className="mt-4 text-sm text-[#5b5b5b] max-w-2xl">
                One assistant, two modes: set whole-property direction with the Project Vision Assistant, then edit each space
                in the editor with the Space Assistant.
              </p>
            </div>
            <div className="flex flex-col items-end gap-3">
              <button
                type="button"
                className="btn-ink px-8 py-3 text-[11px] uppercase tracking-[0.12em]"
                onClick={() => project?.id && openEditorFromHub(project)}
                disabled={!project?.id}
              >
                Open Editor
              </button>
              <div className="flex flex-wrap justify-end gap-2 max-w-md">
                <button type="button" className="btn-ghost text-[10px]" onClick={() => navigate(`/studio/project/${project?.id}/vision`)} disabled={!project?.id}>
                  Edit Project Vision
                </button>
                <button type="button" className="btn-ghost text-[10px]" onClick={() => navigate(`/studio/project/${project?.id}/confirm?from=hub`)} disabled={!project?.id}>
                  Review Spaces
                </button>
                <button type="button" className="btn-ghost text-[10px]" onClick={() => navigate(`/studio/project/${project?.id}/chat`)} disabled={!project?.id}>
                  Ask Project Assistant
                </button>
              </div>
              <p className="text-[10px] text-[#8a857d] text-right max-w-sm leading-relaxed">
                Vision review, space checklist, and project chat are optional once guided setup is finished — use anytime.
              </p>
            </div>
          </div>
          {editorEntryIssue && (
            <div className="rounded-xl border border-sienna-500/35 bg-paper-100/90 px-5 py-4 mb-8">
              <p className="text-sm font-medium text-ink-900">{editorEntryIssue}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-ghost text-[10px]"
                  onClick={() => project?.id && navigate(`/studio/project/${project.id}/confirm`)}
                >
                  Review Spaces
                </button>
                <button
                  type="button"
                  className="btn-ghost text-[10px]"
                  onClick={() => openSpaceTypeModal(project, 'interior')}
                  disabled={creatingInteriorSpace || !project}
                >
                  Add Interior Space
                </button>
                <button
                  type="button"
                  className="btn-ghost text-[10px]"
                  onClick={() => openSpaceTypeModal(project, 'exterior')}
                  disabled={creatingExteriorSpace || !project}
                >
                  Add Exterior Area
                </button>
              </div>
            </div>
          )}

          {setupIncomplete && (
            <div className="rounded-xl border border-sienna-500/35 bg-paper-100/90 px-5 py-4 mb-10">
              <p className="text-sm font-medium text-ink-900">Continue guided setup</p>
              <p className="mt-1 text-xs text-ink-600 max-w-2xl leading-relaxed">
                New projects walk through vision and space confirmation first. Pick up where you left off, or use the links
                above if you prefer to skip ahead.
              </p>
              <button
                type="button"
                className="btn-sienna mt-4 text-[10px] uppercase tracking-editorial"
                onClick={() => project?.id && navigate(continueSetupPath)}
                disabled={!project?.id}
              >
                Continue setup →
              </button>
            </div>
          )}

          <section className="panel p-6 mb-10">
            <div className="eyebrow text-vs-accent mb-2">Project vision summary</div>
            <p className="text-sm text-[#2d2d2d] leading-relaxed">
              {[
                gv.propertyVision,
                gv.moodVibe,
                gv.styleKeywords?.join(', '),
              ].filter(Boolean).join(' · ') || 'Your whole-property vision appears here.'}
            </p>
          </section>

          <p className="mt-4 text-sm text-[#5b5b5b] mb-10">
            Select a space to edit, or add interior and exterior areas to build out the full property.
          </p>
          {!project && (
            <div className="mt-6 rounded-xl border border-[rgba(0,0,0,0.08)] bg-[#eef4f7] px-5 py-4 text-sm text-[#5b5b5b]">
              Project context unavailable. Showing saved spaces instead.
            </div>
          )}
          <div className="grid lg:grid-cols-2 gap-8 mt-10">
            <section className="panel p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="eyebrow text-vs-accent">Interior Spaces</div>
                  <p className="mt-1 text-xs text-[#5b5b5b]">Rooms, circulation, furniture zones.</p>
                </div>
                <button
                  className="text-[10px] uppercase tracking-[0.2em] text-vs-accent hover:text-[#003a86] transition"
                  onClick={() => openSpaceTypeModal(project, 'interior')}
                  disabled={creatingInteriorSpace || !project}
                >
                  Add Interior Space
                </button>
              </div>
              <div className="space-y-2">
                {interiorSpaces.map((space) => (
                  <button
                    key={space.id}
                    className="w-full text-left rounded-lg border border-[rgba(0,0,0,0.08)] bg-[#f8f8f6] px-4 py-3 transition hover:border-[#004aad]/45"
                    onClick={() => selectProjectSpace(project, space)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">⌂ {space.name}</div>
                        <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-vs-accent">
                          {space.category || 'Interior'} · Open space
                        </div>
                      </div>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-[#5b5b5b]">
                        Last edited {new Date(space.updatedAt || project?.updatedAt || Date.now()).toLocaleDateString()}
                      </div>
                    </div>
                  </button>
                ))}
                {interiorSpaces.length === 0 && (
                  <button
                    className="w-full text-left rounded-lg border border-dashed border-[rgba(0,0,0,0.14)] bg-[#eef4f7] px-4 py-5 transition hover:border-[#004aad]/45"
                    onClick={() => openSpaceTypeModal(project, 'interior')}
                    disabled={creatingInteriorSpace || !project}
                  >
                    <div className="text-sm font-medium">{creatingInteriorSpace ? 'Creating interior space…' : 'Add Interior Space'}</div>
                    <div className="mt-2 text-xs text-[#5b5b5b] leading-relaxed">
                      No interior spaces yet. Add a room such as Living Room, Kitchen, Bedroom, or Office.
                    </div>
                  </button>
                )}
              </div>
            </section>
            <section className="panel p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="eyebrow text-vs-accent">Exterior Areas</div>
                  <p className="mt-1 text-xs text-[#5b5b5b]">Landscape, entry, yard, outdoor living.</p>
                </div>
                <button
                  className="text-[10px] uppercase tracking-[0.2em] text-vs-accent hover:text-[#003a86] transition"
                  onClick={() => openSpaceTypeModal(project, 'exterior')}
                  disabled={creatingExteriorSpace || !project}
                >
                  Add Exterior Area
                </button>
              </div>
              <div className="space-y-2">
                {exteriorSpaces.map((space) => (
                  <button
                    key={space.id}
                    className="w-full text-left rounded-lg border border-[rgba(0,0,0,0.08)] bg-[#f8f8f6] px-4 py-3 transition hover:border-[#004aad]/45"
                    onClick={() => selectProjectSpace(project, space)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">◌ {space.name}</div>
                        <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-vs-accent">
                          {space.category || 'Exterior'} · Open space
                        </div>
                      </div>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-[#5b5b5b]">
                        Last edited {new Date(space.updatedAt || project?.updatedAt || Date.now()).toLocaleDateString()}
                      </div>
                    </div>
                  </button>
                ))}
                {exteriorSpaces.length === 0 && (
                  <button
                    className="w-full text-left rounded-lg border border-dashed border-[rgba(0,0,0,0.14)] bg-[#eef4f7] px-4 py-5 transition hover:border-[#004aad]/45"
                    onClick={() => openSpaceTypeModal(project, 'exterior')}
                    disabled={creatingExteriorSpace || !project}
                  >
                    <div className="text-sm font-medium">{creatingExteriorSpace ? 'Creating exterior area…' : 'Add Exterior Area'}</div>
                    <div className="mt-2 text-xs text-[#5b5b5b] leading-relaxed">
                      No exterior areas yet. Add an area such as Front Yard, Backyard, Patio, Entry, or Garden.
                    </div>
                  </button>
                )}
              </div>
            </section>
          </div>
          <AnimatePresence>
            {showSpaceTypeModal && spaceTypeTarget && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/35 grid place-items-center px-4"
              >
                <div className="w-full max-w-xl rounded-[22px] border border-[rgba(0,0,0,0.08)] bg-[#f8f8f6] p-8">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-vs-accent mb-3">
                    {spaceTypeTarget.type === 'interior' ? 'Add Interior Space' : 'Add Exterior Area'}
                  </div>
                  <h2 className="font-display text-2xl leading-tight mb-2">
                    Choose a {spaceTypeTarget.type === 'interior' ? 'space' : 'area'} type
                  </h2>
                  <p className="text-sm text-[#5b5b5b] mb-6">
                    This creates a backend-compatible editable space and opens it in Studio.
                  </p>
                  <div className="grid grid-cols-2 gap-2 mb-5">
                    {(spaceTypeTarget.type === 'interior' ? INTERIOR_SPACE_TYPES : EXTERIOR_AREA_TYPES).map((option) => (
                      <button
                        key={option}
                        onClick={() => setSelectedSpaceCategory(option)}
                        className={`rounded-lg px-3 py-2 text-[11px] uppercase tracking-editorial border ${
                          selectedSpaceCategory === option
                            ? 'border-[#004aad] text-[#004aad] bg-[#eef4f7]'
                            : 'border-[rgba(0,0,0,0.08)] text-[#5b5b5b]'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                  {selectedSpaceCategory === 'Custom' && (
                    <label className="block mb-5">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#5b5b5b] mb-2">Custom Name</div>
                      <input
                        className="input-field bg-[#fffdf9]"
                        value={customSpaceName}
                        onChange={(e) => setCustomSpaceName(e.target.value)}
                        placeholder={spaceTypeTarget.type === 'interior' ? 'Interior Space' : 'Exterior Area'}
                      />
                    </label>
                  )}
                  <div className="flex justify-end gap-3">
                    <button className="btn-ghost" onClick={closeSpaceTypeModal}>Cancel</button>
                    <button className="btn-ink" onClick={confirmAddSpaceType}>Create and Open</button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </>
    );
  }

  const isProjectEditorMode = Boolean(isProjectEditorRoute && currentProject);
  const selectedSpaceRoomId = getSpaceRoomId(selectedProjectSpace);
  const selectedSpaceHasLinkedRoom = Boolean(selectedSpaceRoomId);
  const showRoomScopedCanvas = Boolean(room && resolvedRoomId);
  const assistantContextLabel = selectedProjectSpace
    ? selectedProjectSpace.name
    : isProjectEditorMode
      ? 'Full Floorplan'
      : room?.name || 'Current Space';

  // -------- Legacy room editor loading states --------
  if (!isProjectEditorMode && !room) {
    if (loadRoomFailed) {
      return (
        <div className="h-[calc(100vh-4rem)] grid place-items-center">
          <div className="panel p-6 max-w-xl mx-4">
            <div className="font-display text-xl mb-2">Editor unavailable for this space</div>
            <p className="text-sm text-ink-600 leading-relaxed">
              {editorEntryIssue || 'Add or confirm a space before opening the editor.'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-ghost text-[10px]"
                onClick={() => projectId && navigate(`/studio/project/${projectId}/confirm`)}
                disabled={!projectId}
              >
                Review Spaces
              </button>
              <button
                type="button"
                className="btn-ghost text-[10px]"
                onClick={() => projectId && navigate(`/studio/project/${projectId}`)}
                disabled={!projectId}
              >
                Back to Project Hub
              </button>
              <button
                type="button"
                className="btn-ghost text-[10px]"
                onClick={() => projectId && navigate(`/studio/project/${projectId}`)}
                disabled={!projectId}
              >
                Create Editable Space
              </button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="h-[calc(100vh-4rem)] grid place-items-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-ink-300 border-t-ink-900 rounded-full animate-spin" />
          <span className="eyebrow text-ink-500">Loading space...</span>
        </div>
      </div>
    );
  }

  if (isProjectEditorMode && selectedSpaceHasLinkedRoom && !room) {
    return (
      <div className="h-[calc(100vh-4rem)] grid place-items-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-ink-300 border-t-ink-900 rounded-full animate-spin" />
          <span className="eyebrow text-ink-500">Loading selected space...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{isProjectEditorMode ? currentProject?.name || 'Project Editor' : room.name || 'Untitled'} — Vision Studio</title>
      </Helmet>
      <div
        className={`flex flex-col bg-[#f6f3ee] ${
          isProjectEditorRoute ? 'h-[100dvh] min-h-0' : 'h-[calc(100vh-4rem)]'
        }`}
      >
        <StudioToolbar
          onToggleCatalog={() => setCatalogOpen(!catalogOpen)}
          catalogOpen={catalogOpen}
          projectIdForBack={projectId}
          contextLabel={assistantContextLabel}
          projectMode={isProjectEditorMode}
        />
        <div className="flex-1 flex overflow-hidden relative min-h-0">
          <AnimatePresence>
            {catalogOpen && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-10 bg-ink-900/20 md:hidden" onClick={() => setCatalogOpen(false)} />
            )}
          </AnimatePresence>

          {/* Workspace sidebar — catalog, spaces list, export (IDE-style) */}
          <aside
            className={`
            ${catalogOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            fixed md:relative z-20 md:z-auto inset-y-0 left-0
            w-[320px] border-r border-[rgba(0,0,0,0.08)] bg-[#f8f8f6] overflow-hidden flex flex-col min-h-0
            transition-transform duration-300 md:transition-none
            ${
              isProjectEditorRoute
                ? 'top-14 h-[calc(100dvh-3.5rem)] md:top-0 md:h-full'
                : 'top-[calc(4rem+3.5rem)] md:top-0 h-[calc(100vh-4rem-3.5rem)] md:h-full'
            }
          `}
          >
            <EditorWorkspaceSidebar
              project={isProjectEditorRoute ? currentProject : null}
              onNavigateToSpace={
                projectId
                  ? (spaceId) => {
                      if (!spaceId) {
                        navigate(`/studio/project/${projectId}/editor`);
                        return;
                      }
                      navigate(`/studio/project/${projectId}/editor/${spaceId}`);
                    }
                  : undefined
              }
            />
          </aside>

          <section className="relative overflow-hidden flex-1 min-w-0">
            <div className="h-full flex flex-col">
              <div className="min-h-0 flex-1 relative overflow-hidden">
                <ErrorBoundary>
                  {viewMode === '3d' ? (
                    isProjectEditorMode && !showRoomScopedCanvas ? (
                      <ProjectViewer3D
                        projectSpaces={projectSpaces}
                        rooms={rooms}
                        selectedSpaceId={selectedProjectSpaceId}
                      />
                    ) : (
                      <RoomViewer3D />
                    )
                  ) : isProjectEditorMode && !showRoomScopedCanvas ? (
                    <ProjectCanvas
                      projectSpaces={projectSpaces}
                      rooms={rooms}
                      selectedSpaceId={selectedProjectSpaceId}
                      onSelectSpace={(spaceId) => {
                        if (!projectId || !spaceId) return;
                        navigate(`/studio/project/${projectId}/editor/${spaceId}`);
                      }}
                    />
                  ) : (
                    <RoomCanvas />
                  )}
                </ErrorBoundary>
                {isProjectEditorMode && selectedProjectSpaceId && !selectedSpaceHasLinkedRoom && (
                  <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-lg border border-sienna-500/40 bg-paper-100/95 px-3 py-2 text-xs text-ink-700">
                    {selectedProjectSpace?.name || 'Space'} has no linked room yet. Previewing project-level geometry.
                  </div>
                )}
                {isProjectEditorMode && projectSpaces.length === 0 && (
                  <div className="absolute inset-0 grid place-items-center">
                    <div className="panel p-6 max-w-lg">
                      <div className="font-display text-xl mb-2">No spaces in this project yet</div>
                      <p className="text-sm text-ink-600">
                        Add interior or exterior spaces to start your floorplan editor.
                      </p>
                      <div className="mt-4 flex gap-2">
                        <button
                          type="button"
                          className="btn-ghost text-[10px]"
                          onClick={() => navigate(`/studio/project/${projectId}/confirm?from=hub`)}
                        >
                          Review Spaces
                        </button>
                        <button
                          type="button"
                          className="btn-ink text-[10px]"
                          onClick={() => navigate(`/studio/project/${projectId}`)}
                        >
                          Add Space
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {isProjectEditorMode ? (
                <ProjectSpaceBottomBar
                  spaces={projectSpaces}
                  selectedSpaceId={selectedProjectSpaceId}
                  onSelectAll={() => projectId && navigate(`/studio/project/${projectId}/editor`)}
                  onSelectSpace={(spaceId) =>
                    projectId && spaceId && navigate(`/studio/project/${projectId}/editor/${spaceId}`)
                  }
                  onAddInterior={() => projectId && navigate(`/studio/project/${projectId}`)}
                  onAddExterior={() => projectId && navigate(`/studio/project/${projectId}`)}
                />
              ) : (
                <ZoneBottomBar />
              )}
            </div>
          </section>

          {/* Sidebar chat — only when not fullscreen */}
          <AnimatePresence>
            {isChatOpen && (
              <motion.aside initial={{ width: 0, opacity: 0 }} animate={{ width: 360, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="hidden md:flex border-l border-[rgba(0,0,0,0.08)] bg-[#f8f8f6] overflow-hidden flex-col shrink-0">
                <ChatPanel
                  projectId={currentProjectId}
                  spaceId={querySpaceId}
                  spaceBranchType={activeSpace?.type}
                  globalVision={currentProject?.globalVision}
                  spaceVision={activeSpace?.spaceVision}
                  contextLabel={assistantContextLabel}
                  projectWideContext={isProjectEditorMode && !selectedProjectSpaceId}
                />
              </motion.aside>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {isChatOpen && (
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className={`md:hidden fixed inset-x-0 bottom-0 z-40 bg-[#f8f8f6] flex flex-col border-t border-[rgba(0,0,0,0.08)] ${
                isProjectEditorRoute ? 'top-0' : 'top-16'
              }`}>
              <ChatPanel
                projectId={currentProjectId}
                spaceId={querySpaceId}
                spaceBranchType={activeSpace?.type}
                globalVision={currentProject?.globalVision}
                spaceVision={activeSpace?.spaceVision}
                contextLabel={assistantContextLabel}
                projectWideContext={isProjectEditorMode && !selectedProjectSpaceId}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
