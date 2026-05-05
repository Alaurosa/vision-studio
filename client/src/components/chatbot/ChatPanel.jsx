import { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useLayoutStore } from '@/store/layoutStore';
import MessageBubble from './MessageBubble';
import StylePrompts from './StylePrompts';

export default function ChatPanel({
  projectId: projectIdProp = null,
  spaceId: spaceIdProp = null,
  spaceBranchType = null,
  globalVision: globalVisionProp = null,
  spaceVision: spaceVisionProp = null,
} = {}) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const {
    room, chatHistory, addChatMessage, clearChat,
    setRecommendedItems, loadRoom,
  } = useLayoutStore();

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
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const send = async (msg) => {
    const text = typeof msg === 'string' ? msg : input;
    if (!room?.id || !text.trim()) return;
    addChatMessage({ role: 'user', content: text });
    setInput('');
    setSending(true);
    try {
      const spaceVisionOut =
        spaceBranchType
          ? {
              ...(spaceVisionProp && typeof spaceVisionProp === 'object' ? spaceVisionProp : {}),
              space_type: spaceBranchType,
            }
          : spaceVisionProp && typeof spaceVisionProp === 'object'
            ? spaceVisionProp
            : null;
      const { data } = await api.post('/api/chat/message', {
        room_id: room.id,
        message: text,
        context_type: 'current_space',
        ...(projectIdProp && { project_id: projectIdProp }),
        ...(spaceIdProp && { space_id: spaceIdProp }),
        ...(globalVisionProp && typeof globalVisionProp === 'object' && { global_vision: globalVisionProp }),
        ...(spaceVisionOut && { space_vision: spaceVisionOut }),
        // For draft rooms, send room context since the server doesn't have it
        ...(room.id?.startsWith?.('draft-') && {
          room_context: {
            id: room.id,
            name: room.name,
            width: room.width,
            depth: room.depth,
            height: room.height || 96,
            unit: room.unit || 'inches',
            placements: useLayoutStore.getState().furniture.map(f => ({
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

      // Pick up catalog suggestions
      const suggestions = (data.actions || [])
        .filter((a) => ['suggest_furniture', 'furnish_room'].includes(a.function))
        .flatMap((a) => a.result?.suggestions || []);
      if (suggestions.length) setRecommendedItems(suggestions);

      // Apply mutations to the active space
      const mutatingTools = ['move_furniture', 'rotate_furniture', 'add_furniture',
        'remove_furniture', 'arrange_room', 'swap_furniture', 'furnish_room', 'clear_room'];
      const didMutate = (data.actions || []).some((a) => mutatingTools.includes(a.function) && a.result?.success);

      if (didMutate) {
        const isDraft = room.id?.startsWith?.('draft-');
        if (isDraft) {
          // Draft rooms: apply mutations locally from action results
          const store = useLayoutStore.getState();
          for (const action of (data.actions || [])) {
            const r = action.result;
            if (!r?.success) continue;
            switch (action.function) {
              case 'add_furniture': {
                const added = r.added_item;
                if (added) {
                  store.addFurniture({
                    name: added.name, category: added.category, provider: added.provider,
                    width: added.width, depth: added.depth, height: added.height,
                    x_inches: added.x_inches || 12, y_inches: added.y_inches || 12,
                    rotation: added.rotation || 0, color: added.color || '#d4a27a',
                    image_url: added.image_url, model_url: added.model_url,
                    _animDelay: 300,
                  });
                }
                break;
              }
              case 'move_furniture':
              case 'rotate_furniture': {
                // Find the item by name and update it
                const name = action.args?.furniture_name?.toLowerCase();
                if (name) {
                  const match = store.furniture.find(f => f.name?.toLowerCase().includes(name));
                  if (match) {
                    const patch = {};
                    if (action.args.x_inches != null) patch.x_inches = action.args.x_inches;
                    if (action.args.y_inches != null) patch.y_inches = action.args.y_inches;
                    if (action.args.rotation != null) patch.rotation = action.args.rotation;
                    store.updateFurniture(match.id, patch);
                  }
                }
                break;
              }
              case 'remove_furniture': {
                const name = action.args?.furniture_name?.toLowerCase();
                if (name) {
                  const match = store.furniture.find(f => f.name?.toLowerCase().includes(name));
                  if (match) store.removeFurniture(match.id);
                }
                break;
              }
              case 'clear_room':
                // Remove all furniture
                for (const f of [...store.furniture]) store.removeFurniture(f.id);
                break;
              case 'swap_furniture': {
                const removedName = r.removed_name?.toLowerCase();
                if (removedName) {
                  const match = store.furniture.find(f => f.name?.toLowerCase().includes(removedName));
                  if (match) store.removeFurniture(match.id);
                }
                const added = r.added_item;
                if (added) {
                  store.addFurniture({
                    name: added.name, category: added.category, provider: added.provider,
                    width: added.width, depth: added.depth, height: added.height,
                    x_inches: added.x_inches || 12, y_inches: added.y_inches || 12,
                    rotation: added.rotation || 0, color: added.color || '#d4a27a',
                    image_url: added.image_url, model_url: added.model_url,
                    _animDelay: 300,
                  });
                }
                break;
              }
              case 'furnish_room': {
                const items = r.suggestions || [];
                items.forEach((item, idx) => {
                  store.addFurniture({
                    name: item.name, category: item.category, provider: item.provider,
                    width: item.width, depth: item.depth, height: item.height,
                    x_inches: item.x_inches || 12, y_inches: item.y_inches || 12,
                    rotation: item.rotation || 0, color: '#d4a27a',
                    image_url: item.image_url, model_url: item.model_url,
                    _animDelay: 400 + idx * 500,
                  });
                });
                break;
              }
            }
          }
          // For arrange_room only (furnish_room already returns arranged positions)
          const hasArrange = (data.actions || []).some(a =>
            a.function === 'arrange_room' && a.result?.success);
          if (hasArrange) {
            // The server arranged in the fallback store; we need to get those positions
            // Send a follow-up auto-place request with current state
            try {
              const currentFurniture = useLayoutStore.getState().furniture;
              if (currentFurniture.length > 0) {
                const { data: arranged } = await api.post('/api/layout/auto-place', {
                  room_id: room.id,
                  room_context: { id: room.id, name: room.name, width: room.width, depth: room.depth },
                  placements_context: currentFurniture.map(f => ({
                    id: f.id, name: f.name, category: f.category, width: f.width,
                    depth: f.depth, height: f.height, x_inches: f.x_inches,
                    y_inches: f.y_inches, rotation: f.rotation,
                  })),
                });
                for (const u of (arranged.placements || [])) {
                  const match = useLayoutStore.getState().furniture.find(f => f.name === u.name);
                  if (match) {
                    useLayoutStore.getState().updateFurniture(match.id, {
                      x_inches: u.x_inches, y_inches: u.y_inches, rotation: u.rotation,
                    });
                  }
                }
              }
            } catch { /* auto-arrange is best-effort */ }
          }
        } else {
          // Server-side spaces: just reload from DB
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

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      send(input);
    }
    // Plain Enter without shift sends, Shift+Enter adds newline
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      send(input);
    }
  };

  const handleClear = () => {
    clearChat();
    toast.success('Conversation cleared');
  };

  const charCount = input.length;
  const hasMessages = chatHistory.length > 0;

  return (
    <>
      {/* Header */}
      <div className="p-5 border-b border-ink-900/10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-sienna-400 to-sienna-600 grid place-items-center shadow-sm">
              <span className="text-xs text-paper-50 font-bold">V</span>
            </div>
            <div>
              <div className="font-display text-base leading-tight">Space Assistant</div>
              <div className="text-[10px] uppercase tracking-editorial text-ink-500 mt-0.5">
                {sending ? 'Thinking…' : 'Online'}
              </div>
            </div>
          </div>
          {hasMessages && (
            <button
              onClick={handleClear}
              className="text-[10px] uppercase tracking-editorial text-ink-500 hover:text-ink-900 transition px-2 py-1 rounded hover:bg-ink-900/5"
              title="Clear conversation"
            >
              Clear
            </button>
          )}
        </div>
        <p className="text-xs text-ink-500 leading-relaxed mt-2">
          Edit the selected room or exterior area.
        </p>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
        {!hasMessages && (
          <StylePrompts onSend={send} compact />
        )}
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
          <div className="flex justify-start">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-sienna-400 to-sienna-600 grid place-items-center shrink-0">
                <span className="text-[10px] text-paper-50 font-bold">V</span>
              </div>
              <div className="bg-paper-100 border border-ink-900/10 px-4 py-3 rounded-2xl rounded-bl-md flex items-center gap-1.5">
                <span className="typing-dot" style={{ animationDelay: '0ms' }} />
                <span className="typing-dot" style={{ animationDelay: '150ms' }} />
                <span className="typing-dot" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-ink-900/10 bg-paper-50 p-4">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              className="w-full bg-paper-100 border border-ink-900/10 rounded-xl px-4 py-3 pr-12 text-sm text-ink-900 placeholder:text-ink-400 resize-none focus:outline-none focus:border-ink-900/30 focus:ring-1 focus:ring-ink-900/10 transition min-h-[44px] max-h-[120px]"
              placeholder={room ? 'Describe your space goals…' : 'Select a space first'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!room || sending}
              rows={1}
              id="chat-input"
            />
            {charCount > 0 && (
              <span className="absolute right-3 bottom-2 text-[10px] text-ink-400">
                {charCount}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => send(input)}
            disabled={!input.trim() || !room || sending}
            className="shrink-0 w-11 h-11 rounded-xl bg-ink-900 text-paper-50 grid place-items-center transition hover:bg-ink-700 disabled:opacity-30 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-sienna-500"
            aria-label="Send message"
            id="chat-send-button"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <div className="flex items-center justify-between mt-2 px-1">
          <span className="text-[10px] text-ink-400">
            {room ? `Space: ${room.name}` : 'No space selected'}
          </span>
          <span className="text-[10px] text-ink-400 hidden sm:inline">
            Enter to send · Shift+Enter for new line
          </span>
        </div>
      </div>
    </>
  );
}
