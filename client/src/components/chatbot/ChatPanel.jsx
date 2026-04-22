import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';
import { useLayoutStore } from '@/store/layoutStore';

const QUICK_ACTIONS = [
  'Auto-arrange the room',
  'Suggest a sofa under $600',
  'Validate my layout',
  'Make it feel open and minimal',
  'Add a reading corner',
];

export default function ChatPanel() {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);
  const {
    room, chatHistory, addChatMessage, setRecommendedItems, loadRoom,
  } = useLayoutStore();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [chatHistory]);

  const send = async (msg) => {
    if (!room?.id || !msg.trim()) return;
    addChatMessage({ role: 'user', content: msg });
    setInput('');
    setSending(true);
    try {
      const { data } = await api.post('/api/chat/message', {
        room_id: room.id,
        message: msg,
      });
      addChatMessage({
        role: 'assistant',
        content: data.message || '(no response)',
        actions: data.actions || [],
      });

      // Pick up any suggestions from suggest_furniture or furnish_room into the sidebar
      const suggestions = (data.actions || [])
        .filter((a) => ['suggest_furniture', 'furnish_room'].includes(a.function))
        .flatMap((a) => a.result?.suggestions || []);
      if (suggestions.length) setRecommendedItems(suggestions);

      // If the agent mutated layout, refresh from server
      const mutates = ['move_furniture', 'rotate_furniture', 'add_furniture',
        'remove_furniture', 'arrange_room', 'swap_furniture', 'furnish_room'];
      const didMutate = (data.actions || []).some((a) => mutates.includes(a.function));
      if (didMutate) await loadRoom(room.id);
    } catch (e) {
      addChatMessage({ role: 'assistant', content: `Error: ${e?.response?.data?.error || e.message}` });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="p-5 border-b border-ink-900/10">
        <div className="eyebrow mb-2">Studio Assistant</div>
        <div className="font-display text-lg">Your AI designer</div>
        <p className="text-xs text-ink-500 mt-2 leading-relaxed">
          Ask anything about your room — move pieces, auto-arrange, validate
          clearances, or get live furniture suggestions.
        </p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
        {chatHistory.length === 0 && (
          <div className="space-y-2">
            <div className="eyebrow text-ink-500 mb-3">Try asking</div>
            {QUICK_ACTIONS.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                className="w-full text-left text-sm border border-ink-900/10 px-4 py-3 rounded hover:bg-ink-900 hover:text-paper-50 transition"
              >
                {q}
              </button>
            ))}
          </div>
        )}
        <AnimatePresence initial={false}>
          {chatHistory.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
            >
              <div
                className={`max-w-[85%] px-4 py-3 rounded-lg text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-ink-900 text-paper-50'
                    : 'bg-paper-100 text-ink-900 border border-ink-900/10'
                }`}
              >
                {m.content}
                {!!m.actions?.length && (
                  <div className="mt-2 text-[10px] uppercase tracking-editorial opacity-70">
                    {m.actions.length} action{m.actions.length > 1 ? 's' : ''} taken
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {sending && (
          <div className="flex justify-start">
            <div className="bg-paper-100 border border-ink-900/10 px-4 py-3 rounded-lg text-sm text-ink-500 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 bg-ink-400 rounded-full animate-bounce" style={{ animationDuration: '0.6s' }} />
              <span className="inline-block w-2 h-2 bg-ink-400 rounded-full animate-bounce" style={{ animationDuration: '0.6s', animationDelay: '0.15s' }} />
              <span className="inline-block w-2 h-2 bg-ink-400 rounded-full animate-bounce" style={{ animationDuration: '0.6s', animationDelay: '0.3s' }} />
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="p-4 border-t border-ink-900/10 bg-paper-50"
      >
        <div className="flex items-center gap-2">
          <input
            className="input-field flex-1"
            placeholder={room ? 'Ask the Studio assistant…' : 'Select a room first'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={!room || sending}
          />
          <button
            type="submit"
            disabled={!input.trim() || !room || sending}
            className="btn-ink text-[10px] px-4 py-2"
          >Send</button>
        </div>
      </form>
    </>
  );
}
