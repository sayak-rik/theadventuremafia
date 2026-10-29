import { requirePool, withTx } from "../db";
import { HttpError } from "../api";

export type ApplicationSummary = {
  companyId: number;
  companyName: string;
  ownerName: string | null;
  email: string;
  phone: string;
  address: string | null;
  categories: string[];
};

/** What the admin alert + operator "pending" emails need. */
export async function getApplicationSummary(companyId: number): Promise<ApplicationSummary | null> {
  const res = await requirePool().query<{
    id: number; name: string; contact_email: string; contact_phone: string; address: string | null;
    owner_name: string | null; categories: string[] | null;
  }>(
    `SELECT c.id, c.name, c.contact_email, c.contact_phone, c.address,
            (SELECT cu.name FROM company_users cu WHERE cu.company_id = c.id AND cu.role = 'owner' ORDER BY cu.id LIMIT 1) AS owner_name,
            ARRAY(SELECT ac.name FROM company_categories cc JOIN adventure_categories ac ON ac.id = cc.category_id WHERE cc.company_id = c.id ORDER BY ac.sort_order) AS categories
       FROM companies c WHERE c.id = $1`,
    [companyId],
  );
  const r = res.rows[0];
  if (!r) return null;
  return { companyId: r.id, companyName: r.name, ownerName: r.owner_name, email: r.contact_email, phone: r.contact_phone, address: r.address, categories: r.categories ?? [] };
}

export type OperatorAction = "approve" | "reject" | "suspend" | "reinstate" | "set_auto_publish" | "set_verified" | "set_commission";

/**
 * Admin lifecycle actions on a company. Every change is audit-logged. Returns
 * the operator's contact details so the caller can email the outcome.
 */
export async function applyOperatorAction(
  companyId: number,
  action: OperatorAction,
  opts: { reason?: string; value?: boolean; percent?: number },
): Promise<{ email: string; ownerName: string | null; companyName: string; status: string }> {
  return withTx(async (client) => {
    const cur = await client.query<{ status: string; name: string }>(`SELECT status, name FROM companies WHERE id = $1 FOR UPDATE`, [companyId]);
    const company = cur.rows[0];
    if (!company) throw new HttpError(404, "Operator not found.");

    const allowed: Record<OperatorAction, string[] | null> = {
      approve: ["pending", "rejected"],
      reject: ["pending", "approved"],
      suspend: ["approved"],
      reinstate: ["suspended", "rejected"],
      set_auto_publish: null,
      set_verified: null,
      set_commission: null,
    };
    const from = allowed[action];
    if (from && !from.includes(company.status)) throw new HttpError(409, `Can't ${action.replace("_", " ")} an operator who is ${company.status}.`);

    switch (action) {
      case "approve":
      case "reinstate":
        await client.query(`UPDATE companies SET status = 'approved', approved_at = COALESCE(approved_at, now()), rejection_reason = NULL WHERE id = $1`, [companyId]);
        break;
      case "reject":
        if (!opts.reason?.trim()) throw new HttpError(422, "Give a reason so the operator knows what to fix.");
        await client.query(`UPDATE companies SET status = 'rejected', rejection_reason = $2 WHERE id = $1`, [companyId, opts.reason.trim()]);
        break;
      case "suspend":
        if (!opts.reason?.trim()) throw new HttpError(422, "Give a reason for the suspension.");
        await client.query(`UPDATE companies SET status = 'suspended', rejection_reason = $2 WHERE id = $1`, [companyId, opts.reason.trim()]);
        break;
      case "set_auto_publish":
        await client.query(`UPDATE companies SET auto_publish_listings = $2 WHERE id = $1`, [companyId, Boolean(opts.value)]);
        break;
      case "set_verified":
        await client.query(`UPDATE companies SET is_verified = $2 WHERE id = $1`, [companyId, Boolean(opts.value)]);
        break;
      case "set_commission":
        // Inert groundwork — nothing reads this to collect a fee yet (see migration 007).
        if (opts.percent === undefined || opts.percent < 0 || opts.percent > 100) throw new HttpError(422, "Enter a commission between 0 and 100%.");
        await client.query(`UPDATE companies SET commission_percent = $2 WHERE id = $1`, [companyId, opts.percent]);
        break;
    }

    await client.query(
      `INSERT INTO audit_log (actor_type, company_id, action, meta) VALUES ('admin', $1, $2, $3)`,
      [companyId, `operator.${action}`, JSON.stringify({ from: company.status, reason: opts.reason ?? null, value: opts.value ?? null, percent: opts.percent ?? null })],
    );

    const after = await client.query<{ status: string; name: string; contact_email: string; owner_name: string | null }>(
      `SELECT c.status, c.name, c.contact_email,
              (SELECT cu.name FROM company_users cu WHERE cu.company_id = c.id AND cu.role = 'owner' ORDER BY cu.id LIMIT 1) AS owner_name
         FROM companies c WHERE c.id = $1`,
      [companyId],
    );
    const a = after.rows[0];
    return { email: a.contact_email, ownerName: a.owner_name, companyName: a.name, status: a.status };
  });
}

