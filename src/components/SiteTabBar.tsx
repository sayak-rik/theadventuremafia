"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House } from "lucide-react";
import { NAV_LINKS } from "@/data/site";
import { CategoryIcon } from "./marketplace/CategoryIcon";
import { cn } from "@/lib/cn";

/**
 * Phone-only bottom tabs mirroring the four things people come here to do.
 * Shown while browsing; hidden on pages that have their own sticky action bar.
 */
export function SiteTabBar() {
  const pathname = usePathname();
  const browsing = pathname === "/" || pathname.startsWith("/adventures") || /^\/companies\/[^/]+$/.test(pathname);
  if (!browsing) return null;

  // Bottom tabs stay at 5 for thumb reach — the first 4 nav links plus Home.
  const tabs = [{ href: "/", label: "Home", icon: null }, ...NAV_LINKS.slice(0, 4).map((l) => ({ href: l.href, label: l.label, icon: l.icon }))];
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href.replace(/\/pelling$/, "")));
  return (
    <nav aria-label="Browse" className="fixed inset-x-0 bottom-0 z-30 border-t border-navy/10 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {tabs.map((t) => (
          <li key={t.href}>
            <Link href={t.href} aria-current={active(t.href) ? "page" : undefined}
              className={cn("flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium", active(t.href) ? "text-navy" : "text-navy/55")}>
              {t.icon ? <CategoryIcon icon={t.icon} className={cn("h-6 w-6", active(t.href) && "text-green-600")} strokeWidth={active(t.href) ? 2.4 : 2} /> : <House className={cn("h-6 w-6", active(t.href) && "text-green-600")} aria-hidden strokeWidth={active(t.href) ? 2.4 : 2} />}
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
