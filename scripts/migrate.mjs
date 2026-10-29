// Applies db/migrations/*.sql against DATABASE_URL, tracked in a
// drizzle.__drizzle_migrations table so each file runs at most once.
// Migration files are still plain hand-written SQL (see db/migrations/) —
// this only replaces the old "pipe each file into psql by hand" step with
// something that remembers what's already been applied.
//
//   node --env-file=.env scripts/migrate.mjs
//   (or: npm run db:migrate)
//
// New migrations: add db/migrations/00N_name.sql, then append an entry to
// db/migrations/meta/_journal.json with a `when` greater than the previous
// entry's and `tag` set to the filename without ".sql".

import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const { DATABASE_URL } = process.env;

if (!DATABASE_URL) {
  console.error("✗ DATABASE_URL is not set. Did you pass --env-file=.env ?");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool);

try {
  await migrate(db, { migrationsFolder: "./db/migrations" });
  console.log("✓ Migrations applied.");
} catch (err) {
  console.error("✗ Migration failed:", err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
