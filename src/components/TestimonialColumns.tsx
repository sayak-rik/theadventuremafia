"use client";

import type { Testimonial } from "@/lib/data";
import { Marquee } from "./Marquee";
import { TestimonialCard } from "./TestimonialCard";

// Three vertical columns scrolling at different speeds, with a fade mask top
// and bottom. Content is server-rendered into the DOM (SEO-safe); the marquee
// only animates presentation and pauses on hover/focus.
export function TestimonialColumns({ testimonials }: { testimonials: Testimonial[] }) {
  // Split into up to three columns round-robin so each has a balanced set.
  const cols: Testimonial[][] = [[], [], []];
  testimonials.forEach((t, i) => cols[i % 3].push(t));
  const speeds = [26, 36, 30];

  return (
    <div className="grid max-h-[34rem] grid-cols-1 gap-6 overflow-hidden sm:grid-cols-2 lg:grid-cols-3">
      {cols.map((col, i) => (
        <Marquee
          key={i}
          direction="vertical"
          speed={speeds[i]}
          className={`max-h-[34rem] ${i === 1 ? "hidden sm:block" : ""} ${i === 2 ? "hidden lg:block" : ""}`}
        >
          {col.map((t) => (
            <TestimonialCard key={t.id} t={t} className="w-full" />
          ))}
        </Marquee>
      ))}
    </div>
  );
}
