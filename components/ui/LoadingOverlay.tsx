interface LoadingOverlayProps {
  message?: string;
}

export function LoadingOverlay({ message = 'Loading mock workspace...' }: LoadingOverlayProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-slate-950/90 text-center text-slate-100">
      <div>
        <div className="mb-4 text-lg font-semibold">{message}</div>
        <div className="h-2 w-32 animate-pulse rounded-full bg-brand-500" />
      </div>
    </div>
  );
}
