"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { lucasImage } from "@/lib/images";

export function InteriorBanner() {
  return (
    <section className="relative border-b border-stone-200/80 py-24 lg:py-32">
      <div className="relative mx-auto max-w-[min(100%,1280px)] overflow-hidden rounded-[28px] px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, scale: 1.03 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          className="relative aspect-[21/9] min-h-[340px] w-full overflow-hidden rounded-[28px] md:aspect-[21/8] lg:min-h-[420px]"
        >
          <Image
            src={lucasImage("warm-library-space.jpg")}
            alt="Warm wood library interior"
            fill
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/35 to-black/25" />

          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.75, delay: 0.15 }}
            >
              <h2 className="max-w-4xl font-sans text-[clamp(1.75rem,4vw,3rem)] font-semibold tracking-[-0.03em] text-white">
                Interiors That Feel Human
              </h2>
              <p className="mx-auto mt-6 max-w-2xl text-lg text-white/85 md:text-xl">
                Warmth, flow, materiality, and intelligence—generated instantly.
              </p>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
