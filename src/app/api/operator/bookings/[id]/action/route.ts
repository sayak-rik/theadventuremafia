import { after } from "next/server";
import { operatorRoute } from "@/lib/operator-auth";
import { HttpError, json, parseBody, parseId } from "@/lib/api";
import { operatorTransition } from "@/lib/booking/transitions";
import { operatorActionSchema } from "@/lib/validation/booking";
import { notifyBooking } from "@/lib/notify/booking";

// A suspended / unapproved operator can still wind things down, but not start new work.
const ALLOWED_WHEN_NOT_APPROVED = new Set(["cancel", "refund_done", "note"]);

export const POST = operatorRoute<{ id: string }>(async (req, s, { id }) => {
  const bookingId = parseId(id);
  const op = await parseBody(req, operatorActionSchema);
  if (s.companyStatus !== "approved" && !ALLOWED_WHEN_NOT_APPROVED.has(op.action)) {
    throw new HttpError(403, "Your account isn't approved, so this isn't available.");
  }
  const { status } = await operatorTransition({ id: bookingId, companyId: s.companyId }, op, { type: "operator", id: s.companyUserId });

  if (op.action === "confirm_payment") after(() => notifyBooking(bookingId, "confirmed"));
  else if (op.action === "reject_payment") after(() => notifyBooking(bookingId, status === "cancelled" ? "cancelled" : "payment_not_received"));
  else if (op.action === "cancel") after(() => notifyBooking(bookingId, "cancelled"));
  else if (op.action === "move") after(() => notifyBooking(bookingId, "moved"));
  return json({ ok: true, status });
});
