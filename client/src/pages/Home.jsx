import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion, useReducedMotion } from 'framer-motion';

const sections = [
  { n: '01', title: 'Capture', body: 'Upload any floorplan or room photo. Our vision pipeline detects walls, rooms, windows, doors, and existing furniture — preserving the story of your space.' },
  { n: '02', title: 'Compose', body: 'Drag from a living catalog of real IKEA and Ashley pieces. Snap to grid, rotate, and arrange in a canvas tuned for the way architects actually work.' },
  { n: '03', title: 'Converse', body: 'A resident AI designer chats alongside you. Ask it to auto-arrange, suggest a coffee table under $300, or validate clearances — and it acts on the canvas in real time.' },
  { n: '04', title: 'Deliver', body: 'Export to JSON, SVG, or DXF. Step into a 3D walkthrough. Share a finished layout with a contractor or a client without losing a single inch of intent.' },
];

const services = [
  { k: 'Architectural Intake',   body: 'OpenCV + Grounding DINO + SAM segment your floorplan into precise room geometry, measured in real-world inches.' },
  { k: 'Interior Mastery',       body: 'A curated catalog of production-grade furniture with dimensions, prices, and provider links — not stock photography.' },
  { k: 'Autonomous Layouts',     body: 'An agent that reasons about flow, clearance, and composition, then places furniture you can still move by hand.' },
  { k: 'Studio Tooling',         body: 'Undo, zones, 2D and 3D views, exports for any downstream tool in the design stack.' },
];

