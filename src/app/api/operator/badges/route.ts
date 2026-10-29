import { operatorRoute } from "@/lib/operator-auth";
import { json } from "@/lib/api";
import { companyCounts } from "@/lib/booking/queries";

// Polled (while the tab is visible) to light up the "needs action" badge.
export const GET = operatorRoute(async (_req, s) => json(await companyCounts(s.companyId), { headers: { "Cache-Control": "no-store" } }));
