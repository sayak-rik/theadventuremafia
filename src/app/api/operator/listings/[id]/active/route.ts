import { z } from "zod";
import { revalidateMarketplace } from "@/lib/listings/public";
import { operatorRoute } from "@/lib/operator-auth";
import { json, parseBody, parseId } from "@/lib/api";
import { forCompany } from "@/lib/listings/repo";

// Pause or resume a live listing.
export const POST = operatorRoute<{ id: string }>(async (req, s, { id }) => {
  const { active } = await parseBody(req, z.object({ active: z.boolean() }));
  const status = await forCompany(s.companyId).setActive(parseId(id), active);
  revalidateMarketplace();
  return json({ ok: true, status });
});
