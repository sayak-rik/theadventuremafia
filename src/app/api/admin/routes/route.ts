import { z } from "zod";
import { adminRoute, json, parseBody } from "@/lib/api";
import { createRoute, listRouteCatalog } from "@/lib/listings/routes";
import { slug } from "@/lib/validation/common";

const schema = z.object({
  originSlug: slug,
  destinationSlug: slug,
  distanceKm: z.number().min(0).max(2000).nullish(),
  durationMinutes: z.number().int().min(0).max(4000).nullish(),
});

export const GET = adminRoute(async () => json({ routes: await listRouteCatalog() }));

export const POST = adminRoute(async (req) => {
  const input = await parseBody(req, schema);
  const { id } = await createRoute({ originSlug: input.originSlug, destinationSlug: input.destinationSlug, distanceKm: input.distanceKm ?? null, durationMinutes: input.durationMinutes ?? null });
  return json({ ok: true, id }, { status: 201 });
});
