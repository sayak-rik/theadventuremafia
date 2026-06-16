"use client";

import { motion, useScroll, useSpring } from "motion/react";

// Slim page scroll-progress bar pinned under the navbar. Subtle and minimal —
// a thin green line that fills as you scroll.
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 });

  return (
    <motion.div
      aria-hidden
      style={{ scaleX }}
      className="fixed left-0 top-0 z-50 h-0.5 w-full origin-left bg-gradient-to-r from-green via-green-300 to-gold"
    />
  );
}
