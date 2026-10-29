"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Trash2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/client-api";
import type { ListingImage } from "@/lib/listings/repo";

const MAX = 8;
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;

function videoDurationSeconds(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    const el = document.createElement("video");
    el.preload = "metadata";
    el.onloadedmetadata = () => { resolve(Number.isFinite(el.duration) ? el.duration : undefined); URL.revokeObjectURL(el.src); };
    el.onerror = () => resolve(undefined);
    el.src = URL.createObjectURL(file);
  });
}

// Shrink big phone photos before upload (saves the operator's mobile data);
// the server then re-encodes to small WebP.
async function downscale(file: File, max = 2000): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 1_500_000) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.85));
  } catch {
    return file;
  }
}

export function ImageManager({ listingId, images, allowVideo = false }: { listingId: number; images: ListingImage[]; allowVideo?: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const photos = images.filter((i) => i.mediaType !== "video");
  const video = images.find((i) => i.mediaType === "video");

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    const room = MAX - photos.length;
    const picked = Array.from(files).slice(0, room);
    try {
      for (let i = 0; i < picked.length; i++) {
        setBusy(`Uploading photo ${i + 1} of ${picked.length}…`);
        const form = new FormData();
        form.set("file", await downscale(picked[i]), picked[i].name);
        await api(`/api/operator/listings/${listingId}/images`, { body: form });
      }
      if (files.length > room) setError(`Only ${MAX} photos fit. The rest were skipped.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed. Check your connection and try again.");
      router.refresh();
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  }

  async function uploadVideo(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setError("");
    if (file.size > MAX_VIDEO_BYTES) { setError("Videos must be under 25 MB."); return; }
    try {
      setBusy("Uploading video…");
      const duration = await videoDurationSeconds(file);
      if (duration && duration > 45) { setError("Keep it short — under 30 seconds works best."); }
      const form = new FormData();
      form.set("file", file, file.name);
      if (duration) form.set("durationSeconds", String(Math.round(duration)));
      await api(`/api/operator/listings/${listingId}/video`, { body: form });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed. Check your connection and try again.");
      router.refresh();
    } finally {
      setBusy(null);
      if (videoInput.current) videoInput.current.value = "";
    }
  }

  async function remove(id: number) {
    if (!confirm("Remove this photo?")) return;
    setError("");
    try {
      await api(`/api/operator/listings/${listingId}/images/${id}`, { method: "DELETE" });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't remove it.");
    }
  }

  async function makeCover(id: number) {
    setError("");
    try {
      await api(`/api/operator/listings/${listingId}/images`, { method: "PUT", body: { order: [id, ...photos.filter((i) => i.id !== id).map((i) => i.id)] } });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't change the cover.");
    }
  }

  return (
    <div>
      {photos.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((img, i) => (
            <li key={img.id} className="overflow-hidden rounded-xl border border-navy/10 bg-white">
              <div className="relative aspect-[4/3] bg-navy/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.thumbUrl ?? img.url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
                {i === 0 && <span className="absolute left-2 top-2 rounded-full bg-navy px-2.5 py-1 text-xs font-semibold text-cream">Cover</span>}
              </div>
              <div className="flex items-center justify-between gap-1 p-2">
                {i === 0 ? <span className="px-1 text-xs text-navy/50">Shown first</span> : (
                  <button type="button" onClick={() => makeCover(img.id)} className="h-9 rounded-lg px-2 text-sm font-medium text-navy hover:bg-navy/5">Make cover</button>
                )}
                <button type="button" onClick={() => remove(img.id)} aria-label={`Remove photo ${i + 1}`} className="flex h-9 w-9 items-center justify-center rounded-lg text-red-700 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <input ref={input} id="photos-input" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => upload(e.target.files)} />
        <Button type="button" variant="outline" disabled={!!busy || photos.length >= MAX} onClick={() => input.current?.click()}>
          <ImagePlus className="h-4 w-4" aria-hidden /> {photos.length ? "Add more photos" : "Add photos"}
        </Button>
        <p className="text-sm text-navy/60" aria-live="polite">{busy ?? `${photos.length} of ${MAX} photos`}</p>
      </div>
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{error}</p>}

      {allowVideo && (
        <div className="mt-6 border-t border-navy/10 pt-5">
          <h3 className="text-sm font-semibold text-navy">Short video (optional)</h3>
          <p className="mt-1 text-[13px] text-navy/60">One clip, under 25 MB — 30 seconds or less works best. No editing is done to it.</p>
          {video ? (
            <div className="mt-3 flex items-center gap-3">
              <video src={video.url} className="h-24 w-36 rounded-lg bg-navy/5 object-cover" controls muted />
              <button type="button" onClick={() => remove(video.id)} aria-label="Remove video" className="flex h-9 w-9 items-center justify-center rounded-lg text-red-700 hover:bg-red-50">
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ) : (
            <div className="mt-3">
              <input ref={videoInput} id="video-input" type="file" accept="video/mp4" hidden onChange={(e) => uploadVideo(e.target.files)} />
              <Button type="button" variant="outline" disabled={!!busy} onClick={() => videoInput.current?.click()}>
                <Video className="h-4 w-4" aria-hidden /> Add a video
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
