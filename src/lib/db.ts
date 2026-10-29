import { Pool, types, type PoolClient } from "pg";

// BIGSERIAL ids (listing_bookings) come back as strings by default. They'll never
// approach 2^53, so hand them to JS as numbers.
types.setTypeParser(20, (v) => Number(v));

// A single shared pool per server process. Cached on globalThis so Next.js
// dev hot-reload doesn't open a new pool on every change.
const globalForDb = globalThis as unknown as { pgPool?: Pool };

export function getPool(): Pool | null {
  if (!process.env.DATABASE_URL) return null;
  if (!globalForDb.pgPool) {
    globalForDb.pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return globalForDb.pgPool;
}

/**
 * Run a query. Returns rows, or `null` if the database is unreachable / not
 * configured — callers fall back to seed data so the site still renders.
 */
export async function query<T extends Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[] | null> {
  const pool = getPool();
  if (!pool) return null;
  try {
    const result = await pool.query(text, params);
    return result.rows as T[];
  } catch (err) {
    console.error("[db] query failed, falling back to seed data:", err);
    return null;
  }
}

/** The shared pool, or throws — for marketplace code that has no seed-data fallback. */
export function requirePool(): Pool {
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL is not configured");
  return pool;
}

/** Run `fn` inside a transaction (BEGIN/COMMIT, ROLLBACK on throw). */
export async function withTx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await requirePool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
