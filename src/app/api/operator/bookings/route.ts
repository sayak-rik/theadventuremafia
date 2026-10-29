import { z } from "zod";
import { operatorRoute } from "@/lib/operator-auth";
import { json, parseBody, parseQuery } from "@/lib/api";
import { createWalkInBooking } from "@/lib/booking/create";
import { listCompanyBookings } from "@/lib/booking/queries";
import { walkInSchema } from "@/lib/validation/booking";

const query = z.object({ tab: z.enum(["action", "upcoming", "past"]).default("action") });

export const GET = operatorRoute(async (req, s) => {
  const { tab } = parseQuery(req, query);
  return json({ bookings: await listCompanyBookings(s.companyId, tab) });
});

// Add a walk-in / phone / WhatsApp booking so the shop's own customers use the same inventory.
export const POST = operatorRoute(async (req, s) => {
  const input = await parseBody(req, walkInSchema);
  const booking = await createWalkInBooking(s.companyId, input);
  return json({ ok: true, id: booking.id, code: booking.code }, { status: 201 });
}, { requireApproved: true });
