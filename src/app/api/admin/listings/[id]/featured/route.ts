import { z } from "zod";
import { revalidateMarketplace } from "@/lib/listings/public";
import { adminRoute, json, parseBody, parseId } from "@/lib/api";
import { setFeatured } from "@/lib/listings/moderation";
import { isoDate } from "@/lib/validation/common";

const schema = z.object({ isFeatured: z.boolean(), featuredUntil: isoDate.nullish() });

export const PUT = adminRoute<{ id: string }>(async (req, { id }) => {
  const input = await parseBody(req, schema);
  await setFeatured(parseId(id), { isFeatured: input.isFeatured, featuredUntil: input.featuredUntil ?? null });
  revalidateMarketplace();
  return json({ ok: true });
});
