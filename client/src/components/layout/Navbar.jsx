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
  const isStudio = pathname.startsWith('/studio');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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

        <Link to="/studio" className="btn-ink text-[10px] py-2 px-4">
          Open Studio
        </Link>
      </div>
    </header>
  );
}
