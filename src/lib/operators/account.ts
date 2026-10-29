import { requirePool, withTx } from "../db";
import { HttpError } from "../api";
import { verifyPassword } from "../password";
import type { ProfileInput } from "../validation/operator";

export type CompanyProfile = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  contactEmail: string;
  contactPhone: string;
  whatsappNumber: string | null;
  address: string | null;
  mapsUrl: string | null;
  websiteUrl: string | null;
  instagramUrl: string | null;
  status: string;
  rejectionReason: string | null;
  isVerified: boolean;
  categories: string[];
  regions: string[];
};

export async function getCompanyProfile(companyId: number): Promise<CompanyProfile> {
  const res = await requirePool().query(
    `SELECT c.*,
            ARRAY(SELECT ac.slug FROM company_categories cc JOIN adventure_categories ac ON ac.id = cc.category_id WHERE cc.company_id = c.id ORDER BY ac.sort_order) AS categories,
            ARRAY(SELECT r.slug FROM company_regions cr JOIN regions r ON r.id = cr.region_id WHERE cr.company_id = c.id ORDER BY r.sort_order) AS regions
       FROM companies c WHERE c.id = $1`,
    [companyId],
  );
  const c = res.rows[0];
  if (!c) throw new HttpError(404, "Company not found.");
  return {
    id: c.id, slug: c.slug, name: c.name, description: c.description, contactEmail: c.contact_email, contactPhone: c.contact_phone,
    whatsappNumber: c.whatsapp_number, address: c.address, mapsUrl: c.maps_url, websiteUrl: c.website_url, instagramUrl: c.instagram_url,
    status: c.status, rejectionReason: c.rejection_reason, isVerified: c.is_verified, categories: c.categories, regions: c.regions,
  };
}

export async function updateCompanyProfile(companyId: number, input: ProfileInput): Promise<void> {
  await withTx(async (client) => {
    const cats = await client.query<{ id: number }>(`SELECT id FROM adventure_categories WHERE slug = ANY($1::text[]) AND is_active`, [input.categories]);
    if (cats.rowCount !== new Set(input.categories).size) throw new HttpError(422, "One of the selected categories isn't available.");
    const regs = await client.query<{ id: number }>(`SELECT id FROM regions WHERE slug = ANY($1::text[])`, [input.regions]);
    if (regs.rowCount !== new Set(input.regions).size) throw new HttpError(422, "One of the selected places isn't available.");

    await client.query(
      `UPDATE companies SET name = $2, description = $3, contact_phone = $4, whatsapp_number = $5, address = $6,
              maps_url = $7, website_url = $8, instagram_url = $9 WHERE id = $1`,
      [companyId, input.name, input.description ?? null, input.contactPhone, input.whatsappNumber ?? input.contactPhone,
        input.address ?? null, input.mapsUrl ?? null, input.websiteUrl ?? null, input.instagramUrl ?? null],
    );
    await client.query(`DELETE FROM company_categories WHERE company_id = $1`, [companyId]);
    for (const c of cats.rows) await client.query(`INSERT INTO company_categories (company_id, category_id) VALUES ($1,$2)`, [companyId, c.id]);
    await client.query(`DELETE FROM company_regions WHERE company_id = $1`, [companyId]);
    for (const r of regs.rows) await client.query(`INSERT INTO company_regions (company_id, region_id) VALUES ($1,$2)`, [companyId, r.id]);
  });
}

export type PaymentSettings = {
  payeeName: string;
  upiVpa: string | null;
  upiNumber: string | null;
  qrImageUrl: string | null;
} | null;

export async function getPaymentSettings(companyId: number): Promise<PaymentSettings> {
  const res = await requirePool().query<{ payee_name: string; upi_vpa: string | null; upi_number: string | null; qr_image_url: string | null }>(
    `SELECT payee_name, upi_vpa, upi_number, qr_image_url FROM company_payment_settings WHERE company_id = $1`,
    [companyId],
  );
  const r = res.rows[0];
  return r ? { payeeName: r.payee_name, upiVpa: r.upi_vpa, upiNumber: r.upi_number, qrImageUrl: r.qr_image_url } : null;
}

/** Mask a UPI id / number for logs and emails: "ra••••@okaxis". */
export function maskPayment(value: string | null): string | null {
  if (!value) return null;
  const [name, bank] = value.split("@");
  const shown = name.slice(0, 2) + "•".repeat(Math.max(2, name.length - 2));
  return bank ? `${shown}@${bank}` : shown;
}

/**
 * Re-check the signed-in operator's password before touching payment
 * details — a stolen session alone must not be able to redirect advances.
 */
