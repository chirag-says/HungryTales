/**
 * Apply SQL migrations in ./drizzle to the database at DATABASE_URL.
 * Use Supabase's *session pooler* string (port 5432) here; the direct connection is
 * IPv6-only. The app itself runs on the transaction pooler (port 6543).
 *
 *   DATABASE_URL=postgres://... npm run db:migrate
 */
import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. (Local development migrates the embedded database automatically.)");
  process.exit(1);
}

const client = postgres(url, { max: 1, prepare: false });
try {
  await migrate(drizzle(client), { migrationsFolder: path.join(process.cwd(), "drizzle") });
  console.log("Migrations applied.");
} catch (error) {
  console.error("Migration failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end();
}
