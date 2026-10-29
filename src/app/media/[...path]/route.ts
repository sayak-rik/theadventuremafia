import { readLocalObject } from "@/lib/storage";

const TYPES: Record<string, string> = { webp: "image/webp", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" };

// Serves locally stored uploads (only used when R2 isn't configured).
export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await ctx.params;
  const key = parts.join("/");
  let body: Buffer | null = null;
  try {
    body = await readLocalObject(key);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  if (!body) return new Response("Not found", { status: 404 });
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return new Response(new Uint8Array(body), {
    headers: {
      "content-type": TYPES[ext] ?? "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}
