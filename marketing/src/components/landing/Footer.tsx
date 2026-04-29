import Link from "next/link";

const columns = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "Gallery", href: "#gallery" },
      { label: "Solutions", href: "#compare" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Careers", href: "#" },
      { label: "Press", href: "#" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Documentation", href: "#" },
      { label: "Blog", href: "#" },
      { label: "Support", href: "#" },
    ],
  },
  {
    title: "Contact",
    links: [
      { label: "hello@visionstudio.app", href: "mailto:hello@visionstudio.app" },
      { label: "San Francisco · Remote", href: "#" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-stone-800 bg-stone-950 text-stone-300">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-20">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
          {columns.map((col) => (
            <div key={col.title}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-stone-500">
                {col.title}
              </p>
              <ul className="mt-6 space-y-4 text-sm">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="transition hover:text-white">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-start justify-between gap-4 border-t border-stone-800 pt-10 text-sm text-stone-500 md:flex-row md:items-center">
          <span>© Vision Studio</span>
          <span className="text-xs uppercase tracking-[0.2em] text-stone-600">
            Intelligent spatial design
          </span>
        </div>
      </div>
    </footer>
  );
}
