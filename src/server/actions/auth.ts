"use server";

import { count, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hashPassphrase, safeEqual, verifyPassphrase } from "@/lib/auth/crypto";
import { clientKey, isLockedOut, recordAttempt } from "@/lib/auth/rate-limit";
import { assertMember, endSession, getSession, setSessionPerson, startSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { duos, persons, sessions } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { runAction, UserError, type ActionResult } from "@/server/action-result";
import { passphrase, personName, setupInput, uuid } from "@/server/validation";

function safeTimezone(tz: string): string {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return tz;
  } catch {
    return "Asia/Kolkata";
  }
}

export async function setupJournal(raw: unknown): Promise<ActionResult<null>> {
  return runAction("setupJournal", async () => {
    const input = setupInput.parse(raw);
    const code = env().SETUP_CODE;
    if (code && !safeEqual(input.setupCode ?? "", code)) {
      throw new UserError("That setup code isn't right. It's the SETUP_CODE value from the deployment settings.");
    }
    const db = await getDb();
    const hash = await hashPassphrase(input.passphrase);
    const created = await db.transaction(async (tx) => {
      // Serialise concurrent setups so only one journal can ever be created.
      await tx.execute(sql`select pg_advisory_xact_lock(724301)`);
      const [existing] = await tx.select({ n: count() }).from(duos);
      if (existing.n > 0) throw new UserError("This journal is already set up. Unlock it instead.", "conflict");
      const [duo] = await tx
        .insert(duos)
        .values({ name: input.journalName, passphraseHash: hash, timezone: safeTimezone(input.timezone), currency: input.currency })
        .returning({ id: duos.id, epoch: duos.sessionEpoch });
      const people = await tx
        .insert(persons)
        .values([
          { duoId: duo.id, name: input.myName, slot: 1 },
          { duoId: duo.id, name: input.friendName, slot: 2 },
        ])
        .returning({ id: persons.id, slot: persons.slot });
      return { duo, meId: people.find((p) => p.slot === 1)!.id };
    });
    await startSession(created.duo.id, created.duo.epoch, created.meId);
    return null;
  });
}

export async function unlockJournal(raw: unknown): Promise<ActionResult<null>> {
  return runAction("unlockJournal", async () => {
    const { passphrase: attempt } = z.object({ passphrase: z.string().min(1, "Enter the passphrase.").max(200) }).parse(raw);
    const key = await clientKey();
    if (await isLockedOut(key)) {
      throw new UserError("Too many wrong tries. Wait 15 minutes, then try again.");
    }
    const db = await getDb();
    const candidates = await db.select({ id: duos.id, hash: duos.passphraseHash, epoch: duos.sessionEpoch }).from(duos).limit(5);
    if (candidates.length === 0) redirect("/setup");
    for (const duo of candidates) {
      if (await verifyPassphrase(attempt, duo.hash)) {
        await recordAttempt(key, true);
        await startSession(duo.id, duo.epoch);
        return null;
      }
    }
    await recordAttempt(key, false);
    throw new UserError("That passphrase didn't work.");
  });
}

export async function chooseWho(personId: string): Promise<ActionResult<null>> {
  return runAction("chooseWho", async () => {
    const id = uuid.parse(personId);
    const session = await getSession();
    if (!session) throw new UserError("Unlock the journal first.");
    if (!session.persons.some((p) => p.id === id)) throw new UserError("That person isn't part of this journal.");
    await setSessionPerson(session.id, id);
    return null;
  });
}

export async function signOut(): Promise<void> {
  await endSession();
  redirect("/unlock");
}

export async function renamePeople(raw: unknown): Promise<ActionResult<null>> {
  return runAction("renamePeople", async () => {
    const session = await assertMember();
    const input = z.object({ journalName: personName, names: z.record(uuid, personName) }).parse(raw);
    const db = await getDb();
    await db.transaction(async (tx) => {
      await tx.update(duos).set({ name: input.journalName, updatedAt: new Date() }).where(eq(duos.id, session.duo.id));
      for (const person of session.persons) {
        const name = input.names[person.id];
        if (name) await tx.update(persons).set({ name }).where(eq(persons.id, person.id));
      }
    });
    return null;
  });
}

/** Changing the passphrase signs out every other device (epoch bump) and keeps this one. */
export async function changePassphrase(raw: unknown): Promise<ActionResult<null>> {
  return runAction("changePassphrase", async () => {
    const session = await assertMember();
    const input = z
      .object({ current: z.string().min(1, "Enter the current passphrase."), next: passphrase, confirm: z.string() })
      .refine((v) => v.next === v.confirm, { path: ["confirm"], message: "The two passphrases don't match." })
      .parse(raw);
    const key = await clientKey();
    if (await isLockedOut(key)) throw new UserError("Too many wrong tries. Wait 15 minutes, then try again.");
    const db = await getDb();
    const [duo] = await db.select({ hash: duos.passphraseHash, epoch: duos.sessionEpoch }).from(duos).where(eq(duos.id, session.duo.id));
    if (!(await verifyPassphrase(input.current, duo.hash))) {
      await recordAttempt(key, false);
      throw new UserError("The current passphrase isn't right.");
    }
    const nextEpoch = duo.epoch + 1;
    await db
      .update(duos)
      .set({ passphraseHash: await hashPassphrase(input.next), sessionEpoch: nextEpoch, updatedAt: new Date() })
      .where(eq(duos.id, session.duo.id));
    await db.delete(sessions).where(eq(sessions.duoId, session.duo.id));
    await startSession(session.duo.id, nextEpoch, session.me.id);
    return null;
  });
}
