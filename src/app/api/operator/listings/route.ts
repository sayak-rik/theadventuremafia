import { operatorRoute } from "@/lib/operator-auth";
import { revalidateMarketplace } from "@/lib/listings/public";
import { json, parseBody } from "@/lib/api";
import { forCompany } from "@/lib/listings/repo";
import { listingSchema } from "@/lib/validation/listing";

export const GET = operatorRoute(async (_req, s) => json({ listings: await forCompany(s.companyId).list() }));

// Drafts can be created by pending operators too; publishing is gated separately.
export const POST = operatorRoute(async (req, s) => {
  const input = await parseBody(req, listingSchema);
  const saved = await forCompany(s.companyId).save(null, input);
  revalidateMarketplace();
  return json({ ok: true, ...saved }, { status: 201 });
});
