import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import RoomSetupModal from '@/components/studio/RoomSetupModal';
import ZoneBottomBar from '@/components/studio/ZoneBottomBar';
import ConfirmModal from '@/components/ConfirmModal';
import ErrorBoundary from '@/components/ErrorBoundary';
import MessageBubble from '@/components/chatbot/MessageBubble';
import { ROOM_TEMPLATES } from '@/utils/constants';
import { inchesToFeet } from '@/utils/scale';

const isDraftId = (id) => typeof id === 'string' && id.startsWith('draft-');

/* ── Fullscreen chat overlay shown when entering a room ── */
function FullscreenChat({ room, onMinimize }) {
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
            else if (action.function === 'furnish_room' && r.suggestions) { r.suggestions.forEach((item, idx) => store.addFurniture({ name: item.name, category: item.category, provider: item.provider, width: item.width, depth: item.depth, height: item.height, x_inches: 12, y_inches: 12, rotation: 0, color: '#d4a27a', image_url: item.image_url, model_url: item.model_url, _animDelay: 400 + idx * 500 })); }
          }
          const hasArrange = (data.actions || []).some(a => ['arrange_room', 'furnish_room'].includes(a.function) && a.result?.success);
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
                placeholder="Describe your room goals, style, or ask for furniture…" value={input}
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
              <span className="text-[10px] text-ink-400">{room.name} · {furniture.length} items</span>
              <span className="text-[10px] text-ink-400 hidden sm:inline">Enter to send</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Studio() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const {
    room, loadRoom, viewMode, isChatOpen, createRoom, createDraftRoom, clearDraft,
  } = useLayoutStore();
  const [showSetup, setShowSetup] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [chatFullscreen, setChatFullscreen] = useState(true);
  const draftRoom = useLayoutStore((s) => (isDraftId(s.room?.id) ? s.room : null));

  // Confirm modal state
  const [confirmTarget, setConfirmTarget] = useState(null);

  // Load the requested room, or show a dashboard/setup UI
  useEffect(() => {
    if (roomId) {
      loadRoom(roomId);
    } else if (user) {
      fetchRooms();
    } else {
      setRooms([]);
      setLoadingList(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, user]);

  const fetchRooms = async () => {
    setLoadingList(true);
    try {
      const { data } = await api.get('/api/rooms');
      setRooms(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error('Failed to load rooms');
    } finally {
      setLoadingList(false);
    }
  };

  const openRoom = (id) => navigate(`/studio/${id}`);

  const createAndEnter = async (payload) => {
    try {
      if (!user) {
        const draft = createDraftRoom(payload);
        navigate(`/studio/${draft.id}`);
        return;
      }
      const newRoom = await createRoom(payload);
      if (newRoom?.id) {
        toast.success(`Created "${payload.name}"`);
        navigate(`/studio/${newRoom.id}`);
      }
    } catch (e) {
      toast.error('Failed to create room');
    }
  };

  const deleteRoom = async (id) => {
    try {
      await api.delete(`/api/rooms/${id}`);
      setRooms((prev) => prev.filter((r) => r.id !== id));
      toast.success('Room deleted');
    } catch (err) {
      toast.error('Failed to delete room');
    }
  };

  const discardDraft = () => {
    if (!window.confirm('Discard your draft? This cannot be undone.')) return;
    clearDraft();
    toast.success('Draft discarded');
  };

  // -------- No room selected → dashboard --------
  if (!roomId) {
    const waitingForAuth = authLoading;
    const guest = !user && !authLoading;

    return (
      <>
        <Helmet>
          <title>Studio — Vision Studio</title>
        </Helmet>
        <div className="max-w-8xl mx-auto px-6 md:px-10 py-20">
          <p className="eyebrow mb-4">Studio</p>
          <div className="flex flex-wrap items-end justify-between gap-6 mb-12">
            <h1 className="display-lg max-w-3xl">
              {guest ? 'Start designing in seconds.' : 'Your rooms in progress.'}
            </h1>
            <button className="btn-ink" onClick={() => setShowSetup(true)}>+ New Room</button>
          </div>

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
                <button className="btn-ink" onClick={() => openRoom(draftRoom.id)}>Continue editing →</button>
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
              <p className="text-ink-500 mb-8 max-w-lg leading-relaxed">
                No sign-in required. Pick a template to start from scratch, or upload a floorplan to design your real space.
                Save to your account whenever you're ready.
              </p>
              <div className="grid md:grid-cols-3 gap-6 mb-12">
                {ROOM_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => createAndEnter({ name: t.name, width: t.width, depth: t.depth, height: t.height })}
                    className="text-left panel p-8 hover:border-ink-900 transition group"
                  >
                    <div className="eyebrow mb-6 text-ink-500">Template</div>
                    <div className="display-md mb-3">{t.name}</div>
                    <div className="text-sm text-ink-500">
                      {inchesToFeet(t.width)} × {inchesToFeet(t.depth)}
                    </div>
                  </button>
                ))}
              </div>
              <div className="panel p-8 flex flex-wrap items-center justify-between gap-6">
                <div>
                  <div className="eyebrow mb-2 text-ink-500">Have a floorplan?</div>
                  <div className="display-md">Upload & auto-segment your rooms.</div>
                </div>
                <button className="btn-ink" onClick={() => navigate('/upload')}>Upload floorplan →</button>
              </div>
            </div>
          )}

          {/* Authed: existing "your rooms" flow */}
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
            ) : rooms.length === 0 ? (
              <div>
                <div className="text-center py-16 mb-12">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-paper-200 grid place-items-center">
                    <span className="text-3xl">🏠</span>
                  </div>
                  <h2 className="display-md mb-3">No rooms yet</h2>
                  <p className="text-ink-500 mb-8 max-w-md mx-auto leading-relaxed">
                    Pick a template below to get started, or create a custom room with your own dimensions.
                  </p>
                </div>
                <p className="eyebrow mb-4">Quick Start Templates</p>
                <div className="grid md:grid-cols-3 gap-6">
                  {ROOM_TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => createAndEnter({ name: t.name, width: t.width, depth: t.depth, height: t.height })}
                      className="text-left panel p-8 hover:border-ink-900 transition group"
                    >
                      <div className="eyebrow mb-6 text-ink-500">Template</div>
                      <div className="display-md mb-3">{t.name}</div>
                      <div className="text-sm text-ink-500">
                        {inchesToFeet(t.width)} × {inchesToFeet(t.depth)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid md:grid-cols-3 gap-6">
                {rooms.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => openRoom(r.id)}
                    className="text-left panel p-8 hover:border-ink-900 transition group relative"
                  >
                    <div className="eyebrow mb-6 text-ink-500">
                      {r.placements?.length || 0} item{(r.placements?.length || 0) !== 1 ? 's' : ''}
                    </div>
                    <div className="display-md mb-3">{r.name}</div>
                    <div className="text-sm text-ink-500">
                      {r.width ? `${inchesToFeet(r.width)} × ${inchesToFeet(r.depth)}` : 'Unsized'}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmTarget(r);
                      }}
                      className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] uppercase tracking-editorial px-3 py-1.5 rounded-full border border-red-300 text-red-600 hover:bg-red-600 hover:text-white"
                      aria-label={`Delete ${r.name}`}
                    >
                      Delete
                    </button>
                  </button>
                ))}
              </div>
            )
          )}

          {waitingForAuth && (
            <div className="text-ink-500 eyebrow">Loading…</div>
          )}

          {showSetup && (
            <RoomSetupModal onClose={() => setShowSetup(false)} onCreate={createAndEnter} />
          )}

          <ConfirmModal
            open={!!confirmTarget}
            title={`Delete "${confirmTarget?.name}"?`}
            message="This room and all its furniture will be permanently deleted. This action cannot be undone."
            confirmLabel="Delete Room"
            danger
            onConfirm={() => {
              if (confirmTarget) deleteRoom(confirmTarget.id);
              setConfirmTarget(null);
            }}
            onCancel={() => setConfirmTarget(null)}
          />
        </div>
      </>
    );
  }

  // -------- Room selected → full editor --------
  if (!room) {
    return (
      <div className="h-[calc(100vh-4rem)] grid place-items-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-ink-300 border-t-ink-900 rounded-full animate-spin" />
          <span className="eyebrow text-ink-500">Loading room…</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{room.name || 'Untitled'} — Vision Studio</title>
      </Helmet>
      <div className="h-[calc(100vh-4rem)] flex flex-col bg-paper-100">
        <StudioToolbar onToggleCatalog={() => setCatalogOpen(!catalogOpen)} catalogOpen={catalogOpen}
          chatFullscreen={chatFullscreen} onToggleChatFullscreen={() => setChatFullscreen(f => !f)} />
        <div className="flex-1 flex overflow-hidden relative">

          {/* Fullscreen chat overlay — shown by default, hides when AI places furniture */}
          {chatFullscreen && (
            <div className="absolute inset-0 z-30 bg-paper-50 flex flex-col">
              <FullscreenChat room={room} onMinimize={() => setChatFullscreen(false)} />
            </div>
          )}

          {/* Catalog */}
          <aside className={`
            ${catalogOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            fixed md:relative z-20 md:z-auto inset-y-0 left-0
            w-[320px] border-r border-ink-900/10 bg-paper-50 overflow-y-auto
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
                className="hidden md:flex border-l border-ink-900/10 bg-paper-50 overflow-hidden flex-col">
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
              className="md:hidden fixed inset-x-0 bottom-0 top-16 z-40 bg-paper-50 flex flex-col border-t border-ink-900/10">
              <ChatPanel />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
