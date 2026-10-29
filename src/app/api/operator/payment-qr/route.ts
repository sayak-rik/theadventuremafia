import { z } from "zod";
import { after } from "next/server";
import { operatorRoute, OPERATOR_COOKIE, operatorCookieOptions, operatorCookieValue } from "@/lib/operator-auth";
import { HttpError, json, parseBody } from "@/lib/api";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { MAX_UPLOAD_BYTES, newImageKey, processQrImage } from "@/lib/images";
import { deleteObject, keyFromUrl, putObject } from "@/lib/storage";
import { saveQrUrl } from "@/lib/operators/account";
import { notifyPaymentDetailsChanged } from "@/lib/notify";

// Upload the operator's own payment QR (kept lossless so it stays scannable).
export const POST = operatorRoute(async (req, s) => {
  const limit = await rateLimit(`upload:${s.companyId}`, 60, 3600);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(422, "Choose an image of your QR code.");
  if (file.size > MAX_UPLOAD_BYTES) throw new HttpError(413, "Images must be under 8 MB.");
  const password = typeof form.get("password") === "string" ? (form.get("password") as string) : undefined;

  const img = await processQrImage(Buffer.from(await file.arrayBuffer()));
  const url = await putObject(newImageKey(s.companyId, "png", "-qr"), img.buffer, "image/png");
  let saved;
  try {
    saved = await saveQrUrl(s.companyId, s.companyUserId, s.companyName, url, password);
  } catch (err) {
    const key = keyFromUrl(url);
    if (key) await deleteObject(key);
    throw err;
  }
  if (saved.previous) {
    const key = keyFromUrl(saved.previous);
    if (key) await deleteObject(key);
  }

  const res = json({ ok: true, url });
  if (saved.tokenVersion !== null) {
    res.cookies.set(OPERATOR_COOKIE, operatorCookieValue(s.companyUserId, saved.tokenVersion), operatorCookieOptions);
    after(() => notifyPaymentDetailsChanged(s.email, { name: s.name, companyName: s.companyName, summary: "A new QR image was uploaded" }));
  }
  return res;
});

export const DELETE = operatorRoute(async (req, s) => {
  const { password } = await parseBody(req, z.object({ password: z.string().max(200).optional() }));
  const saved = await saveQrUrl(s.companyId, s.companyUserId, s.companyName, null, password);
  if (saved.previous) {
    const key = keyFromUrl(saved.previous);
    if (key) await deleteObject(key);
  }
  const res = json({ ok: true });
  if (saved.tokenVersion !== null) res.cookies.set(OPERATOR_COOKIE, operatorCookieValue(s.companyUserId, saved.tokenVersion), operatorCookieOptions);
  return res;
});
