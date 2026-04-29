import { Link, useLocation } from 'react-router-dom';

export default function Footer() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/studio')) return null;
  return (
    <footer className="mt-0 border-t border-vs-soft/25 bg-vs-light">
      <div className="mx-auto max-w-8xl px-6 py-16 md:grid md:grid-cols-4 md:gap-12 md:px-10 md:py-20">
        <div className="mb-12 md:mb-0">
          <div className="font-display text-2xl font-medium tracking-[-0.02em] text-vs-charcoal">Vision Studio</div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-vs-dark/85">
            A spatial design studio for interior planning, architectural layout, and thoughtful space.
          </p>
        </div>
        <div className="mb-10 md:mb-0">
          <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.35em] text-vs-accent">Explore</div>
          <ul className="space-y-3 text-sm text-vs-dark/90">
            <li>
              <Link to="/" className="transition hover:text-vs-accent">
                Home
              </Link>
            </li>
            <li>
              <Link to="/upload" className="transition hover:text-vs-accent">
                Upload Floorplan
              </Link>
            </li>
            <li>
              <Link to="/studio" className="transition hover:text-vs-accent">
                Design Studio
              </Link>
            </li>
          </ul>
        </div>
        <div className="mb-10 md:mb-0">
          <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.35em] text-vs-accent">Built With</div>
          <ul className="space-y-3 text-sm text-vs-dark/90">
            <li>OpenAI Vision + Agents</li>
            <li>Grounding DINO · SAM</li>
            <li>Konva · Three.js</li>
          </ul>
        </div>
        <div>
          <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.35em] text-vs-accent">UC Santa Cruz</div>
          <p className="text-sm leading-relaxed text-vs-dark/90">
            CSE 115A — Capstone 2026
            <br />
            William Liu · Ethan Cao · Sriya Katreddi · Ashley Kim
          </p>
        </div>
      </div>
      <div className="border-t border-vs-soft/30">
        <div className="mx-auto flex max-w-8xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-xs text-vs-dark/55 md:px-10">
          <span>© {new Date().getFullYear()} Vision Studio</span>
          <span className="uppercase tracking-[0.28em]">Designed for dreamers</span>
        </div>
      </div>
    </footer>
  );
}
