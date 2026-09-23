"use server";

import { and, count, eq, gt, inArray, isNull, notInArray, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { assertMember, type Session } from "@/lib/auth/session";
import { getDb, type Db } from "@/lib/db/client";
import { foods, memories, memoryFoods, memoryPhotos, pendingUploads, places, reactions, reviews, wishlistItems } from "@/lib/db/schema";
import { LIMITS } from "@/lib/domain";
import { addDays, todayIn } from "@/lib/engine/dates";
import { findDuplicates, type DuplicateWarning, type PhotoFingerprint } from "@/lib/engine/duplicates";
import { sharesAreValid } from "@/lib/engine/money";
import { normalizeText } from "@/lib/engine/text";
import { photoKey, storage, type UploadReceipt, type UploadTarget } from "@/lib/storage";
import { runAction, UserError, type ActionResult } from "@/server/action-result";
import { knownPhotoFingerprints } from "@/server/queries/memories";
import { memoryInput, reactionInput, reviewInput, uuid, type MemoryInput } from "@/server/validation";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const PENDING_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_PENDING_PER_HOUR = 200;

// ---------------------------------------------------------------- photo uploads

export interface PreparedUpload {
  photoId: string;
  target: UploadTarget;
}

/** Issue photo ids and signed upload targets. Keys are derived here, never taken from the client. */
export async function preparePhotoUploads(howMany: number): Promise<ActionResult<PreparedUpload[]>> {
  return runAction("preparePhotoUploads", async () => {
    const session = await assertMember();
    const n = z.number().int().min(1).max(LIMITS.photosPerMemory).parse(howMany);
    const db = await getDb();
    const [recent] = await db
      .select({ n: count() })
      .from(pendingUploads)
      .where(and(eq(pendingUploads.duoId, session.duo.id), gt(pendingUploads.createdAt, new Date(Date.now() - 60 * 60 * 1000))));
    if (recent.n + n > MAX_PENDING_PER_HOUR) throw new UserError("That's a lot of uploads in one hour. Give it a little while.");

    const ids = Array.from({ length: n }, () => crypto.randomUUID());
    await db.insert(pendingUploads).values(ids.map((id) => ({ id, duoId: session.duo.id })));
    const store = storage();
    return Promise.all(ids.map(async (photoId) => ({ photoId, target: await store.createUploadTarget(photoKey(session.duo.id, photoId)) })));
  });
}

const fingerprintSchema = z.object({
  hash: z.string().regex(/^[0-9a-f]{64}$/).nullable(),
  takenAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/).nullable(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
});

function nearbySeconds(takenAt: string): string[] {
  const base = Date.parse(`${takenAt}Z`);
  if (!Number.isFinite(base)) return [];
  return [-2, -1, 0, 1, 2].map((d) => new Date(base + d * 1000).toISOString().slice(0, 19));
}

/** Soft warnings for photos that look already saved. Never blocks. */
export async function checkPhotoDuplicates(raw: unknown, excludeMemoryId?: string): Promise<ActionResult<DuplicateWarning[]>> {
  return runAction("checkPhotoDuplicates", async () => {
    const session = await assertMember();
    const selection: PhotoFingerprint[] = z.array(fingerprintSchema).max(LIMITS.photosPerMemory).parse(raw);
    const exclude = excludeMemoryId ? uuid.parse(excludeMemoryId) : undefined;
    const hashes = selection.map((s) => s.hash).filter((h): h is string => h != null);
    const times = selection.flatMap((s) => (s.takenAt ? nearbySeconds(s.takenAt) : []));
    const known = await knownPhotoFingerprints(session.duo.id, hashes, times, exclude);
    return findDuplicates(selection, known);
  });
}

// ---------------------------------------------------------------- save memory

async function resolvePlace(tx: Tx, session: Session, input: MemoryInput): Promise<string | null> {
  if (!input.place) return null;
  const duoId = session.duo.id;
  const coords = input.latitude != null && input.longitude != null ? { latitude: input.latitude, longitude: input.longitude } : null;

  if (input.place.mode === "existing") {
    const [place] = await tx
      .select({ id: places.id, latitude: places.latitude })
      .from(places)
      .where(and(eq(places.id, input.place.id), eq(places.duoId, duoId)));
    if (!place) throw new UserError("That place no longer exists. Pick it again.");
    // Fill in coordinates the place never had; never overwrite existing ones.
    if (place.latitude == null && coords) {
      await tx.update(places).set({ ...coords, updatedAt: new Date() }).where(eq(places.id, place.id));
    }
    return place.id;
  }

  const normalizedName = normalizeText(input.place.name);
  const [same] = await tx
    .select({ id: places.id })
    .from(places)
    .where(and(eq(places.duoId, duoId), eq(places.normalizedName, normalizedName)))
    .limit(1);
  if (same) return same.id;
  const [created] = await tx
    .insert(places)
    .values({
      duoId,
      name: input.place.name,
      normalizedName,
      area: input.place.area,
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
      discoveredById: input.discoveredById,
    })
    .returning({ id: places.id });
  return created.id;
}

async function resolveFoods(tx: Tx, duoId: string, names: string[], category: string | null, discoveredById: string | null): Promise<string[]> {
  const unique = new Map<string, string>();
  for (const name of names) {
    const key = normalizeText(name);
    if (key && !unique.has(key)) unique.set(key, name);
  }
  if (unique.size === 0) return [];
  const keys = [...unique.keys()];
  await tx
    .insert(foods)
    .values(keys.map((k) => ({ duoId, name: unique.get(k)!, normalizedName: k, category, discoveredById })))
    .onConflictDoNothing({ target: [foods.duoId, foods.normalizedName] });
  const rows = await tx
    .select({ id: foods.id, normalizedName: foods.normalizedName })
    .from(foods)
    .where(and(eq(foods.duoId, duoId), inArray(foods.normalizedName, keys)));
  const idByKey = new Map(rows.map((r) => [r.normalizedName, r.id]));
  return keys.map((k) => idByKey.get(k)!).filter(Boolean);
}

function assertInputBelongsToDuo(session: Session, input: MemoryInput) {
  const personIds = new Set(session.persons.map((p) => p.id));
  if (input.discoveredById && !personIds.has(input.discoveredById)) throw new UserError("Pick who found it from the two of you.");
  if (input.shares) {
    if (Object.keys(input.shares).some((id) => !personIds.has(id))) throw new UserError("Shares must belong to the two of you.");
    if (!sharesAreValid(input.costMinor ?? 0, input.shares)) throw new UserError("The two shares need to add up to the total.");
  }
  const latest = addDays(todayIn(session.duo.timezone), 1);
  if (input.eatenOn > latest) throw new UserError("That date is in the future.");
}

async function verifyNewPhotos(tx: Tx, duoId: string, uploads: { id: string; receipt: UploadReceipt | null }[]) {
  if (uploads.length === 0) return;
  const photoIds = uploads.map((u) => u.id);
  const pending = await tx
    .select({ id: pendingUploads.id })
    .from(pendingUploads)
    .where(
      and(
        eq(pendingUploads.duoId, duoId),
        inArray(pendingUploads.id, photoIds),
        isNull(pendingUploads.consumedAt),
        gt(pendingUploads.createdAt, new Date(Date.now() - PENDING_TTL_MS)),
      ),
    );
  if (pending.length !== photoIds.length) throw new UserError("Some photos expired before saving. Remove them and add them again.");
  const store = storage();
  const present = await Promise.all(uploads.map((u) => store.confirmUpload(photoKey(duoId, u.id), u.receipt)));
  if (present.some((ok) => !ok)) throw new UserError("Some photos didn't finish uploading. Try saving again.");
  await tx.update(pendingUploads).set({ consumedAt: new Date() }).where(inArray(pendingUploads.id, photoIds));
}

async function writePhotos(tx: Tx, duoId: string, memoryId: string, input: MemoryInput) {
  const coverId = input.coverPhotoId ?? input.photos[0]?.id ?? null;
  const fresh = input.photos.filter((p) => p.isNew);
  await verifyNewPhotos(tx, duoId, fresh.map((p) => ({ id: p.id, receipt: p.receipt })));
  for (const [position, photo] of input.photos.entries()) {
    if (photo.isNew) {
      await tx.insert(memoryPhotos).values({
        id: photo.id,
        memoryId,
        duoId,
        storageKey: photoKey(duoId, photo.id),
        width: photo.width,
        height: photo.height,
        position,
        isCover: photo.id === coverId,
        contentHash: photo.contentHash,
        takenAt: photo.takenAt,
        bytes: photo.bytes,
      });
    } else {
      await tx
        .update(memoryPhotos)
        .set({ position, isCover: photo.id === coverId })
        .where(and(eq(memoryPhotos.id, photo.id), eq(memoryPhotos.memoryId, memoryId)));
    }
  }
}

async function writeFoods(tx: Tx, duoId: string, memoryId: string, input: MemoryInput) {
  const foodIds = await resolveFoods(tx, duoId, input.foods, input.category, input.discoveredById);
  await tx.delete(memoryFoods).where(eq(memoryFoods.memoryId, memoryId));
  if (foodIds.length) await tx.insert(memoryFoods).values(foodIds.map((foodId, position) => ({ memoryId, foodId, position })));
}

function memoryColumns(input: MemoryInput, placeId: string | null) {
  return {
    eatenOn: input.eatenOn,
    eatenAt: input.eatenAt,
    placeId,
    locationLabel: input.locationLabel,
    latitude: input.latitude,
    longitude: input.longitude,
    category: input.category,
    costMinor: input.costMinor,
    shares: input.shares,
    notes: input.notes,
    story: input.story,
    discoveredById: input.discoveredById,
    provenance: input.provenance,
  };
}

export async function createMemory(raw: unknown, wishId?: string | null): Promise<ActionResult<{ id: string }>> {
  return runAction("createMemory", async () => {
    const session = await assertMember();
    const input = memoryInput.parse(raw);
    if (input.photos.some((p) => !p.isNew)) throw new UserError("New memories can only have new photos.");
    assertInputBelongsToDuo(session, input);
    const db = await getDb();
    const id = await db.transaction(async (tx) => {
      const placeId = await resolvePlace(tx, session, input);
      const [row] = await tx
        .insert(memories)
        .values({ duoId: session.duo.id, creatorId: session.me.id, ...memoryColumns(input, placeId) })
        .returning({ id: memories.id });
      await writeFoods(tx, session.duo.id, row.id, input);
      await writePhotos(tx, session.duo.id, row.id, input);
      if (wishId) {
        await tx
          .update(wishlistItems)
          .set({ doneMemoryId: row.id, doneAt: new Date() })
          .where(and(eq(wishlistItems.id, uuid.parse(wishId)), eq(wishlistItems.duoId, session.duo.id)));
      }
      return row.id;
    });
    return { id };
  });
}

export async function updateMemory(memoryId: string, raw: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction("updateMemory", async () => {
    const session = await assertMember();
    const id = uuid.parse(memoryId);
    const input = memoryInput.parse(raw);
    assertInputBelongsToDuo(session, input);
    const db = await getDb();
    const removedKeys = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: memories.id })
        .from(memories)
        .where(and(eq(memories.id, id), eq(memories.duoId, session.duo.id)))
        .for("update");
      if (!existing) throw new UserError("This memory no longer exists.", "conflict");

      const current = await tx.select({ id: memoryPhotos.id, storageKey: memoryPhotos.storageKey }).from(memoryPhotos).where(eq(memoryPhotos.memoryId, id));
      const currentIds = new Set(current.map((p) => p.id));
      const kept = input.photos.filter((p) => !p.isNew).map((p) => p.id);
      if (kept.some((pid) => !currentIds.has(pid))) throw new UserError("A photo in this memory changed. Reload and try again.", "conflict");

      const removed = current.filter((p) => !kept.includes(p.id));
      if (removed.length) {
        await tx.delete(memoryPhotos).where(and(eq(memoryPhotos.memoryId, id), kept.length ? notInArray(memoryPhotos.id, kept) : sql`true`));
      }
      const placeId = await resolvePlace(tx, session, input);
      await tx.update(memories).set({ ...memoryColumns(input, placeId), updatedAt: new Date() }).where(eq(memories.id, id));
      await writeFoods(tx, session.duo.id, id, input);
      await writePhotos(tx, session.duo.id, id, input);
      return removed.map((p) => p.storageKey);
    });
    await removeObjects(removedKeys, "updateMemory");
    return { id };
  });
}

