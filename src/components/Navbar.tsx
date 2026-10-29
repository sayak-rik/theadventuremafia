"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { NAV_LINKS } from "@/data/site";
import { Logo } from "./Logo";
import { CategoryIcon } from "./marketplace/CategoryIcon";
import { cn } from "@/lib/cn";

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`) || (href.includes("/pelling") && pathname.startsWith(href.replace("/pelling", "")));

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-navy/95 backdrop-blur-md">
      <nav aria-label="Primary" className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" aria-label="The Adventure Mafia — home"><Logo /></Link>

        <ul className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} aria-current={isActive(l.href) ? "page" : undefined}
                className={cn("flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition", isActive(l.href) ? "bg-white/10 text-green-300" : "text-cream/80 hover:text-cream")}>
                <CategoryIcon icon={l.icon} className="h-4 w-4" /> {l.label}
              </Link>
            </li>
          ))}
          <li className="hidden xl:block"><Link href="/itinerary" className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-cream/60 transition hover:text-cream">Sikkim expedition</Link></li>
        </ul>

        <div className="flex items-center gap-1.5">
          <Link href="/book/find" className="hidden whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium text-cream/70 transition hover:text-cream xl:block">Find my booking</Link>
          <Link href="/partner" className="whitespace-nowrap rounded-full border border-cream/30 px-4 py-2 text-sm font-semibold text-cream transition hover:border-cream/70 hover:bg-white/5">List your business</Link>
          <button type="button" className="rounded-md p-2 text-cream lg:hidden" aria-expanded={open} aria-controls="mobile-menu" aria-label="Menu" onClick={() => setOpen((v) => !v)}>
            {open ? <X className="h-6 w-6" aria-hidden /> : <Menu className="h-6 w-6" aria-hidden />}
          </button>
        </div>
      </nav>

      {open && (
        <ul id="mobile-menu" className="space-y-1 border-t border-white/10 bg-navy px-4 pb-4 pt-2 lg:hidden">
          {[...NAV_LINKS, { href: "/itinerary", label: "7-day Sikkim expedition", icon: "" }, { href: "/book/find", label: "Find my booking", icon: "" }].map((l) => (
            <li key={l.href}>
              <Link href={l.href} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-3 text-cream/90 hover:bg-white/5">
                {l.icon ? <CategoryIcon icon={l.icon} className="h-5 w-5 text-green-300" /> : <span className="w-5" />} {l.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}
