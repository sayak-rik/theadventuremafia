import Link from "next/link";
import { cn } from "@/lib/cn";

const ITEMS = [
  { key: "bookings", href: "/admin", label: "Expedition" },
  { key: "marketplace", href: "/admin/marketplace", label: "Marketplace" },
  { key: "operators", href: "/admin/operators", label: "Operators" },
  { key: "listings", href: "/admin/listings", label: "Listings" },
  { key: "routes", href: "/admin/routes", label: "Routes" },
  { key: "referrals", href: "/admin/referrals", label: "Referrals" },
] as const;

export type AdminSection = (typeof ITEMS)[number]["key"];

/** Pill nav shared by every admin page (matches the original Bookings/Referrals tabs). */
export function AdminNav({ active }: { active: AdminSection }) {
  return (
    <nav aria-label="Admin" className="flex flex-wrap gap-2 text-sm">
      {ITEMS.map((i) => (
        <Link key={i.key} href={i.href} aria-current={active === i.key ? "page" : undefined}
          className={cn("rounded-full px-3 py-1.5 font-semibold", active === i.key ? "bg-navy text-cream" : "text-navy/50 hover:bg-cream")}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
