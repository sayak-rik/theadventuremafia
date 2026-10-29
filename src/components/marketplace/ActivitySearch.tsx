"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/field";
import { CategoryIcon } from "./CategoryIcon";
import { cn } from "@/lib/cn";

const TABS = [
  { slug: "guided-tours", label: "Tours", icon: "map", path: "/adventures/guided-tours" },
  { slug: "bike-rental", label: "Bike", icon: "bike", path: "/adventures/bike-rental" },
  { slug: "scooty-rental", label: "Scooty", icon: "scooter", path: "/adventures/scooty-rental" },
  { slug: "rafting", label: "Rafting", icon: "waves", path: "/adventures/rafting" },
  { slug: "paragliding", label: "Paragliding", icon: "wind", path: "/adventures/paragliding" },
];

/** The one question the home page asks: what do you want to do, and when? */
export function ActivitySearch({ today }: { today: string }) {
  const router = useRouter();
  const [tab, setTab] = useState(TABS[0]);
  const [date, setDate] = useState("");

  return (
    <form
      className="rounded-2xl bg-white p-3 shadow-luxe sm:p-4"
      onSubmit={(e) => { e.preventDefault(); router.push(`${tab.path}${date ? `?date=${date}` : ""}`); }}
    >
      <div role="group" aria-label="What do you want to do?" className="grid grid-cols-5 gap-1.5 rounded-xl bg-navy/[0.05] p-1.5">
        {TABS.map((t) => (
          <button key={t.slug} type="button" aria-pressed={tab.slug === t.slug} onClick={() => setTab(t)}
            className={cn("flex h-14 flex-col items-center justify-center gap-1 rounded-lg text-[13px] font-semibold transition sm:h-12 sm:flex-row sm:gap-2 sm:text-sm",
              tab.slug === t.slug ? "bg-navy text-cream shadow-sm" : "text-navy/70 hover:bg-white")}>
            <CategoryIcon icon={t.icon} className="h-5 w-5" /> {t.label}
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
        <div>
          <label htmlFor="home-date" className="mb-1.5 block text-sm font-semibold text-navy">Which day?</label>
          <input id="home-date" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} className={cn(fieldClass, "h-12")} />
        </div>
        <Button type="submit" size="lg" className="self-end"><Search className="h-5 w-5" aria-hidden /> Show what's free</Button>
      </div>
      <p className="mt-2.5 text-center text-[13px] text-navy/55">
        Need a car instead? <a href="/adventures/car-hire" className="font-semibold text-green-700 underline-offset-2 hover:underline">Browse routes and drivers</a>
      </p>
    </form>
  );
}
