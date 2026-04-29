"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { lucasImage } from "@/lib/images";

const tiles = [
  {
    src: lucasImage("project-whitehouse-exterior.jpg"),
    alt: "Residential exterior",
    className:
      "md:col-span-2 md:row-span-2 md:col-start-1 md:row-start-1 min-h-[280px] md:min-h-[520px]",
  },
  {
    src: lucasImage("project-whitehouse-livingroom.jpg"),
    alt: "Living room interior",
    className:
      "md:col-span-2 md:col-start-3 md:row-start-1 min-h-[220px] md:min-h-[240px]",
  },
  {
    src: lucasImage("hero-alt.jpg"),
    alt: "Architectural rendering",
    className:
      "md:col-span-1 md:col-start-3 md:row-start-2 min-h-[220px] md:min-h-[260px]",
  },
  {
    src: lucasImage("circular-courtyard.jpg"),
    alt: "Circular courtyard",
    className:
      "md:col-span-1 md:col-start-4 md:row-start-2 min-h-[220px] md:min-h-[260px]",
  },
];

export function GalleryGrid() {
  return (
    <section id="gallery" className="relative scroll-mt-24 border-b border-stone-200/80 bg-[#fafaf9] py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.75 }}
          className="mb-14 max-w-2xl"
        >
          <h2 className="font-sans text-[clamp(2rem,4vw,3rem)] font-semibold tracking-[-0.03em] text-stone-900">
            Designed Outcomes
          </h2>
          <p className="mt-4 text-lg text-stone-600">
            From private homes to visionary spaces.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-4 md:grid-rows-2 md:gap-6">
          {tiles.map((tile, i) => (
            <motion.figure
              key={tile.alt}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.65, delay: i * 0.06 }}
              className={`group relative overflow-hidden rounded-[28px] bg-stone-200 shadow-[0_12px_40px_rgba(0,0,0,0.06)] ${tile.className}`}
            >
              <Image
                src={tile.src}
                alt={tile.alt}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover transition duration-700 ease-out group-hover:scale-[1.04]"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}
