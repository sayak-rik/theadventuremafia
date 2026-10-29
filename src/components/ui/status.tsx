import { cn } from "@/lib/cn";

type Tone = "green" | "amber" | "grey" | "red" | "blue";

const DOT: Record<Tone, string> = {
  green: "bg-green",
  amber: "bg-amber-500",
  grey: "bg-navy/30",
  red: "bg-red-600",
  blue: "bg-sky-600",
};

/** A small coloured dot + plain-language word — lighter than a pill badge. */
export function StatusDot({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm font-medium text-navy", className)}>
      <span aria-hidden className={cn("h-2.5 w-2.5 rounded-full", DOT[tone])} />
      {children}
    </span>
  );
}

export const LISTING_STATUS: Record<string, { label: string; tone: Tone; help: string }> = {
  draft: { label: "Draft", tone: "grey", help: "Not submitted yet" },
  pending_review: { label: "In review", tone: "amber", help: "We're checking it — usually within a day" },
  published: { label: "Live", tone: "green", help: "Customers can book it" },
  changes_requested: { label: "Needs changes", tone: "amber", help: "See the note, fix it, and submit again" },
  rejected: { label: "Not approved", tone: "red", help: "Not shown to customers" },
  deactivated: { label: "Paused", tone: "grey", help: "Hidden from customers" },
};

export const COMPANY_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "Awaiting approval", tone: "amber" },
  approved: { label: "Approved", tone: "green" },
  rejected: { label: "Not approved", tone: "red" },
  suspended: { label: "Suspended", tone: "red" },
};
