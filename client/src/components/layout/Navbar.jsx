import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { useAuth } from '@/hooks/useAuth';

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/upload', label: 'Upload' },
  { to: '/studio', label: 'Studio' },
  { to: '/chat', label: 'Chat' },
];

export default function Navbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pastHero, setPastHero] = useState(false);

  const isStudio = pathname.startsWith('/studio');
  const isHome = pathname === '/';
  /** Transparent nav over cinematic hero */
  const overHero = isHome && !pastHero && !isStudio;

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  useEffect(() => {
    const update = () => {
      if (!isHome || isStudio) {
        setPastHero(true);
        return;
      }
      const hero = document.getElementById('hero');
      if (!hero) {
        setPastHero(true);
        return;
      }
      const bottom = hero.getBoundingClientRect().bottom;
      setPastHero(bottom <= 72);
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [isHome, isStudio, pathname]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const shell = clsx(
    'fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter,box-shadow] duration-300',
    isStudio &&
      'border-b border-white/10 bg-[color-mix(in_srgb,var(--vs-midnight)_82%,transparent)] backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)]',
    !isStudio &&
      overHero &&
      'border-b border-transparent bg-transparent shadow-none',
    !isStudio &&
      !overHero &&
      'border-b border-stone-200/80 bg-vs-warm/95 backdrop-blur-md shadow-[0_8px_30px_rgba(0,0,0,0.04)]'
  );

  const linkClass = ({ isActive }) =>
    clsx(
      'rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200',
      overHero &&
        (isActive ? 'bg-white/15 text-white' : 'text-white/85 hover:bg-white/10 hover:text-white'),
      !overHero &&
        !isStudio &&
        (isActive
          ? 'bg-vs-accent/10 text-vs-accent'
          : 'text-vs-dark/80 hover:bg-stone-100 hover:text-vs-charcoal'),
      isStudio &&
        (isActive ? 'bg-white/12 text-white' : 'text-white/70 hover:bg-white/8 hover:text-white')
    );

  const logoText = clsx(
    'text-[15px] font-semibold tracking-[-0.02em] transition-colors',
    overHero && 'text-white',
    !overHero && !isStudio && 'text-vs-charcoal',
    isStudio && 'text-white'
  );

  const ctaPrimary = clsx(
    'hidden rounded-full px-4 py-2 text-xs font-semibold transition md:inline-flex',
    overHero && 'bg-white text-vs-charcoal hover:bg-stone-100',
    !overHero && !isStudio && 'bg-vs-accent text-white hover:brightness-110',
    isStudio && 'bg-vs-accent text-white hover:brightness-110'
  );

  const ctaSignIn = clsx(
    'rounded-full px-4 py-2 text-xs font-semibold transition',
    overHero && 'border border-white/25 bg-white/10 text-white hover:bg-white/15',
    !overHero && !isStudio && 'border border-stone-200 bg-white text-vs-charcoal hover:border-stone-300',
    isStudio && 'border border-white/20 bg-white/5 text-white hover:bg-white/10'
  );

  const mobileBtn = clsx('rounded-full p-2.5 transition md:hidden', overHero && 'text-white hover:bg-white/10', !overHero && !isStudio && 'text-vs-charcoal hover:bg-stone-100', isStudio && 'text-white hover:bg-white/10');

  const mobilePanel = clsx(
    'border-t md:hidden',
    overHero && 'border-white/15 bg-black/45 backdrop-blur-xl',
    !overHero && !isStudio && 'border-stone-200 bg-vs-warm/98 backdrop-blur-md',
    isStudio && 'border-white/10 bg-[color-mix(in_srgb,var(--vs-midnight)_95%,transparent)] backdrop-blur-xl'
  );

  return (
    <>
      <a href="#main-content" className="skip-to-content">
        Skip to content
      </a>
      <header className={shell} role="banner">
      <div className="mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-3 px-6 md:gap-6 lg:px-8">
        <div className="flex min-w-0 items-center justify-self-start">
          <Link to="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-90">
            <img src="/vision-studio-logo.png" alt="" className="h-8 w-auto object-contain md:h-9" />
            <span className={logoText}>Vision Studio</span>
          </Link>
        </div>

        <nav className="hidden shrink-0 items-center gap-1 justify-self-center md:flex" aria-label="Primary">
          {navLinks.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.to === '/'} className={linkClass}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex min-w-0 items-center justify-end gap-2 md:gap-3">
          <Link to="/studio" className={ctaPrimary}>
            Open Studio
          </Link>

          {user ? (
            <div className="hidden items-center gap-3 md:flex">
              <span
                className={clsx(
                  'max-w-[140px] truncate text-xs',
                  overHero && 'text-white/65',
                  !overHero && !isStudio && 'text-vs-dark/55',
                  isStudio && 'text-white/55'
                )}
              >
                {user.email}
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                className={clsx(
                  'rounded-full px-4 py-2 text-xs font-medium transition',
                  overHero && 'text-white/85 hover:bg-white/10',
                  !overHero && !isStudio && 'text-vs-dark/75 hover:bg-stone-100',
                  isStudio && 'text-white/75 hover:bg-white/10'
                )}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <Link to="/login" className={ctaSignIn}>
              Sign In
            </Link>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className={mobileBtn}
            aria-expanded={mobileOpen}
            aria-label="Toggle menu"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={mobileOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'}
              />
            </svg>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className={mobilePanel}>
          <nav className="flex flex-col gap-1 p-4" aria-label="Mobile primary">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) =>
                  clsx(
                    'rounded-xl px-4 py-3 text-sm font-medium transition-colors',
                    overHero &&
                      (isActive ? 'bg-white/12 text-white' : 'text-white/85 hover:bg-white/8'),
                    !overHero &&
                      !isStudio &&
                      (isActive ? 'bg-vs-accent/10 text-vs-accent' : 'text-vs-dark hover:bg-stone-100'),
                    isStudio &&
                      (isActive ? 'bg-white/12 text-white' : 'text-white/85 hover:bg-white/8')
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
            <Link
              to="/studio"
              className={clsx(
                'mt-2 rounded-full px-4 py-3 text-center text-sm font-semibold',
                overHero && 'bg-white text-vs-charcoal',
                !overHero && !isStudio && 'bg-vs-accent text-white',
                isStudio && 'bg-vs-accent text-white'
              )}
              onClick={() => setMobileOpen(false)}
            >
              Open Studio
            </Link>
            {user && (
              <button
                type="button"
                onClick={() => {
                  handleSignOut();
                  setMobileOpen(false);
                }}
                className={clsx(
                  'rounded-xl px-4 py-3 text-left text-sm',
                  overHero && 'text-white/85 hover:bg-white/8',
                  !overHero && !isStudio && 'text-vs-dark hover:bg-stone-100',
                  isStudio && 'text-white/85 hover:bg-white/8'
                )}
              >
                Sign Out
              </button>
            )}
          </nav>
        </div>
      )}
    </header>
    </>
  );
}
