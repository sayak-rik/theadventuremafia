import { z } from "zod";
import { adminRoute, json, parseBody, parseId } from "@/lib/api";
import { setRouteActive, updateRouteDetails } from "@/lib/listings/routes";

const schema = z.object({
  isActive: z.boolean().optional(),
  distanceKm: z.number().min(0).max(2000).nullish(),
  durationMinutes: z.number().int().min(0).max(4000).nullish(),
});

export const PUT = adminRoute<{ id: string }>(async (req, { id }) => {
  const routeId = parseId(id);
  const input = await parseBody(req, schema);
  if (input.isActive !== undefined) await setRouteActive(routeId, input.isActive);
  if (input.distanceKm !== undefined || input.durationMinutes !== undefined) {
    await updateRouteDetails(routeId, { distanceKm: input.distanceKm ?? null, durationMinutes: input.durationMinutes ?? null });
  }
  return json({ ok: true });
});
