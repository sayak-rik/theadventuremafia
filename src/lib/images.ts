import sharp from "sharp";
import crypto from "crypto";
import { HttpError } from "./api";

// Small VM: one image at a time, no libvips cache.
sharp.concurrency(1);
sharp.cache(false);

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["jpeg", "png", "webp"]);

export type ProcessedImage = { buffer: Buffer; width: number; height: number };

async function open(input: Buffer) {
  if (input.length === 0 || input.length > MAX_UPLOAD_BYTES) throw new HttpError(413, "Images must be under 8 MB.");
  const img = sharp(input, { limitInputPixels: 40_000_000, failOn: "error" });
  let format: string | undefined;
  try {
    format = (await img.metadata()).format;
  } catch {
    throw new HttpError(422, "That file isn't a valid image.");
  }
  if (!format || !ALLOWED.has(format)) throw new HttpError(422, "Please upload a JPG, PNG or WebP image.");
  return img;
}

/**
 * Photos are deliberately small: a detail image (<=1200px) and a card
 * thumbnail (<=400px), both lossy WebP with metadata (EXIF/GPS) stripped.
 */
export async function processListingImage(input: Buffer): Promise<{ detail: ProcessedImage; thumb: ProcessedImage }> {
  const img = await open(input);
  const render = async (size: number, quality: number): Promise<ProcessedImage> => {
    const { data, info } = await img
      .clone()
      .rotate() // honour EXIF orientation, then drop metadata
      .resize({ width: size, height: size, fit: "inside", withoutEnlargement: true })
      .webp({ quality, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    return { buffer: data, width: info.width, height: info.height };
  };
  const detail = await render(1200, 65);
  const thumb = await render(400, 60);
  return { detail, thumb };
}

/**
 * Payment QR images must stay scannable, so they are never lossy-compressed:
 * flattened onto white, capped at 800px, stored as PNG.
 */
export async function processQrImage(input: Buffer): Promise<ProcessedImage> {
  const img = await open(input);
  const { data, info } = await img
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize({ width: 800, height: 800, fit: "inside", withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer({ resolveWithObject: true });
  return { buffer: data, width: info.width, height: info.height };
}

/** Storage key under the operator's own prefix; never derived from the filename. */
export function newImageKey(companyId: number, ext: "webp" | "png", variant = ""): string {
  return `c/${companyId}/${crypto.randomBytes(12).toString("hex")}${variant}.${ext}`;
}
