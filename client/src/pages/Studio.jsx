import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useLayoutStore } from '@/store/layoutStore';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import RoomCanvas from '@/components/canvas/RoomCanvas';
import CatalogPanel from '@/components/catalog/CatalogPanel';
import ChatPanel from '@/components/chatbot/ChatPanel';
import RoomViewer3D from '@/components/viewer/RoomViewer3D';
import StudioToolbar from '@/components/studio/StudioToolbar';
import ZoneBottomBar from '@/components/studio/ZoneBottomBar';
import ErrorBoundary from '@/components/ErrorBoundary';
import MessageBubble from '@/components/chatbot/MessageBubble';
import { ROOM_TEMPLATES } from '@/utils/constants';
import { inchesToFeet } from '@/utils/scale';
import {
  countSpaces,
  createProjectSpaceDraft,
  createProjectDraft,
  deleteProjectById,
  getMostRecentSpace,
  getProjectById,
  toDashboardProjects,
  upsertProject,
} from '@/utils/projectCompat';

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
const PROPERTY_TYPES = ['Apartment', 'House', 'Studio', 'Office', 'Retail / Hospitality', 'Other'];
const PROJECT_SCOPES = [
  { id: 'interior_only', label: 'Interior only' },
  { id: 'exterior_only', label: 'Exterior only' },
  { id: 'interior_exterior', label: 'Interior + Exterior' },
];
const STATUS_OPTIONS = ['in_progress', 'draft', 'completed'];

