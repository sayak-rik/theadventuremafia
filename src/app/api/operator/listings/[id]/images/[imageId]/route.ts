import { operatorRoute } from "@/lib/operator-auth";
import { revalidateMarketplace } from "@/lib/listings/public";
import { json, parseId } from "@/lib/api";
import { forCompany } from "@/lib/listings/repo";
import { deleteObject, keyFromUrl } from "@/lib/storage";

export const DELETE = operatorRoute<{ id: string; imageId: string }>(async (_req, s, { id, imageId }) => {
  const removed = await forCompany(s.companyId).removeImage(parseId(id), parseId(imageId, "photo id"));
  revalidateMarketplace();
  for (const url of [removed.url, removed.thumbUrl]) {
    const key = url ? keyFromUrl(url) : null;
    if (key) await deleteObject(key);
  }
  return json({ ok: true });
});
