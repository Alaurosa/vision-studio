import { Link, useLocation } from 'react-router-dom';

const LUCAS_CREDIT_URL = 'https://issuu.com/lucasvargas89';

const linkClass =
  'text-[#334155] transition-colors duration-200 hover:text-[#0f172a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8]/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[#e8eef4] rounded-sm';

const labelClass =
  'mb-5 text-[11px] font-medium uppercase tracking-[0.28em] text-[#1d4ed8]';

export default function Footer() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/studio')) return null;

  return (
    <footer className="mt-0 border-t border-[#d7dee7] bg-[#e8eef4]">
      <div className="mx-auto max-w-7xl px-6 py-16 md:px-8 md:py-24">
        <div className="grid grid-cols-1 gap-x-8 gap-y-14 md:grid-cols-2 xl:grid-cols-5 xl:gap-x-10">
          {/* Column 1 — Brand */}
          <div className="min-w-0 xl:max-w-none">
            <div className="font-display text-xl font-medium tracking-[-0.02em] text-[#0f172a] md:text-2xl">
              Vision Studio
            </div>
            <p className="mt-5 max-w-[22rem] text-sm leading-[1.65] text-[#334155]">
              A spatial design studio for interior planning, architectural layout, and intelligent room
              visualization.
            </p>
          </div>

          {/* Column 2 — Product */}
          <div>
            <div className={labelClass}>Product</div>
            <ul className="space-y-3.5 text-sm">
              <li>
                <Link to="/" className={linkClass}>
                  Home
                </Link>
              </li>
              <li>
                <Link to="/studio/new?startMode=upload" className={linkClass}>
                  New project
                </Link>
              </li>
              <li>
                <Link to="/studio" className={linkClass}>
                  Design Studio
                </Link>
              </li>
              <li>
                <Link to="/chat" className={linkClass}>
                  Chat
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3 — Built With */}
          <div>
            <div className={labelClass}>Built With</div>
            <ul className="space-y-3 text-sm leading-relaxed text-[#334155]">
              <li>AI Vision</li>
              <li>Spatial Layout Engine</li>
              <li>3D Preview</li>
              <li>Furniture + Material Intelligence</li>
            </ul>
          </div>

          {/* Column 4 — Creative Credits */}
          <div className="min-w-0">
            <div className={labelClass}>Creative Credits</div>
            <div className="space-y-4 text-sm leading-[1.65] text-[#334155]">
              <p>
                Architectural imagery curated in collaboration with{' '}
                <a
                  href={LUCAS_CREDIT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#1d4ed8] underline underline-offset-4 transition-colors duration-200 hover:text-[#0f172a]"
                >
                  Lucas Vargas
                </a>
                .
              </p>
              <p className="text-[#475569]">Cal Poly Pomona — Architecture</p>
            </div>
          </div>

          {/* Column 5 — Course / Team */}
          <div className="min-w-0">
            <div className={labelClass}>Course / Team</div>
            <div className="space-y-3 text-sm leading-relaxed text-[#334155]">
              <p>UC Santa Cruz</p>
              <p>CSE 115A — Capstone 2026</p>
              <p className="text-[#475569]">
                William Liu · Ethan Cao · Sriya Katreddi · Ashley Kim
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-[#d7dee7] bg-[#edf2f7]">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-8 text-xs text-[#64748b] md:flex-row md:items-center md:justify-between md:px-8 md:py-9">
          <span className="tracking-[0.02em]">© 2026 Vision Studio. All rights reserved.</span>
          <span className="uppercase tracking-[0.28em]">Designed for dreamers.</span>
        </div>
      </div>
    </footer>
  );
}
