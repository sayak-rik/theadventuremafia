import { operatorRoute } from "@/lib/operator-auth";
import { revalidateMarketplace } from "@/lib/listings/public";
import { json, parseBody, parseId } from "@/lib/api";
import { forCompany } from "@/lib/listings/repo";
import { listingSchema } from "@/lib/validation/listing";

export const GET = operatorRoute<{ id: string }>(async (_req, s, { id }) =>
  json(await forCompany(s.companyId).get(parseId(id))),
);

export const PUT = operatorRoute<{ id: string }>(async (req, s, { id }) => {
  const input = await parseBody(req, listingSchema);
  const saved = await forCompany(s.companyId).save(parseId(id), input);
  revalidateMarketplace();
  return json({ ok: true, ...saved });
});
