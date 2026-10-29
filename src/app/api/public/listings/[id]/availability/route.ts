import { z } from "zod";
import { publicRoute, json, parseId, parseQuery } from "@/lib/api";
import { clientIp } from "@/lib/http";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { getPublicAvailability } from "@/lib/booking/public";
import { isoDate } from "@/lib/validation/common";

const query = z.object({ from: isoDate, to: isoDate });

export const GET = publicRoute<{ id: string }>(async (req, { id }) => {
  const limit = await rateLimit(`avail-ip:${clientIp(req)}`, 240, 600);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);
  const { from, to } = parseQuery(req, query);
  const days = await getPublicAvailability(parseId(id), from, to);
  return json({ days }, { headers: { "Cache-Control": "public, max-age=0, s-maxage=10, stale-while-revalidate=20" } });
});