export type OperatorRow = {
  id: number; slug: string; name: string; status: string; companyType: string; isVerified: boolean; autoPublish: boolean; isSeed: boolean;
  email: string; phone: string; createdAt: string; listings: number; pendingListings: number; liveListings: number; hasPayment: boolean;
};

export async function listOperators(status: string | "all", companyType: "operator" | "driver" | "all" = "all"): Promise<OperatorRow[]> {
  const res = await requirePool().query(
    `SELECT c.id, c.slug, c.name, c.status, c.company_type, c.is_verified, c.auto_publish_listings, c.is_seed, c.contact_email, c.contact_phone, c.created_at,
            (SELECT count(*) FROM adventure_listings l WHERE l.company_id = c.id)::int AS listings,
            (SELECT count(*) FROM adventure_listings l WHERE l.company_id = c.id AND l.status = 'pending_review')::int AS pending_listings,
            (SELECT count(*) FROM adventure_listings l WHERE l.company_id = c.id AND l.status = 'published')::int AS live_listings,
            EXISTS (SELECT 1 FROM company_payment_settings p WHERE p.company_id = c.id AND (p.upi_vpa IS NOT NULL OR p.upi_number IS NOT NULL OR p.qr_image_url IS NOT NULL)) AS has_payment
       FROM companies c
      WHERE ($1 = 'all' OR c.status = $1) AND ($2 = 'all' OR c.company_type = $2)
      ORDER BY (c.status = 'pending') DESC, c.created_at DESC LIMIT 300`,
    [status, companyType],
  );
  return res.rows.map((r) => ({
    id: r.id, slug: r.slug, name: r.name, status: r.status, companyType: r.company_type, isVerified: r.is_verified, autoPublish: r.auto_publish_listings, isSeed: r.is_seed,
    email: r.contact_email, phone: r.contact_phone, createdAt: new Date(r.created_at).toISOString(),
    listings: r.listings, pendingListings: r.pending_listings, liveListings: r.live_listings, hasPayment: r.has_payment,
  }));
}

export type VerificationInput = {
  businessType?: string; tradeLicenceNo?: string; address?: string; mapsUrl?: string;
  phoneVerified: boolean; visited: boolean; documentsNote?: string; adminNotes?: string;
  /** Drivers only — the driving licence belongs to the person, not a specific vehicle. */
  drivingLicenceNumber?: string; drivingLicenceExpiry?: string | null;
};

export async function saveVerification(companyId: number, v: VerificationInput): Promise<void> {
  await requirePool().query(
    `INSERT INTO company_verification (company_id, business_type, trade_licence_no, address, maps_url, phone_verified_at, visited_at,
         documents_note, admin_notes, driving_licence_number, driving_licence_expiry, reviewed_at)
     VALUES ($1,$2,$3,$4,$5, CASE WHEN $6 THEN now() END, CASE WHEN $7 THEN now() END, $8, $9, $10, $11, now())
     ON CONFLICT (company_id) DO UPDATE SET business_type = EXCLUDED.business_type, trade_licence_no = EXCLUDED.trade_licence_no,
        address = EXCLUDED.address, maps_url = EXCLUDED.maps_url,
        phone_verified_at = CASE WHEN $6 THEN COALESCE(company_verification.phone_verified_at, now()) END,
        visited_at = CASE WHEN $7 THEN COALESCE(company_verification.visited_at, now()) END,
        documents_note = EXCLUDED.documents_note, admin_notes = EXCLUDED.admin_notes,
        driving_licence_number = EXCLUDED.driving_licence_number, driving_licence_expiry = EXCLUDED.driving_licence_expiry, reviewed_at = now()`,
    [companyId, v.businessType ?? null, v.tradeLicenceNo ?? null, v.address ?? null, v.mapsUrl ?? null, v.phoneVerified, v.visited,
      v.documentsNote ?? null, v.adminNotes ?? null, v.drivingLicenceNumber ?? null, v.drivingLicenceExpiry ?? null],
  );
}

