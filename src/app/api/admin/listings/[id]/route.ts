import { z } from "zod";
import { revalidateMarketplace } from "@/lib/listings/public";
import { after } from "next/server";
import { adminRoute, json, parseBody, parseId } from "@/lib/api";
import { reviewListing } from "@/lib/listings/moderation";
import { notifyListingDecision } from "@/lib/notify";

const schema = z.object({
  action: z.enum(["publish", "request_changes", "reject", "deactivate", "reinstate"]),
  note: z.string().trim().max(1000).optional(),
});

export const POST = adminRoute<{ id: string }>(async (req, { id }) => {
  const { action, note } = await parseBody(req, schema);
  const r = await reviewListing(parseId(id), action, note);
  revalidateMarketplace();

  const decision = r.status === "published" ? "published" : r.status === "changes_requested" ? "changes_requested" : r.status === "rejected" ? "rejected" : null;
  if (decision && r.operatorEmail) {
    after(() => notifyListingDecision(r.operatorEmail, { name: r.operatorName, title: r.title, decision, note: r.note }));
  }
  return json({ ok: true, status: r.status });
});
