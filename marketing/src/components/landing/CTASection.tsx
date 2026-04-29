"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { lucasImage } from "@/lib/images";

export function CTASection() {
  return (
    <section id="cta" className="relative isolate scroll-mt-24 py-28 lg:py-36">
      <div className="absolute inset-0 overflow-hidden">
        <Image
          src={lucasImage("hero-alt.jpg")}
          alt=""
          fill
          sizes="100vw"
          className="object-cover blur-sm scale-105"
          aria-hidden
        />
        <div className="absolute inset-0 bg-white/78 backdrop-blur-xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/65 to-white/85" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 22 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.75 }}
        className="relative z-10 mx-auto max-w-3xl px-6 text-center lg:px-8"
      >
        <h2 className="font-sans text-[clamp(2rem,4.5vw,3.25rem)] font-semibold tracking-[-0.03em] text-stone-900">
          Bring Your Space to Life.
        </h2>
        <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="#cta"
            className="inline-flex min-w-[160px] items-center justify-center rounded-full bg-stone-900 px-10 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-stone-900/15 transition hover:bg-stone-800 active:scale-[0.98]"
          >
            Start Free
          </Link>
          <Link
            href="mailto:hello@visionstudio.app?subject=Vision%20Studio%20demo"
            className="inline-flex min-w-[160px] items-center justify-center rounded-full border border-stone-300 bg-white/90 px-10 py-3.5 text-[15px] font-semibold text-stone-900 shadow-sm transition hover:border-stone-400 hover:bg-white active:scale-[0.98]"
          >
            Book Demo
          </Link>
        </div>
      </motion.div>
    </section>
  );
}
