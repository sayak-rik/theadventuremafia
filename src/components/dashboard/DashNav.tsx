"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarCheck, House, ListChecks, LogOut, UserRound, Wallet } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Same five generic pages either way — only the labels change. A driver's
 * "listings" are their vehicle(s) and "bookings" are trips, but it's the
 * exact same booking/listing machinery underneath.
 */
function navItemsFor(companyType: string) {
  const isDriver = companyType === "driver";
  return [
    { href: "/dashboard", label: "Today", icon: House, exact: true },
    { href: "/dashboard/bookings", label: isDriver ? "Trips" : "Bookings", icon: CalendarCheck, badge: true },
    { href: "/dashboard/listings", label: isDriver ? "Vehicle" : "Listings", icon: ListChecks },
    { href: "/dashboard/payments", label: "Payments", icon: Wallet },
    { href: "/dashboard/profile", label: "Profile", icon: UserRound },
  ];
}

/** How many bookings need the operator. Re-checked every 45 s, only while the tab is visible. */
function useActionCount() {
  const pathname = usePathname();
  const [n, setN] = useState(0);
  useEffect(() => {
    let live = true;
    const load = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/operator/badges", { cache: "no-store" });
        if (res.ok && live) setN((await res.json()).action ?? 0);
      } catch { /* offline — keep the last number */ }
    };
    load();
    const t = setInterval(load, 45_000);
    document.addEventListener("visibilitychange", load);
    return () => { live = false; clearInterval(t); document.removeEventListener("visibilitychange", load); };
  }, [pathname]);
  return n;
}

function useActive() {
  const pathname = usePathname();
  return (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));
}

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        await fetch("/api/operator/logout", { method: "POST" });
        router.replace("/dashboard/login");
        router.refresh();
      }}
    >
      <LogOut className="h-4 w-4" aria-hidden /> Sign out
    </button>
  );
}

/** Left rail on desktop. */
export function SideNav({ companyType = "operator" }: { companyType?: string }) {
  const active = useActive();
  const action = useActionCount();
  const items = navItemsFor(companyType);
  return (
    <nav aria-label="Dashboard" className="flex flex-col gap-1">
      {items.map(({ href, label, icon: Icon, exact, ...rest }) => {
        const on = active(href, exact);
        return (
          <Link key={href} href={href} aria-current={on ? "page" : undefined}
            className={cn("flex h-11 items-center gap-3 rounded-lg px-3 text-[15px] font-medium transition",
              on ? "bg-white/10 text-cream" : "text-cream/65 hover:bg-white/5 hover:text-cream")}>
            <Icon className="h-5 w-5" aria-hidden /> {label}
            {"badge" in rest && action > 0 && <span className="ml-auto rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold tabular-nums text-navy" aria-label={`${action} need action`}>{action}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

/** Bottom tab bar on phones — within thumb reach, respects the iOS home indicator. */
export function TabBar({ companyType = "operator" }: { companyType?: string }) {
  const active = useActive();
  const action = useActionCount();
  const items = navItemsFor(companyType);
  return (
    <nav aria-label="Dashboard" className="fixed inset-x-0 bottom-0 z-30 border-t border-navy/10 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {items.map(({ href, label, icon: Icon, exact, ...rest }) => {
          const on = active(href, exact);
          return (
            <li key={href}>
              <Link href={href} aria-current={on ? "page" : undefined}
                className={cn("relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium", on ? "text-navy" : "text-navy/55")}>
                <span className="relative">
                  <Icon className={cn("h-6 w-6", on && "text-green-600")} aria-hidden strokeWidth={on ? 2.4 : 2} />
                  {"badge" in rest && action > 0 && <span className="absolute -right-2.5 -top-1.5 min-w-[18px] rounded-full bg-amber-400 px-1 text-center text-[11px] font-bold leading-[18px] text-navy tabular-nums" aria-label={`${action} need action`}>{action}</span>}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
