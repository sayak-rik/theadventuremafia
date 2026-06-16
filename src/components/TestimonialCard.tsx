import type { Testimonial } from "@/lib/data";

function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// Pure presentational card — safe to render inside client marquees or server lists.
export function TestimonialCard({ t, className = "" }: { t: Testimonial; className?: string }) {
  return (
    <figure
      className={`flex flex-col rounded-2xl border border-navy/10 bg-white p-6 shadow-sm transition-shadow duration-300 hover:shadow-luxe ${className}`}
    >
      <div className="text-gold" aria-label={`${t.rating} out of 5 stars`}>
        {"★".repeat(t.rating)}
        <span className="text-gold/25">{"★".repeat(5 - t.rating)}</span>
      </div>
      <blockquote className="mt-3 flex-1 text-[15px] leading-relaxed text-navy/85">
        “{t.content}”
      </blockquote>
      <figcaption className="mt-5 flex items-center gap-3">
        <span
          aria-hidden
          className="flex h-10 w-10 items-center justify-center rounded-full bg-green/10 font-serif text-sm font-bold text-green-600"
        >
          {initials(t.name)}
        </span>
        <span className="text-sm leading-tight">
          <span className="block font-semibold text-navy">{t.name}</span>
          {t.location && <span className="block text-navy/50">{t.location}</span>}
        </span>
      </figcaption>
    </figure>
  );
}
