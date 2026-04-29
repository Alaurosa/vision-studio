"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { lucasImage } from "@/lib/images";

const cards = [
  {
    src: lucasImage("interior-lobby.jpg"),
    alt: "Residential lounge",
    label: "Residential",
    body: "Homes, renovations, and tailored interior visions.",
  },
  {
    src: lucasImage("interior-atrium.jpg"),
    alt: "Commercial atrium",
    label: "Commercial",
    body: "Offices, retail, hospitality, and experiential spaces.",
  },
];

export function DoubleCompare() {
  return (
    <section id="compare" className="relative scroll-mt-24 border-b border-stone-200/80 bg-[#fafaf9] py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.h2
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="mb-14 font-sans text-[clamp(2rem,4vw,3rem)] font-semibold tracking-[-0.03em] text-stone-900"
        >
          Versatile By Design
        </motion.h2>

        <div className="grid gap-8 md:grid-cols-2 md:gap-10">
          {cards.map((c, i) => (
            <motion.article
              key={c.label}
              initial={{ opacity: 0, y: 26 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.65, delay: i * 0.1 }}
              className="group overflow-hidden rounded-[28px] border border-stone-200/90 bg-white shadow-[0_16px_48px_rgba(0,0,0,0.05)] transition duration-500 hover:-translate-y-2 hover:shadow-[0_28px_70px_rgba(0,0,0,0.1)]"
            >
              <div className="relative aspect-[16/11] overflow-hidden">
                <Image
                  src={c.src}
                  alt={c.alt}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover transition duration-700 group-hover:scale-[1.03]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60" />
              </div>
              <div className="p-8 md:p-10">
                <p className="text-[13px] font-semibold uppercase tracking-[0.28em] text-stone-400">
                  {c.label}
                </p>
                <p className="mt-3 text-base leading-relaxed text-stone-600">{c.body}</p>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
