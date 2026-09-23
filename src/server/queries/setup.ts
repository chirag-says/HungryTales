import "server-only";
import { count } from "drizzle-orm";
import { connection } from "next/server";
import { getDb } from "@/lib/db/client";
import { duos } from "@/lib/db/schema";

/** Live check; opts the calling page out of prerendering. */
export async function isSetupComplete(): Promise<boolean> {
  await connection();
  const db = await getDb();
  const [row] = await db.select({ n: count() }).from(duos);
  return row.n > 0;
}
