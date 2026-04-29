"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { lucasImage } from "@/lib/images";

export function FeatureSplit() {
  return (
    <section id="features" className="relative scroll-mt-24 border-b border-stone-200/80 bg-white py-24 lg:py-32">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-6 lg:grid-cols-2 lg:gap-20 lg:px-8">
        <motion.div
          initial={{ opacity: 0, x: -36 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
          className="relative aspect-[4/5] overflow-hidden rounded-[28px] shadow-[0_24px_80px_rgba(0,0,0,0.08)] lg:aspect-[5/6]"
        >
          <Image
            src={lucasImage("project-cutaway.jpg")}
            alt="Architectural cutaway visualization"
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-stone-900/10 to-transparent" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 36 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
          className="max-w-xl lg:justify-self-end"
        >
          <p className="text-[13px] font-semibold uppercase tracking-[0.32em] text-stone-400">
            Intelligent spatial design
          </p>
          <h2 className="mt-5 font-sans text-[clamp(2rem,4vw,3rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-stone-900">
            See Beyond the Surface
          </h2>
          <p className="mt-8 text-lg leading-relaxed text-stone-600">
            Upload a room or property and generate intelligent layouts, furniture plans, and spatial
            transformations with AI precision.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
