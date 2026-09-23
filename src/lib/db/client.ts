import "server-only";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { env } from "@/lib/env";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

const globalForDb = globalThis as unknown as { __hungryTalesDb?: Promise<Db> };

async function connectPostgres(url: string): Promise<Db> {
  const { default: postgres } = await import("postgres");
  const { drizzle } = await import("drizzle-orm/postgres-js");
  // prepare:false keeps us compatible with Supabase's transaction pooler (port 6543).
  const client = postgres(url, { prepare: false, max: 5, idle_timeout: 20, connect_timeout: 10 });
  return drizzle(client, { schema }) as unknown as Db;
}

/**
 * Local development without a database server: embedded Postgres (PGlite) on disk,
 * migrated on first use. Never used in production (env() requires DATABASE_URL there).
 */
async function connectEmbedded(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dataDir = path.join(process.cwd(), ".data", "pglite");
  await mkdir(path.dirname(dataDir), { recursive: true });
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return db as unknown as Db;
}

export function getDb(): Promise<Db> {
  if (!globalForDb.__hungryTalesDb) {
    const url = env().DATABASE_URL;
    const pending = url ? connectPostgres(url) : connectEmbedded();
    globalForDb.__hungryTalesDb = pending.catch((error) => {
      globalForDb.__hungryTalesDb = undefined;
      throw error;
    });
  }
  return globalForDb.__hungryTalesDb;
}

export { schema };
