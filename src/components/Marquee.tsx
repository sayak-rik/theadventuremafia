"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useMotionValue, useAnimationFrame, useReducedMotion } from "motion/react";

// A continuous, seamless marquee driven by Framer Motion (not CSS) so it can
// pause on hover/focus and honour prefers-reduced-motion. Content is rendered
// twice and the track wraps at the halfway point for an infinite loop.
export function Marquee({
  children,
  direction = "vertical",
  speed = 30, // pixels per second
  className = "",
}: {
  children: ReactNode;
  direction?: "vertical" | "horizontal";
  speed?: number;
  className?: string;
}) {
  const isV = direction === "vertical";
  const reduced = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const pos = useMotionValue(0);
  const [half, setHalf] = useState(0);
  const paused = useRef(false);

  useEffect(() => {
    const measure = () => {
      if (!trackRef.current) return;
      setHalf(isV ? trackRef.current.scrollHeight / 2 : trackRef.current.scrollWidth / 2);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [isV, children]);

  useAnimationFrame((_, delta) => {
    if (reduced || paused.current || !half) return;
    let next = pos.get() - (delta / 1000) * speed;
    if (next <= -half) next += half; // seamless wrap
    pos.set(next);
  });

  const flexDir = isV ? "flex-col" : "flex-row";
  const mask = isV
    ? "[mask-image:linear-gradient(to_bottom,transparent,black_10%,black_90%,transparent)]"
    : "[mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]";

  return (
    <div
      className={`overflow-hidden ${mask} ${className}`}
      onPointerEnter={() => (paused.current = true)}
      onPointerLeave={() => (paused.current = false)}
      onFocusCapture={() => (paused.current = true)}
      onBlurCapture={() => (paused.current = false)}
    >
      <motion.div
        ref={trackRef}
        style={isV ? { y: pos } : { x: pos }}
        className={`flex ${flexDir} ${isV ? "w-full" : "w-max"} gap-6`}
      >
        <div className={`flex ${flexDir} gap-6 ${isV ? "" : "shrink-0"}`}>{children}</div>
        {!reduced && (
          <div aria-hidden className={`flex ${flexDir} gap-6 ${isV ? "" : "shrink-0"}`}>
            {children}
          </div>
        )}
      </motion.div>
    </div>
  );
}
