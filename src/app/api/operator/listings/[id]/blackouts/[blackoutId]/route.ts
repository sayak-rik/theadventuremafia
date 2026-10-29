import { operatorRoute } from "@/lib/operator-auth";
import { json, parseId } from "@/lib/api";
import { removeBlackout } from "@/lib/booking/blackouts";

export const DELETE = operatorRoute<{ id: string; blackoutId: string }>(async (_req, s, { id, blackoutId }) => {
  await removeBlackout(s.companyId, parseId(id), parseId(blackoutId, "closure id"));
  return json({ ok: true });
});
