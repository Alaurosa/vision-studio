import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useLayoutStore } from '@/store/layoutStore';
import MessageBubble from '@/components/chatbot/MessageBubble';

const QUICK_PROMPTS = [
  { icon: '✨', text: 'Give this house a warm luxury feel', category: 'style' },
  { icon: '🌿', text: 'Modernize the backyard', category: 'exterior' },
  { icon: '🛏️', text: 'Optimize bedroom layout', category: 'layout' },
  { icon: '🎨', text: 'Scandinavian interior with bold exterior', category: 'style' },
  { icon: '🏡', text: 'Improve curb appeal', category: 'exterior' },
];

const STYLE_CHIPS = [
  'Modern', 'Scandinavian', 'Industrial', 'Mid-Century',
  'Minimalist', 'Bohemian', 'Rustic', 'Japandi', 'Coastal',
];

export default function Chat() {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [chatContext, setChatContext] = useState('current_space');
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);

  const {
    room, chatHistory, addChatMessage, clearChat, furniture,
    setRecommendedItems, loadRoom,
  } = useLayoutStore();

  // Load rooms (server + draft)
  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await api.get('/api/rooms');
        const serverRooms = Array.isArray(data) ? data : [];
        setRooms(serverRooms);
        if (serverRooms.length > 0 && !selectedRoomId) {
          setSelectedRoomId(serverRooms[0].id);
        }
      } catch {
        // Not authenticated — check for draft room in store
      }
      // If we already have a draft room loaded, use it
      const storeRoom = useLayoutStore.getState().room;
      if (storeRoom?.id && !selectedRoomId) {
        setSelectedRoomId(storeRoom.id);
      }
    };
    fetch();
  }, []);

  useEffect(() => {
    if (selectedRoomId) loadRoom(selectedRoomId);
  }, [selectedRoomId]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      });
    }
  }, [chatHistory, sending]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  const send = async (msg) => {
    const text = typeof msg === 'string' ? msg : input;
    if (!text.trim()) return;
    if (!room?.id) { toast.error('Select or create a space first'); return; }

    addChatMessage({ role: 'user', content: text });
    setInput('');
    setSending(true);

    try {
      const isDraft = room.id?.startsWith?.('draft-');
      const { data } = await api.post('/api/chat/message', {
        room_id: room.id,
        message: text,
        project_id: null,
        space_id: null,
        context_type: chatContext,
        global_vision: null,
        space_vision: null,
        ...(isDraft && {
          room_context: {
            id: room.id, name: room.name, width: room.width, depth: room.depth,
            height: room.height || 96, unit: room.unit || 'inches',
            placements: furniture.map(f => ({
              id: f.id, name: f.name, category: f.category, provider: f.provider,
              width: f.width, depth: f.depth, height: f.height,
              x_inches: f.x_inches, y_inches: f.y_inches, rotation: f.rotation,
            })),
          },
        }),
      });

      addChatMessage({
        role: 'assistant',
        content: data.message || '(no response)',
        actions: data.actions || [],
      });

      // Pick up suggestions
      const suggestions = (data.actions || [])
        .filter(a => ['suggest_furniture', 'furnish_room'].includes(a.function))
        .flatMap(a => a.result?.suggestions || []);
      if (suggestions.length) setRecommendedItems(suggestions);

      // Apply mutations
      const mutatingTools = ['move_furniture', 'rotate_furniture', 'add_furniture',
        'remove_furniture', 'arrange_room', 'swap_furniture', 'furnish_room', 'clear_room'];
      const didMutate = (data.actions || []).some(a => mutatingTools.includes(a.function) && a.result?.success);

      if (didMutate) {
        if (isDraft) {
          // Apply mutations locally for draft rooms
          const store = useLayoutStore.getState();
          for (const action of (data.actions || [])) {
            const r = action.result;
            if (!r?.success) continue;
            if (action.function === 'add_furniture' && r.added_item) {
              const ai = r.added_item;
              store.addFurniture({ name: ai.name, category: ai.category, provider: ai.provider, width: ai.width, depth: ai.depth, height: ai.height, x_inches: ai.x_inches || 12, y_inches: ai.y_inches || 12, rotation: ai.rotation || 0, color: ai.color || '#d4a27a', image_url: ai.image_url, model_url: ai.model_url });
            } else if (['move_furniture', 'rotate_furniture'].includes(action.function)) {
              const name = action.args?.furniture_name?.toLowerCase();
              if (name) { const m = store.furniture.find(f => f.name?.toLowerCase().includes(name)); if (m) { const patch = {}; if (action.args.x_inches != null) patch.x_inches = action.args.x_inches; if (action.args.y_inches != null) patch.y_inches = action.args.y_inches; if (action.args.rotation != null) patch.rotation = action.args.rotation; store.updateFurniture(m.id, patch); } }
            } else if (action.function === 'remove_furniture') {
              const name = action.args?.furniture_name?.toLowerCase();
              if (name) { const m = store.furniture.find(f => f.name?.toLowerCase().includes(name)); if (m) store.removeFurniture(m.id); }
            } else if (action.function === 'clear_room') {
              for (const f of [...store.furniture]) store.removeFurniture(f.id);
            } else if (action.function === 'swap_furniture') {
              if (r.removed_name) { const m = store.furniture.find(f => f.name?.toLowerCase().includes(r.removed_name.toLowerCase())); if (m) store.removeFurniture(m.id); }
              if (r.added_item) { const ai = r.added_item; store.addFurniture({ name: ai.name, category: ai.category, provider: ai.provider, width: ai.width, depth: ai.depth, height: ai.height, x_inches: ai.x_inches || 12, y_inches: ai.y_inches || 12, rotation: ai.rotation || 0, color: '#d4a27a', image_url: ai.image_url, model_url: ai.model_url }); }
            } else if (action.function === 'furnish_room' && r.suggestions) {
              for (const item of r.suggestions) {
                store.addFurniture({ name: item.name, category: item.category, provider: item.provider, width: item.width, depth: item.depth, height: item.height, x_inches: 12, y_inches: 12, rotation: 0, color: '#d4a27a', image_url: item.image_url, model_url: item.model_url });
              }
            }
          }
          // Auto-arrange if needed
          const hasArrange = (data.actions || []).some(a => ['arrange_room', 'furnish_room'].includes(a.function) && a.result?.success);
          if (hasArrange) {
            try {
              const cur = useLayoutStore.getState().furniture;
              if (cur.length > 0) {
                const { data: arranged } = await api.post('/api/layout/auto-place', {
                  room_id: room.id, room_context: { id: room.id, name: room.name, width: room.width, depth: room.depth },
                  placements_context: cur.map(f => ({ id: f.id, name: f.name, category: f.category, width: f.width, depth: f.depth, height: f.height, x_inches: f.x_inches, y_inches: f.y_inches, rotation: f.rotation })),
                });
                for (const u of (arranged.placements || [])) {
                  const m = useLayoutStore.getState().furniture.find(f => f.name === u.name);
                  if (m) useLayoutStore.getState().updateFurniture(m.id, { x_inches: u.x_inches, y_inches: u.y_inches, rotation: u.rotation });
                }
              }
            } catch { /* best-effort */ }
          }
        } else {
          await loadRoom(room.id);
        }
      }
    } catch (e) {
      addChatMessage({ role: 'assistant', content: `Something went wrong: ${e?.response?.data?.error || e.message}` });
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  const hasMessages = chatHistory.length > 0;

  return (
    <>
      <Helmet>
        <title>AI Design Assistant — Vision Studio</title>
        <meta name="description" content="Chat with Vision Studio's AI to get furniture recommendations, layout optimization, and design advice." />
      </Helmet>

      <div className="h-[calc(100vh-4rem)] flex bg-[#f6f3ee] text-[#171717]">
        {/* Editor panel — only visible when minimized */}
        <AnimatePresence>
          {minimized && room && (
            <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: '55%', opacity: 1 }} exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden border-r border-[rgba(0,0,0,0.08)]">
              <div className="h-full flex flex-col">
                <div className="h-12 border-b border-[rgba(0,0,0,0.08)] flex items-center px-4 gap-3 shrink-0 bg-[#eef4f7]">
                  <span className="eyebrow text-ink-500">{room.name}</span>
                  <div className="flex-1" />
                  <button onClick={() => navigate(`/studio/${room.id}`)} className="text-[10px] uppercase tracking-editorial text-ink-500 hover:text-ink-900 transition">
                    Open Studio →
                  </button>
                </div>
                <div className="flex-1 bg-[#f8f8f6] grid place-items-center">
                  <div className="text-center p-8">
                    <div className="text-6xl mb-4 opacity-20">📐</div>
                    <p className="text-ink-500 text-sm">Space: {room.width ? `${Math.round(room.width/12)}' × ${Math.round(room.depth/12)}'` : 'Unsized'}</p>
                    <p className="text-ink-400 text-xs mt-1">{furniture.length} items placed</p>
                    <button onClick={() => navigate(`/studio/${room.id}`)} className="btn-ghost text-[10px] mt-4 py-2 px-4">
                      Edit in Studio
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat panel */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="h-14 border-b border-[rgba(0,0,0,0.08)] flex items-center justify-between px-6 bg-[#eef4f7] shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sienna-400 to-sienna-600 grid place-items-center shadow-sm">
                <span className="text-sm text-paper-50 font-bold">V</span>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-vs-accent mb-0.5">Design Conversation</div>
                <div className="font-display text-base leading-tight text-[#171717]">Design Assistant</div>
                <div className="text-[10px] uppercase tracking-editorial text-[#5b5b5b] flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${sending ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                  {sending ? 'Thinking…' : room ? room.name : 'No space selected'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Space selector */}
              {(rooms.length > 0 || room) && (
                <select value={selectedRoomId || room?.id || ''} onChange={(e) => { setSelectedRoomId(e.target.value); clearChat(); }}
                  className="text-[11px] bg-[#f8f8f6] border border-[rgba(0,0,0,0.08)] rounded-lg px-3 py-1.5 text-[#171717] focus:outline-none max-w-[160px]">
                  {room?.id?.startsWith('draft-') && <option value={room.id}>{room.name} (draft space)</option>}
                  {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
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
              {room && (
                <button onClick={() => setMinimized(!minimized)}
                  className="text-[10px] uppercase tracking-editorial px-3 py-1.5 rounded-full border border-[rgba(0,0,0,0.08)] text-[#5b5b5b] hover:border-[#004aad]/45 hover:text-[#171717] transition hidden md:inline-flex">
                  {minimized ? 'Full Chat' : 'Show Editor'}
                </button>
              )}
              {hasMessages && (
                <button onClick={() => { clearChat(); toast.success('Cleared'); }}
                  className="text-[10px] uppercase tracking-editorial text-[#5b5b5b] hover:text-[#171717] transition px-2 py-1.5 rounded hover:bg-[#eef4f7]">
                  Clear
                </button>
              )}
            </div>
          </div>
          <div className="border-t border-[rgba(0,0,0,0.08)] px-6 py-2 flex flex-wrap items-center gap-2 bg-[#f8f8f6]">
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#5b5b5b]">
              Current Context:
            </span>
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

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            <div className={`mx-auto px-6 py-8 space-y-5 ${minimized ? 'max-w-2xl' : 'max-w-3xl'}`}>
              {/* Empty state */}
              {!hasMessages && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="text-center py-8">
                  <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-sienna-400 to-sienna-600 grid place-items-center shadow-lg">
                    <span className="text-xl text-paper-50 font-display">V</span>
                  </div>
                  <h2 className="display-md mb-2">Describe what you want to improve.</h2>
                  <p className="text-[#2d2d2d] max-w-2xl mx-auto text-sm mb-8 leading-relaxed">
                    Ask about layout, furniture, atmosphere, flow, materials, or exterior design.
                    Use project vision when suggesting furniture, layout, and exterior flow.
                  </p>

                  {/* Style chips */}
                  <div className="mb-6">
                    <div className="eyebrow text-ink-400 mb-3">Set your style</div>
                    <div className="flex flex-wrap justify-center gap-2">
                      {STYLE_CHIPS.map(s => (
                        <button key={s} onClick={() => send(`I prefer a ${s.toLowerCase()} style. Keep this in mind for all suggestions.`)}
                          className="text-[10px] uppercase tracking-editorial rounded-full px-3.5 py-1.5 border border-[rgba(0,0,0,0.08)] bg-[#f8f8f6] text-[#5b5b5b] hover:border-[#004aad]/45 hover:text-[#171717] hover:bg-[#eef4f7] transition">
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quick prompts grid */}
                  <div className={`grid gap-2.5 ${minimized ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4'}`}>
                    {QUICK_PROMPTS.map(p => (
                      <button key={p.text} onClick={() => send(p.text)}
                        className="text-left p-3.5 rounded-xl border border-[rgba(0,0,0,0.08)] bg-[#f8f8f6] hover:bg-[#eef4f7] hover:border-[#004aad]/35 hover:shadow-sm transition-all group">
                        <span className="text-base mb-1.5 block">{p.icon}</span>
                        <span className="text-xs text-[#5b5b5b] group-hover:text-[#171717] transition leading-snug">{p.text}</span>
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

          {/* Input area */}
          <div className="border-t border-[rgba(0,0,0,0.08)] bg-[#eef4f7] shrink-0">
            <div className={`mx-auto px-6 py-4 ${minimized ? 'max-w-2xl' : 'max-w-3xl'}`}>
              <div className="flex items-end gap-3">
                <div className="flex-1 relative">
                  <textarea ref={textareaRef}
                    className="w-full bg-[#f8f8f6] border border-[rgba(0,0,0,0.08)] rounded-2xl px-5 py-3.5 pr-14 text-sm text-[#171717] placeholder:text-[#5b5b5b] resize-none focus:outline-none focus:border-[#004aad]/45 focus:ring-2 focus:ring-[#004aad]/15 transition min-h-[52px] max-h-[160px]"
                    placeholder={room ? 'Describe your space goals, ask for furniture, or request a layout change…' : 'Select a space to start…'}
                    value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
                    disabled={!room || sending} rows={1} />
                  {input.length > 0 && <span className="absolute right-4 bottom-3 text-[10px] text-ink-400">{input.length}</span>}
                </div>
                <button type="button" onClick={() => send(input)} disabled={!input.trim() || !room || sending}
                  className="shrink-0 w-12 h-12 rounded-2xl bg-ink-900 text-paper-50 grid place-items-center transition hover:bg-ink-700 disabled:opacity-30 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-sienna-500 shadow-sm"
                  aria-label="Send message">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
              <div className="flex items-center justify-between mt-2 px-1">
                <span className="text-[10px] text-ink-400">
                  {room ? <>Space: <strong className="text-ink-600">{room.name}</strong> · {furniture.length} items</> : 'No space selected'}
                </span>
                <span className="text-[10px] text-ink-400 hidden sm:inline">Enter to send · Shift+Enter for new line</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
