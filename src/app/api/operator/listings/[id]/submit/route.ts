import { operatorRoute } from "@/lib/operator-auth";
import { revalidateMarketplace } from "@/lib/listings/public";
import { json, parseId } from "@/lib/api";
import { forCompany } from "@/lib/listings/repo";

// Send for review (or publish straight away for trusted, approved operators).
export const POST = operatorRoute<{ id: string }>(async (_req, s, { id }) => {
  const status = await forCompany(s.companyId).submit(parseId(id));
  revalidateMarketplace();
  return json({ ok: true, status });
});
