import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';

/** Local Lucas portfolio assets (encode path for folder name with space) */
const lp = (file) =>
  `/images/${encodeURIComponent('lucas portfolio')}/${encodeURIComponent(file)}`;

const timeline = [
  {
    step: '01',
    title: 'Upload your plan',
    text: 'Floor plan or room photo in—geometry, scale, and zones aligned so the canvas matches reality.',
  },
  {
    step: '02',
    title: 'Describe the vision',
    text: 'Residential refresh, studio workflow, or hospitality tone. Your brief becomes the program.',
  },
  {
    step: '03',
    title: 'Edit the layout',
    text: 'Place furniture, tune circulation, and stay dimensionally honest while you iterate.',
  },
  {
    step: '04',
    title: 'Preview in 3D',
    text: 'Walk the space before you commit—materiality, proportion, and flow in one review.',
  },
];

const productNotes = [
  {
    label: 'Spatial intelligence',
    text: 'AI-assisted layout and catalog intelligence built for architecture-minded decisions—not generic prompts.',
  },
  {
    label: 'Material & furniture bridge',
    text: 'Connect real dimensions to furnishings and finishes so software stays grounded in buildable detail.',
  },
  {
    label: 'Who it serves',
    text: 'Homeowners refining a room, designers steering clients, and architects sketching possibilities faster.',
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

  const scrollToShowcase = () => {
    document.getElementById('showcase')?.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  };

  return (
    <div className="bg-vs-warm text-vs-charcoal">
      {/* Hero — full viewport, image-led, logo only in navbar */}
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
          <div className="absolute inset-0 bg-gradient-to-r from-black/78 via-black/55 to-black/35" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/25" />
        </div>

        <motion.div
          initial="hidden"
          animate="show"
          variants={heroVariants}
          className="relative z-10 mx-auto flex min-h-[100svh] max-w-7xl flex-col justify-end px-6 pb-20 pt-10 md:px-8 md:pb-28 lg:pb-32"
        >
          <div className="max-w-3xl text-left">
            <motion.p
              variants={heroItemVariants}
              className="mb-5 text-[11px] font-semibold uppercase tracking-[0.38em] text-white/65"
            >
              Vision Studio
            </motion.p>
            <motion.h1
              variants={heroItemVariants}
              className="font-display text-[clamp(2.25rem,5.5vw,4rem)] font-medium leading-[1.06] tracking-[-0.035em] text-white"
            >
              Design spaces that read like architecture.
            </motion.h1>
            <motion.p
              variants={heroItemVariants}
              className="mt-6 max-w-xl text-base leading-relaxed text-white/78 md:text-lg"
            >
              Upload a plan, shape the layout, refine materials, and preview the room in immersive 3D.
            </motion.p>
            <motion.div variants={heroItemVariants} className="mt-10 flex flex-wrap gap-3">
              <Link
                to="/upload"
                className="inline-flex items-center justify-center rounded-full bg-vs-accent px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-black/25 transition hover:brightness-110 active:scale-[0.98]"
              >
                Start with a plan
              </Link>
              <button
                type="button"
                onClick={scrollToShowcase}
                className="inline-flex items-center justify-center rounded-full border border-white/30 bg-white/10 px-8 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:border-white/45 hover:bg-white/15 active:scale-[0.98]"
              >
                Explore projects
              </button>
            </motion.div>
          </div>
        </motion.div>
      </section>

      <div className="h-px w-full bg-gradient-to-r from-transparent via-vs-soft/50 to-transparent" />

      {/* Process */}
      <section className="border-b border-vs-soft/30 bg-vs-light">
        <div className="mx-auto max-w-7xl px-6 py-24 md:px-8 md:py-32">
          <div className="grid gap-14 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.1fr)] lg:items-start">
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-80px' }}
              variants={sectionReveal}
              className="space-y-6"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.38em] text-vs-accent">
                Process
              </p>
              <h2 className="font-display text-3xl font-medium leading-[1.12] tracking-[-0.03em] text-vs-charcoal md:text-[2.25rem]">
                From plan upload to spatial review—without losing architectural intent.
              </h2>
              <p className="max-w-md text-sm leading-relaxed text-vs-dark/78">
                A measured sequence for homeowners, designers, and architects who want intelligence
                without noise.
              </p>
            </motion.div>

            <div className="grid gap-5 sm:grid-cols-2">
              {timeline.map((item, i) => (
                <motion.article
                  key={item.step}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, margin: '-40px' }}
                  variants={makeVariant(20, 0.65)}
                  transition={{ delay: prefersReducedMotion ? 0 : i * 0.05 }}
                  className="rounded-[24px] border border-vs-soft/40 bg-white/80 p-7 shadow-[0_20px_50px_rgba(4,12,46,0.05)] transition hover:shadow-[0_24px_60px_rgba(4,12,46,0.07)]"
                >
                  <p className="font-mono text-[11px] tabular-nums text-vs-accent">{item.step}</p>
                  <h3 className="mt-4 font-display text-lg font-medium tracking-[-0.02em] text-vs-charcoal">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-vs-dark/84">{item.text}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="h-px w-full bg-gradient-to-r from-transparent via-stone-300/40 to-transparent" />

      {/* Showcase — asymmetrical portfolio grid */}
      <section
        id="showcase"
        className="scroll-mt-24 border-b border-stone-800/10 bg-vs-charcoal text-stone-100"
      >
        <div className="mx-auto max-w-7xl px-6 py-24 md:px-8 md:py-32">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={sectionReveal}
            className="mb-14 flex flex-col justify-between gap-8 md:flex-row md:items-end"
          >
            <div className="max-w-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.38em] text-vs-soft">
                Spatial studies
              </p>
              <h2 className="mt-4 font-display text-3xl font-medium tracking-[-0.03em] md:text-4xl">
                Outcomes shaped like real projects.
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-stone-400">
              Residential massing, interior clarity, section thinking, and atmosphere—composed as a
              portfolio rhythm, not a template grid.
            </p>
          </motion.div>

          <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
            <motion.figure
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              variants={makeVariant(24, 0.75)}
              className="group relative min-h-[380px] flex-1 overflow-hidden rounded-[28px] border border-white/10 lg:min-h-[560px] lg:flex-[1.15]"
            >
              <img
                src={lp('project-whitehouse-exterior.jpg')}
                alt="Residential exterior study"
                className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <figcaption className="absolute bottom-0 left-0 p-8 md:p-10">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/60">
                  Residential
                </p>
                <p className="mt-2 font-display text-xl text-white">Envelope & approach</p>
              </figcaption>
            </motion.figure>

            <div className="flex flex-col gap-6 lg:flex-[0.85]">
              <motion.figure
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                variants={makeVariant(18, 0.65)}
                className="group relative aspect-[16/10] overflow-hidden rounded-[28px] border border-white/10"
              >
                <img
                  src={lp('project-whitehouse-livingroom.jpg')}
                  alt="Living space"
                  className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent opacity-0 transition group-hover:opacity-100" />
              </motion.figure>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <motion.figure
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true }}
                  variants={makeVariant(18, 0.6)}
                  className="group relative aspect-square overflow-hidden rounded-[24px] border border-white/10 sm:aspect-[4/5]"
                >
                  <img
                    src={lp('project-cutaway.jpg')}
                    alt="Section cutaway"
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
                    loading="lazy"
                  />
                </motion.figure>
                <motion.figure
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true }}
                  variants={makeVariant(18, 0.6)}
                  className="group relative aspect-square overflow-hidden rounded-[24px] border border-white/10 sm:aspect-[4/5]"
                >
                  <img
                    src={lp('hero-alt.jpg')}
                    alt="Visualization study"
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
                    loading="lazy"
                  />
                </motion.figure>
              </div>
            </div>
          </div>

          {/* Remaining portfolio imagery — decorative only (no copy changes) */}
          <div
            className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3"
            aria-hidden="true"
          >
            <figure className="group relative aspect-[4/3] overflow-hidden rounded-[24px] border border-white/10">
              <img
                src={lp('circular-courtyard.jpg')}
                alt=""
                className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
                loading="lazy"
              />
            </figure>
            <figure className="group relative aspect-[4/3] overflow-hidden rounded-[24px] border border-white/10">
              <img
                src={lp('interior-lobby.jpg')}
                alt=""
                className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
                loading="lazy"
              />
            </figure>
            <figure className="group relative aspect-[4/3] overflow-hidden rounded-[24px] border border-white/10">
              <img
                src={lp('interior-atrium.jpg')}
                alt=""
                className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
                loading="lazy"
              />
            </figure>
          </div>
        </div>
      </section>

      <div className="h-px w-full bg-gradient-to-r from-transparent via-stone-300/35 to-transparent" />

      {/* Interior atmosphere */}
      <section className="border-b border-vs-soft/25 bg-vs-warm">
        <div className="mx-auto max-w-7xl px-6 py-24 md:px-8 md:py-32">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={sectionReveal}
            className="mb-12 max-w-2xl"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.38em] text-vs-accent">
              Atmosphere
            </p>
            <h2 className="mt-4 font-display text-3xl font-medium tracking-[-0.03em] text-vs-charcoal md:text-4xl">
              Interiors with gravity and warmth.
            </h2>
          </motion.div>

          <motion.figure
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={makeVariant(26, 0.85)}
            className="group relative overflow-hidden rounded-[28px] border border-stone-200/80 shadow-[0_24px_70px_rgba(0,0,0,0.06)]"
          >
            <div className="relative aspect-[21/9] min-h-[280px] w-full md:min-h-[360px]">
              <img
                src={lp('warm-library-space.jpg')}
                alt="Warm wood interior"
                className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.02]"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
              <figcaption className="absolute bottom-0 left-0 p-8 md:p-12">
                <p className="max-w-lg font-display text-2xl text-white md:text-3xl">
                  Materiality and calm light—readable at human scale.
                </p>
              </figcaption>
            </div>
          </motion.figure>

          <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              variants={makeVariant(20, 0.7)}
              className="order-2 space-y-5 lg:order-1"
            >
              <h3 className="font-display text-2xl font-medium tracking-[-0.02em] text-vs-charcoal">
                Lobbies, lounges, and layered hospitality moments.
              </h3>
              <p className="text-sm leading-relaxed text-vs-dark/85">
                Translate brand tone into spatial sequence—seating, circulation, and quiet focal
                points that feel considered, not generated at random.
              </p>
            </motion.div>
            <motion.figure
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              variants={makeVariant(24, 0.75)}
              className="order-1 overflow-hidden rounded-[28px] border border-stone-200/80 shadow-lg lg:order-2"
            >
              <div className="relative aspect-[5/4] w-full">
                <img
                  src={lp('pink-lobby.jpg')}
                  alt="Hospitality lobby atmosphere"
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
            </motion.figure>
          </div>
        </div>
      </section>

      <div className="h-px w-full bg-gradient-to-r from-transparent via-vs-soft/45 to-transparent" />

      {/* Product reveal */}
      <section className="border-b border-vs-soft/25 bg-vs-light">
        <div className="mx-auto max-w-7xl px-6 py-24 md:px-8 md:py-32">
          <div className="grid items-start gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20">
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              variants={sectionReveal}
              className="space-y-8"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.38em] text-vs-accent">
                The studio
              </p>
              <h2 className="font-display text-3xl font-medium leading-[1.12] tracking-[-0.03em] text-vs-charcoal md:text-[2.35rem]">
                A spatial design studio—not a gimmick generator.
              </h2>
              <p className="text-base leading-relaxed text-vs-dark/85">
                Vision Studio bridges software craft and architectural thinking: structured layouts,
                real measurements, furniture intelligence, and a 3D line of sight for decisions you
                can defend to clients and collaborators.
              </p>
              <ul className="space-y-6 border-t border-vs-soft/40 pt-8">
                {productNotes.map((note) => (
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
                    Layout
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

      {/* Closing CTA */}
      <section className="bg-vs-midnight px-6 py-24 text-center md:px-8 md:py-32">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={sectionReveal}
          className="mx-auto max-w-2xl"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.38em] text-vs-soft">Next step</p>
          <h2 className="mt-6 font-display text-3xl font-medium leading-[1.15] tracking-[-0.03em] text-white md:text-4xl">
            Bring a plan, leave with a spatial story you can stand behind.
          </h2>
          <div className="mt-12 flex flex-wrap justify-center gap-4">
            <Link
              to="/upload"
              className="inline-flex min-w-[180px] items-center justify-center rounded-full bg-vs-accent px-10 py-3.5 text-sm font-semibold text-white shadow-xl shadow-black/25 transition hover:brightness-110 active:scale-[0.98]"
            >
              Start with a plan
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
