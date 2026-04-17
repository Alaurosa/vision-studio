import { Link, useLocation } from 'react-router-dom';

export default function Footer() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/studio')) return null;
  return (
    <footer className="mt-32 border-t border-ink-900/10">
      <div className="max-w-8xl mx-auto px-6 md:px-10 py-16 grid md:grid-cols-4 gap-10">
        <div>
          <div className="font-display text-2xl mb-3">Vision Studio</div>
          <p className="text-sm text-ink-500 max-w-xs">
            An AI-powered spatial layout engine for interior design,
            architectural planning, and everyday dreamers.
          </p>
        </div>
        <div>
          <div className="eyebrow mb-4">Explore</div>
          <ul className="space-y-2 text-sm text-ink-700">
            <li><Link to="/" className="hover:text-ink-900">Home</Link></li>
            <li><Link to="/upload" className="hover:text-ink-900">Upload Floorplan</Link></li>
            <li><Link to="/studio" className="hover:text-ink-900">Design Studio</Link></li>
          </ul>
        </div>
        <div>
          <div className="eyebrow mb-4">Built With</div>
          <ul className="space-y-2 text-sm text-ink-700">
            <li>OpenAI Vision + Agents</li>
            <li>Grounding DINO · SAM</li>
            <li>Konva · Three.js</li>
          </ul>
        </div>
        <div>
          <div className="eyebrow mb-4">UC Santa Cruz</div>
          <p className="text-sm text-ink-700">
            CSE 115A — Capstone 2026<br />
            William Liu · Ethan Cao · Sriya Katreddi · Ashley Kim
          </p>
        </div>
      </div>
      <div className="border-t border-ink-900/10">
        <div className="max-w-8xl mx-auto px-6 md:px-10 py-6 flex flex-wrap justify-between text-xs text-ink-500 gap-3">
          <span>© {new Date().getFullYear()} Vision Studio</span>
          <span className="uppercase tracking-editorial">Designed for dreamers</span>
        </div>
      </div>
    </footer>
  );
}
