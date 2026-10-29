import { z } from "zod";
import { revalidateMarketplace } from "@/lib/listings/public";
import { after } from "next/server";
import { adminRoute, json, parseBody, parseId } from "@/lib/api";
import { applyOperatorAction } from "@/lib/operators/admin";
import { notifyOperatorApproved, notifyOperatorRejected, notifyOperatorSuspended } from "@/lib/notify";

const schema = z.object({
  action: z.enum(["approve", "reject", "suspend", "reinstate", "set_auto_publish", "set_verified", "set_commission"]),
  reason: z.string().trim().max(500).optional(),
  value: z.boolean().optional(),
  percent: z.number().min(0).max(100).optional(),
});

export const POST = adminRoute<{ id: string }>(async (req, { id }) => {
  const companyId = parseId(id);
  const { action, reason, value, percent } = await parseBody(req, schema);
  const op = await applyOperatorAction(companyId, action, { reason, value, percent });
  revalidateMarketplace();

  after(async () => {
    if (action === "approve" || action === "reinstate") await notifyOperatorApproved(op.email, op.ownerName, op.companyName);
    else if (action === "reject") await notifyOperatorRejected(op.email, op.ownerName, op.companyName, reason ?? null);
    else if (action === "suspend") await notifyOperatorSuspended(op.email, op.ownerName, op.companyName, reason ?? null);
  });
  return json({ ok: true, status: op.status });
});
