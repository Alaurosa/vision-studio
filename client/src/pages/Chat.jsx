import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { fetchRoomsListOnce } from '@/lib/roomsFetchOnce';
import { useLayoutStore } from '@/store/layoutStore';
import MessageBubble from '@/components/chatbot/MessageBubble';
import { getProjectById, toDashboardProjects } from '@/utils/projectCompat';
import { getChatRoutableProjects, handleChatNavigationIntent } from '@/utils/chatRouting';

const GLOBAL_INSPIRATION_ROOM_ID = 'draft-global-inspiration';

const GLOBAL_STYLE_CHIPS = [
  'Modern',
  'Scandinavian',
  'Industrial',
  'Mid-century',
  'Minimalist',
  'Bohemian',
  'Rustic',
  'Japandi',
  'Coastal',
];

const GLOBAL_PROMPTS = [
  'Give me warm luxury living room ideas',
  'Help me choose a design style',
  'What furniture works in a small bedroom?',
  'How should I plan an entryway?',
  'Suggest exterior curb appeal ideas',
  'Create a cozy Japandi moodboard',
  'How do I make a room feel larger?',
  'What should I upload to start a project?',
];

const PROJECT_QUICK_PROMPTS = [
  { icon: '✨', text: 'Give this house a warm luxury feel' },
  { icon: '🌿', text: 'Modernize the backyard' },
  { icon: '🛏️', text: 'Optimize bedroom layout' },
  { icon: '🎨', text: 'Scandinavian interior with bold exterior' },
  { icon: '🏡', text: 'Improve curb appeal' },
];

const PROJECT_STYLE_CHIPS = [
  'Modern', 'Scandinavian', 'Industrial', 'Mid-Century',
  'Minimalist', 'Bohemian', 'Rustic', 'Japandi', 'Coastal',
];

const normalizeProjectPayload = (project) => {
  if (!project) return null;
  return {
    ...project,
    updatedAt: project.updatedAt ?? project.updated_at,
    createdAt: project.createdAt ?? project.created_at,
    spaces: (project.spaces || []).map((space) => ({
      ...space,
      id: space.id,
      name: space.name || space.category || 'Untitled Space',
      type: (space.type ?? space.space_type ?? 'interior').toLowerCase() === 'exterior' ? 'exterior' : 'interior',
      category: space.category || '',
      roomId: space.roomId ?? space.room_id ?? null,
      updatedAt: space.updatedAt ?? space.updated_at,
      createdAt: space.createdAt ?? space.created_at,
    })),
  };
};

