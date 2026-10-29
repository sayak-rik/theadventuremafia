import crypto from "crypto";
import { HttpError } from "./api";

/**
 * No transcoding — same "small VM" constraint as images.ts. A flat byte cap is
 * the sole authoritative limit (no ffmpeg/duration probing): at ordinary
 * phone-camera bitrates it bounds a clip to roughly 30-60s in practice. The
 * client additionally reads <video> duration before upload and warns past
 * ~30s, but that check is UX only — never trust a client-reported duration.
 */
export const MAX_VIDEO_UPLOAD_BYTES = 25 * 1024 * 1024;

// MP4 files carry an "ftyp" box starting at byte offset 4.
const MP4_SIGNATURE_OFFSET = 4;
const MP4_SIGNATURE = Buffer.from("ftyp");

/** Throws unless the buffer is a plausible, size-capped MP4 file. */
export function assertValidVideo(input: Buffer): void {
  if (input.length === 0 || input.length > MAX_VIDEO_UPLOAD_BYTES) throw new HttpError(413, "Videos must be under 25 MB.");
  if (input.length < MP4_SIGNATURE_OFFSET + 8) throw new HttpError(422, "That file isn't a valid video.");
  const signature = input.subarray(MP4_SIGNATURE_OFFSET, MP4_SIGNATURE_OFFSET + 4);
  if (!signature.equals(MP4_SIGNATURE)) throw new HttpError(422, "Please upload an MP4 video.");
}

/** Storage key under the operator's own prefix; never derived from the filename. */
export function newVideoKey(companyId: number, ext: "mp4" = "mp4"): string {
  return `c/${companyId}/${crypto.randomBytes(12).toString("hex")}.${ext}`;
}
