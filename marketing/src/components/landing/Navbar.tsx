"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const links = [
  { href: "#features", label: "Product" },
  { href: "#gallery", label: "Gallery" },
  { href: "#compare", label: "Solutions" },
  { href: "#cta", label: "Get started" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled
          ? "border-b border-stone-200/80 bg-white/95 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-md"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:h-[4.25rem] lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-xl border text-[11px] font-bold tracking-tight transition-colors ${
              scrolled
                ? "border-stone-200 bg-stone-900 text-white"
                : "border-white/40 bg-white/15 text-white backdrop-blur-sm"
            }`}
          >
            VS
          </span>
          <span
            className={`text-[15px] font-semibold tracking-[-0.02em] transition-colors ${
              scrolled ? "text-stone-900" : "text-white drop-shadow-sm"
            }`}
          >
            Vision Studio
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                scrolled
                  ? "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                  : "text-white/90 hover:bg-white/10 hover:text-white"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="#cta"
            className={`hidden rounded-full px-5 py-2.5 text-sm font-semibold transition-all sm:inline-flex ${
              scrolled
                ? "bg-stone-900 text-white hover:bg-stone-800"
                : "bg-white text-stone-900 hover:bg-stone-100"
            }`}
          >
            Start Designing
          </Link>

          <button
            type="button"
            className={`rounded-full p-2 md:hidden ${scrolled ? "text-stone-900" : "text-white"}`}
            aria-expanded={menuOpen}
            aria-label="Open menu"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <div
          className={`border-t px-6 py-4 md:hidden ${
            scrolled ? "border-stone-200 bg-white/98" : "border-white/15 bg-black/55 backdrop-blur-lg"
          }`}
        >
          <nav className="flex flex-col gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-xl px-4 py-3 text-sm font-medium ${
                  scrolled ? "text-stone-800 hover:bg-stone-100" : "text-white hover:bg-white/10"
                }`}
                onClick={() => setMenuOpen(false)}
              >
                {l.label}
              </Link>
            ))}
            <Link
              href="#cta"
              className="mt-2 rounded-full bg-stone-900 py-3 text-center text-sm font-semibold text-white"
              onClick={() => setMenuOpen(false)}
            >
              Start Designing
            </Link>
          </nav>
        </div>
      )}
    </motion.header>
  );
}