export default function Home() {
  const prefersReducedMotion = useReducedMotion();

  const ease = [0.22, 1, 0.36, 1];
  const instant = { duration: 0.01 };
  const makeTransition = (dur = 0.9) => prefersReducedMotion ? instant : { duration: dur, ease };
  const makeVariant = (yOffset = 20, dur = 0.9) => ({
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : yOffset },
    show: { opacity: 1, y: 0, transition: makeTransition(dur) },
  });

  const heroVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: prefersReducedMotion
        ? { staggerChildren: 0 }
        : { staggerChildren: 0.14, delayChildren: 0.08 },
    },
  };
  const heroItemVariants = makeVariant(18, 1.1);
  const sectionHeadingVariants = makeVariant(20, 0.9);
  const cardVariants = makeVariant(24, 0.9);
  const rowVariants = makeVariant(14, 0.75);

  return (
    <div className="relative">
      <Helmet>
        <title>Vision Studio — AI-Powered Spatial Layout Engine</title>
        <meta name="description" content="Upload a floorplan, let AI detect rooms and dimensions, then design layouts with real IKEA and Ashley furniture. Export to JSON, SVG, or DXF." />
      </Helmet>
      {/* HERO */}
      <section className="relative overflow-hidden noise">
        <motion.div
          initial="hidden"
          animate="show"
          variants={heroVariants}
          className="max-w-8xl mx-auto px-6 md:px-10 pt-24 md:pt-32 pb-20 md:pb-28"
        >
          <motion.p
            variants={heroItemVariants}
            className="eyebrow mb-8"
          >
            Vision Studio · Spatial Layout Engine
          </motion.p>
          <motion.h1
            variants={heroItemVariants}
            className="display-xl max-w-5xl"
          >
            Design the rooms<br />
            <span className="italic">you actually live in.</span>
          </motion.h1>
          <motion.p
            variants={heroItemVariants}
            className="max-w-xl mt-10 text-ink-600 text-lg leading-relaxed"
          >
            An AI-powered studio for anyone who has ever sketched a room on a
            napkin. Upload a plan, speak to a designer, and watch your layout
            take shape in seconds — measured, moveable, and unmistakably yours.
          </motion.p>
          <motion.div
            variants={heroItemVariants}
            className="flex flex-wrap gap-4 mt-12"
          >
            <Link to="/upload" className="btn-ink">Upload a Floorplan</Link>
            <Link to="/studio" className="btn-ghost">LEARN MORE</Link>
          </motion.div>
        </motion.div>

        {/* Ambient gradient frame */}
        <div aria-hidden className="absolute -bottom-px left-0 right-0 h-px bg-ink-900/10" />
        <motion.div
          aria-hidden
          initial={{ opacity: 0, scaleY: prefersReducedMotion ? 1 : 0.96 }}
          animate={{ opacity: 1, scaleY: 1 }}
          transition={makeTransition(1.1)}
          className="absolute inset-x-0 top-0 h-[520px] origin-top -z-10 bg-gradient-to-b from-paper-200/40 via-paper-50 to-paper-50"
        />
      </section>

      {/* PLATFORM STRIP */}
      <section className="border-t border-b border-ink-900/10 bg-paper-100">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.75 }}
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: prefersReducedMotion ? { staggerChildren: 0 } : { staggerChildren: 0.08 },
            },
          }}
          className="max-w-8xl mx-auto px-6 md:px-10 py-10 flex flex-wrap items-center gap-x-12 gap-y-4 text-ink-500"
        >
          {['Built with', 'OpenAI', 'Supabase', 'Meshy', 'React', 'Konva'].map((item, index) => (
            <motion.span
              key={item}
              variants={{
                hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 10 },
                show: { opacity: 1, y: 0, transition: { ...makeTransition(0.7) } },
              }}
              className={index === 0
                ? 'eyebrow'
                : `font-display text-xl tracking-tight${index % 2 === 0 ? '' : ' italic'}`}
            >
              {item}
            </motion.span>
          ))}
        </motion.div>
      </section>

      {/* PROCESS */}
      <section className="max-w-8xl mx-auto px-6 md:px-10 py-24 md:py-32">
        <div className="grid md:grid-cols-12 gap-10 mb-16">
          <motion.p
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.8 }}
            variants={sectionHeadingVariants}
            className="eyebrow md:col-span-3"
          >
            The Process
          </motion.p>
          <motion.h2
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.45 }}
            variants={sectionHeadingVariants}
            className="display-lg md:col-span-9 max-w-3xl"
          >
            A studio workflow, reimagined around the way you actually think about a space.
          </motion.h2>
        </div>
        <div className="grid md:grid-cols-2 gap-px bg-ink-900/10">
          {sections.map((s, i) => (
            <motion.div
              key={s.n}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.22 }}
              variants={cardVariants}
              transition={prefersReducedMotion ? { duration: 0.01 } : { ...makeTransition(0.9), delay: i * 0.06 }}
              className="bg-paper-50 p-10 md:p-14"
            >
              <div className="eyebrow mb-8">{s.n}</div>
              <h3 className="display-md mb-4">{s.title}</h3>
              <p className="text-ink-600 max-w-md leading-relaxed">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* BIG QUOTE */}
      <section className="bg-ink-900 text-paper-100">
        <div className="max-w-8xl mx-auto px-6 md:px-10 py-28 md:py-40 grid md:grid-cols-12 gap-10">
          <motion.p
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.85 }}
            variants={sectionHeadingVariants}
            className="eyebrow text-paper-400 md:col-span-3"
          >
            Philosophy
          </motion.p>
          <motion.blockquote
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.45 }}
            variants={{
              hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 28 },
              show: { opacity: 1, y: 0, transition: makeTransition(1) },
            }}
            className="md:col-span-9 display-lg text-paper-100 max-w-4xl"
          >
            Every room is a paragraph in a larger story. Vision Studio holds
            the pen steady while you do the writing.
          </motion.blockquote>
        </div>
      </section>

      {/* SERVICES */}
      <section className="max-w-8xl mx-auto px-6 md:px-10 py-24 md:py-32">
        <div className="grid md:grid-cols-12 gap-10 mb-16">
          <motion.p
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.8 }}
            variants={sectionHeadingVariants}
            className="eyebrow md:col-span-3"
          >
            Our Services
          </motion.p>
          <motion.h2
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.45 }}
            variants={sectionHeadingVariants}
            className="display-lg md:col-span-9 max-w-3xl"
          >
            Tools with taste. Automation with restraint.
          </motion.h2>
        </div>
        <div className="divide-y divide-ink-900/10 border-y border-ink-900/10">
          {services.map((s, i) => (
            <motion.div
              key={s.k}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.4 }}
              variants={rowVariants}
              transition={prefersReducedMotion ? { duration: 0.01 } : { ...rowVariants.show.transition, delay: i * 0.04 }}
              className="grid md:grid-cols-12 gap-6 md:gap-10 py-10 group hover:bg-paper-100 transition-colors"
            >
              <div className="md:col-span-1 eyebrow text-ink-400">0{i + 1}</div>
              <h3 className="md:col-span-4 font-display text-2xl md:text-3xl">
                {s.k}
              </h3>
              <p className="md:col-span-6 text-ink-600 max-w-xl leading-relaxed">
                {s.body}
              </p>
              <div className="md:col-span-1 flex md:justify-end items-start">
                <span className="inline-block w-10 h-10 rounded-full border border-ink-900/20 grid place-items-center text-ink-700 group-hover:bg-ink-900 group-hover:text-paper-50 group-hover:border-ink-900 transition">↗</span>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-8xl mx-auto px-6 md:px-10 py-24 md:py-32">
        <div className="grid md:grid-cols-12 gap-10 items-end">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.55 }}
            variants={sectionHeadingVariants}
            className="md:col-span-8"
          >
            <p className="eyebrow mb-6">Let's begin</p>
            <h2 className="display-lg max-w-3xl">
              Bring a floorplan. Leave with a layout you'd actually build.
            </h2>
          </motion.div>
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.55 }}
            variants={{
              hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 18 },
              show: { opacity: 1, y: 0, transition: { ...makeTransition(0.9), delay: prefersReducedMotion ? 0 : 0.08 } },
            }}
            className="md:col-span-4 flex md:justify-end gap-3 flex-wrap"
          >
            <Link to="/upload" className="btn-ink">Upload Floorplan</Link>
            <Link to="/studio" className="btn-ghost">Studio</Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
