import { NextResponse } from "next/server";
import { handleError } from "@/lib/api";
import { safeEqual } from "@/lib/secrets";
import { runSweep } from "@/lib/booking/sweep";

export const dynamic = "force-dynamic";

// Called by the host's crontab (see DEPLOYMENT.md), not by browsers. POST only, so
// link prefetchers can't trigger it, and it answers 404 unless CRON_SECRET matches.
export async function POST(req: Request) {
  try {
    const expected = process.env.CRON_SECRET;
    const given = req.headers.get("x-cron-secret") ?? "";
    if (!expected || !safeEqual(given, expected)) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ ok: true, ...(await runSweep()) });
  } catch (err) {
    return handleError(err);
  }
}
