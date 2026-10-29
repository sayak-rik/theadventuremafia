import { after } from "next/server";
import { operatorRoute } from "@/lib/operator-auth";
import { json, parseBody, parseId } from "@/lib/api";
import { addBlackout, listBlackouts } from "@/lib/booking/blackouts";
import { blackoutSchema } from "@/lib/validation/booking";
import { notifyBooking, notifyFlagged } from "@/lib/notify/booking";
import { forCompany } from "@/lib/listings/repo";

export const GET = operatorRoute<{ id: string }>(async (_req, s, { id }) => {
  const listingId = parseId(id);
  await forCompany(s.companyId).assertOwned(listingId);
  return json({ blackouts: await listBlackouts(s.companyId, listingId) });
});

// Close dates / a slot / some units. Paid bookings in the way are flagged for rescheduling.
export const POST = operatorRoute<{ id: string }>(async (req, s, { id }) => {
  const input = await parseBody(req, blackoutSchema);
  const result = await addBlackout(s.companyId, parseId(id), input, s.companyUserId);
  const why = `Those dates are closed${input.reason ? `: ${input.reason}` : ""}.`;
  after(async () => {
    await notifyFlagged(result.flaggedIds, why);
    for (const bid of result.releasedIds) await notifyBooking(bid, "cancelled");
  });
  return json({ ok: true, ...result }, { status: 201 });
}, { requireApproved: true });
