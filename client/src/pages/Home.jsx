import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion, useReducedMotion } from 'framer-motion';

/** Local Lucas portfolio assets (encode path for folder name with space) */
const lp = (file) =>
  `/images/${encodeURIComponent('lucas portfolio')}/${encodeURIComponent(file)}`;

const workflow = [
  {
    step: '01',
    title: 'Upload',
    text: 'Upload a room photo, sketch, or floorplan.',
  },
  {
    step: '02',
    title: 'Describe',
    text: 'Tell Vision Studio your style, budget, goals, and room purpose.',
  },
  {
    step: '03',
    title: 'Generate',
    text: 'Receive intelligent layouts and furniture suggestions.',
  },
  {
    step: '04',
    title: 'Edit',
    text: 'Move pieces, resize, refine spacing, materials, and walls.',
  },
  {
    step: '05',
    title: 'Preview',
    text: 'Walk through the room in immersive 3D.',
  },
  {
    step: '06',
    title: 'Export',
    text: 'Share with clients, family, contractors, or save concepts.',
  },
];

const differencePoints = [
  'Understands room geometry',
  'Built for editable layouts',
  'Furniture with real dimensions',
  'Real circulation logic',
  'Human taste + AI speed',
  'Designed for iteration, not one-click novelty',
];

const audiences = [
  {
    title: 'Homeowners',
    text: 'See your future room before spending money.',
  },
  {
    title: 'Interior Designers',
    text: 'Create client-ready concepts faster.',
  },
  {
    title: 'Architects',
    text: 'Rapid spatial studies and furniture planning.',
  },
  {
    title: 'Developers',
    text: 'Stage and visualize units instantly.',
  },
];

const whyVisionStudio = [
  {
    label: 'AI-powered room intelligence',
    text: 'Upload a floorplan or room photo and receive spatially aware recommendations.',
  },
  {
    label: 'Editable design workflow',
    text: 'Refine layouts, furniture, walls, and spacing in a studio-grade interface.',
  },
  {
    label: 'Conversion-ready outputs',
    text: 'Preview in 3D and export concepts for clients, family, and builders.',
  },
];

