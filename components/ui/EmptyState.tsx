interface EmptyStateProps {
  message: string;
}

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-700 bg-slate-950/80 px-6 py-10 text-center text-slate-400">
      <div className="mb-4 text-4xl">🛋️</div>
      <p className="max-w-sm text-sm leading-6">{message}</p>
    </div>
  );
}
