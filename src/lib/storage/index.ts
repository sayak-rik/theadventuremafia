import fs from "fs/promises";
import path from "path";
import { AwsClient } from "aws4fetch";

// Object storage for operator photos. Cloudflare R2 when R2_* env vars are set
// (production); otherwise a local directory served by /media/* (dev, or a
// no-R2 dry launch). Callers only deal in keys and URLs.

const r2Configured = () =>
  Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET && process.env.R2_PUBLIC_URL);

export const uploadDir = () => path.resolve(process.env.UPLOAD_DIR ?? ".uploads");

let r2Client: AwsClient | null = null;
function r2() {
  r2Client ??= new AwsClient({
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    service: "s3",
    region: "auto",
  });
  return r2Client;
}
const r2Endpoint = (key: string) => `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET}/${key}`;

const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9/_.-]*$/;
function assertSafeKey(key: string) {
  if (!SAFE_KEY.test(key) || key.includes("..") || key.includes("//")) throw new Error("Unsafe storage key");
}

export function urlForKey(key: string): string {
  return r2Configured() ? `${process.env.R2_PUBLIC_URL!.replace(/\/$/, "")}/${key}` : `/media/${key}`;
}

/** Inverse of urlForKey; null if the URL isn't one of ours. */
export function keyFromUrl(url: string): string | null {
  const prefixes = [process.env.R2_PUBLIC_URL ? `${process.env.R2_PUBLIC_URL.replace(/\/$/, "")}/` : null, "/media/"].filter(Boolean) as string[];
  for (const p of prefixes) {
    if (url.startsWith(p)) {
      const key = url.slice(p.length);
      return SAFE_KEY.test(key) && !key.includes("..") ? key : null;
    }
  }
  return null;
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<string> {
  assertSafeKey(key);
  if (r2Configured()) {
    const res = await r2().fetch(r2Endpoint(key), {
      method: "PUT",
      body: new Uint8Array(body),
      headers: { "content-type": contentType, "cache-control": "public, max-age=31536000, immutable" },
    });
    if (!res.ok) throw new Error(`R2 upload failed (${res.status})`);
  } else {
    const file = path.join(uploadDir(), key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, body);
  }
  return urlForKey(key);
}

export async function deleteObject(key: string): Promise<void> {
  assertSafeKey(key);
  try {
    if (r2Configured()) {
      await r2().fetch(r2Endpoint(key), { method: "DELETE" });
    } else {
      await fs.unlink(path.join(uploadDir(), key));
    }
  } catch {
    /* already gone — deleting is best effort */
  }
}

export async function readLocalObject(key: string): Promise<Buffer | null> {
  assertSafeKey(key);
  try {
    return await fs.readFile(path.join(uploadDir(), key));
  } catch {
    return null;
  }
}
