import { revalidateMarketplace } from "@/lib/listings/public";
import { operatorRoute } from "@/lib/operator-auth";
import { HttpError, json, parseId } from "@/lib/api";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { MAX_VIDEO_UPLOAD_BYTES, assertValidVideo, newVideoKey } from "@/lib/video";
import { deleteObject, keyFromUrl, putObject } from "@/lib/storage";
import { forCompany } from "@/lib/listings/repo";

// Upload one short video (cars only, one per listing): size-capped MP4, no transcoding.
export const POST = operatorRoute<{ id: string }>(async (req, s, { id }) => {
  const listingId = parseId(id);
  const repo = forCompany(s.companyId);
  await repo.assertOwned(listingId); // 404 before doing any upload work

  // Tighter than the photo cap — a 25 MB file is far heavier than an 8 MB photo.
  const limit = await rateLimit(`video:${s.companyId}`, 10, 3600);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(422, "Choose a video to upload.");
  if (file.size > MAX_VIDEO_UPLOAD_BYTES) throw new HttpError(413, "Videos must be under 25 MB.");
  const durationRaw = Number(form.get("durationSeconds"));
  const durationSeconds = Number.isFinite(durationRaw) && durationRaw > 0 ? Math.round(durationRaw) : undefined;

  const buffer = Buffer.from(await file.arrayBuffer());
  assertValidVideo(buffer);

  const url = await putObject(newVideoKey(s.companyId), buffer, "video/mp4");
  try {
    const image = await repo.addImage(listingId, { url, thumbUrl: null, width: null, height: null, mediaType: "video", durationSeconds });
    revalidateMarketplace();
    return json({ ok: true, image }, { status: 201 });
  } catch (err) {
    const key = keyFromUrl(url);
    if (key) await deleteObject(key);
    throw err;
  }
});
