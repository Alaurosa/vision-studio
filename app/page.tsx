import Link from 'next/link';

export default function HomePage() {
  return (
    <section className="space-y-8">
      <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-10 shadow-xl shadow-black/20">
        <div className="max-w-3xl space-y-6">
          <p className="text-sm uppercase tracking-[0.3em] text-brand-200">Vision Studios</p>
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            A frontend design skeleton for room styling with AI in mind.
          </h1>
          <p className="text-base leading-7 text-slate-300 sm:text-lg">
            Explore the upload flow, editor layout, and conversational assistant panels using mock data.
            No backend, no AI, just the architecture for your next phase.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/upload"
              className="inline-flex items-center justify-center rounded-full bg-brand-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-600"
            >
              Try Upload
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

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <h2 className="text-xl font-semibold text-white">Upload</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Start by adding a room image. This page shows the future upload card and preview flow.
          </p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <h2 className="text-xl font-semibold text-white">Design Editor</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            The editor page is laid out for a canvas, furniture panel, toolbar, and chat assistant.
          </p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <h2 className="text-xl font-semibold text-white">Mock Data</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Local mock data drives the UI today. Real AI and provider integrations come later.
          </p>
        </div>
      </div>
    </section>
  );
}
