import { operatorRoute } from "@/lib/operator-auth";
import { revalidateMarketplace } from "@/lib/listings/public";
import { json, parseBody } from "@/lib/api";
import { getCompanyProfile, updateCompanyProfile } from "@/lib/operators/account";
import { profileSchema } from "@/lib/validation/operator";

export const GET = operatorRoute(async (_req, s) => json(await getCompanyProfile(s.companyId)));

export const PUT = operatorRoute(async (req, s) => {
  const input = await parseBody(req, profileSchema);
  await updateCompanyProfile(s.companyId, input);
  revalidateMarketplace();
  return json({ ok: true });
});
