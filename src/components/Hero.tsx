"use client";

import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useScroll, useTransform } from "motion/react";
import { SITE } from "@/data/site";

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  // Subtle parallax: the image drifts down and fades slightly as you scroll past.
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "22%"]);
  const imageScale = useTransform(scrollYProgress, [0, 1], [1, 1.12]);
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "40%"]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <section ref={ref} className="relative isolate flex min-h-[88vh] items-center overflow-hidden bg-navy">
      {/* Full-bleed hero image with dark gradient for legibility (WCAG contrast). */}
      <motion.div style={{ y: imageY, scale: imageScale }} className="absolute inset-0 -z-10">
        <Image
          src="https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=2000&q=80"
          alt="Motorcyclist riding a mountain road in Sikkim with the Kanchenjunga range in the distance"
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-60"
        />
      </motion.div>
      <div className="absolute inset-0 -z-0 bg-gradient-to-b from-navy/70 via-navy/55 to-navy" />

      <motion.div style={{ y: contentY, opacity: contentOpacity }} className="relative mx-auto w-full max-w-7xl px-4 py-24 sm:px-6">
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-sm font-semibold uppercase tracking-[0.3em] text-green-300"
        >
          {SITE.product}
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="mt-5 max-w-3xl font-serif text-4xl font-bold leading-[1.05] text-cream sm:text-6xl"
        >
          Himalayan adventures in <span className="text-green-300">West & North Sikkim</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-6 max-w-xl text-lg leading-relaxed text-cream/85"
        >
          A flagship 7-day guided motorcycle expedition to Gurudongmar Lake, plus
          forest day treks and hikes around Pelling and Yuksom. Guided by riders and
          trekkers who call these hills home.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-9 flex flex-wrap gap-4"
        >
          <Link
            href="/adventures"
            className="rounded-full bg-green px-7 py-3.5 text-sm font-semibold text-white shadow-luxe transition hover:bg-green-600"
          >
            Explore adventures
          </Link>
          <Link
            href="/booking"
            className="rounded-full border border-cream/30 px-7 py-3.5 text-sm font-semibold text-cream transition hover:border-green-300 hover:text-green-300"
          >
            Book the expedition
          </Link>
        </motion.div>

        <motion.dl
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-14 grid max-w-lg grid-cols-3 gap-6 border-t border-cream/15 pt-8"
        >
          {[
            ["3+", "Adventures"],
            ["4,441 m", "Gurudongmar Lake"],
            ["Daily", "Day treks"],
          ].map(([big, small]) => (
            <div key={small}>
              <dt className="font-serif text-2xl font-bold text-cream">{big}</dt>
              <dd className="mt-1 text-xs uppercase tracking-wide text-cream/60">{small}</dd>
            </div>
          ))}
        </motion.dl>
      </motion.div>
    </section>
  );
}
