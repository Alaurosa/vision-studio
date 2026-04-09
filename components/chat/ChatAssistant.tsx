'use client';

import { useMemo } from 'react';
import { mockChatMessages } from '@lib/mock/chat';
import { useAppStore } from '@store/appStore';

export function ChatAssistant() {
  const isChatOpen = useAppStore((state) => state.isChatOpen);

  const messages = useMemo(() => mockChatMessages, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Design assistant</h2>
          <p className="text-sm text-slate-400">Placeholder conversation area for future chat interactions.</p>
        </div>
        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-400">
          {isChatOpen ? 'Open' : 'Hidden'}
        </span>
      </div>
      <div className="space-y-3 rounded-3xl border border-white/10 bg-slate-950/80 p-4">
        {messages.map((message) => (
          <div key={message.id} className="space-y-1 rounded-3xl bg-slate-900/90 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-brand-200">{message.sender}</p>
            <p className="text-sm text-slate-200">{message.text}</p>
            <p className="text-xs text-slate-500">{message.timestamp}</p>
          </div>
        ))}
      </div>
      <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/80 p-4 text-slate-400">
        <p className="text-sm">Chat input will be added later. This is a placeholder for the assistant prompt area.</p>
      </div>
    </div>
  );
}
