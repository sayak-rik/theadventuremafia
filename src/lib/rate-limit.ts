import { getPool } from "./db";

export type RateResult = { ok: boolean; count: number; retryAfterSec: number };

/**
 * Fixed-window counter stored in Postgres (`rate_limits`), so limits survive
 * restarts and work without Redis. Each call counts one hit. Fails open (with a
 * log line) if the database errors, so a limiter fault never takes the site down.
 */
export async function rateLimit(key: string, max: number, windowSec: number): Promise<RateResult> {
  const pool = getPool();
  if (!pool) return { ok: true, count: 0, retryAfterSec: 0 };
  try {
    const res = await pool.query<{ count: number; retry: number }>(
      `INSERT INTO rate_limits (key, window_start, count) VALUES ($1, now(), 1)
       ON CONFLICT (key) DO UPDATE SET
         window_start = CASE WHEN rate_limits.window_start < now() - make_interval(secs => $2::double precision)
                             THEN now() ELSE rate_limits.window_start END,
         count        = CASE WHEN rate_limits.window_start < now() - make_interval(secs => $2::double precision)
                             THEN 1 ELSE rate_limits.count + 1 END
       RETURNING count,
         GREATEST(0, CEIL(EXTRACT(EPOCH FROM (window_start + make_interval(secs => $2::double precision) - now()))))::int AS retry`,
      [key, windowSec],
    );
    const { count, retry } = res.rows[0];
    return { ok: count <= max, count, retryAfterSec: count <= max ? 0 : retry };
  } catch (err) {
    console.error("[rate-limit] failed open:", (err as { code?: string }).code ?? "unknown");
    return { ok: true, count: 0, retryAfterSec: 0 };
  }
}

/** Forget a key (e.g. clear failed-login counters after a successful login). */
export async function resetRateLimit(key: string): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query(`DELETE FROM rate_limits WHERE key = $1`, [key]);
  } catch {
    /* best effort */
  }
}

/** Remove expired counters. Called from the sweep job. */
export async function purgeRateLimits(olderThanSec = 86_400): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query(`DELETE FROM rate_limits WHERE window_start < now() - make_interval(secs => $1::double precision)`, [olderThanSec]);
}

export function tooManyRequests(retryAfterSec: number, message = "Too many attempts. Please try again shortly.") {
  return new Response(JSON.stringify({ error: message }), {
    status: 429,
    headers: { "content-type": "application/json", "retry-after": String(Math.max(1, retryAfterSec)) },
  });
}
