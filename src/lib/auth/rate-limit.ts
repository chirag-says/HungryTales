import "server-only";
import { and, count, eq, gt, lt } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb } from "@/lib/db/client";
import { authAttempts } from "@/lib/db/schema";
import { hmac } from "./crypto";

/**
 * Brute-force protection for the shared passphrase, stored in Postgres because
 * serverless instances share nothing in memory.
 * - Per client: 8 failures per 15 minutes.
 * - Global: 40 failures per 15 minutes across all clients (the passphrase is one secret;
 *   a distributed guesser must not get N x the attempts).
 */
const WINDOW_MS = 15 * 60 * 1000;
const PER_CLIENT_FAILURES = 8;
const GLOBAL_FAILURES = 40;

export async function clientKey(): Promise<string> {
  const h = await headers();
  // Vercel sets x-real-ip; x-forwarded-for's first hop is the client behind other proxies.
  const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  return hmac(`ip:${ip}`);
}

export async function isLockedOut(key: string): Promise<boolean> {
  const db = await getDb();
  const since = new Date(Date.now() - WINDOW_MS);
  const [[client], [global]] = await Promise.all([
    db
      .select({ n: count() })
      .from(authAttempts)
      .where(and(eq(authAttempts.clientKey, key), eq(authAttempts.succeeded, false), gt(authAttempts.createdAt, since))),
    db
      .select({ n: count() })
      .from(authAttempts)
      .where(and(eq(authAttempts.succeeded, false), gt(authAttempts.createdAt, since))),
  ]);
  return client.n >= PER_CLIENT_FAILURES || global.n >= GLOBAL_FAILURES;
}

export async function recordAttempt(key: string, succeeded: boolean): Promise<void> {
  const db = await getDb();
  await db.insert(authAttempts).values({ clientKey: key, succeeded });
  await db.delete(authAttempts).where(lt(authAttempts.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)));
}
