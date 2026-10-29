import { z } from "zod";
import { revalidateMarketplace } from "@/lib/listings/public";
import { operatorRoute } from "@/lib/operator-auth";
import { HttpError, json, parseBody, parseId } from "@/lib/api";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { MAX_UPLOAD_BYTES, newImageKey, processListingImage } from "@/lib/images";
import { deleteObject, keyFromUrl, putObject } from "@/lib/storage";
import { forCompany } from "@/lib/listings/repo";

// Upload one photo: resized + compressed to small WebP (detail + thumbnail).
export const POST = operatorRoute<{ id: string }>(async (req, s, { id }) => {
  const listingId = parseId(id);
  const repo = forCompany(s.companyId);
  await repo.assertOwned(listingId); // 404 before doing any image work

  const limit = await rateLimit(`upload:${s.companyId}`, 60, 3600);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);

  const file = (await req.formData()).get("file");
  if (!(file instanceof File)) throw new HttpError(422, "Choose a photo to upload.");
  if (file.size > MAX_UPLOAD_BYTES) throw new HttpError(413, "Photos must be under 8 MB.");

  const { detail, thumb } = await processListingImage(Buffer.from(await file.arrayBuffer()));
  const detailUrl = await putObject(newImageKey(s.companyId, "webp"), detail.buffer, "image/webp");
  const thumbUrl = await putObject(newImageKey(s.companyId, "webp", "-t"), thumb.buffer, "image/webp");
  try {
    const image = await repo.addImage(listingId, { url: detailUrl, thumbUrl, width: detail.width, height: detail.height });
    revalidateMarketplace();
    return json({ ok: true, image }, { status: 201 });
  } catch (err) {
    for (const url of [detailUrl, thumbUrl]) {
      const key = keyFromUrl(url);
      if (key) await deleteObject(key);
    }
    throw err;
  }
});

// Reorder: the first photo is the cover.
export const PUT = operatorRoute<{ id: string }>(async (req, s, { id }) => {
  const { order } = await parseBody(req, z.object({ order: z.array(z.number().int().positive()).min(1).max(20) }));
  await forCompany(s.companyId).reorderImages(parseId(id), order);
  revalidateMarketplace();
  return json({ ok: true });
});
