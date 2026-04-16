import { useState, useRef, useEffect } from 'react';
import api from '../../lib/api';
import { useLayoutStore } from '../../store/layoutStore';

const QUICK_ACTIONS = [
  { label: 'Validate layout', icon: '✓', message: 'Check my layout for any issues', color: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20' },
  { label: 'Suggest furniture', icon: '💡', message: 'What furniture would you recommend for this room?', color: 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20' },
];

const STYLE_PRESETS = [
  { label: 'Open', icon: '🏠', style: 'open', desc: 'Maximizes walking space' },
  { label: 'Cozy', icon: '🛋️', style: 'cozy', desc: 'Warm and intimate feel' },
  { label: 'Functional', icon: '⚙️', style: 'functional', desc: 'Optimized for daily use' },
  { label: 'Minimal', icon: '✦', style: 'minimal', desc: 'Clean, less is more' },
  { label: 'Social', icon: '👥', style: 'social', desc: 'Great for entertaining' },
];

export default function ChatPanel({ roomId }) {
  const { chatHistory, addChatMessage, setRecommendedItems } = useLayoutStore();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const sendMessage = async (messageText) => {
    const text = typeof messageText === 'string' ? messageText : input.trim();
    if (!text || sending) return;

    // If called from form submit, prevent default
    if (messageText?.preventDefault) {
      messageText.preventDefault();
      if (!input.trim()) return;
    }

    const userMsg = { role: 'user', content: text, timestamp: new Date().toISOString() };
    addChatMessage(userMsg);
    setInput('');
    setSending(true);

    try {
      const { data } = await api.post('/api/chat/message', {
        room_id: roomId,
        message: text,
      });

      addChatMessage({
        role: 'assistant',
        content: data.message,
        timestamp: new Date().toISOString(),
        actions: data.actions,
      });

      // Push suggestions to catalog panel as recommendations
      if (data.actions?.length > 0) {
        const suggestions = data.actions
          .filter(a => (a.function === 'suggest_furniture' || a.function === 'furnish_room') && a.result?.suggestions)
          .flatMap(a => a.result.suggestions);
        if (suggestions.length > 0) {
          setRecommendedItems(suggestions);
        }
      }

      // Refresh room state when agent made changes
      if (data.actions?.length > 0 || data.refresh) {
        useLayoutStore.getState().loadRoom(roomId);
      }
    } catch (err) {
      addChatMessage({
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="w-[320px] shrink-0 bg-slate-900/70 border-l border-white/10 flex flex-col">
      <div className="p-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Design Agent</h2>
            <p className="text-xs text-slate-500 leading-tight">Arrange, move, add & optimize</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
        {chatHistory.length === 0 && (
          <div className="text-center py-4 px-1">
            <div className="w-12 h-12 mx-auto mb-3 rounded-3xl bg-gradient-to-br from-brand-500/20 to-purple-500/20 border border-brand-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-200 mb-0.5">Your AI design assistant</p>
            <p className="text-xs text-slate-500 mb-3 leading-relaxed">
              I can arrange furniture, suggest layouts, and modify your room directly.
            </p>

            {/* Style presets */}
            <div className="mb-3">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Auto-Arrange Style</p>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {STYLE_PRESETS.map((preset) => (
                  <button
                    key={preset.style}
                    onClick={() => sendMessage(`Arrange all furniture in a ${preset.style} style`)}
                    disabled={sending}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition border bg-purple-500/10 border-purple-500/20 text-purple-400 hover:bg-purple-500/20 disabled:opacity-50"
                    title={preset.desc}
                  >
                    <span className="mr-0.5">{preset.icon}</span> {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-2 gap-2">
              {QUICK_ACTIONS.map((action, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(action.message)}
                  disabled={sending}
                  className={`text-left px-2.5 py-2 rounded-lg text-xs font-medium transition border disabled:opacity-50 ${action.color}`}
                >
                  <span className="text-sm mr-1">{action.icon}</span>
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {chatHistory.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-950 text-slate-200 border border-white/10'
              }`}
            >
              {msg.content}
              {msg.actions?.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/10 space-y-1">
                  {msg.actions.map((a, j) => (
                    <p key={j} className={`text-xs ${a.result?.success !== false ? 'text-green-400' : 'text-red-400'}`}>
                      {a.result?.success !== false ? '✓' : '✗'} {a.result?.message || a.function}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-slate-950 rounded-xl px-3 py-2.5 text-sm text-slate-400 border border-white/10 flex items-center gap-2">
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
              Thinking...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={(e) => { e.preventDefault(); sendMessage(input.trim()); }} className="p-3 border-t border-white/10 bg-slate-950/50">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tell me what to do..."
            disabled={sending}
            className="flex-1 border border-white/10 rounded-lg px-3 py-2 text-sm bg-slate-900/70 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent disabled:opacity-50 placeholder:text-slate-500"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="bg-slate-800 text-white p-2 rounded-lg hover:bg-slate-700 transition disabled:opacity-30 shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.769 59.769 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
        <p className="text-[10px] text-slate-500 mt-1.5 text-center">Powered by Codex 5.3 · Can execute layout changes</p>
      </form>
    </div>
  );
}