export async function assertPassword(companyUserId: number, password: string | undefined): Promise<void> {
  if (!password) throw new HttpError(422, "Enter your password to change payment details.");
  const res = await requirePool().query<{ password_hash: string | null }>(`SELECT password_hash FROM company_users WHERE id = $1`, [companyUserId]);
  if (!(await verifyPassword(password, res.rows[0]?.password_hash ?? null))) throw new HttpError(403, "That password isn't right.");
}

export type PaymentChange = { changed: boolean; tokenVersion: number | null };

/**
 * Save payment details. Changing an existing VPA / number needs the password;
 * a change is audit-logged and invalidates other sessions (the caller re-issues
 * the current one with the returned tokenVersion).
 */
export async function savePaymentSettings(
  companyId: number,
  companyUserId: number,
  input: { payeeName: string; upiVpa?: string; upiNumber?: string; currentPassword?: string },
): Promise<PaymentChange> {
  const existing = await getPaymentSettings(companyId);
  const hadMethod = Boolean(existing && (existing.upiVpa || existing.upiNumber || existing.qrImageUrl));
  const vpa = input.upiVpa ?? null;
  const num = input.upiNumber ?? null;
  if (!vpa && !num && !existing?.qrImageUrl) throw new HttpError(422, "Add a UPI ID, a UPI number or upload your QR so customers can pay you.");

  const detailsChanged = hadMethod && ((existing?.upiVpa ?? null) !== vpa || (existing?.upiNumber ?? null) !== num || existing?.payeeName !== input.payeeName);
  if (detailsChanged) await assertPassword(companyUserId, input.currentPassword);

  return withTx(async (client) => {
    await client.query(
      `INSERT INTO company_payment_settings (company_id, payee_name, upi_vpa, upi_number, updated_at)
       VALUES ($1,$2,$3,$4,now())
       ON CONFLICT (company_id) DO UPDATE SET payee_name = EXCLUDED.payee_name, upi_vpa = EXCLUDED.upi_vpa,
          upi_number = EXCLUDED.upi_number, updated_at = now()`,
      [companyId, input.payeeName, vpa, num],
    );
    let tokenVersion: number | null = null;
    if (detailsChanged) {
      await client.query(
        `INSERT INTO audit_log (actor_type, actor_id, company_id, action, meta) VALUES ('operator', $1, $2, 'payment.change', $3)`,
        [companyUserId, companyId, JSON.stringify({ from: { vpa: maskPayment(existing?.upiVpa ?? null), number: maskPayment(existing?.upiNumber ?? null) }, to: { vpa: maskPayment(vpa), number: maskPayment(num) } })],
      );
      const v = await client.query<{ token_version: number }>(`UPDATE company_users SET token_version = token_version + 1 WHERE company_id = $1 RETURNING token_version, id`, [companyId]);
      const own = await client.query<{ token_version: number }>(`SELECT token_version FROM company_users WHERE id = $1`, [companyUserId]);
      tokenVersion = own.rows[0]?.token_version ?? v.rows[0]?.token_version ?? null;
    }
    return { changed: detailsChanged, tokenVersion };
  });
}

export async function saveQrUrl(companyId: number, companyUserId: number, companyName: string, url: string | null, password: string | undefined): Promise<{ previous: string | null; tokenVersion: number | null }> {
  const existing = await getPaymentSettings(companyId);
  const hadMethod = Boolean(existing && (existing.upiVpa || existing.upiNumber || existing.qrImageUrl));
  if (hadMethod) await assertPassword(companyUserId, password);
  if (url === null && !existing?.upiVpa && !existing?.upiNumber) throw new HttpError(409, "Keep at least one way for customers to pay you.");

  return withTx(async (client) => {
    await client.query(
      `INSERT INTO company_payment_settings (company_id, payee_name, qr_image_url, updated_at) VALUES ($1,$2,$3,now())
       ON CONFLICT (company_id) DO UPDATE SET qr_image_url = EXCLUDED.qr_image_url, updated_at = now()`,
      [companyId, existing?.payeeName ?? companyName, url],
    );
    let tokenVersion: number | null = null;
    if (hadMethod) {
      await client.query(`INSERT INTO audit_log (actor_type, actor_id, company_id, action, meta) VALUES ('operator', $1, $2, 'payment.qr_change', $3)`,
        [companyUserId, companyId, JSON.stringify({ removed: url === null })]);
      await client.query(`UPDATE company_users SET token_version = token_version + 1 WHERE company_id = $1`, [companyId]);
      const own = await client.query<{ token_version: number }>(`SELECT token_version FROM company_users WHERE id = $1`, [companyUserId]);
      tokenVersion = own.rows[0]?.token_version ?? null;
    }
    return { previous: existing?.qrImageUrl ?? null, tokenVersion };
  });
}