export default function Home() {
  const prefersReducedMotion = useReducedMotion();

  const ease = [0.22, 1, 0.36, 1];
  const instant = { duration: 0.01 };
  const makeTransition = (dur = 0.85) => (prefersReducedMotion ? instant : { duration: dur, ease });
  const makeVariant = (yOffset = 18, dur = 0.85) => ({
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : yOffset },
    show: { opacity: 1, y: 0, transition: makeTransition(dur) },
  });

  const heroVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: prefersReducedMotion
        ? { staggerChildren: 0 }
        : { staggerChildren: 0.12, delayChildren: 0.06 },
    },
  };
  const heroItemVariants = makeVariant(16, 1);
  const sectionReveal = makeVariant(22, 0.75);

  return (
    <div className="bg-vs-warm text-vs-charcoal">
      <Helmet>
        <title>Vision Studio — AI-Powered Spatial Layout Engine</title>
        <meta
          name="description"
          content="Upload a floorplan, let AI detect rooms and dimensions, then design layouts with real IKEA and Ashley furniture. Export to JSON, SVG, or DXF."
        />
      </Helmet>
      {/* Hero */}
      <section
        id="hero"
        className="relative -mt-16 min-h-[100svh] overflow-hidden bg-vs-midnight pt-16"
      >
        <div className="absolute inset-0">
          <img
            src={lp('hero-main.jpg')}
            alt=""
            className="h-full w-full object-cover"
            loading="eager"
            decoding="async"
          />
          {/* Readability: left→right darken→light + subtle top/bottom vignette; darker on small screens */}
          <div
            className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.52),rgba(0,0,0,0.16))] md:bg-[linear-gradient(to_right,rgba(0,0,0,0.42),rgba(0,0,0,0.10))]"
            aria-hidden
          />
          <div
            className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.22),transparent_32%,transparent_68%,rgba(0,0,0,0.18))] max-md:bg-[linear-gradient(to_bottom,rgba(0,0,0,0.28),transparent_30%,transparent_70%,rgba(0,0,0,0.24))]"
            aria-hidden
          />
        </div>
        <motion.div
          initial="hidden"
          animate="show"
          variants={heroVariants}
          className="relative z-10 mx-auto flex min-h-[100svh] max-w-7xl flex-col justify-center px-6 py-[72px] md:px-8 md:py-[120px]"
        >
          <div className="max-w-3xl text-left">
            <motion.p
              variants={heroItemVariants}
              className="mb-5 text-[11px] font-semibold uppercase tracking-[0.44em] text-[rgba(255,255,255,0.78)]"
            >
              VISION STUDIO · SPATIAL DESIGN ENGINE
            </motion.p>
            <motion.h1
              variants={heroItemVariants}
              className="font-display text-[clamp(2.25rem,5.5vw,4rem)] font-medium leading-[1.06] tracking-[-0.035em] text-[#F8F6F1] [text-shadow:0_2px_12px_rgba(0,0,0,0.28)]"
            >
              Design the rooms you actually live in.
            </motion.h1>
            <motion.p
              variants={heroItemVariants}
              className="mt-6 max-w-xl text-base leading-[1.72] text-[rgba(255,255,255,0.90)] md:text-lg md:leading-[1.75]"
            >
              Upload a floorplan or room photo. Describe your vision. Vision Studio turns ideas into
              editable layouts, intelligent recommendations, and immersive previews.
            </motion.p>
            <motion.div variants={heroItemVariants} className="mt-10 flex flex-wrap gap-3">
              <Link
                to="/studio/new"
                className="inline-flex items-center justify-center rounded-full bg-vs-accent px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-black/25 transition hover:brightness-110 active:scale-[0.98]"
              >
                Start Designing
              </Link>
              <Link
                to="/studio"
                className="inline-flex items-center justify-center rounded-full border border-white/45 bg-white/12 px-8 py-3 text-sm font-semibold text-[rgba(255,255,255,0.96)] backdrop-blur-md transition hover:border-white/55 hover:bg-white/18 active:scale-[0.98]"
              >
                Explore Studio
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </section>

      <div className="h-px w-full bg-gradient-to-r from-transparent via-vs-soft/50 to-transparent" />

      {/* Why Vision Studio Works */}
      <section className="border-b border-vs-soft/30 bg-vs-light">
        <div className="mx-auto max-w-7xl px-6 py-[72px] md:px-8 md:py-[120px]">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={sectionReveal}
            className="mb-12"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.38em] text-vs-accent">
              Value
            </p>
            <h2 className="mt-4 font-display text-3xl font-medium tracking-[-0.03em] text-vs-charcoal md:text-4xl">
              Why Vision Studio Works
            </h2>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-3">
            {whyVisionStudio.map((item, i) => (
              <motion.article
                key={item.label}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                variants={makeVariant(16, 0.6)}
                transition={{ delay: prefersReducedMotion ? 0 : i * 0.04 }}
                className="rounded-[20px] border border-vs-soft/45 bg-vs-warm p-6 shadow-[0_12px_28px_rgba(4,12,46,0.04)]"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-vs-accent">
                  {item.label}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-vs-dark/84">{item.text}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <div className="h-px w-full bg-gradient-to-r from-transparent via-stone-300/40 to-transparent" />

      {/* How it works */}
      <section id="workflow" className="border-b border-vs-soft/30 bg-vs-light">
        <div className="mx-auto max-w-7xl px-6 py-[72px] md:px-8 md:py-[120px]">
          <div className="mb-12 grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-end">
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-80px' }}
              variants={sectionReveal}
              className="space-y-6"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.38em] text-vs-accent">
                How it works
              </p>
              <h2 className="font-display text-3xl font-medium leading-[1.12] tracking-[-0.03em] text-vs-charcoal md:text-[2.4rem]">
                A studio workflow, reimagined.
              </h2>
            </motion.div>
            <motion.p
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-80px' }}
              variants={sectionReveal}
              className="max-w-lg text-sm leading-relaxed text-vs-dark/78"
            >
              Within seconds, first-time users can understand exactly what Vision Studio does: upload,
              describe, generate, edit, preview, and export spatial concepts for real decisions.
            </motion.p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {workflow.map((item, i) => (
              <motion.article
                key={item.step}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: '-60px' }}
                variants={makeVariant(20, 0.65)}
                transition={{ delay: prefersReducedMotion ? 0 : i * 0.04 }}
                className="rounded-[22px] border border-vs-soft/45 bg-white/85 p-6 shadow-[0_18px_44px_rgba(4,12,46,0.05)]"
              >
                <p className="font-mono text-[11px] tabular-nums text-vs-accent">{item.step}</p>
                <h3 className="mt-3 font-display text-xl font-medium tracking-[-0.02em] text-vs-charcoal">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-vs-dark/84">{item.text}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <div className="h-px w-full bg-gradient-to-r from-transparent via-stone-300/40 to-transparent" />

      {/* Showcase — asymmetrical portfolio grid */}
      <section
        id="showcase"
        className="scroll-mt-24 border-b border-stone-800/10 bg-vs-charcoal text-stone-100"
      >
        <div className="mx-auto max-w-7xl px-6 py-[72px] md:px-8 md:py-[120px]">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={sectionReveal}
            className="mb-14 flex flex-col justify-between gap-8 md:flex-row md:items-end"
          >
            <div className="max-w-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.38em] text-vs-soft">
                Showcase
              </p>
              <h2 className="mt-4 font-display text-3xl font-medium tracking-[-0.03em] md:text-4xl">
                Image-led studies with product intent.
              </h2>
            </div>
            <div className="text-xs uppercase tracking-[0.16em] text-white/50">Curated image studies</div>
          </motion.div>

          <div className="grid gap-6 md:gap-8">
            <div className="grid gap-6 lg:grid-cols-[1.65fr_1fr]">
              <ImageCard image={lp('project-whitehouse-exterior.jpg')} title="Residential Layout Concepts" />
              <ImageCard image={lp('project-whitehouse-livingroom.jpg')} title="Furniture Flow Study" />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <ImageCard image={lp('project-cutaway.jpg')} title="Spatial Composition Test" />
              <ImageCard image={lp('hero-alt.jpg')} title="Light & Atmosphere Preview" />
            </div>

            <ImageCard image={lp('warm-library-space.jpg')} title="Material Warmth Preview" wide />

            <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
              <ImageCard image={lp('pink-lobby.jpg')} title="Hospitality Arrival Sequence" />
              <ImageCard image={lp('circular-courtyard.jpg')} title="Spatial Composition Test" />
            </div>
          </div>

          <p className="mt-12 max-w-4xl border-t border-white/[0.09] pt-8 font-medium tracking-[0.04em] text-[11px] text-white/45 md:mt-14 md:text-xs md:tracking-[0.06em]">
            Featured imagery by{' '}
            <a
              href="https://issuu.com/lucasvargas89"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/[0.72] underline decoration-white/20 underline-offset-[5px] transition duration-200 hover:text-white/95 hover:decoration-white/40"
            >
              Lucas Vargas
            </a>
          </p>
        </div>
      </section>

      <div className="h-px w-full bg-gradient-to-r from-transparent via-vs-soft/45 to-transparent" />

      {/* Why it's different */}
      <section className="border-b border-vs-soft/30 bg-vs-light">
        <div className="mx-auto max-w-7xl px-6 py-[72px] md:px-8 md:py-[120px]">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              variants={sectionReveal}
              className="space-y-6"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.38em] text-vs-accent">
                Why it&apos;s different
              </p>
              <h2 className="font-display text-3xl font-medium leading-[1.12] tracking-[-0.03em] text-vs-charcoal md:text-[2.3rem]">
                Not another image generator.
              </h2>
              <p className="max-w-md text-sm leading-relaxed text-vs-dark/82">
                Vision Studio is built as a spatial workflow engine: it understands geometry, supports
                iterative edits, and helps teams communicate buildable concepts with confidence.
              </p>
            </motion.div>

            <div className="grid gap-4 sm:grid-cols-2">
              {differencePoints.map((point, i) => (
                <motion.div
                  key={point}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true }}
                  variants={makeVariant(16, 0.6)}
                  transition={{ delay: prefersReducedMotion ? 0 : i * 0.03 }}
                  className="rounded-xl border border-vs-soft/45 bg-white/85 px-4 py-4 text-sm text-vs-dark/90"
                >
                  {point}
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="h-px w-full bg-gradient-to-r from-transparent via-stone-300/40 to-transparent" />

      {/* Who it's for */}
      <section className="border-b border-vs-soft/30 bg-vs-warm">
        <div className="mx-auto max-w-7xl px-6 py-[72px] md:px-8 md:py-[120px]">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={sectionReveal}
            className="mb-12 max-w-2xl"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.38em] text-vs-accent">Who it&apos;s for</p>
            <h2 className="mt-4 font-display text-3xl font-medium tracking-[-0.03em] text-vs-charcoal md:text-4xl">
              Built for people shaping real spaces.
            </h2>
          </motion.div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {audiences.map((audience, i) => (
              <motion.article
                key={audience.title}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                variants={makeVariant(18, 0.6)}
                transition={{ delay: prefersReducedMotion ? 0 : i * 0.05 }}
                className="rounded-[20px] border border-vs-soft/40 bg-white/80 p-6 shadow-[0_16px_34px_rgba(4,12,46,0.04)]"
              >
                <h3 className="font-display text-2xl font-medium tracking-[-0.02em] text-vs-charcoal">
                  {audience.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-vs-dark/82">{audience.text}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <div className="h-px w-full bg-gradient-to-r from-transparent via-vs-soft/45 to-transparent" />

      {/* AI chat section */}
      <section className="border-b border-vs-soft/25 bg-vs-light">
        <div className="mx-auto max-w-7xl px-6 py-24 md:px-8 md:py-32">
          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              variants={sectionReveal}
              className="space-y-6"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.38em] text-vs-accent">
                AI chat assistant
              </p>
              <h2 className="font-display text-3xl font-medium leading-[1.12] tracking-[-0.03em] text-vs-charcoal md:text-[2.2rem]">
                Design with an assistant that understands space.
              </h2>
              <p className="max-w-lg text-sm leading-relaxed text-vs-dark/84">
                Ask for layout fixes, furniture swaps, budget alternatives, lighting changes, or
                style shifts in real time while designing.
              </p>
              <Link
                to="/chat"
                className="inline-flex items-center justify-center rounded-full bg-vs-accent px-7 py-3 text-sm font-semibold text-white transition hover:brightness-110"
              >
                Open Chat
              </Link>
            </motion.div>

            <motion.figure
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              variants={makeVariant(22, 0.75)}
              className="overflow-hidden rounded-[26px] border border-stone-200/70 shadow-[0_24px_60px_rgba(0,0,0,0.06)]"
            >
              <img
                src={lp('warm-library-space.jpg')}
                alt="Interior atmosphere preview"
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </motion.figure>
          </div>
        </div>
      </section>

      <div className="h-px w-full bg-gradient-to-r from-transparent via-vs-soft/45 to-transparent" />

      {/* Product reveal */}
      <section className="border-b border-vs-soft/25 bg-vs-warm">
        <div className="mx-auto max-w-7xl px-6 py-[72px] md:px-8 md:py-[120px]">
          <div className="grid items-start gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20">
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              variants={sectionReveal}
              className="space-y-8"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.38em] text-vs-accent">
                Product reveal
              </p>
              <h2 className="font-display text-3xl font-medium leading-[1.12] tracking-[-0.03em] text-vs-charcoal md:text-[2.35rem]">
                Spatial design intelligence with premium execution.
              </h2>
              <p className="text-base leading-relaxed text-vs-dark/85">
                Vision Studio bridges software craft and architectural thinking: structured layouts,
                real measurements, furniture intelligence, and a 3D line of sight for decisions you
                can defend to clients and collaborators.
              </p>
              <ul className="space-y-6 border-t border-vs-soft/40 pt-8">
                {whyVisionStudio.map((note) => (
                  <li key={note.label} className="max-w-prose">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-vs-accent">
                      {note.label}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-vs-dark/88">{note.text}</p>
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              variants={makeVariant(28, 0.8)}
              className="rounded-[28px] border border-vs-soft/45 bg-white/90 p-6 shadow-[0_32px_80px_rgba(4,12,46,0.08)]"
            >
              <div className="rounded-2xl border border-stone-200/80 bg-vs-midnight p-5 text-white shadow-inner">
                <div className="flex items-center gap-2 border-b border-white/10 pb-4">
                  <span className="h-2 w-2 rounded-full bg-red-400/90" />
                  <span className="h-2 w-2 rounded-full bg-amber-400/90" />
                  <span className="h-2 w-2 rounded-full bg-emerald-400/90" />
                  <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.2em] text-white/35">
                    Vision Studio
                  </span>
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-white/40">Plan</p>
                    <div className="mt-4 aspect-[4/3] rounded-lg border border-white/10 bg-gradient-to-br from-vs-accent/15 to-transparent" />
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-white/40">Review</p>
                    <div className="mt-4 aspect-[4/3] rounded-lg border border-white/10 bg-gradient-to-t from-black/30 to-vs-accent/10" />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <div className="h-px w-full bg-gradient-to-r from-transparent via-stone-600/25 to-transparent" />

      {/* Final CTA */}
      <section className="bg-vs-midnight px-6 py-[72px] text-center md:px-8 md:py-[120px]">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={sectionReveal}
          className="mx-auto max-w-3xl"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.38em] text-vs-soft">Final step</p>
          <h2 className="mt-6 font-display text-3xl font-medium leading-[1.15] tracking-[-0.03em] text-white md:text-4xl">
            Bring a floorplan. Leave with a room you can believe in.
          </h2>
          <div className="mt-12 flex flex-wrap justify-center gap-4">
            <Link
              to="/studio/new"
              className="inline-flex min-w-[180px] items-center justify-center rounded-full bg-vs-accent px-10 py-3.5 text-sm font-semibold text-white shadow-xl shadow-black/25 transition hover:brightness-110 active:scale-[0.98]"
            >
              Start Designing
            </Link>
            <Link
              to="/studio"
              className="inline-flex min-w-[180px] items-center justify-center rounded-full border border-white/25 bg-transparent px-10 py-3.5 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/10 active:scale-[0.98]"
            >
              Open Studio
            </Link>
          </div>
        </motion.div>
      </section>
    </div>
  );
}

function ImageCard({ image, title, wide = false }) {
  return (
    <motion.figure
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-40px' }}
      variants={{
        hidden: { opacity: 0, y: 16 },
        show: { opacity: 1, y: 0, transition: { duration: 0.7 } },
      }}
      className={`group relative overflow-hidden rounded-[26px] border border-white/10 ${wide ? 'min-h-[280px] md:min-h-[360px]' : 'min-h-[280px]'}`}
    >
      <img src={image} alt={title} className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]" loading="lazy" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
      <figcaption className="absolute bottom-0 left-0 p-6 md:p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-vs-soft/90">{title}</p>
      </figcaption>
    </motion.figure>
  );
}