/* ── Fullscreen chat overlay shown when entering a space ── */
function FullscreenChat({
  room,
  onMinimize,
  projectName,
  selectedContextLabel,
  projectId,
  spaceId,
  contextType,
  globalVision,
  spaceVision,
}) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const { chatHistory, addChatMessage, furniture, setRecommendedItems, loadRoom } = useLayoutStore();

  useEffect(() => {
    if (scrollRef.current) requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }));
  }, [chatHistory, sending]);

  useEffect(() => {
    if (textareaRef.current) { textareaRef.current.style.height = 'auto'; textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`; }
  }, [input]);

  const send = async (msg) => {
    const text = typeof msg === 'string' ? msg : input;
    if (!text.trim() || !room?.id) return;
    addChatMessage({ role: 'user', content: text });
    setInput('');
    setSending(true);
    try {
      const isDraft = isDraftId(room.id);
      const { data } = await api.post('/api/chat/message', {
        room_id: room.id, message: text,
        project_id: projectId || null,
        space_id: spaceId || null,
        context_type: contextType || 'current_space',
        global_vision: globalVision || null,
        space_vision: spaceVision || null,
        ...(isDraft && { room_context: { id: room.id, name: room.name, width: room.width, depth: room.depth, height: room.height || 96, unit: room.unit || 'inches', placements: furniture.map(f => ({ id: f.id, name: f.name, category: f.category, provider: f.provider, width: f.width, depth: f.depth, height: f.height, x_inches: f.x_inches, y_inches: f.y_inches, rotation: f.rotation })) } }),
      });
      addChatMessage({ role: 'assistant', content: data.message || '(no response)', actions: data.actions || [] });

      const suggestions = (data.actions || []).filter(a => ['suggest_furniture', 'furnish_room'].includes(a.function)).flatMap(a => a.result?.suggestions || []);
      if (suggestions.length) setRecommendedItems(suggestions);

      const mutatingTools = ['move_furniture', 'rotate_furniture', 'add_furniture', 'remove_furniture', 'arrange_room', 'swap_furniture', 'furnish_room', 'clear_room'];
      const didMutate = (data.actions || []).some(a => mutatingTools.includes(a.function) && a.result?.success);

      if (didMutate) {
        if (isDraft) {
          const store = useLayoutStore.getState();
          for (const action of (data.actions || [])) {
            const r = action.result; if (!r?.success) continue;
            if (action.function === 'add_furniture' && r.added_item) { const ai = r.added_item; store.addFurniture({ name: ai.name, category: ai.category, provider: ai.provider, width: ai.width, depth: ai.depth, height: ai.height, x_inches: ai.x_inches || 12, y_inches: ai.y_inches || 12, rotation: ai.rotation || 0, color: '#d4a27a', image_url: ai.image_url, model_url: ai.model_url, _animDelay: 300 }); }
            else if (['move_furniture', 'rotate_furniture'].includes(action.function)) { const nm = action.args?.furniture_name?.toLowerCase(); if (nm) { const m = store.furniture.find(f => f.name?.toLowerCase().includes(nm)); if (m) { const p = {}; if (action.args.x_inches != null) p.x_inches = action.args.x_inches; if (action.args.y_inches != null) p.y_inches = action.args.y_inches; if (action.args.rotation != null) p.rotation = action.args.rotation; store.updateFurniture(m.id, p); } } }
            else if (action.function === 'remove_furniture') { const nm = action.args?.furniture_name?.toLowerCase(); if (nm) { const m = store.furniture.find(f => f.name?.toLowerCase().includes(nm)); if (m) store.removeFurniture(m.id); } }
            else if (action.function === 'clear_room') { for (const f of [...store.furniture]) store.removeFurniture(f.id); }
            else if (action.function === 'swap_furniture') { if (r.removed_name) { const m = store.furniture.find(f => f.name?.toLowerCase().includes(r.removed_name.toLowerCase())); if (m) store.removeFurniture(m.id); } if (r.added_item) { const ai = r.added_item; store.addFurniture({ name: ai.name, category: ai.category, provider: ai.provider, width: ai.width, depth: ai.depth, height: ai.height, x_inches: ai.x_inches || 12, y_inches: ai.y_inches || 12, rotation: ai.rotation || 0, color: '#d4a27a', image_url: ai.image_url, model_url: ai.model_url, _animDelay: 300 }); } }
            else if (action.function === 'furnish_room' && r.suggestions) { r.suggestions.forEach((item, idx) => store.addFurniture({ name: item.name, category: item.category, provider: item.provider, width: item.width, depth: item.depth, height: item.height, x_inches: item.x_inches || 12, y_inches: item.y_inches || 12, rotation: item.rotation || 0, color: '#d4a27a', image_url: item.image_url, model_url: item.model_url, _animDelay: 400 + idx * 500 })); }
          }
          // Skip follow-up auto-place for furnish_room since positions are already arranged
          const hasArrange = (data.actions || []).some(a => a.function === 'arrange_room' && a.result?.success);
          if (hasArrange) {
            try {
              const cur = useLayoutStore.getState().furniture;
              if (cur.length > 0) {
                const { data: arranged } = await api.post('/api/layout/auto-place', { room_id: room.id, room_context: { id: room.id, name: room.name, width: room.width, depth: room.depth }, placements_context: cur.map(f => ({ id: f.id, name: f.name, category: f.category, width: f.width, depth: f.depth, height: f.height, x_inches: f.x_inches, y_inches: f.y_inches, rotation: f.rotation })) });
                for (const u of (arranged.placements || [])) { const m = useLayoutStore.getState().furniture.find(f => f.name === u.name); if (m) useLayoutStore.getState().updateFurniture(m.id, { x_inches: u.x_inches, y_inches: u.y_inches, rotation: u.rotation }); }
              }
            } catch {}
          }
        } else { await loadRoom(room.id); }
        // Auto-minimize to show the editor after mutations
        onMinimize();
      }
    } catch (e) { addChatMessage({ role: 'assistant', content: `Something went wrong: ${e?.response?.data?.error || e.message}` }); }
    finally { setSending(false); }
  };

  const hasMessages = chatHistory.length > 0;
  const PROMPTS = [
    { icon: '🏠', text: 'Furnish this as a living room' },
    { icon: '🛏️', text: 'Set up a cozy bedroom' },
    { icon: '💼', text: 'Design a home office' },
    { icon: '🎨', text: 'I want a Scandinavian style' },
    { icon: '🪑', text: 'Show me sofas under $600' },
    { icon: '📐', text: 'Auto-arrange everything' },
    { icon: '💡', text: 'Give me design tips' },
    { icon: '💰', text: 'Estimate the total cost' },
  ];
  const STYLES = ['Modern', 'Scandinavian', 'Industrial', 'Mid-Century', 'Minimalist', 'Bohemian', 'Rustic', 'Japandi'];

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="h-12 border-b border-ink-900/10 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-sienna-400 to-sienna-600 grid place-items-center">
            <span className="text-xs text-paper-50 font-bold">V</span>
          </div>
          <span className="font-display text-base">AI Design Assistant</span>
          <span className="text-[10px] uppercase tracking-editorial text-ink-500 flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${sending ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
            {sending ? 'Thinking…' : room.name}
          </span>
        </div>
        <button onClick={onMinimize} className="text-[10px] uppercase tracking-editorial px-3 py-1.5 rounded-full border border-ink-900/15 text-ink-600 hover:border-ink-900 hover:text-ink-900 transition">
          Show Editor
        </button>
      </div>
      <div className="border-b border-ink-900/10 px-6 py-2 text-[10px] uppercase tracking-[0.2em] text-ink-500">
        Selected context: {selectedContextLabel || 'Current space'}
        {projectName ? ` · ${projectName}` : ''}
      </div>
      <div className="border-b border-ink-900/10 px-6 py-2 text-xs text-ink-500">
        Ask about this project, a specific space, or the overall design direction.
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 space-y-5">
          {!hasMessages && (
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-16rem)] py-8">
              <div className="w-12 h-12 mb-4 rounded-2xl bg-gradient-to-br from-sienna-400 to-sienna-600 grid place-items-center shadow-lg">
                <span className="text-lg text-paper-50 font-display">V</span>
              </div>
              <h2 className="display-md mb-6 text-center">What would you like to do with {room.name}?</h2>

              {/* Inline chat input — prominent on the welcome screen */}
              <div className="w-full max-w-lg mb-8">
                <div className="flex items-end gap-2">
                  <textarea ref={textareaRef}
                    className="flex-1 bg-paper-100 border border-ink-900/15 rounded-2xl px-5 py-3.5 text-sm text-ink-900 placeholder:text-ink-400 resize-none focus:outline-none focus:border-ink-900/30 focus:ring-2 focus:ring-ink-900/5 transition min-h-[52px] max-h-[120px] shadow-sm"
                    placeholder="e.g. Furnish this as a modern living room…" value={input}
                    onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
                    disabled={sending} rows={1} autoFocus />
                  <button onClick={() => send(input)} disabled={!input.trim() || sending}
                    className="shrink-0 w-12 h-12 rounded-2xl bg-ink-900 text-paper-50 grid place-items-center transition hover:bg-ink-700 disabled:opacity-30 shadow-sm" aria-label="Send">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </button>
                </div>
                <p className="text-[10px] text-ink-400 mt-2 text-center">Enter to send · Shift+Enter for new line</p>
              </div>

              {/* Style chips */}
              <div className="mb-5">
                <div className="eyebrow text-ink-400 mb-2 text-center">Or set your style</div>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {STYLES.map(s => (
                    <button key={s} onClick={() => send(`I prefer a ${s.toLowerCase()} style`)}
                      className="text-[10px] uppercase tracking-editorial rounded-full px-3 py-1.5 border border-ink-900/12 text-ink-600 hover:border-sienna-500 hover:text-sienna-600 transition">{s}</button>
                  ))}
                </div>
              </div>

              {/* Quick prompts */}
              <div className="w-full max-w-xl">
                <div className="eyebrow text-ink-400 mb-2 text-center">Quick actions</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {PROMPTS.map(p => (
                    <button key={p.text} onClick={() => send(p.text)}
                      className="text-left p-3 rounded-xl border border-ink-900/8 hover:border-ink-900/25 hover:shadow-sm transition-all group">
                      <span className="text-base mb-1 block">{p.icon}</span>
                      <span className="text-xs text-ink-600 group-hover:text-ink-900 transition leading-snug">{p.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {/* Message history */}
          {hasMessages && <div className="pt-6" />}
          <AnimatePresence initial={false}>
            {chatHistory.map((m, i) => <MessageBubble key={m.id} message={m} isLast={i === chatHistory.length - 1} />)}
          </AnimatePresence>
          {sending && (
            <div className="flex items-center gap-2 pb-4">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-sienna-400 to-sienna-600 grid place-items-center shrink-0">
                <span className="text-[9px] text-paper-50 font-bold">V</span>
              </div>
              <div className="bg-paper-100 border border-ink-900/10 px-4 py-3 rounded-2xl rounded-bl-md flex items-center gap-1.5">
                <span className="typing-dot" style={{ animationDelay: '0ms' }} /><span className="typing-dot" style={{ animationDelay: '150ms' }} /><span className="typing-dot" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          {hasMessages && <div className="pb-4" />}
        </div>
      </div>

      {/* Bottom input — only shown after conversation starts (welcome screen has its own inline input) */}
      {hasMessages && (
        <div className="border-t border-ink-900/10 bg-paper-50 shrink-0">
          <div className="max-w-2xl mx-auto px-6 py-3">
            <div className="flex items-end gap-3">
              <textarea ref={textareaRef}
                className="flex-1 bg-paper-100 border border-ink-900/10 rounded-2xl px-5 py-3 text-sm text-ink-900 placeholder:text-ink-400 resize-none focus:outline-none focus:border-ink-900/25 focus:ring-2 focus:ring-ink-900/5 transition min-h-[48px] max-h-[140px]"
                    placeholder="Describe your space goals, style, or ask for furniture…" value={input}
                onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
                disabled={sending} rows={1} />
              <button onClick={() => send(input)} disabled={!input.trim() || sending}
                className="shrink-0 w-11 h-11 rounded-2xl bg-ink-900 text-paper-50 grid place-items-center transition hover:bg-ink-700 disabled:opacity-30 shadow-sm" aria-label="Send">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
            <div className="flex items-center justify-between mt-2 px-1">
              <span className="text-[10px] text-ink-400">{room.name} space · {furniture.length} items</span>
              <span className="text-[10px] text-ink-400 hidden sm:inline">Enter to send</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Studio() {
  const { roomId, projectId, spaceId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const {
    room, loadRoom, viewMode, isChatOpen, createRoom, createDraftRoom, clearDraft, clearChat, setActiveZone,
  } = useLayoutStore();
  const [rooms, setRooms] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [chatFullscreen, setChatFullscreen] = useState(true);
  const [showProjectCreate, setShowProjectCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [projectCreateError, setProjectCreateError] = useState('');
  const [creatingInteriorSpace, setCreatingInteriorSpace] = useState(false);
  const [creatingExteriorSpace, setCreatingExteriorSpace] = useState(false);
  const [showSpaceTypeModal, setShowSpaceTypeModal] = useState(false);
  const [spaceTypeTarget, setSpaceTypeTarget] = useState(null);
  const [selectedSpaceCategory, setSelectedSpaceCategory] = useState('');
  const [customSpaceName, setCustomSpaceName] = useState('');
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [projectForm, setProjectForm] = useState({
    name: '',
    propertyType: 'Apartment',
    scope: 'interior_exterior',
    startMode: 'upload',
    templateId: ROOM_TEMPLATES[0]?.id || '',
  });
  const draftRoom = useLayoutStore((s) => (isDraftId(s.room?.id) ? s.room : null));

  const queryProjectId = searchParams.get('projectId');
  const querySpaceId = searchParams.get('spaceId');
  const currentProjectId = projectId || queryProjectId;
  const currentProject = useMemo(() => {
    if (!currentProjectId) return null;
    return getProjectById(currentProjectId) || projects.find((p) => p.id === currentProjectId) || null;
  }, [currentProjectId, projects]);
  const selectedContextLabel = querySpaceId
    ? 'Current space'
    : currentProject
      ? 'Whole project'
      : 'Current space';
  const activeSpace = currentProject?.spaces?.find((s) => s.id === querySpaceId) || null;

  const normalizeProjectPayload = (project) => {
    if (!project) return null;
    return {
      ...project,
      propertyType: project.propertyType ?? project.property_type ?? 'House',
      globalVision: project.globalVision ?? project.global_vision ?? {},
      spaces: (project.spaces || []).map((space) => ({
        ...space,
        roomId: space.roomId ?? space.room_id ?? null,
        placeholderMode: space.placeholderMode ?? space.placeholder_mode ?? false,
        spaceVision: space.spaceVision ?? space.space_vision ?? {},
      })),
      updatedAt: project.updatedAt ?? project.updated_at,
      createdAt: project.createdAt ?? project.created_at,
    };
  };

  // Load requested room or dashboard data.
  useEffect(() => {
    if (roomId) {
      clearChat();
      loadRoom(roomId);
      if (queryProjectId) {
        fetchRooms();
      }
    } else {
      fetchRooms();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, user, projectId, queryProjectId]);

  const fetchRooms = async () => {
    setLoadingList(true);
    try {
      const { data } = await api.get('/api/rooms');
      const nextRooms = Array.isArray(data) ? data : [];
      setRooms(nextRooms);
      try {
        const projectsRes = await api.get('/api/projects');
        const apiProjects = Array.isArray(projectsRes.data)
          ? projectsRes.data.map((p) => normalizeProjectPayload(p)).filter(Boolean)
          : [];
        if (apiProjects.length > 0) {
          setProjects(apiProjects);
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

  const openRoom = (id) => navigate(`/studio/${id}`);
  const openProject = (id) => navigate(`/studio/project/${id}`);
  const continueProjectEditing = (project) => {
    const mostRecent = getMostRecentSpace(project);
    if (mostRecent?.id && mostRecent?.roomId) {
      navigate(`/studio/project/${project.id}/${mostRecent.id}`);
      return;
    }
    openProject(project.id);
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
    const project = getProjectById(editingProjectId) || projects.find((p) => p.id === editingProjectId);
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
    if (!space?.roomId) return;
    const params = new URLSearchParams({
      projectId: project.id,
      spaceId: space.id,
    });
    navigate(`/studio/${space.roomId}?${params.toString()}`);
  };

  const addProjectSpace = async (project, type = 'interior', options = {}) => {
    if (!project?.id) return;
    if (type === 'interior') setCreatingInteriorSpace(true);
    else setCreatingExteriorSpace(true);
    try {
      const draftSpace = createProjectSpaceDraft(project, type, options);
      try {
        const { data } = await api.post(`/api/projects/${project.id}/spaces`, {
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
          ...project,
          spaces: [...(project.spaces || []), normalizedSpace],
          updatedAt: new Date().toISOString(),
        };
        upsertProject(nextProject);
        setProjects((prev) => prev.map((p) => (p.id === nextProject.id ? nextProject : p)));
        navigate(`/studio/project/${project.id}/${normalizedSpace.id}`);
        return;
      } catch {
        // Fallback to local compatibility behavior
      }

      const payload = {
        name: `${project.name} - ${draftSpace.name}`,
        width: type === 'interior' ? 240 : 300,
        depth: type === 'interior' ? 180 : 220,
        height: 96,
      };
      const created = user ? await createRoom(payload) : createDraftRoom(payload);
      const nextProject = {
        ...project,
        spaces: [...(project.spaces || []), { ...draftSpace, roomId: created.id }],
        updatedAt: new Date().toISOString(),
      };
      upsertProject(nextProject);
      setProjects((prev) => {
        const hasProject = prev.some((p) => p.id === nextProject.id);
        if (!hasProject) return [...prev, nextProject];
        return prev.map((p) => (p.id === nextProject.id ? nextProject : p));
      });
      navigate(`/studio/project/${project.id}/${draftSpace.id}`);
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
    });
    closeSpaceTypeModal();
  };

  useEffect(() => {
    if (!projectId || !spaceId) return;
    const p = getProjectById(projectId) || projects.find((proj) => proj.id === projectId);
    const space = p?.spaces?.find((s) => s.id === spaceId);
    if (space?.roomId) {
      const params = new URLSearchParams({ projectId, spaceId });
      navigate(`/studio/${space.roomId}?${params.toString()}`, { replace: true });
    }
  }, [projectId, spaceId, navigate, projects]);

  useEffect(() => {
    if (!room || !currentProject || !querySpaceId) return;
    const activeSpace = currentProject.spaces?.find((s) => s.id === querySpaceId);
    if (activeSpace?.zoneId) setActiveZone(activeSpace.zoneId);
  }, [room, currentProject, querySpaceId, setActiveZone]);

  const createProject = async () => {
    if (creating) return;
    setCreating(true);
    setProjectCreateError('');
    try {
      let project = createProjectDraft({
        name: projectForm.name || 'Untitled Project',
        propertyType: projectForm.propertyType,
        startMode: projectForm.startMode,
      });
      project.scope = projectForm.scope;
      project.status = 'in_progress';

      try {
        const { data } = await api.post('/api/projects', {
          name: project.name,
          property_type: project.propertyType,
          scope: project.scope,
          global_vision: project.globalVision,
          status: project.status,
        });
        project = normalizeProjectPayload({ ...data, spaces: data.spaces || [] }) || project;
      } catch {
        // Local compatibility path
      }

      if (projectForm.startMode === 'upload') {
        upsertProject(project);
        setProjects((prev) => {
          const has = prev.some((p) => p.id === project.id);
          if (has) return prev.map((p) => (p.id === project.id ? project : p));
          return [project, ...prev];
        });
        setShowProjectCreate(false);
        const params = new URLSearchParams({
          projectId: project.id,
          projectName: project.name,
          propertyType: project.propertyType,
        });
        navigate(`/upload?${params.toString()}`);
        return;
      }

      const shouldSeedInterior = projectForm.scope !== 'exterior_only';
      if (shouldSeedInterior) {
        const template = ROOM_TEMPLATES.find((t) => t.id === projectForm.templateId) || ROOM_TEMPLATES[0];
        const seedSpace = createProjectSpaceDraft(project, 'interior', {
          name: projectForm.startMode === 'template' ? template.name : 'Living Room',
          category: projectForm.startMode === 'template' ? template.name : 'Living Room',
        });
        try {
          const { data } = await api.post(`/api/projects/${project.id}/spaces`, {
            type: 'interior',
            name: seedSpace.name,
            category: seedSpace.category,
            placeholder_mode: false,
            space_vision: seedSpace.spaceVision,
            room_payload: {
              name: `${project.name} - ${seedSpace.name}`,
              width: projectForm.startMode === 'template' ? template.width : 240,
              depth: projectForm.startMode === 'template' ? template.depth : 180,
              height: projectForm.startMode === 'template' ? template.height : 96,
            },
          });
          const normalizedSpace = normalizeProjectPayload({ spaces: [data] })?.spaces?.[0];
          project.spaces = normalizedSpace ? [normalizedSpace] : [];
        } catch {
          try {
            const base = projectForm.startMode === 'template'
              ? { name: `${project.name} - ${template.name}`, width: template.width, depth: template.depth, height: template.height }
              : { name: `${project.name} - Interior`, width: 240, depth: 180, height: 96 };
            const created = user ? await createRoom(base) : createDraftRoom(base);
            project.spaces = [{ ...seedSpace, roomId: created.id }];
          } catch {
            // Keep creation resilient: project can still open with empty state cards.
            project.spaces = [];
            toast.error('Project created, but initial space setup failed. Add spaces from the project page.');
          }
        }
      }

      project.updatedAt = new Date().toISOString();
      upsertProject(project);
      setProjects((prev) => {
        const has = prev.some((p) => p.id === project.id);
        if (has) return prev.map((p) => (p.id === project.id ? project : p));
        return [project, ...prev];
      });
      setShowProjectCreate(false);
      navigate(`/studio/project/${project.id}`);
    } catch (e) {
      const message = e?.response?.data?.error || e?.message || 'Failed to create project';
      setProjectCreateError(message);
      toast.error('Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  const discardDraft = () => {
    if (!window.confirm('Discard your draft? This cannot be undone.')) return;
    clearDraft();
    toast.success('Draft discarded');
  };

  // -------- No room selected and no project selected -> project dashboard --------
  if (!roomId && !projectId) {
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
            <button className="btn-ink" onClick={() => setShowProjectCreate(true)}>+ New Project</button>
          </div>
          <p className="mb-10 max-w-3xl text-sm leading-relaxed text-[#2d2d2d]">
            Create or open a floorplan-level project. Each project contains interior spaces, exterior
            areas, layout geometry, design context, and room-specific edits.
          </p>
          <div className="mb-8 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.2em] text-[#5b5b5b]">
            <span className="rounded-full border border-[rgba(0,0,0,0.08)] bg-[#f8f8f6] px-3 py-1">Saved automatically</span>
            <span className="rounded-full border border-[rgba(0,0,0,0.08)] bg-[#f8f8f6] px-3 py-1">Last synced just now</span>
            <span className="rounded-full border border-[rgba(0,0,0,0.08)] bg-[#f8f8f6] px-3 py-1">Multi-space planning enabled</span>
            <span className="rounded-full border border-[rgba(0,0,0,0.08)] bg-[#f8f8f6] px-3 py-1">AI suggestions use project context</span>
          </div>
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
                    onClick={() => {
                      setProjectForm((s) => ({ ...s, startMode: 'template', templateId: t.id, name: t.name }));
                      setShowProjectCreate(true);
                    }}
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
                  onClick={() => {
                    setProjectForm((s) => ({ ...s, startMode: 'upload' }));
                    setShowProjectCreate(true);
                  }}
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
                <button className="btn-ink" onClick={() => setShowProjectCreate(true)}>Create Project</button>
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
          {!waitingForAuth && (
            <p className="mt-14 text-xs uppercase tracking-[0.2em] text-vs-dark/52">
              Projects group interior and exterior spaces while keeping current room APIs compatible.
            </p>
          )}

          {showProjectCreate && (
            <div className="fixed inset-0 z-50 bg-black/35 grid place-items-center px-4">
              <form
                className="w-full max-w-xl rounded-[22px] border border-[rgba(0,0,0,0.08)] bg-[#f8f8f6] p-8"
                onSubmit={(e) => {
                  e.preventDefault();
                  createProject();
                }}
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-vs-accent mb-4">New Project</div>
                <label className="block mb-5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#5b5b5b] mb-2">Project Name</div>
                  <input className="input-field bg-[#fffdf9]" value={projectForm.name} onChange={(e) => setProjectForm((s) => ({ ...s, name: e.target.value }))} placeholder="Untitled Project" />
                </label>
                <label className="block mb-5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#5b5b5b] mb-2">Property Type</div>
                  <select className="input-field bg-[#fffdf9]" value={projectForm.propertyType} onChange={(e) => setProjectForm((s) => ({ ...s, propertyType: e.target.value }))}>
                    {PROPERTY_TYPES.map((type) => <option key={type}>{type}</option>)}
                  </select>
                </label>
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#5b5b5b] mb-2">Choose how to begin</div>
                <div className="grid grid-cols-3 gap-2 mb-5">
                  {['upload', 'blank', 'template'].map((mode) => (
                    <button type="button" key={mode} onClick={() => setProjectForm((s) => ({ ...s, startMode: mode }))}
                      className={`rounded-lg px-3 py-2 text-[11px] uppercase tracking-editorial border ${projectForm.startMode === mode ? 'border-[#004aad] text-[#004aad] bg-[#eef4f7]' : 'border-[rgba(0,0,0,0.08)] text-[#5b5b5b]'}`}>
                      {mode === 'upload' ? 'Upload Floorplan' : mode === 'blank' ? 'Start Blank' : 'Use Template'}
                    </button>
                  ))}
                </div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#5b5b5b] mb-2">Scope</div>
                <div className="grid grid-cols-3 gap-2 mb-5">
                  {PROJECT_SCOPES.map((scope) => (
                    <button
                      type="button"
                      key={scope.id}
                      onClick={() => setProjectForm((s) => ({ ...s, scope: scope.id }))}
                      className={`rounded-lg px-3 py-2 text-[11px] uppercase tracking-editorial border ${
                        projectForm.scope === scope.id
                          ? 'border-[#004aad] text-[#004aad] bg-[#eef4f7]'
                          : 'border-[rgba(0,0,0,0.08)] text-[#5b5b5b]'
                      }`}
                    >
                      {scope.label}
                    </button>
                  ))}
                </div>
                {projectCreateError && (
                  <div className="mb-4 rounded-lg border border-[rgba(143,77,77,0.3)] bg-[#fff1f1] px-3 py-2 text-sm text-[#7a2f2f]">
                    {projectCreateError}
                  </div>
                )}
                {projectForm.startMode === 'template' && (
                  <select className="input-field bg-[#fffdf9] mb-5" value={projectForm.templateId} onChange={(e) => setProjectForm((s) => ({ ...s, templateId: e.target.value }))}>
                    {ROOM_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                )}
                <div className="flex justify-end gap-3">
                  <button type="button" className="btn-ghost" onClick={() => { setProjectCreateError(''); setShowProjectCreate(false); }}>Cancel</button>
                  <button type="submit" className="btn-ink" disabled={creating}>{creating ? 'Creating…' : 'Continue'}</button>
                </div>
              </form>
            </div>
          )}
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

  if (!roomId && projectId) {
    const project = currentProject;
    const interiorSpaces = (project?.spaces || []).filter((s) => s.type === 'interior');
    const exteriorSpaces = (project?.spaces || []).filter((s) => s.type === 'exterior');
    return (
      <>
        <Helmet><title>{project?.name || 'Project'} — Vision Studio</title></Helmet>
        <div className="mx-auto max-w-7xl bg-[#f6f3ee] px-6 py-20 text-[#171717] md:px-8">
          <button className="text-[11px] uppercase tracking-editorial text-[#5b5b5b] hover:text-[#171717] mb-4" onClick={() => navigate('/studio')}>← Back to Projects</button>
          <h1 className="display-lg">{project?.name || 'Project'}</h1>
          <p className="mt-4 text-sm text-[#5b5b5b]">
            Select a space to edit, or add interior and exterior areas to build out the full property.
          </p>
          {!project && (
            <div className="mt-6 rounded-xl border border-[rgba(0,0,0,0.08)] bg-[#eef4f7] px-5 py-4 text-sm text-[#5b5b5b]">
              Project context unavailable. Showing saved spaces instead.
            </div>
          )}
          <div className="grid lg:grid-cols-3 gap-8 mt-10">
            <section className="panel p-6 lg:col-span-2">
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
                  + Add interior space
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
                    <div className="text-sm font-medium">{creatingInteriorSpace ? 'Creating interior space…' : '+ Add interior space'}</div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-vs-accent">No interior spaces yet</div>
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
                  + Add exterior area
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
                    <div className="text-sm font-medium">{creatingExteriorSpace ? 'Creating exterior area…' : '+ Add exterior area'}</div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-vs-accent">No exterior areas yet</div>
                  </button>
                )}
              </div>
            </section>
            <aside className="panel p-6">
              <div className="eyebrow text-vs-accent mb-2">Project Vision</div>
              <p className="text-xs text-[#5b5b5b] mb-5">
                Keep strategic direction visible across interior and exterior decisions.
              </p>
              <div className="space-y-3">
                <label className="block">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[#5b5b5b] mb-1">Style</div>
                  <input
                    className="input-field bg-[#fffdf9]"
                    value={project?.globalVision?.styleKeywords?.join(', ') || ''}
                    onChange={(e) => updateProjectVision(project, {
                      styleKeywords: e.target.value.split(',').map((v) => v.trim()).filter(Boolean),
                    })}
                    placeholder="Warm minimal, Japandi, modern coastal"
                  />
                </label>
                <label className="block">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[#5b5b5b] mb-1">Mood</div>
                  <input
                    className="input-field bg-[#fffdf9]"
                    value={project?.globalVision?.moodVibe || ''}
                    onChange={(e) => updateProjectVision(project, { moodVibe: e.target.value })}
                    placeholder="Calm, gallery-like, inviting"
                  />
                </label>
                <label className="block">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[#5b5b5b] mb-1">Budget</div>
                  <input
                    className="input-field bg-[#fffdf9]"
                    value={project?.globalVision?.budgetRange || ''}
                    onChange={(e) => updateProjectVision(project, { budgetRange: e.target.value })}
                    placeholder="Mid-range, premium accents"
                  />
                </label>
                <label className="block">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[#5b5b5b] mb-1">Interior Goals</div>
                  <textarea
                    className="w-full rounded-lg border border-[rgba(0,0,0,0.08)] bg-[#fffdf9] px-3 py-2 text-sm"
                    value={project?.globalVision?.interiorGoals || ''}
                    onChange={(e) => updateProjectVision(project, { interiorGoals: e.target.value })}
                    placeholder="Flow, zoning, atmosphere, furniture strategy"
                  />
                </label>
                <label className="block">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[#5b5b5b] mb-1">Exterior Goals</div>
                  <textarea
                    className="w-full rounded-lg border border-[rgba(0,0,0,0.08)] bg-[#fffdf9] px-3 py-2 text-sm"
                    value={project?.globalVision?.exteriorGoals || ''}
                    onChange={(e) => updateProjectVision(project, { exteriorGoals: e.target.value })}
                    placeholder="Curb appeal, entry sequence, outdoor living"
                  />
                </label>
              </div>
              <button className="btn-ink w-full mt-4 text-[10px] py-2.5">Refine with AI Assistant</button>
              <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-[#5b5b5b]">
                Saved automatically · Last synced just now
              </p>
            </aside>
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

  // -------- Space selected -> full editor --------
  if (!room) {
    return (
      <div className="h-[calc(100vh-4rem)] grid place-items-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-ink-300 border-t-ink-900 rounded-full animate-spin" />
          <span className="eyebrow text-ink-500">Loading space…</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{room.name || 'Untitled'} — Vision Studio</title>
      </Helmet>
      <div className="h-[calc(100vh-4rem)] flex flex-col bg-[#f6f3ee]">
        <StudioToolbar onToggleCatalog={() => setCatalogOpen(!catalogOpen)} catalogOpen={catalogOpen}
          chatFullscreen={chatFullscreen} onToggleChatFullscreen={() => setChatFullscreen(f => !f)} />
        <div className="flex-1 flex overflow-hidden relative">
          {currentProject && (
            <aside className="hidden lg:flex w-[240px] border-r border-[rgba(0,0,0,0.08)] bg-[#f8f8f6] flex-col p-4 gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#5b5b5b]">Project</div>
                <div className="font-display text-lg mt-1">{currentProject.name}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-vs-accent mb-2">Interior</div>
                <div className="space-y-1">
                  {(currentProject.spaces || []).filter((s) => s.type === 'interior').map((space) => (
                    <button key={space.id}
                      onClick={() => selectProjectSpace(currentProject, space)}
                      className={`w-full text-left px-3 py-2 rounded-md border text-sm ${querySpaceId === space.id ? 'border-[#004aad]/45 bg-[#eef4f7]' : 'border-transparent hover:border-[rgba(0,0,0,0.08)]'}`}>
                      {space.name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-vs-accent mb-2">Exterior</div>
                <div className="space-y-1">
                  {(currentProject.spaces || []).filter((s) => s.type === 'exterior').map((space) => (
                    <button key={space.id}
                      onClick={() => selectProjectSpace(currentProject, space)}
                      className={`w-full text-left px-3 py-2 rounded-md border text-sm ${querySpaceId === space.id ? 'border-[#004aad]/45 bg-[#eef4f7]' : 'border-transparent hover:border-[rgba(0,0,0,0.08)]'}`}>
                      {space.name}
                    </button>
                  ))}
                </div>
              </div>
            </aside>
          )}

          {/* Fullscreen chat overlay — shown by default, hides when AI places furniture */}
          {chatFullscreen && (
            <div className="absolute inset-0 z-30 bg-[#f6f3ee] flex flex-col">
              <FullscreenChat
                room={room}
                onMinimize={() => setChatFullscreen(false)}
                projectName={currentProject?.name || ''}
                selectedContextLabel={selectedContextLabel}
                projectId={currentProject?.id || null}
                spaceId={activeSpace?.id || null}
                contextType={activeSpace ? 'current_space' : currentProject ? 'whole_project' : 'current_space'}
                globalVision={currentProject?.globalVision || currentProject?.global_vision || null}
                spaceVision={activeSpace?.spaceVision || activeSpace?.space_vision || null}
              />
            </div>
          )}

          {/* Catalog */}
          <aside className={`
            ${catalogOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            fixed md:relative z-20 md:z-auto inset-y-0 left-0
            w-[320px] border-r border-[rgba(0,0,0,0.08)] bg-[#f8f8f6] overflow-y-auto
            transition-transform duration-300 md:transition-none
            top-[calc(4rem+3.5rem)] md:top-0 h-[calc(100vh-4rem-3.5rem)] md:h-auto
          `}>
            <CatalogPanel />
          </aside>

          <AnimatePresence>
            {catalogOpen && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-10 bg-ink-900/20 md:hidden" onClick={() => setCatalogOpen(false)} />
            )}
          </AnimatePresence>

          <section className="relative overflow-hidden flex-1 min-w-0">
            <div className="h-full flex flex-col">
              <div className="min-h-0 flex-1 relative overflow-hidden">
                <ErrorBoundary>
                  {viewMode === '3d' ? <RoomViewer3D /> : <RoomCanvas />}
                </ErrorBoundary>
              </div>
              <ZoneBottomBar />
            </div>
          </section>

          {/* Sidebar chat — only when not fullscreen */}
          <AnimatePresence>
            {isChatOpen && !chatFullscreen && (
              <motion.aside initial={{ width: 0, opacity: 0 }} animate={{ width: 360, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="hidden md:flex border-l border-[rgba(0,0,0,0.08)] bg-[#f8f8f6] overflow-hidden flex-col">
                <ChatPanel />
              </motion.aside>
            )}
          </AnimatePresence>
        </div>

        {/* Mobile chat overlay */}
        <AnimatePresence>
          {isChatOpen && !chatFullscreen && (
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="md:hidden fixed inset-x-0 bottom-0 top-16 z-40 bg-[#f8f8f6] flex flex-col border-t border-[rgba(0,0,0,0.08)]">
              <ChatPanel />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
