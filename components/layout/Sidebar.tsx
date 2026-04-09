import type { ReactNode } from 'react';

interface SidebarProps {
  title: string;
  children: ReactNode;
}

export function Sidebar({ title, children }: SidebarProps) {
  return (
    <aside className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
      <h2 className="mb-4 text-lg font-semibold text-white">{title}</h2>
      <div className="space-y-4">{children}</div>
    </aside>
  );
}
