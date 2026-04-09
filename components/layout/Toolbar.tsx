import { useAppStore } from '@store/appStore';

export function Toolbar() {
  const toggleChat = useAppStore((state) => state.toggleChat);

  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        onClick={toggleChat}
        className="rounded-full bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
      >
        Toggle Chat
      </button>
      <button
        type="button"
        className="rounded-full border border-slate-700 bg-transparent px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500"
      >
        Save Draft
      </button>
    </div>
  );
}
