import { useEffect } from 'react';
import { create } from 'zustand';

// ---- Toast store ----
// Usage:  toast.success('Saved'); toast.error('Failed'); toast.info('Hi');
const useToastStore = create((set, get) => ({
  toasts: [],
  push: (toast) => {
    const id = Math.random().toString(36).slice(2);
    const entry = { id, ...toast };
    set((s) => ({ toasts: [...s.toasts, entry] }));
    const duration = toast.duration ?? (toast.type === 'error' ? 5000 : 3000);
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, duration);
  },
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (msg, opts = {}) => useToastStore.getState().push({ type: 'success', message: msg, ...opts }),
  error:   (msg, opts = {}) => useToastStore.getState().push({ type: 'error',   message: msg, ...opts }),
  info:    (msg, opts = {}) => useToastStore.getState().push({ type: 'info',    message: msg, ...opts }),
};

const TYPE_STYLES = {
  success: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-300', icon: 'text-emerald-500' },
  error:   { bg: 'bg-red-500/10',     border: 'border-red-500/20',     text: 'text-red-300',     icon: 'text-red-400' },
  info:    { bg: 'bg-brand-500/10',   border: 'border-brand-500/30',   text: 'text-brand-200',   icon: 'text-brand-500' },
};

const ICONS = {
  success: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  error: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  ),
  info: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
    </svg>
  ),
};

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none max-w-sm">
      {toasts.map((t) => {
        const style = TYPE_STYLES[t.type] || TYPE_STYLES.info;
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-2 px-3 py-2 rounded-lg border shadow-sm animate-[slideIn_.2s_ease-out] ${style.bg} ${style.border} ${style.text}`}
            role="status"
          >
            <span className={`shrink-0 mt-0.5 ${style.icon}`}>{ICONS[t.type] || ICONS.info}</span>
            <div className="flex-1 text-sm leading-snug">{t.message}</div>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 text-slate-500 hover:text-slate-300 text-lg leading-none"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
