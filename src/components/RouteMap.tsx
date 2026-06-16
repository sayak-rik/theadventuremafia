"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { ROUTE_STOPS } from "@/data/itinerary";

// Stylised journey line that draws itself as you scroll through the section,
// with a glowing "rider" beacon tracing the route and stop markers popping in.
// Not a geographic map — an evocative timeline of the expedition.
const POINTS = [
  { x: 40, y: 220 },
  { x: 150, y: 170 },
  { x: 250, y: 200 },
  { x: 360, y: 140 },
  { x: 470, y: 175 },
  { x: 580, y: 110 },
  { x: 700, y: 90 },
  { x: 800, y: 40 },
];

const path = POINTS.reduce(
  (d, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${d} L ${p.x} ${p.y}`),
  "",
);

const xs = POINTS.map((p) => p.x);
const ys = POINTS.map((p) => p.y);
const times = POINTS.map((_, i) => i / (POINTS.length - 1));

export function RouteMap() {
  const ref = useRef<HTMLDivElement>(null);
  // Tie the route draw to scroll progress through the section.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 85%", "end 60%"],
  });
  const pathLength = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <div ref={ref} className="overflow-x-auto">
      <svg
        viewBox="0 0 840 260"
        className="h-auto w-full min-w-[640px]"
        role="img"
        aria-label="Expedition route from NJP through Pelling, Dentam, Yuksom, Ravangla, Gangtok, Lachen to Lachung"
      >
        <defs>
          <linearGradient id="routeGrad" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--color-green)" />
            <stop offset="60%" stopColor="var(--color-green-300)" />
            <stop offset="100%" stopColor="var(--color-gold)" />
          </linearGradient>
          <filter id="routeGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* faint base track */}
        <path d={path} fill="none" stroke="rgba(245,243,232,0.15)" strokeWidth={3} strokeDasharray="2 8" />

        {/* scroll-drawn route */}
        <motion.path
          d={path}
          fill="none"
          stroke="url(#routeGrad)"
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#routeGlow)"
          style={{ pathLength }}
        />

        {/* flowing dash overlay for a sense of motion */}
        <motion.path
          d={path}
          fill="none"
          stroke="var(--color-cream)"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeDasharray="1 14"
          opacity={0.5}
          animate={{ strokeDashoffset: [0, -60] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
        />

        {/* moving rider beacon tracing the route */}
        <motion.circle
          r={7}
          fill="var(--color-green)"
          filter="url(#routeGlow)"
          animate={{ cx: xs, cy: ys }}
          transition={{ duration: 6, times, repeat: Infinity, repeatDelay: 0.8, ease: "easeInOut" }}
        />
        <motion.circle
          r={3}
          fill="var(--color-cream)"
          animate={{ cx: xs, cy: ys }}
          transition={{ duration: 6, times, repeat: Infinity, repeatDelay: 0.8, ease: "easeInOut" }}
        />

        {/* stop markers */}
        {POINTS.map((p, i) => {
          const endpoint = i === 0 || i === POINTS.length - 1;
          return (
            <motion.g
              key={ROUTE_STOPS[i]}
              initial={{ opacity: 0, scale: 0.3 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 + i * 0.18, type: "spring", stiffness: 260, damping: 16 }}
            >
              {endpoint && (
                <motion.circle
                  cx={p.x}
                  cy={p.y}
                  r={9}
                  fill="none"
                  stroke="var(--color-gold)"
                  strokeWidth={1.5}
                  animate={{ r: [9, 16, 9], opacity: [0.7, 0, 0.7] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut" }}
                />
              )}
              <circle cx={p.x} cy={p.y} r={endpoint ? 9 : 6} fill="var(--color-gold)" />
              <circle cx={p.x} cy={p.y} r={3} fill="var(--color-navy)" />
              <text
                x={p.x}
                y={p.y - 16}
                textAnchor="middle"
                className="fill-cream font-sans text-[13px] font-semibold"
              >
                {ROUTE_STOPS[i]}
              </text>
            </motion.g>
          );
        })}
      </svg>
    </div>
  );
}
