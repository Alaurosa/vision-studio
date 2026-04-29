"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { lucasImage } from "@/lib/images";

export function SecondarySplit() {
  return (
    <section className="relative border-b border-stone-200/80 bg-white py-24 lg:py-32">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-6 lg:grid-cols-2 lg:gap-20 lg:px-8">
        <motion.div
          initial={{ opacity: 0, x: -28 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="order-2 max-w-xl lg:order-1 lg:justify-self-start"
        >
          <p className="text-[13px] font-semibold uppercase tracking-[0.32em] text-stone-400">
            Hospitality-grade environments
          </p>
          <h2 className="mt-5 font-sans text-[clamp(2rem,4vw,3rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-stone-900">
            Hospitality-Level Beauty
          </h2>
          <p className="mt-8 text-lg leading-relaxed text-stone-600">
            Generate premium lounges, offices, lobbies, wellness spaces, and modern environments
            tailored to your aesthetic.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 28 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.06 }}
          className="relative order-1 aspect-[4/5] overflow-hidden rounded-[28px] shadow-[0_24px_80px_rgba(0,0,0,0.08)] lg:order-2 lg:aspect-[5/6]"
        >
          <Image
            src={lucasImage("pink-lobby.jpg")}
            alt="Pink-toned hospitality lobby"
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-bl from-transparent via-transparent to-black/15" />
        </motion.div>
      </div>
    </section>
  );
}
