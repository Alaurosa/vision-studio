import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useLayoutStore } from '@/store/layoutStore';
import MessageBubble from '@/components/chatbot/MessageBubble';
import StylePrompts from '@/components/chatbot/StylePrompts';

export default function Chat() {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);

  const {
    room, chatHistory, addChatMessage, clearChat,
    setRecommendedItems, loadRoom,
  } = useLayoutStore();

  // Load user's rooms
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const { data } = await api.get('/api/rooms');
        const list = Array.isArray(data) ? data : [];
        setRooms(list);
        // Auto-select first room if available
        if (list.length > 0 && !selectedRoomId) {
          setSelectedRoomId(list[0].id);
        }
      } catch {
        // Rooms couldn't be loaded — user might not be authenticated
      } finally {
        setLoadingRooms(false);
      }
    };
    fetchRooms();
  }, []);

  // Load selected room into store
  useEffect(() => {
    if (selectedRoomId) {
      loadRoom(selectedRoomId);
    }
  }, [selectedRoomId]);

  // Auto-scroll to bottom
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
    if (!room?.id || !text.trim()) {
      if (!room?.id) toast.error('Please select a room first');
      return;
    }
    addChatMessage({ role: 'user', content: text });
    setInput('');
    setSending(true);
    try {
      const { data } = await api.post('/api/chat/message', {
        room_id: room.id,
        message: text,
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

      const mutates = ['move_furniture', 'rotate_furniture', 'add_furniture',
        'remove_furniture', 'arrange_room', 'swap_furniture', 'furnish_room'];
      const didMutate = (data.actions || []).some((a) => mutates.includes(a.function));
      if (didMutate) await loadRoom(room.id);
    } catch (e) {
      addChatMessage({
        role: 'assistant',
        content: `Something went wrong: ${e?.response?.data?.error || e.message}`,
      });
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const hasMessages = chatHistory.length > 0;

  return (
    <>
      <Helmet>
        <title>AI Design Assistant — Vision Studio</title>
        <meta name="description" content="Chat with Vision Studio's AI assistant to get personalized interior design suggestions, furniture recommendations, and layout optimization." />
      </Helmet>

      <div className="h-[calc(100vh-4rem)] flex bg-paper-50">
        {/* Left sidebar — Style preferences & Room selector */}
        <aside className="hidden lg:flex w-[340px] border-r border-ink-900/10 flex-col bg-paper-50">
          {/* Room selector */}
          <div className="p-6 border-b border-ink-900/10">
            <div className="eyebrow mb-3">Active Room</div>
            {loadingRooms ? (
              <div className="h-10 bg-paper-200 rounded-lg animate-pulse" />
            ) : rooms.length === 0 ? (
              <div className="text-sm text-ink-500">
                <p className="mb-3 leading-relaxed">No rooms yet. Create one to start chatting with context.</p>
                <button
                  onClick={() => navigate('/studio')}
                  className="btn-ghost text-[10px] py-2 px-4"
                >
                  Go to Studio
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                {rooms.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      setSelectedRoomId(r.id);
                      clearChat();
                    }}
                    className={`w-full text-left px-4 py-3 rounded-xl text-sm transition flex items-center justify-between group ${
                      selectedRoomId === r.id
                        ? 'bg-ink-900 text-paper-50'
                        : 'bg-paper-100 hover:bg-paper-200 text-ink-900 border border-ink-900/8'
                    }`}
                  >
                    <div>
                      <div className="font-medium truncate">{r.name}</div>
                      <div className={`text-[10px] uppercase tracking-editorial mt-0.5 ${
                        selectedRoomId === r.id ? 'text-paper-300' : 'text-ink-500'
                      }`}>
                        {r.width ? `${Math.round(r.width / 12)}' × ${Math.round(r.depth / 12)}'` : 'Unsized'} · {r.placements?.length || 0} items
                      </div>
                    </div>
                    {selectedRoomId === r.id && (
                      <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Style preferences */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="eyebrow mb-4">Style Preferences</div>
            <StylePrompts onSend={send} />
          </div>

          {/* Open in Studio link */}
          {room && (
            <div className="p-4 border-t border-ink-900/10">
              <button
                onClick={() => navigate(`/studio/${room.id}`)}
                className="w-full btn-ghost text-[10px] py-2.5"
              >
                Open in Studio Editor →
              </button>
            </div>
          )}
        </aside>

        {/* Main chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Chat header */}
          <div className="h-16 border-b border-ink-900/10 flex items-center justify-between px-6 bg-paper-50 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sienna-400 to-sienna-600 grid place-items-center shadow-sm">
                <span className="text-sm text-paper-50 font-bold">V</span>
              </div>
              <div>
                <div className="font-display text-lg leading-tight">AI Design Assistant</div>
                <div className="text-[10px] uppercase tracking-editorial text-ink-500 mt-0.5 flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${sending ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                  {sending ? 'Thinking…' : room ? `Connected to ${room.name}` : 'No room selected'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Mobile room selector */}
              {rooms.length > 0 && (
                <select
                  value={selectedRoomId || ''}
                  onChange={(e) => {
                    setSelectedRoomId(e.target.value);
                    clearChat();
                  }}
                  className="lg:hidden text-[11px] bg-paper-100 border border-ink-900/10 rounded-lg px-3 py-2 text-ink-900 focus:outline-none focus:border-ink-900/30"
                >
                  <option value="">Select room…</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              )}
              {hasMessages && (
                <button
                  onClick={() => {
                    clearChat();
                    toast.success('Conversation cleared');
                  }}
                  className="text-[10px] uppercase tracking-editorial text-ink-500 hover:text-ink-900 transition px-3 py-2 rounded-lg hover:bg-ink-900/5"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Messages area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-6 py-8 space-y-5">
              {/* Empty state */}
              {!hasMessages && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="text-center py-12"
                >
                  <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-sienna-400 to-sienna-600 grid place-items-center shadow-lg">
                    <span className="text-2xl text-paper-50 font-display">V</span>
                  </div>
                  <h2 className="display-md mb-3">How can I help design your space?</h2>
                  <p className="text-ink-500 max-w-md mx-auto leading-relaxed text-sm mb-8">
                    Describe your room goals, style preferences, or ask me to arrange furniture.
                    I can search catalogs, place items, and optimize your entire layout.
                  </p>

                  {/* Quick start prompts — visible on mobile (sidebar hidden) */}
                  <div className="lg:hidden">
                    <StylePrompts onSend={send} compact />
                  </div>

                  {/* Desktop: show a few popular prompts inline */}
                  <div className="hidden lg:grid grid-cols-2 gap-3 max-w-lg mx-auto">
                    {[
                      { icon: '🏠', text: 'Furnish this room as a living room' },
                      { icon: '🎨', text: 'I want a Scandinavian style' },
                      { icon: '📐', text: 'Auto-arrange everything' },
                      { icon: '💡', text: 'Suggest furniture under $500' },
                    ].map((prompt) => (
                      <button
                        key={prompt.text}
                        onClick={() => send(prompt.text)}
                        className="text-left p-4 rounded-xl border border-ink-900/8 hover:border-ink-900/25 hover:shadow-sm transition-all group"
                      >
                        <span className="text-lg mb-2 block">{prompt.icon}</span>
                        <span className="text-sm text-ink-700 group-hover:text-ink-900 transition leading-snug">
                          {prompt.text}
                        </span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Message list */}
              <AnimatePresence initial={false}>
                {chatHistory.map((m, i) => (
                  <MessageBubble
                    key={m.id}
                    message={m}
                    isLast={i === chatHistory.length - 1}
                  />
                ))}
              </AnimatePresence>

              {/* Typing indicator */}
              {sending && (
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-sienna-400 to-sienna-600 grid place-items-center shrink-0">
                    <span className="text-[10px] text-paper-50 font-bold">V</span>
                  </div>
                  <div className="bg-paper-100 border border-ink-900/10 px-5 py-3.5 rounded-2xl rounded-bl-md flex items-center gap-1.5">
                    <span className="typing-dot" style={{ animationDelay: '0ms' }} />
                    <span className="typing-dot" style={{ animationDelay: '150ms' }} />
                    <span className="typing-dot" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Input area */}
          <div className="border-t border-ink-900/10 bg-paper-50 shrink-0">
            <div className="max-w-3xl mx-auto px-6 py-4">
              <div className="flex items-end gap-3">
                <div className="flex-1 relative">
                  <textarea
                    ref={textareaRef}
                    className="w-full bg-paper-100 border border-ink-900/10 rounded-2xl px-5 py-3.5 pr-14 text-sm text-ink-900 placeholder:text-ink-400 resize-none focus:outline-none focus:border-ink-900/25 focus:ring-2 focus:ring-ink-900/5 transition min-h-[52px] max-h-[160px]"
                    placeholder={room ? 'Describe your room goals and style preferences…' : 'Select a room above to start chatting…'}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={!room || sending}
                    rows={1}
                    id="chat-page-input"
                  />
                  {input.length > 0 && (
                    <span className="absolute right-4 bottom-3 text-[10px] text-ink-400">
                      {input.length}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => send(input)}
                  disabled={!input.trim() || !room || sending}
                  className="shrink-0 w-12 h-12 rounded-2xl bg-ink-900 text-paper-50 grid place-items-center transition hover:bg-ink-700 disabled:opacity-30 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-sienna-500 shadow-sm"
                  aria-label="Send message"
                  id="chat-page-send"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
              <div className="flex items-center justify-between mt-2.5 px-1">
                <span className="text-[10px] text-ink-400">
                  {room ? (
                    <>Connected to <strong className="text-ink-600">{room.name}</strong></>
                  ) : 'Select a room to get started'}
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
