import { ChatAssistant } from '@components/chat/ChatAssistant';
import { FurniturePanel } from '@components/editor/FurniturePanel';
import { LayoutCanvas } from '@components/editor/LayoutCanvas';
import { Toolbar } from '@components/layout/Toolbar';

export default function EditorPage() {
  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-sm shadow-black/10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-brand-200">Editor</p>
            <h1 className="text-2xl font-semibold text-white sm:text-3xl">Room design workspace</h1>
          </div>
          <Toolbar />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.7fr_0.95fr]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <LayoutCanvas />
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <FurniturePanel />
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <ChatAssistant />
        </div>
      </div>
    </section>
  );
}
