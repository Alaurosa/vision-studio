import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';
import { useLayoutStore } from '@/store/layoutStore';

const QUICK_ACTIONS = [
  { label: 'Make Modern', prompt: 'Transform this room into a modern, minimalist design with clean lines and contemporary furniture' },
  { label: 'Add Storage', prompt: 'Add practical storage solutions like bookshelves, cabinets, and organizers to maximize space' },
  { label: 'Luxury Upgrade', prompt: 'Upgrade to luxury furniture with premium materials, elegant proportions, and sophisticated styling' },
  { label: 'Better Flow', prompt: 'Rearrange furniture to improve traffic flow and create better pathways through the room' },
  { label: 'Minimalist Theme', prompt: 'Simplify the design with fewer pieces, neutral colors, and clean, uncluttered aesthetics' },
  { label: 'Cozy Reading', prompt: 'Create a comfortable reading nook with armchair, side table, and good lighting' },
  { label: 'Entertainment Hub', prompt: 'Design around a TV/media center with comfortable seating and optimal viewing angles' },
  { label: 'Workspace Setup', prompt: 'Set up an ergonomic home office with desk, chair, storage, and proper lighting' }
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
      <div className="p-5 border-b border-surface-700">
        <div className="eyebrow text-surface-300 mb-2">Command Assistant</div>
        <div className="font-display text-lg text-surface-100">Transform your space</div>
        <p className="text-xs text-surface-400 mt-2 leading-relaxed">
          Tell me what you want to change — I'll suggest furniture, rearrange pieces, and optimize your layout.
        </p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
        {chatHistory.length === 0 && (
          <div className="space-y-3">
            <div className="eyebrow text-surface-400 mb-3">Quick Commands</div>
            <div className="grid grid-cols-1 gap-2">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  onClick={() => send(action.prompt)}
                  className="w-full text-left text-sm border border-surface-600 bg-surface-700 hover:bg-blue-600 hover:border-blue-600 text-surface-200 hover:text-white px-4 py-3 rounded-lg transition-all duration-200 hover:shadow-lg"
                >
                  <div className="font-medium">{action.label}</div>
                  <div className="text-xs opacity-75 mt-1">{action.prompt.slice(0, 60)}...</div>
                </button>
              ))}
            </div>
            <div className="text-xs text-surface-500 text-center mt-4">
              Or type your own command below
            </div>
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
                    ? 'bg-blue-600 text-white'
                    : 'bg-surface-700 text-surface-100 border border-surface-600'
                }`}
              >
                {m.content}
                {!!m.actions?.length && (
                  <div className="mt-2 text-[10px] uppercase tracking-editorial opacity-70 text-surface-400">
                    {m.actions.length} action{m.actions.length > 1 ? 's' : ''} taken
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {sending && (
          <div className="flex justify-start">
            <div className="bg-surface-700 border border-surface-600 px-4 py-3 rounded-lg text-sm text-surface-300 flex items-center gap-1.5">
              <div className="flex gap-1">
                <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDuration: '0.6s' }} />
                <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDuration: '0.6s', animationDelay: '0.15s' }} />
                <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDuration: '0.6s', animationDelay: '0.3s' }} />
              </div>
              <span>Working...</span>
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="p-4 border-t border-surface-700 bg-surface-800"
      >
        <div className="flex items-center gap-2">
          <input
            className="input-field flex-1 bg-surface-700 border border-surface-600 text-surface-100 placeholder-surface-400 focus:ring-blue-500"
            placeholder={room ? 'Type a command (e.g., "add a dining table")…' : 'Select a room first'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={!room || sending}
          />
          <button
            type="submit"
            disabled={!input.trim() || !room || sending}
            className="btn-ink text-[10px] px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sending ? '...' : 'Send'}
          </button>
        </div>
      </form>
    </>
  );
}