/** Storage cleanup happens after the DB commit; a failure leaves an orphan file, never a broken memory. */
async function removeObjects(keys: string[], context: string) {
  if (keys.length === 0) return;
  try {
    await storage().remove(keys);
  } catch (error) {
    console.error(JSON.stringify({ level: "warn", action: context, message: "photo cleanup failed", keys: keys.length, error: String(error) }));
  }
}

export async function deleteMemory(memoryId: string): Promise<ActionResult<null>> {
  return runAction("deleteMemory", async () => {
    const session = await assertMember();
    const id = uuid.parse(memoryId);
    const db = await getDb();
    const keys = await db.transaction(async (tx) => {
      const photos = await tx
        .select({ storageKey: memoryPhotos.storageKey })
        .from(memoryPhotos)
        .where(and(eq(memoryPhotos.memoryId, id), eq(memoryPhotos.duoId, session.duo.id)));
      const deleted = await tx.delete(memories).where(and(eq(memories.id, id), eq(memories.duoId, session.duo.id))).returning({ id: memories.id });
      if (deleted.length === 0) throw new UserError("This memory was already deleted.", "conflict");
      return photos.map((p) => p.storageKey);
    });
    await removeObjects(keys, "deleteMemory");
    return null;
  });
}

// ---------------------------------------------------------------- reviews, reactions, story

