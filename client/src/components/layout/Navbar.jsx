import { Link, NavLink, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import clsx from 'clsx';

const links = [
  { to: '/',        label: 'Home' },
  { to: '/upload',  label: 'Upload' },
  { to: '/studio',  label: 'Studio' },
];

export default function Navbar() {
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isStudio = pathname.startsWith('/studio');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <header
      className={clsx(
        'sticky top-0 z-40 transition-all duration-500',
        scrolled || isStudio
          ? 'bg-paper-50/90 backdrop-blur border-b border-ink-900/10'
          : 'bg-transparent'
      )}
    >
      <div className="max-w-8xl mx-auto flex items-center justify-between px-6 md:px-10 h-16">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-2.5 h-2.5 rounded-full bg-ink-900 group-hover:bg-sienna-500 transition" />
          <span className="font-display text-lg tracking-tight">Vision Studio</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-10">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) =>
                clsx(
                  'text-[11px] uppercase tracking-editorial transition relative py-2',
                  isActive ? 'text-ink-900' : 'text-ink-500 hover:text-ink-900'
                )
              }
            >
              {({ isActive }) => (
                <>
                  {l.label}
                  {isActive && (
                    <span className="absolute left-0 right-0 -bottom-px h-px bg-ink-900" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link to="/upload" className="hidden md:inline-flex btn-ink text-[10px] py-2 px-4">
            Get Started
          </Link>

          {/* Mobile hamburger */}
          <button
            className="md:hidden flex flex-col gap-1.5 p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation menu"
          >
            <span className={clsx('block w-5 h-0.5 bg-ink-900 transition-transform origin-center', mobileOpen && 'rotate-45 translate-y-[4px]')} />
            <span className={clsx('block w-5 h-0.5 bg-ink-900 transition-opacity', mobileOpen && 'opacity-0')} />
            <span className={clsx('block w-5 h-0.5 bg-ink-900 transition-transform origin-center', mobileOpen && '-rotate-45 -translate-y-[4px]')} />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-ink-900/10 bg-paper-50/95 backdrop-blur">
          <nav className="max-w-8xl mx-auto px-6 py-6 flex flex-col gap-4">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/'}
                className={({ isActive }) =>
                  clsx(
                    'text-[11px] uppercase tracking-editorial py-2 transition',
                    isActive ? 'text-ink-900' : 'text-ink-500 hover:text-ink-900'
                  )
                }
              >
                {l.label}
              </NavLink>
            ))}
            <Link to="/upload" className="btn-ink text-[10px] py-2 px-4 text-center mt-2">
              Get Started
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