export type OperatorDetail = {
  id: number; slug: string; name: string; description: string | null; status: string; rejectionReason: string | null;
  companyType: string; commissionPercent: number;
  isVerified: boolean; autoPublish: boolean; email: string; phone: string; whatsapp: string | null; address: string | null; mapsUrl: string | null;
  websiteUrl: string | null; instagramUrl: string | null; createdAt: string; termsVersion: string | null; termsAcceptedAt: string | null;
  ownerName: string | null; ownerEmail: string | null; lastLoginAt: string | null;
  categories: string[]; regions: string[];
  payment: { payeeName: string; upiVpa: string | null; upiNumber: string | null; qrImageUrl: string | null; updatedAt: string } | null;
  verification: {
    businessType: string | null; tradeLicenceNo: string | null; address: string | null; mapsUrl: string | null; phoneVerifiedAt: string | null;
    visitedAt: string | null; documentsNote: string | null; adminNotes: string | null;
    drivingLicenceNumber: string | null; drivingLicenceExpiry: string | null;
  } | null;
  recentAudit: { action: string; at: string; meta: unknown }[];
};

export async function getOperatorDetail(companyId: number): Promise<OperatorDetail | null> {
  const pool = requirePool();
  const c = (await pool.query(
    `SELECT c.*,
            (SELECT cu.name FROM company_users cu WHERE cu.company_id = c.id AND cu.role = 'owner' ORDER BY cu.id LIMIT 1) AS owner_name,
            (SELECT cu.email FROM company_users cu WHERE cu.company_id = c.id AND cu.role = 'owner' ORDER BY cu.id LIMIT 1) AS owner_email,
            (SELECT cu.last_login_at FROM company_users cu WHERE cu.company_id = c.id AND cu.role = 'owner' ORDER BY cu.id LIMIT 1) AS last_login_at,
            ARRAY(SELECT ac.name FROM company_categories cc JOIN adventure_categories ac ON ac.id = cc.category_id WHERE cc.company_id = c.id ORDER BY ac.sort_order) AS categories,
            ARRAY(SELECT r.name FROM company_regions cr JOIN regions r ON r.id = cr.region_id WHERE cr.company_id = c.id ORDER BY r.sort_order) AS regions
       FROM companies c WHERE c.id = $1`,
    [companyId],
  )).rows[0];
  if (!c) return null;
  const pay = (await pool.query(`SELECT payee_name, upi_vpa, upi_number, qr_image_url, updated_at FROM company_payment_settings WHERE company_id = $1`, [companyId])).rows[0];
  const ver = (await pool.query(`SELECT * FROM company_verification WHERE company_id = $1`, [companyId])).rows[0];
  const audit = (await pool.query(`SELECT action, created_at, meta FROM audit_log WHERE company_id = $1 ORDER BY id DESC LIMIT 15`, [companyId])).rows;
  const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);
  return {
    id: c.id, slug: c.slug, name: c.name, description: c.description, status: c.status, rejectionReason: c.rejection_reason,
    companyType: c.company_type, commissionPercent: Number(c.commission_percent),
    isVerified: c.is_verified, autoPublish: c.auto_publish_listings, email: c.contact_email, phone: c.contact_phone,
    whatsapp: c.whatsapp_number, address: c.address, mapsUrl: c.maps_url, websiteUrl: c.website_url, instagramUrl: c.instagram_url,
    createdAt: new Date(c.created_at).toISOString(), termsVersion: c.terms_version, termsAcceptedAt: iso(c.terms_accepted_at),
    ownerName: c.owner_name, ownerEmail: c.owner_email, lastLoginAt: iso(c.last_login_at), categories: c.categories, regions: c.regions,
    payment: pay ? { payeeName: pay.payee_name, upiVpa: pay.upi_vpa, upiNumber: pay.upi_number, qrImageUrl: pay.qr_image_url, updatedAt: new Date(pay.updated_at).toISOString() } : null,
    verification: ver ? { businessType: ver.business_type, tradeLicenceNo: ver.trade_licence_no, address: ver.address, mapsUrl: ver.maps_url,
      phoneVerifiedAt: iso(ver.phone_verified_at), visitedAt: iso(ver.visited_at), documentsNote: ver.documents_note, adminNotes: ver.admin_notes,
      drivingLicenceNumber: ver.driving_licence_number, drivingLicenceExpiry: ver.driving_licence_expiry ? new Date(ver.driving_licence_expiry).toISOString().slice(0, 10) : null } : null,
    recentAudit: audit.map((a) => ({ action: a.action, at: new Date(a.created_at).toISOString(), meta: a.meta })),
  };
}
