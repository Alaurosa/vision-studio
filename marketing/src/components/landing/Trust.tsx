"use client";

import { motion } from "framer-motion";

const pills = ["AI Visualization", "Realistic Layout Planning", "Luxury Interior Intelligence"];

export function Trust() {
  return (
    <section className="relative border-b border-stone-200/80 bg-[#fafaf9] py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 text-center lg:px-8">
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-4xl text-[clamp(1.375rem,3vw,2rem)] font-medium leading-snug tracking-[-0.025em] text-stone-800"
        >
          Built for homeowners, designers, architects, and developers.
        </motion.p>

        <motion.ul
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          variants={{
            hidden: {},
            show: {
              transition: { staggerChildren: 0.08, delayChildren: 0.15 },
            },
          }}
          className="mt-14 flex flex-wrap items-center justify-center gap-3 md:gap-4"
        >
          {pills.map((label) => (
            <motion.li
              key={label}
              variants={{
                hidden: { opacity: 0, y: 14 },
                show: { opacity: 1, y: 0, transition: { duration: 0.55 } },
              }}
              className="rounded-full border border-stone-200/90 bg-white px-6 py-3 text-sm font-medium text-stone-700 shadow-[0_2px_16px_rgba(0,0,0,0.04)]"
            >
              {label}
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}
