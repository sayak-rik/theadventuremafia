import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/cn";

/** Gold is reserved for this badge only — it should mean "we actually checked". */
export function VerifiedBadge({ className, label = true }: { className?: string; label?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-[13px] font-semibold text-navy", className)} title="Checked by The Adventure Mafia">
      <BadgeCheck className="h-4 w-4 text-gold" aria-hidden />
      {label ? "Mafia Verified" : <span className="sr-only">Mafia Verified</span>}
    </span>
  );
}
