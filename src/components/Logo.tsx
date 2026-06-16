import { SITE } from "@/data/site";

// Brand logo. The artwork lives at /public/logo.svg. A plain <img> is used
// (not next/image) so the SVG is served as-is without the optimizer, and there
// is no error-swap that could fail before hydration.
export function Logo({ size = 44 }: { size?: number }) {
  return (
    <span className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.svg"
        alt={`${SITE.name} logo`}
        width={size}
        height={size}
        className="rounded-full"
      />
      <span className="hidden flex-col leading-tight sm:flex">
        <span className="font-serif text-base font-bold tracking-wide text-cream">
          The Adventure Mafia
        </span>
        <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-green-300">
          West Sikkim Expedition
        </span>
      </span>
    </span>
  );
}
