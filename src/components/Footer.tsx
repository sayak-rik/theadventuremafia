import Link from "next/link";
import { SITE, FOOTER_GROUPS } from "@/data/site";

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-navy pb-20 text-cream lg:pb-0">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.3fr_repeat(3,1fr)]">
        <div>
          <p className="font-serif text-xl font-bold">{SITE.name}</p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-cream/70">
            Tours, bikes, cars, river rafting and paragliding from verified local operators and drivers across Sikkim. You pay them directly — we never hold your money.
          </p>
          <ul className="mt-5 space-y-1.5 text-sm text-cream/80">
            <li><a href={`mailto:${SITE.email}`} className="hover:text-green-300">{SITE.email}</a></li>
            <li><a href={`tel:${SITE.phone.replace(/\s/g, "")}`} className="hover:text-green-300">{SITE.phone}</a></li>
          </ul>
        </div>

        {FOOTER_GROUPS.map((g) => (
          <div key={g.title}>
            <p className="text-sm font-semibold text-green-300">{g.title}</p>
            <ul className="mt-4 space-y-2 text-sm">
              {g.links.map((l) => (
                <li key={l.href}><Link href={l.href} className="text-cream/80 transition hover:text-green-300">{l.label}</Link></li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-cream/50 sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} {SITE.name}. All rights reserved.</p>
          <p>The Adventure Mafia connects customers with independent operators. Each operator is responsible for its own services.</p>
        </div>
      </div>
    </footer>
  );
}
