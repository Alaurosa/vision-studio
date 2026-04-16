import Link from 'next/link';

export default function HomePage() {
  return (
    <section className="space-y-8">
      {/* Hero */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-10 shadow-xl shadow-black/20">
        <div className="max-w-3xl space-y-6">
          <p className="text-sm uppercase tracking-[0.3em] text-brand-200">Vision Studios</p>
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            AI-powered spatial layout design for real rooms.
          </h1>
          <p className="text-base leading-7 text-slate-300 sm:text-lg">
            Upload a photo of your room, let AI detect walls and furniture, browse real IKEA &amp; Ashley
            catalogs, arrange layouts with an AI design assistant, and export to JSON, DXF, or SVG.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/upload"
              className="inline-flex items-center justify-center rounded-full bg-brand-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-600"
            >
              Upload Room Photo
            </Link>
            <Link
              href="/editor"
              className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900 px-6 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-500"
            >
              Open Editor
            </Link>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { value: '27+', label: 'Furniture Items' },
          { value: '2', label: 'Retail Partners' },
          { value: '3', label: 'Export Formats' },
          { value: 'GPT', label: 'AI Engine' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-3xl border border-white/10 bg-slate-900/70 px-4 py-5 text-center"
          >
            <p className="text-2xl font-bold text-white">{stat.value}</p>
            <p className="mt-1 text-xs text-slate-400">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-8">
        <h2 className="mb-6 text-2xl font-semibold text-white">How it works</h2>
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="space-y-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-200">
              <span className="text-lg">1</span>
            </div>
            <h3 className="text-sm font-semibold text-white">Upload a room photo</h3>
            <p className="text-sm leading-6 text-slate-400">
              Take a photo of your empty room or upload a floor plan. Our AI analyzes walls,
              dimensions, and existing furniture automatically.
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-200">
              <span className="text-lg">2</span>
            </div>
            <h3 className="text-sm font-semibold text-white">Design your layout</h3>
            <p className="text-sm leading-6 text-slate-400">
              Browse real furniture from IKEA and Ashley Furniture. Drag, drop, rotate, and snap items
              to a measured grid with collision detection.
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-200">
              <span className="text-lg">3</span>
            </div>
            <h3 className="text-sm font-semibold text-white">Export &amp; share</h3>
            <p className="text-sm leading-6 text-slate-400">
              Export your finished layout to JSON, DXF for AutoCAD/SketchUp, or SVG for printing.
              View your design in an interactive 3D walkthrough.
            </p>
          </div>
        </div>
      </div>

      {/* Feature cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white">AI Room Analysis</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Upload a floor plan or room photo. AI detects walls, rooms, and furniture using
            Grounding DINO and computer vision.
          </p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016A3.001 3.001 0 0021 9.349m-18 0V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25v4.1" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white">Real Furniture Catalogs</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Browse 27+ items from IKEA and Ashley Furniture with real dimensions, pricing, and
            direct product links.
          </p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white">2D Layout Editor</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Drag, drop, rotate, and snap furniture to a measured grid with real-time collision
            detection and clearance validation.
          </p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white">AI Design Assistant</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Chat with an AI agent that moves furniture, suggests products, validates layouts,
            and can auto-arrange your entire room.
          </p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 01-1.125-1.125v-3.75zM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-8.25zM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-2.25z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white">3D Walkthrough</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            View your room in an interactive 3D scene with orbit controls, procedural models,
            and AI-generated GLB furniture via Meshy.
          </p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10 text-teal-400">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white">Multi-Format Export</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Export your finished layout to JSON, DXF for SketchUp and AutoCAD, or SVG for
            printing and sharing with clients.
          </p>
        </div>
      </div>

      {/* CTA */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-10 text-center shadow-xl shadow-black/20">
        <h2 className="text-2xl font-semibold text-white sm:text-3xl">Ready to design your space?</h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-400">
          Upload a room photo and let AI handle the rest. Browse real furniture, get layout
          suggestions, and export in seconds.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/upload"
            className="inline-flex items-center justify-center rounded-full bg-brand-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-600"
          >
            Get Started
          </Link>
        </div>
      </div>
    </section>
  );
}
