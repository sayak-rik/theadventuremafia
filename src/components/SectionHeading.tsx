import { Reveal } from "./Reveal";

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  light = false,
  center = false,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  light?: boolean;
  center?: boolean;
}) {
  return (
    <Reveal className={center ? "text-center" : ""}>
      {eyebrow && (
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-green-600">
          {eyebrow}
        </p>
      )}
      <h2
        className={`font-serif text-3xl font-bold tracking-tight sm:text-4xl ${
          light ? "text-cream" : "text-navy"
        }`}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className={`mt-4 max-w-2xl text-base leading-relaxed ${
            center ? "mx-auto" : ""
          } ${light ? "text-cream/70" : "text-navy/70"}`}
        >
          {subtitle}
        </p>
      )}
    </Reveal>
  );
}