async function assertMemoryInDuo(session: Session, memoryId: string) {
  const db = await getDb();
  const [row] = await db
    .select({ id: memories.id })
    .from(memories)
    .where(and(eq(memories.id, memoryId), eq(memories.duoId, session.duo.id)));
  if (!row) throw new UserError("This memory no longer exists.", "conflict");
}

/** A person can only write their own review. The reviewer is the session, never the payload. */
export async function saveReview(raw: unknown): Promise<ActionResult<null>> {
  return runAction("saveReview", async () => {
    const session = await assertMember();
    const input = reviewInput.parse(raw);
    await assertMemoryInDuo(session, input.memoryId);
    const db = await getDb();
    const values = {
      taste: input.taste,
      quantity: input.quantity,
      value: input.value,
      overall: input.overall,
      wouldEatAgain: input.wouldEatAgain,
      comment: input.comment,
    };
    await db
      .insert(reviews)
      .values({ memoryId: input.memoryId, personId: session.me.id, ...values })
      .onConflictDoUpdate({ target: [reviews.memoryId, reviews.personId], set: { ...values, updatedAt: new Date() } });
    refresh();
    return null;
  });
}

export async function deleteMyReview(memoryId: string): Promise<ActionResult<null>> {
  return runAction("deleteMyReview", async () => {
    const session = await assertMember();
    const id = uuid.parse(memoryId);
    await assertMemoryInDuo(session, id);
    const db = await getDb();
    await db.delete(reviews).where(and(eq(reviews.memoryId, id), eq(reviews.personId, session.me.id)));
    refresh();
    return null;
  });
}

