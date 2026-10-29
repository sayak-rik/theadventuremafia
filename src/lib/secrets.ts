import crypto from "crypto";

const generated = new Map<string, string>();

/**
 * Reads a signing secret from the environment. If it's missing in production a
 * random per-process secret is used instead of failing the whole site —
 * sessions just won't survive a restart until it's set — and a loud error is
 * logged. Dev uses a fixed fallback for convenience.
 */
export function getSecret(envVar: string, devFallback: string): string {
  const value = process.env[envVar];
  if (value) return value;
  if (process.env.NODE_ENV !== "production") return devFallback;

  let secret = generated.get(envVar);
  if (!secret) {
    secret = crypto.randomBytes(32).toString("hex");
    generated.set(envVar, secret);
    console.error(
      `[secrets] ${envVar} is not set — using a random per-process secret. Set ${envVar} in production so sessions survive a restart.`,
    );
  }
  return secret;
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}