export default function Chat() {
  const navigate = useNavigate();
  const { projectId: routeProjectId } = useParams();
  const isGlobalChat = !routeProjectId;

  const scopedProjectMeta = useMemo(
    () => (routeProjectId ? getProjectById(routeProjectId) : null),
    [routeProjectId],
  );

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [inferredContext, setInferredContext] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [routableProjects, setRoutableProjects] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [chatContext, setChatContext] = useState(() => (routeProjectId ? 'whole_project' : 'current_space'));
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);

  /** Local-only thread for global inspiration chat — never mixes with Studio / editor history. */
  const [inspirationMessages, setInspirationMessages] = useState([]);

  const {
    room, chatHistory, addChatMessage, clearChat, furniture,
    setRecommendedItems, loadRoom,
  } = useLayoutStore();

  const loadRoutableProjects = async () => {
    try {
      const nextRooms = await fetchRoomsListOnce();
      if (!isGlobalChat) setRooms(nextRooms);
      try {
        const projectsRes = await api.get('/api/projects');
        const apiProjects = Array.isArray(projectsRes.data)
          ? projectsRes.data.map((p) => normalizeProjectPayload(p)).filter(Boolean)
          : [];
        if (apiProjects.length > 0) {
          const next = getChatRoutableProjects(apiProjects);
          setRoutableProjects(next);
          return next;
        }
      } catch {
        // fallback to local compatibility data
      }
      const next = getChatRoutableProjects(toDashboardProjects(nextRooms));
      setRoutableProjects(next);
      return next;
    } catch {
      const next = getChatRoutableProjects([]);
      setRoutableProjects(next);
      return next;
    }
  };

  useEffect(() => {
    if (isGlobalChat) return;
    const loadRooms = async () => {
      try {
        const serverRooms = await fetchRoomsListOnce();
        setRooms(serverRooms);
        if (serverRooms.length > 0 && !selectedRoomId) {
          setSelectedRoomId(serverRooms[0].id);
        }
      } catch {
        // Guest / API unavailable — draft-only path
      }
      const storeRoom = useLayoutStore.getState().room;
      if (storeRoom?.id && !selectedRoomId) {
        setSelectedRoomId(storeRoom.id);
      }
    };
    loadRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once when entering project chat
  }, [isGlobalChat]);

  useEffect(() => {
    if (!isGlobalChat) return;
    loadRoutableProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGlobalChat]);

  useEffect(() => {
    if (isGlobalChat || !selectedRoomId) return;
    loadRoom(selectedRoomId);
  }, [selectedRoomId, isGlobalChat, loadRoom]);

  const activeMessages = isGlobalChat ? inspirationMessages : chatHistory;

  useEffect(() => {
    if (scrollRef.current) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      });
    }
  }, [activeMessages, sending, isGlobalChat]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  const sendGlobalInspiration = async (msg) => {
    const text = typeof msg === 'string' ? msg : input;
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const uid = () => `m-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const userEntry = { id: uid(), role: 'user', content: trimmed };
    setInspirationMessages((prev) => [...prev, userEntry]);
    setInput('');
    setSending(true);

    try {
      const projects =
        routableProjects.length > 0 ? routableProjects : await loadRoutableProjects();
      const intent = handleChatNavigationIntent(trimmed, projects);

      if (intent.kind === 'route' && intent.to) {
        if (intent.context) setInferredContext(intent.context);
        setInspirationMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: 'assistant',
            content: intent.assistantText || 'I can take you there in Studio.',
            routeOptions: [{ label: 'Open in Studio', to: intent.to }],
          },
        ]);
        setTimeout(() => navigate(intent.to), 250);
        return;
      }

      if ((intent.kind === 'suggest' || intent.kind === 'not_found') && intent.options) {
        if (intent.context) setInferredContext(intent.context);
        setInspirationMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: 'assistant',
            content: intent.assistantText,
            routeOptions: intent.options,
          },
        ]);
        return;
      }

      const { data } = await api.post('/api/chat/message', {
        room_id: GLOBAL_INSPIRATION_ROOM_ID,
        message: trimmed,
        room_context: {
          id: GLOBAL_INSPIRATION_ROOM_ID,
          name: 'Design inspiration (general)',
          width: 240,
          depth: 180,
          height: 96,
          unit: 'inches',
          placements: [],
        },
      });

      setInspirationMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: 'assistant',
          content: data.message || '(no response)',
          actions: [],
        },
      ]);
    } catch (e) {
      const errText = e?.response?.data?.error || e.message || 'Request failed';
      setInspirationMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: 'assistant',
          content:
            `We couldn't reach the assistant (${errText}). For layout editing and saved projects, continue in **Studio**. This page is for general design inspiration only.`,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const sendProjectChat = async (msg) => {
    const text = typeof msg === 'string' ? msg : input;
    if (!text.trim()) return;
    if (!room?.id) {
      toast.error('Select or create a space first');
      return;
    }

    addChatMessage({ role: 'user', content: text });
    setInput('');
    setSending(true);

    try {
      const isDraft = room.id?.startsWith?.('draft-');
      const scopedProject = routeProjectId ? getProjectById(routeProjectId) : null;
      const gv = scopedProject?.globalVision ?? scopedProject?.global_vision ?? null;

      const { data } = await api.post('/api/chat/message', {
        room_id: room.id,
        message: text,
        project_id: routeProjectId || null,
        space_id: null,
        context_type: chatContext,
        global_vision: gv,
        space_vision: null,
        ...(isDraft && {
          room_context: {
            id: room.id,
            name: room.name,
            width: room.width,
            depth: room.depth,
            height: room.height || 96,
            unit: room.unit || 'inches',
            placements: furniture.map((f) => ({
              id: f.id,
              name: f.name,
              category: f.category,
              provider: f.provider,
              width: f.width,
              depth: f.depth,
              height: f.height,
              x_inches: f.x_inches,
              y_inches: f.y_inches,
              rotation: f.rotation,
            })),
          },
        }),
      });

      addChatMessage({
        role: 'assistant',
        content: data.message || '(no response)',
        actions: data.actions || [],
      });

      const suggestions = (data.actions || [])
        .filter((a) => ['suggest_furniture', 'furnish_room'].includes(a.function))
        .flatMap((a) => a.result?.suggestions || []);
      if (suggestions.length) setRecommendedItems(suggestions);

      const mutatingTools = [
        'move_furniture',
        'rotate_furniture',
        'add_furniture',
        'remove_furniture',
        'arrange_room',
        'swap_furniture',
        'furnish_room',
        'clear_room',
      ];
      const didMutate = (data.actions || []).some(
        (a) => mutatingTools.includes(a.function) && a.result?.success,
      );

      if (didMutate) {
        if (isDraft) {
          const store = useLayoutStore.getState();
          for (const action of data.actions || []) {
            const r = action.result;
            if (!r?.success) continue;
            if (action.function === 'add_furniture' && r.added_item) {
              const ai = r.added_item;
              store.addFurniture({
                name: ai.name,
                category: ai.category,
                provider: ai.provider,
                width: ai.width,
                depth: ai.depth,
                height: ai.height,
                x_inches: ai.x_inches || 12,
                y_inches: ai.y_inches || 12,
                rotation: ai.rotation || 0,
                color: ai.color || '#d4a27a',
                image_url: ai.image_url,
                model_url: ai.model_url,
              });
            } else if (['move_furniture', 'rotate_furniture'].includes(action.function)) {
              const name = action.args?.furniture_name?.toLowerCase();
              if (name) {
                const m = store.furniture.find((f) => f.name?.toLowerCase().includes(name));
                if (m) {
                  const patch = {};
                  if (action.args.x_inches != null) patch.x_inches = action.args.x_inches;
                  if (action.args.y_inches != null) patch.y_inches = action.args.y_inches;
                  if (action.args.rotation != null) patch.rotation = action.args.rotation;
                  store.updateFurniture(m.id, patch);
                }
              }
            } else if (action.function === 'remove_furniture') {
              const name = action.args?.furniture_name?.toLowerCase();
              if (name) {
                const m = store.furniture.find((f) => f.name?.toLowerCase().includes(name));
                if (m) store.removeFurniture(m.id);
              }
            } else if (action.function === 'clear_room') {
              for (const f of [...store.furniture]) store.removeFurniture(f.id);
            } else if (action.function === 'swap_furniture') {
              if (r.removed_name) {
                const m = store.furniture.find((f) =>
                  f.name?.toLowerCase().includes(r.removed_name.toLowerCase()),
                );
                if (m) store.removeFurniture(m.id);
              }
              if (r.added_item) {
                const ai = r.added_item;
                store.addFurniture({
                  name: ai.name,
                  category: ai.category,
                  provider: ai.provider,
                  width: ai.width,
                  depth: ai.depth,
                  height: ai.height,
                  x_inches: ai.x_inches || 12,
                  y_inches: ai.y_inches || 12,
                  rotation: ai.rotation || 0,
                  color: '#d4a27a',
                  image_url: ai.image_url,
                  model_url: ai.model_url,
                });
              }
            } else if (action.function === 'furnish_room' && r.suggestions) {
              for (const item of r.suggestions) {
                store.addFurniture({
                  name: item.name,
                  category: item.category,
                  provider: item.provider,
                  width: item.width,
                  depth: item.depth,
                  height: item.height,
                  x_inches: item.x_inches || 12,
                  y_inches: item.y_inches || 12,
                  rotation: item.rotation || 0,
                  color: '#d4a27a',
                  image_url: item.image_url,
                  model_url: item.model_url,
                });
              }
            }
          }
          const hasArrange = (data.actions || []).some(
            (a) => a.function === 'arrange_room' && a.result?.success,
          );
          if (hasArrange) {
            try {
              const cur = useLayoutStore.getState().furniture;
              if (cur.length > 0) {
                const { data: arranged } = await api.post('/api/layout/auto-place', {
                  room_id: room.id,
                  room_context: { id: room.id, name: room.name, width: room.width, depth: room.depth },
                  placements_context: cur.map((f) => ({
                    id: f.id,
                    name: f.name,
                    category: f.category,
                    width: f.width,
                    depth: f.depth,
                    height: f.height,
                    x_inches: f.x_inches,
                    y_inches: f.y_inches,
                    rotation: f.rotation,
                  })),
                });
                for (const u of arranged.placements || []) {
                  const m = useLayoutStore.getState().furniture.find((f) => f.name === u.name);
                  if (m) {
                    useLayoutStore.getState().updateFurniture(m.id, {
                      x_inches: u.x_inches,
                      y_inches: u.y_inches,
                      rotation: u.rotation,
                    });
                  }
                }
              }
            } catch {
              /* best-effort */
            }
          }
        } else {
          await loadRoom(room.id);
        }
      }
    } catch (e) {
      addChatMessage({
        role: 'assistant',
        content: `Something went wrong: ${e?.response?.data?.error || e.message}`,
      });
    } finally {
      setSending(false);
    }
  };

  const send = async (msg) => {
    if (isGlobalChat) return sendGlobalInspiration(msg);
    return sendProjectChat(msg);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const clearThread = () => {
    if (isGlobalChat) {
      setInspirationMessages([]);
      toast.success('Conversation cleared');
    } else {
      clearChat();
      toast.success('Cleared');
    }
  };

  const hasMessages = activeMessages.length > 0;
  const contextLabel = inferredContext?.label
    ? `Context: ${inferredContext.label}`
    : 'Context: General design';

  if (isGlobalChat) {
    return (
      <>
        <Helmet>
          <title>Design Inspiration Assistant — Vision Studio</title>
          <meta
            name="description"
            content="General interior and exterior design inspiration before you start a project in Vision Studio."
          />
        </Helmet>

        <div className="flex flex-col bg-[#f6f3ee] text-[#171717] h-[calc(100vh-4rem)]">
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
            <div className="mx-auto max-w-4xl px-6 py-5 md:px-10 space-y-5">
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="pt-2 pb-1"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sienna-400 to-sienna-600 grid place-items-center shadow-sm shrink-0">
                    <span className="text-[11px] text-paper-50 font-bold font-display">V</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-vs-accent mb-0.5">
                      Vision Studio
                    </p>
                    <h1 className="font-display text-xl md:text-2xl text-[#171717] leading-tight">
                      Design Inspiration Assistant
                    </h1>
                    <p className="mt-1.5 text-sm text-[#5b5b5b] max-w-2xl leading-relaxed">
                      Ask for style ideas, layout inspiration, furniture guidance, or help planning a new space.
                    </p>
                    <p className="mt-1 text-[11px] text-[#8a857d] leading-relaxed max-w-2xl">
                      General guidance only — open a project in Studio to edit floors, rooms, and furniture.
                    </p>
                  </div>
                </div>
              </motion.div>

              {!hasMessages && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="text-center py-6"
                >
                  <div className="mb-8">
                    <p className="eyebrow text-ink-400 mb-3">Style filters</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {GLOBAL_STYLE_CHIPS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => sendGlobalInspiration(`Give me ${s} design inspiration.`)}
                          disabled={sending}
                          className="text-[10px] uppercase tracking-editorial rounded-full px-3.5 py-1.5 border border-[rgba(0,0,0,0.08)] bg-[#f8f8f6] text-[#5b5b5b] hover:border-[#004aad]/45 hover:text-[#171717] hover:bg-[#eef4f7] transition disabled:opacity-40"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {GLOBAL_PROMPTS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => sendGlobalInspiration(p)}
                        disabled={sending}
                        className="text-left p-4 rounded-xl border border-[rgba(0,0,0,0.08)] bg-[#f8f8f6] hover:bg-[#eef4f7] hover:border-[#004aad]/35 hover:shadow-sm transition-all text-sm text-[#2d2d2d] disabled:opacity-40"
                      >
                        {p}
                      </button>
                    ))}
                  </div>

                  <div className="mt-12 pt-10 border-t border-[rgba(0,0,0,0.06)]">
                    <p className="text-sm text-[#2d2d2d] font-medium mb-4">Ready to design your own space?</p>
                    <div className="flex flex-wrap justify-center gap-3">
                      <Link to="/studio/new" className="btn-ink text-[11px] px-6 py-2.5 inline-flex">
                        Start a new project
                      </Link>
                      <Link to="/studio" className="btn-ghost text-[11px] px-6 py-2.5 inline-flex border border-[rgba(0,0,0,0.12)]">
                        Open existing projects
                      </Link>
                    </div>
                  </div>
                </motion.div>
              )}

              <AnimatePresence initial={false}>
                {inspirationMessages.map((m, i) => (
                  <div key={m.id} className="space-y-2">
                    <MessageBubble message={m} isLast={i === inspirationMessages.length - 1} />
                    {Array.isArray(m.routeOptions) && m.routeOptions.length > 0 && (
                      <div className="ml-8 flex flex-wrap gap-2">
                        {m.routeOptions.slice(0, 4).map((opt) => (
                          <button
                            key={`${m.id}-${opt.to}-${opt.label}`}
                            type="button"
                            onClick={() => navigate(opt.to)}
                            className="text-[11px] rounded-full border border-[rgba(0,0,0,0.12)] bg-[#fffdf9] px-3.5 py-1.5 text-[#2d2d2d] hover:border-[#004aad]/40 hover:text-[#003a86] transition"
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </AnimatePresence>

              {sending && (
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-sienna-400 to-sienna-600 grid place-items-center shrink-0">
                    <span className="text-[9px] text-paper-50 font-bold">V</span>
                  </div>
                  <div className="bg-[#f8f8f6] border border-[rgba(0,0,0,0.08)] px-4 py-3 rounded-2xl rounded-bl-md flex items-center gap-1.5">
                    <span className="typing-dot" style={{ animationDelay: '0ms' }} />
                    <span className="typing-dot" style={{ animationDelay: '150ms' }} />
                    <span className="typing-dot" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
            </div>
          </div>

          <footer className="shrink-0 border-t border-[rgba(0,0,0,0.08)] bg-[#eef4f7] sticky bottom-0">
            <div className="mx-auto max-w-4xl px-6 py-3 md:px-10 space-y-2">
              <div className="relative flex items-center justify-start">
                <button
                  type="button"
                  onClick={() => setContextOpen((v) => !v)}
                  className="text-[10px] uppercase tracking-editorial rounded-full border border-[rgba(0,0,0,0.14)] bg-paper-50 px-3 py-1.5 text-[#5b5b5b] hover:border-[#004aad]/35 hover:text-[#003a86]"
                >
                  {contextLabel}
                </button>
                {contextOpen && (
                  <>
                    <button
                      type="button"
                      aria-label="Close context popover"
                      className="fixed inset-0 z-40"
                      onClick={() => setContextOpen(false)}
                    />
                    <div className="absolute left-0 bottom-full mb-2 w-[min(92vw,420px)] rounded-xl border border-[rgba(0,0,0,0.12)] bg-[#fffdf9] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.08)] z-50">
                      <p className="text-xs text-[#2d2d2d] leading-relaxed">
                        This chat gives general design guidance. To directly edit rooms, furniture, or floorplans, open the project in Studio.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {inferredContext?.projectId ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setContextOpen(false);
                                navigate(`/studio/project/${inferredContext.projectId}`);
                              }}
                              className="text-[10px] rounded-full border border-[rgba(0,0,0,0.12)] px-3 py-1.5 hover:border-[#004aad]/40"
                            >
                              Open project
                            </button>
                            {inferredContext.spaceId && (
                              <button
                                type="button"
                                onClick={() => {
                                  setContextOpen(false);
                                  navigate(`/studio/project/${inferredContext.projectId}/editor/${inferredContext.spaceId}`);
                                }}
                                className="text-[10px] rounded-full border border-[rgba(0,0,0,0.12)] px-3 py-1.5 hover:border-[#004aad]/40"
                              >
                                Open space in Studio
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setContextOpen(false);
                                navigate('/studio/new');
                              }}
                              className="text-[10px] rounded-full border border-[rgba(0,0,0,0.12)] px-3 py-1.5 hover:border-[#004aad]/40"
                            >
                              Start new project
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setContextOpen(false);
                                navigate('/studio');
                              }}
                              className="text-[10px] rounded-full border border-[rgba(0,0,0,0.12)] px-3 py-1.5 hover:border-[#004aad]/40"
                            >
                              Open Studio
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
              {hasMessages && (
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={clearThread}
                    className="text-[10px] uppercase tracking-editorial text-[#5b5b5b] hover:text-[#171717] px-2 py-1 rounded hover:bg-paper-50/70"
                  >
                    Clear
                  </button>
                </div>
              )}
              {hasMessages && (
                <div className="flex flex-wrap gap-2">
                  {GLOBAL_PROMPTS.slice(0, 4).map((prompt) => (
                    <button
                      key={`chip-${prompt}`}
                      type="button"
                      onClick={() => sendGlobalInspiration(prompt)}
                      className="text-[10px] rounded-full border border-[rgba(0,0,0,0.1)] bg-paper-50 px-3 py-1 text-[#5b5b5b] hover:border-[#004aad]/35 hover:text-[#003a86]"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-end gap-3">
                <div className="flex-1 relative">
                  <textarea
                    ref={textareaRef}
                    className="w-full bg-[#f8f8f6] border border-[rgba(0,0,0,0.08)] rounded-2xl px-5 py-3.5 pr-14 text-sm text-[#171717] placeholder:text-[#5b5b5b] resize-none focus:outline-none focus:border-[#004aad]/45 focus:ring-2 focus:ring-[#004aad]/15 transition min-h-[52px] max-h-[160px]"
                    placeholder="Ask for design inspiration, layout ideas, furniture guidance, or help starting a project..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={sending}
                    rows={1}
                  />
                  {input.length > 0 && (
                    <span className="absolute right-4 bottom-3 text-[10px] text-ink-400">{input.length}</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => sendGlobalInspiration(input)}
                  disabled={!input.trim() || sending}
                  className="shrink-0 w-12 h-12 rounded-2xl bg-ink-900 text-paper-50 grid place-items-center transition hover:bg-ink-700 disabled:opacity-30 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-sienna-500 shadow-sm"
                  aria-label="Send message"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
              <p className="text-[10px] text-ink-400 mt-3 px-1 text-right sm:text-right">
                Enter to send · Shift+Enter for new line
              </p>
            </div>
          </footer>
        </div>
      </>
    );
  }

  /* ---------- Project-scoped chat (/studio/project/:projectId/chat) ---------- */

  return (
    <>
      <Helmet>
        <title>Project Assistant — Vision Studio</title>
        <meta name="description" content="Vision Studio assistant — project-wide planning or space editing modes." />
      </Helmet>

      <div
        className={`flex bg-[#f6f3ee] text-[#171717] ${
          routeProjectId ? 'min-h-[100dvh] h-[100dvh]' : 'h-[calc(100vh-4rem)]'
        }`}
      >
        <div className="flex-1 flex flex-col min-w-0">
          <div className="h-14 border-b border-[rgba(0,0,0,0.08)] flex items-center justify-between px-6 bg-[#eef4f7] shrink-0">
            <div className="flex flex-wrap gap-3 mr-2 shrink-0 hidden sm:flex">
              <Link
                to={`/studio/project/${routeProjectId}`}
                className="text-[10px] uppercase tracking-editorial text-vs-accent hover:text-[#003a86]"
              >
                ← Project hub
              </Link>
              <Link
                to={`/studio/project/${routeProjectId}/vision`}
                className="text-[10px] uppercase tracking-editorial text-vs-accent hover:text-[#003a86]"
              >
                Project Vision Assistant
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sienna-400 to-sienna-600 grid place-items-center shadow-sm">
                <span className="text-sm text-paper-50 font-bold">V</span>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-vs-accent mb-0.5">
                  Project-wide chat
                </div>
                <div className="font-display text-base leading-tight text-[#171717]">
                  {scopedProjectMeta?.name ? `${scopedProjectMeta.name} · Project Assistant` : 'Project Assistant'}
                </div>
                <div className="text-[10px] uppercase tracking-editorial text-[#5b5b5b] flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${sending ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                  {sending ? 'Thinking…' : room ? room.name : 'No space selected'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {(rooms.length > 0 || room) && (
                <select
                  value={selectedRoomId || room?.id || ''}
                  onChange={(e) => {
                    setSelectedRoomId(e.target.value);
                    clearChat();
                  }}
                  className="text-[11px] bg-[#f8f8f6] border border-[rgba(0,0,0,0.08)] rounded-lg px-3 py-1.5 text-[#171717] focus:outline-none max-w-[160px]"
                >
                  {room?.id?.startsWith('draft-') && (
                    <option value={room.id}>{room.name} (draft space)</option>
                  )}
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              )}
              <select
                value={chatContext}
                onChange={(e) => setChatContext(e.target.value)}
                className="text-[11px] bg-[#f8f8f6] border border-[rgba(0,0,0,0.08)] rounded-lg px-3 py-1.5 text-[#171717] focus:outline-none max-w-[170px]"
              >
                <option value="whole_project">Whole Project</option>
                <option value="interior">Interior</option>
                <option value="exterior">Exterior</option>
                <option value="current_space">Current Space</option>
              </select>
              {hasMessages && (
                <button
                  type="button"
                  onClick={clearThread}
                  className="text-[10px] uppercase tracking-editorial text-[#5b5b5b] hover:text-[#171717] transition px-2 py-1.5 rounded hover:bg-[#eef4f7]"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          <div className="border-t border-[rgba(0,0,0,0.08)] px-6 py-2 flex flex-wrap items-center gap-2 bg-[#f8f8f6]">
            <span className="text-[10px] text-[#5b5b5b] leading-snug max-w-3xl">
              Same assistant as elsewhere — project mode for broad questions. Use Project Vision Assistant for structured
              goals; Space Assistant in the editor for the selected room.
            </span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#5b5b5b]">Current Context:</span>
            <span className="text-[10px] uppercase tracking-[0.2em] rounded-full border border-[rgba(0,0,0,0.08)] px-2.5 py-1 bg-[#eef4f7] text-vs-accent">
              {chatContext === 'whole_project'
                ? 'Whole Project'
                : chatContext === 'interior'
                  ? 'Interior'
                  : chatContext === 'exterior'
                    ? 'Exterior'
                    : 'Current Space'}
            </span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#5b5b5b]">
              AI suggestions based on project context
            </span>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            <div className="mx-auto px-6 py-8 space-y-5 max-w-3xl">
              {!hasMessages && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="text-center py-8"
                >
                  <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-sienna-400 to-sienna-600 grid place-items-center shadow-lg">
                    <span className="text-xl text-paper-50 font-display">V</span>
                  </div>
                  <h2 className="display-md mb-2">Describe what you want to improve.</h2>
                  <p className="text-[#2d2d2d] max-w-2xl mx-auto text-sm mb-8 leading-relaxed">
                    Ask about layout, furniture, atmosphere, flow, materials, or exterior design.
                    Use project vision when suggesting furniture, layout, and exterior flow.
                  </p>

                  <div className="mb-6">
                    <div className="eyebrow text-ink-400 mb-3">Set your style</div>
                    <div className="flex flex-wrap justify-center gap-2">
                      {PROJECT_STYLE_CHIPS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => sendProjectChat(`I prefer a ${s.toLowerCase()} style. Keep this in mind for all suggestions.`)}
                          className="text-[10px] uppercase tracking-editorial rounded-full px-3.5 py-1.5 border border-[rgba(0,0,0,0.08)] bg-[#f8f8f6] text-[#5b5b5b] hover:border-[#004aad]/45 hover:text-[#171717] hover:bg-[#eef4f7] transition"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-2.5 grid-cols-2 md:grid-cols-4">
                    {PROJECT_QUICK_PROMPTS.map((p) => (
                      <button
                        key={p.text}
                        type="button"
                        onClick={() => sendProjectChat(p.text)}
                        className="text-left p-3.5 rounded-xl border border-[rgba(0,0,0,0.08)] bg-[#f8f8f6] hover:bg-[#eef4f7] hover:border-[#004aad]/35 hover:shadow-sm transition-all group"
                      >
                        <span className="text-base mb-1.5 block">{p.icon}</span>
                        <span className="text-xs text-[#5b5b5b] group-hover:text-[#171717] transition leading-snug">
                          {p.text}
                        </span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              <AnimatePresence initial={false}>
                {chatHistory.map((m, i) => (
                  <MessageBubble key={m.id} message={m} isLast={i === chatHistory.length - 1} />
                ))}
              </AnimatePresence>

              {sending && (
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-sienna-400 to-sienna-600 grid place-items-center shrink-0">
                    <span className="text-[9px] text-paper-50 font-bold">V</span>
                  </div>
                  <div className="bg-[#f8f8f6] border border-[rgba(0,0,0,0.08)] px-4 py-3 rounded-2xl rounded-bl-md flex items-center gap-1.5">
                    <span className="typing-dot" style={{ animationDelay: '0ms' }} />
                    <span className="typing-dot" style={{ animationDelay: '150ms' }} />
                    <span className="typing-dot" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-[rgba(0,0,0,0.08)] bg-[#eef4f7] shrink-0">
            <div className="mx-auto px-6 py-4 max-w-3xl">
              <div className="flex items-end gap-3">
                <div className="flex-1 relative">
                  <textarea
                    ref={textareaRef}
                    className="w-full bg-[#f8f8f6] border border-[rgba(0,0,0,0.08)] rounded-2xl px-5 py-3.5 pr-14 text-sm text-[#171717] placeholder:text-[#5b5b5b] resize-none focus:outline-none focus:border-[#004aad]/45 focus:ring-2 focus:ring-[#004aad]/15 transition min-h-[52px] max-h-[160px]"
                    placeholder={
                      room
                        ? 'Describe your space goals, ask for furniture, or request a layout change…'
                        : 'Select a space to start…'
                    }
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={!room || sending}
                    rows={1}
                  />
                  {input.length > 0 && (
                    <span className="absolute right-4 bottom-3 text-[10px] text-ink-400">{input.length}</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => sendProjectChat(input)}
                  disabled={!input.trim() || !room || sending}
                  className="shrink-0 w-12 h-12 rounded-2xl bg-ink-900 text-paper-50 grid place-items-center transition hover:bg-ink-700 disabled:opacity-30 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-sienna-500 shadow-sm"
                  aria-label="Send message"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
              <div className="flex items-center justify-between mt-2 px-1">
                <span className="text-[10px] text-ink-400">
                  {room ? (
                    <>
                      Space: <strong className="text-ink-600">{room.name}</strong> · {furniture.length} items
                    </>
                  ) : (
                    'No space selected'
                  )}
                </span>
                <span className="text-[10px] text-ink-400 hidden sm:inline">
                  Enter to send · Shift+Enter for new line
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
