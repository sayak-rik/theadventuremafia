import Link from "next/link";
import { SITE, FOOTER_LINKS } from "@/data/site";

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-navy text-cream">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-3">
        <div>
          <p className="font-serif text-xl font-bold">{SITE.name}</p>
          <p className="mt-3 max-w-xs text-sm text-cream/70">{SITE.description}</p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-green-300">
            Explore
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {FOOTER_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-cream/80 transition hover:text-green-300">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-green-300">
            Get in touch
          </p>
          <ul className="mt-4 space-y-2 text-sm text-cream/80">
            <li>
              <a href={`mailto:${SITE.email}`} className="hover:text-green-300">
                {SITE.email}
              </a>
            </li>
            <li>
              <a href={`tel:${SITE.phone.replace(/\s/g, "")}`} className="hover:text-green-300">
                {SITE.phone}
              </a>
            </li>
            <li className="pt-2 text-cream/60">
              Departures every Sunday · Sep–May
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-cream/50 sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} {SITE.name}. All rights reserved.</p>
          <p>Sikkim ILP permits required · Altitude advisory applies</p>
        </div>
      </div>
    </footer>
  );
}
