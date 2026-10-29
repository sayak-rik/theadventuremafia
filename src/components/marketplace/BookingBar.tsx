import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/pricing";

/** Mobile-only sticky bar: price + a jump to the booking section. */
export function BookingBar({ price, unit }: { price: number; unit: string }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-navy/10 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-md items-center justify-between gap-4">
        <p className="text-sm text-navy/70"><strong className="block text-xl font-bold tabular-nums text-navy">{formatINR(price)}</strong>{unit}</p>
        <Button asChild size="lg" className="flex-1"><a href="#book">Check dates</a></Button>
      </div>
    </div>
  );
}
