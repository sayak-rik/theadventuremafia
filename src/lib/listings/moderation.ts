import { requirePool, withTx } from "../db";
import { HttpError } from "../api";
import { forCompany, type ListingDetail } from "./repo";
import type { ListingStatus } from "./repo";

export type ReviewRow = {
  id: number;
  title: string;
  status: ListingStatus;
  moderationNote: string | null;
  companyId: number;
  companyName: string;
  companyStatus: string;
  categoryName: string;
  regionName: string;
  unitPrice: number | null;
  bookingModel: string;
  cover: string | null;
  updatedAt: string;
};

export async function listForReview(status: ListingStatus | "all"): Promise<ReviewRow[]> {
  const res = await requirePool().query(
    `SELECT l.id, l.title, l.status, l.moderation_note, l.unit_price, l.updated_at, c.id AS company_id, c.name AS company_name, c.status AS company_status,
            ac.name AS category_name, ac.booking_model, r.name AS region_name,
            (SELECT i.thumb_url FROM listing_images i WHERE i.listing_id = l.id ORDER BY i.sort_order, i.id LIMIT 1) AS cover
       FROM adventure_listings l
       JOIN companies c ON c.id = l.company_id
       JOIN adventure_categories ac ON ac.id = l.category_id
       JOIN regions r ON r.id = l.region_id
      WHERE ($1 = 'all' OR l.status = $1)
      ORDER BY l.updated_at DESC LIMIT 200`,
    [status],
  );
  return res.rows.map((r) => ({
    id: r.id, title: r.title, status: r.status, moderationNote: r.moderation_note, companyId: r.company_id, companyName: r.company_name,
    companyStatus: r.company_status, categoryName: r.category_name, regionName: r.region_name, unitPrice: r.unit_price,
    bookingModel: r.booking_model, cover: r.cover, updatedAt: new Date(r.updated_at).toISOString(),
  }));
}

export type ReviewAction = "publish" | "request_changes" | "reject" | "deactivate" | "reinstate";

/** Admin decision on a listing. Returns what the operator should be told. */
export async function reviewListing(
  listingId: number,
  action: ReviewAction,
  note: string | undefined,
): Promise<{ title: string; status: ListingStatus; note: string | null; operatorEmail: string; operatorName: string | null }> {
  return withTx(async (client) => {
    const cur = await client.query<{ status: ListingStatus; title: string; company_id: number; company_status: string }>(
      `SELECT l.status, l.title, l.company_id, c.status AS company_status
         FROM adventure_listings l JOIN companies c ON c.id = l.company_id WHERE l.id = $1 FOR NO KEY UPDATE OF l`,
      [listingId],
    );
    const l = cur.rows[0];
    if (!l) throw new HttpError(404, "Listing not found.");
    const needsNote = action === "request_changes" || action === "reject" || action === "deactivate";
    if (needsNote && !note?.trim()) throw new HttpError(422, "Add a note so the operator knows why.");

    let next: ListingStatus;
    switch (action) {
      case "publish":
        if (!["pending_review", "changes_requested", "rejected", "draft"].includes(l.status)) throw new HttpError(409, `Can't publish a listing that is ${l.status}.`);
        if (l.company_status !== "approved") throw new HttpError(409, "Approve the operator first — nothing goes live for an unapproved operator.");
        next = "published";
        break;
      case "request_changes":
        if (l.status !== "pending_review") throw new HttpError(409, "Only listings waiting for review can have changes requested.");
        next = "changes_requested";
        break;
      case "reject":
        if (!["pending_review", "changes_requested", "published"].includes(l.status)) throw new HttpError(409, `Can't reject a listing that is ${l.status}.`);
        next = "rejected";
        break;
      case "deactivate":
        if (l.status !== "published") throw new HttpError(409, "Only live listings can be taken down.");
        next = "deactivated";
        break;
      case "reinstate":
        if (l.status !== "deactivated" && l.status !== "rejected") throw new HttpError(409, "Nothing to reinstate.");
        if (l.company_status !== "approved") throw new HttpError(409, "Approve the operator first.");
        next = "published";
        break;
    }

    // moderation_note doubles as the "taken down by admin" marker for deactivated listings.
    const keepNote = action === "publish" || action === "reinstate" ? null : note!.trim();
    await client.query(
      `UPDATE adventure_listings SET status = $2, moderation_note = $3, updated_at = now(),
              published_at = CASE WHEN $2 = 'published' THEN COALESCE(published_at, now()) ELSE published_at END WHERE id = $1`,
      [listingId, next, keepNote],
    );
    await client.query(`INSERT INTO audit_log (actor_type, company_id, action, meta) VALUES ('admin', $1, $2, $3)`,
      [l.company_id, `listing.${action}`, JSON.stringify({ listingId, from: l.status, to: next })]);

    const owner = await client.query<{ email: string; name: string | null }>(
      `SELECT email, name FROM company_users WHERE company_id = $1 AND role = 'owner' ORDER BY id LIMIT 1`, [l.company_id]);
    return { title: l.title, status: next, note: keepNote, operatorEmail: owner.rows[0]?.email ?? "", operatorName: owner.rows[0]?.name ?? null };
  });
}

/**
 * Paid placement (the v1 revenue lever) — admin-set, manually invoiced like
 * platform_fee_amount, no gateway. Orthogonal to the publish status machine:
 * featuring an unpublished listing is harmless (it just won't show anywhere
 * until it's published), so this isn't gated on `status`.
 */
export async function setFeatured(listingId: number, input: { isFeatured: boolean; featuredUntil: string | null }): Promise<void> {
  const res = await requirePool().query<{ company_id: number }>(
    `UPDATE adventure_listings SET is_featured = $2, featured_until = $3, updated_at = now() WHERE id = $1 RETURNING company_id`,
    [listingId, input.isFeatured, input.featuredUntil],
  );
  if (!res.rows[0]) throw new HttpError(404, "Listing not found.");
  await requirePool().query(`INSERT INTO audit_log (actor_type, company_id, action, meta) VALUES ('admin', $1, 'listing.set_featured', $2)`,
    [res.rows[0].company_id, JSON.stringify({ listingId, isFeatured: input.isFeatured, featuredUntil: input.featuredUntil })]);
}

export type AdminListingView = {
  detail: ListingDetail; companyId: number; companyName: string; companyStatus: string; categoryName: string; regionName: string;
  isFeatured: boolean; featuredUntil: string | null;
};

/** Full read-only view of any listing, for the review screen. */
export async function getListingForAdmin(listingId: number): Promise<AdminListingView | null> {
  const res = await requirePool().query<{
    company_id: number; company_name: string; company_status: string; category_name: string; region_name: string;
    is_featured: boolean; featured_until: string | null;
  }>(
    `SELECT l.company_id, c.name AS company_name, c.status AS company_status, ac.name AS category_name, r.name AS region_name,
            l.is_featured, l.featured_until
       FROM adventure_listings l JOIN companies c ON c.id = l.company_id
       JOIN adventure_categories ac ON ac.id = l.category_id JOIN regions r ON r.id = l.region_id
      WHERE l.id = $1`,
    [listingId],
  );
  const row = res.rows[0];
  if (!row) return null;
  const detail = await forCompany(row.company_id).get(listingId);
  return {
    detail, companyId: row.company_id, companyName: row.company_name, companyStatus: row.company_status, categoryName: row.category_name, regionName: row.region_name,
    isFeatured: row.is_featured, featuredUntil: row.featured_until ? new Date(row.featured_until).toISOString().slice(0, 10) : null,
  };
}