export async function toggleReaction(raw: unknown): Promise<ActionResult<{ active: boolean }>> {
  return runAction("toggleReaction", async () => {
    const session = await assertMember();
    const input = reactionInput.parse(raw);
    await assertMemoryInDuo(session, input.memoryId);
    const db = await getDb();
    const where = and(eq(reactions.memoryId, input.memoryId), eq(reactions.personId, session.me.id), eq(reactions.kind, input.kind));
    const removed = await db.delete(reactions).where(where).returning({ kind: reactions.kind });
    if (removed.length === 0) {
      await db.insert(reactions).values({ memoryId: input.memoryId, personId: session.me.id, kind: input.kind }).onConflictDoNothing();
    }
    refresh();
    return { active: removed.length === 0 };
  });
}

/** Save an edited story line, or pass null to go back to the generated one. */
export async function updateStory(memoryId: string, story: string | null): Promise<ActionResult<null>> {
  return runAction("updateStory", async () => {
    const session = await assertMember();
    const id = uuid.parse(memoryId);
    const value = z.string().trim().max(LIMITS.storyMax).nullable().parse(story);
    await assertMemoryInDuo(session, id);
    const db = await getDb();
    await db.update(memories).set({ story: value || null, updatedAt: new Date() }).where(eq(memories.id, id));
    refresh();
    return null;
  });
}
