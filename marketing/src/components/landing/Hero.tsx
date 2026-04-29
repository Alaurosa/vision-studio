"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { lucasImage } from "@/lib/images";

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.14]);
  const overlayOpacity = useTransform(scrollYProgress, [0, 0.8], [0.52, 0.72]);

  return (
    <section ref={sectionRef} className="relative min-h-[100svh] overflow-hidden">
      <motion.div style={{ scale }} className="absolute inset-0 origin-center">
        <Image
          src={lucasImage("hero-main.jpg")}
          alt="Architectural exterior at dusk"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      </motion.div>

      <motion.div
        style={{ opacity: overlayOpacity }}
        className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/25"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/15" />

      <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-7xl flex-col justify-center px-6 pb-24 pt-32 lg:px-8 lg:pb-32 lg:pt-36">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          className="max-w-3xl"
        >
          <p className="mb-6 text-[13px] font-semibold uppercase tracking-[0.35em] text-white/75">
            Vision Studio
          </p>
          <h1 className="font-sans text-[clamp(2.5rem,6vw,4.25rem)] font-semibold leading-[1.05] tracking-[-0.035em] text-white">
            Design Spaces Intelligently.
          </h1>
          <p className="mt-8 max-w-xl text-lg leading-relaxed text-white/82 md:text-xl">
            AI-powered room, home, and architectural redesign for the next generation of living.
          </p>
          <div className="mt-12 flex flex-wrap gap-4">
            <Link
              href="#cta"
              className="inline-flex items-center justify-center rounded-full bg-white px-8 py-3.5 text-[15px] font-semibold text-stone-900 shadow-lg shadow-black/15 transition hover:bg-stone-100 active:scale-[0.98]"
            >
              Start Designing
            </Link>
            <Link
              href="#gallery"
              className="inline-flex items-center justify-center rounded-full border border-white/35 bg-white/10 px-8 py-3.5 text-[15px] font-semibold text-white backdrop-blur-sm transition hover:bg-white/18 active:scale-[0.98]"
            >
              View Demo
            </Link>
          </div>
        </motion.div>
      </div>

      <div className="pointer-events-none absolute bottom-10 left-1/2 z-10 hidden -translate-x-1/2 md:block">
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          className="h-12 w-[1px] rounded-full bg-gradient-to-b from-white/0 via-white/50 to-white/0"
        />
      </div>
    </section>
  );
}
