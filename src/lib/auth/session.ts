import "server-only";
import { and, eq, gt, lt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/lib/db/client";
import { duos, persons, sessions } from "@/lib/db/schema";
import type { Person, PersonSlot } from "@/lib/domain";
import { newToken, sha256 } from "./crypto";

export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-ht_session" : "ht_session";
const SESSION_DAYS = 90;
const TOUCH_AFTER_MS = 24 * 60 * 60 * 1000;

export interface Session {
  id: string;
  duo: { id: string; name: string; currency: string; timezone: string };
  persons: Person[];
  /** Who is using this device. Null until they pick on the "who's here" screen. */
  me: Person | null;
  partner: Person | null;
}

function expiry(): Date {
  return new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
}

async function writeCookie(token: string, expires: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

/** Create a session and set the cookie. Call only from Server Actions / Route Handlers. */
export async function startSession(duoId: string, epoch: number, personId: string | null = null): Promise<void> {
  const db = await getDb();
  const token = newToken();
  const expiresAt = expiry();
  await db.insert(sessions).values({ id: sha256(token), duoId, personId, epoch, expiresAt });
  await writeCookie(token, expiresAt);
  // Opportunistic cleanup keeps the table small without a cron job.
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.delete(sessions).where(eq(sessions.id, sha256(token)));
  }
  jar.delete(SESSION_COOKIE);
}

/** Current session, validated against the database. Cached per request. */
export const getSession = cache(async (): Promise<Session | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const db = await getDb();
  const id = sha256(token);
  const [row] = await db
    .select({ session: sessions, duo: duos })
    .from(sessions)
    .innerJoin(duos, eq(duos.id, sessions.duoId))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (!row || row.session.epoch !== row.duo.sessionEpoch) return null;

  const people = await db
    .select({ id: persons.id, name: persons.name, slot: persons.slot })
    .from(persons)
    .where(eq(persons.duoId, row.duo.id))
    .orderBy(persons.slot);
  const list: Person[] = people.map((p) => ({ ...p, slot: p.slot as PersonSlot }));
  const me = list.find((p) => p.id === row.session.personId) ?? null;

  if (Date.now() - row.session.lastSeenAt.getTime() > TOUCH_AFTER_MS) {
    await db.update(sessions).set({ lastSeenAt: new Date(), expiresAt: expiry() }).where(eq(sessions.id, id));
  }

  return {
    id,
    duo: { id: row.duo.id, name: row.duo.name, currency: row.duo.currency, timezone: row.duo.timezone },
    persons: list,
    me,
    partner: me ? (list.find((p) => p.id !== me.id) ?? null) : null,
  };
});

/** For pages: signed in *and* has picked who they are, or redirect. */
export async function requireMember(): Promise<Session & { me: Person }> {
  const session = await getSession();
  if (!session) redirect("/unlock");
  if (!session.me) redirect("/who");
  return session as Session & { me: Person };
}

/** For Server Actions and Route Handlers: same checks, but throw instead of redirecting mid-mutation. */
export class AuthError extends Error {
  constructor(message = "Your session has ended. Unlock the journal again.") {
    super(message);
    this.name = "AuthError";
  }
}

export async function assertMember(): Promise<Session & { me: Person }> {
  const session = await getSession();
  if (!session || !session.me) throw new AuthError();
  return session as Session & { me: Person };
}

export async function setSessionPerson(sessionId: string, personId: string): Promise<void> {
  const db = await getDb();
  await db.update(sessions).set({ personId }).where(eq(sessions.id, sessionId));
}
