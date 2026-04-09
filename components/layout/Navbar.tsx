import Link from 'next/link';

export function Navbar() {
  return (
    <header className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-900/70 p-4 shadow-sm shadow-black/10 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-200">Vision Studios</p>
        <p className="text-sm text-slate-400">AI room design placeholder UI</p>
      </div>
      <nav className="flex flex-wrap items-center gap-3">
        <Link href="/" className="text-sm text-slate-200 transition hover:text-white">
          Home
        </Link>
        <Link href="/upload" className="text-sm text-slate-200 transition hover:text-white">
          Upload
        </Link>
        <Link href="/editor" className="text-sm text-slate-200 transition hover:text-white">
          Editor
        </Link>
      </nav>
    </header>
  );
}
