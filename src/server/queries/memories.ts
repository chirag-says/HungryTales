import "server-only";
import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { foods, memories, memoryFoods, memoryPhotos, places, reactions, reviews } from "@/lib/db/schema";
import type { ReactionKind, WouldEatAgain } from "@/lib/domain";
import { compareChronoDesc, mealTimeOf } from "@/lib/engine/dates";
import { generateStory } from "@/lib/engine/narrative";
import { memorySubtitle, memoryTitle } from "@/lib/engine/present";
import { summarizeRatings } from "@/lib/engine/ratings";
import type { SearchDoc } from "@/lib/engine/search";
import { signPhotoUrls } from "@/lib/storage";
import type { Session } from "@/lib/auth/session";
import { loadHistory } from "./history";

export interface PhotoView {
  id: string;
  thumbUrl: string | null;
  displayUrl: string | null;
  width: number;
  height: number;
  isCover: boolean;
}

export interface MemoryCardData {
  id: string;
  eatenOn: string;
  eatenAt: string | null;
  title: string;
  subtitle: string | null;
  placeName: string | null;
  category: string | null;
  costMinor: number | null;
  cover: PhotoView | null;
  photoCount: number;
  ratings: { personId: string; overall: number }[];
  reactions: { personId: string; kind: ReactionKind }[];
  hasLocation: boolean;
}

/** Attach cover photos (with signed URLs) and reactions to a page of history docs. */
export async function hydrateCards(docs: SearchDoc[]): Promise<MemoryCardData[]> {
  if (docs.length === 0) return [];
  const db = await getDb();
  const ids = docs.map((d) => d.id);
  const [photoRows, reactionRows] = await Promise.all([
    db
      .select({
        id: memoryPhotos.id,
        memoryId: memoryPhotos.memoryId,
        storageKey: memoryPhotos.storageKey,
        width: memoryPhotos.width,
        height: memoryPhotos.height,
        isCover: memoryPhotos.isCover,
      })
      .from(memoryPhotos)
      .where(inArray(memoryPhotos.memoryId, ids))
      .orderBy(desc(memoryPhotos.isCover), asc(memoryPhotos.position)),
    db
      .select({ memoryId: reactions.memoryId, personId: reactions.personId, kind: reactions.kind })
      .from(reactions)
      .where(inArray(reactions.memoryId, ids))
      .orderBy(asc(reactions.createdAt)),
  ]);

  const covers = new Map<string, (typeof photoRows)[number]>();
  for (const p of photoRows) if (!covers.has(p.memoryId)) covers.set(p.memoryId, p);
  const urls = await signPhotoUrls([...covers.values()].map((c) => c.storageKey));

  return docs.map((d) => {
    const cover = covers.get(d.id);
    const summary = summarizeRatings(d.reviews);
    return {
      id: d.id,
      eatenOn: d.eatenOn,
      eatenAt: d.eatenAt,
      title: memoryTitle(d),
      subtitle: memorySubtitle(d),
      placeName: d.placeName,
      category: d.category,
      costMinor: d.costMinor,
      cover: cover
        ? { id: cover.id, thumbUrl: urls[cover.storageKey]?.thumb ?? null, displayUrl: urls[cover.storageKey]?.display ?? null, width: cover.width, height: cover.height, isCover: true }
        : null,
      photoCount: d.photoCount,
      ratings: [...summary.byPerson].map(([personId, overall]) => ({ personId, overall })),
      reactions: reactionRows.filter((r) => r.memoryId === d.id).map((r) => ({ personId: r.personId, kind: r.kind })),
      hasLocation: d.latitude != null && d.longitude != null,
    };
  });
}

export interface ReviewView {
  personId: string;
  taste: number | null;
  quantity: number | null;
  value: number | null;
  overall: number | null;
  wouldEatAgain: WouldEatAgain | null;
  comment: string | null;
  updatedAt: string;
}

export interface MemoryDetail {
  id: string;
  eatenOn: string;
  eatenAt: string | null;
  title: string;
  place: { id: string; name: string; area: string | null; address: string | null; visitNumber: number; totalVisits: number } | null;
  locationLabel: string | null;
  latitude: number | null;
  longitude: number | null;
  category: string | null;
  costMinor: number | null;
  shares: Record<string, number> | null;
  notes: string | null;
  story: string;
  storyIsGenerated: boolean;
  generatedStory: string;
  discoveredById: string | null;
  creatorId: string | null;
  provenance: Record<string, string>;
  foods: { id: string; name: string; category: string | null }[];
  photos: (PhotoView & { position: number; takenAt: string | null; contentHash: string | null; bytes: number })[];
  reviews: ReviewView[];
  reactions: { personId: string; kind: ReactionKind }[];
  createdAt: string;
  updatedAt: string;
  prevId: string | null;
  nextId: string | null;
}

/** One memory, scoped to the session's duo. Returns null for anything that is not theirs. */
export async function getMemoryDetail(session: Session, memoryId: string): Promise<MemoryDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(memoryId)) return null;
  const db = await getDb();
  const duoId = session.duo.id;
  const [row] = await db
    .select({ memory: memories, place: places })
    .from(memories)
    .leftJoin(places, eq(places.id, memories.placeId))
    .where(and(eq(memories.id, memoryId), eq(memories.duoId, duoId)))
    .limit(1);
  if (!row) return null;
  const m = row.memory;

  const [photoRows, foodRows, reviewRows, reactionRows, history] = await Promise.all([
    db.select().from(memoryPhotos).where(eq(memoryPhotos.memoryId, m.id)).orderBy(asc(memoryPhotos.position)),
    db
      .select({ id: foods.id, name: foods.name, category: foods.category })
      .from(memoryFoods)
      .innerJoin(foods, eq(foods.id, memoryFoods.foodId))
      .where(eq(memoryFoods.memoryId, m.id))
      .orderBy(asc(memoryFoods.position)),
    db.select().from(reviews).where(eq(reviews.memoryId, m.id)),
    db.select({ personId: reactions.personId, kind: reactions.kind }).from(reactions).where(eq(reactions.memoryId, m.id)).orderBy(asc(reactions.createdAt)),
    loadHistory(duoId),
  ]);

  const urls = await signPhotoUrls(photoRows.map((p) => p.storageKey));
  const ordered = [...history.memories].sort(compareChronoDesc);
  const index = ordered.findIndex((d) => d.id === m.id);

  // Visit number and the previous visit's rating come from real history at this place.
  let place: MemoryDetail["place"] = null;
  let previousCombined: number | null = null;
  if (row.place) {
    const visits = ordered.filter((d) => d.placeId === row.place!.id).reverse();
    const visitIndex = visits.findIndex((d) => d.id === m.id);
    place = { id: row.place.id, name: row.place.name, area: row.place.area, address: row.place.address, visitNumber: visitIndex + 1, totalVisits: visits.length };
    const previous = visitIndex > 0 ? visits[visitIndex - 1] : null;
    previousCombined = previous ? summarizeRatings(previous.reviews).combined : null;
  }

  const reviewList: ReviewView[] = reviewRows.map((r) => ({
    personId: r.personId,
    taste: r.taste,
    quantity: r.quantity,
    value: r.value,
    overall: r.overall,
    wouldEatAgain: r.wouldEatAgain,
    comment: r.comment,
    updatedAt: r.updatedAt.toISOString(),
  }));
  const summary = summarizeRatings(reviewList);
  const nameOf = (id: string) => session.persons.find((p) => p.id === id)?.name ?? "Someone";
  const generatedStory = generateStory({
    memoryId: m.id,
    mealTime: mealTimeOf(m.eatenAt),
    placeName: row.place?.name ?? null,
    foods: foodRows.map((f) => f.name),
    visitNumber: place?.visitNumber ?? null,
    ratings: session.persons.filter((p) => summary.byPerson.has(p.id)).map((p) => ({ name: p.name, overall: summary.byPerson.get(p.id)! })),
    previousCombined,
    combined: summary.combined,
    discoveredBy: m.discoveredById ? nameOf(m.discoveredById) : null,
    bothWouldEatAgain: reviewList.length === 2 && reviewList.every((r) => r.wouldEatAgain === "yes"),
  });

  return {
    id: m.id,
    eatenOn: m.eatenOn,
    eatenAt: m.eatenAt,
    title: memoryTitle({ foods: foodRows, placeName: row.place?.name ?? null, category: m.category, eatenAt: m.eatenAt }),
    place,
    locationLabel: m.locationLabel,
    latitude: m.latitude ?? row.place?.latitude ?? null,
    longitude: m.longitude ?? row.place?.longitude ?? null,
    category: m.category,
    costMinor: m.costMinor,
    shares: m.shares,
    notes: m.notes,
    story: m.story ?? generatedStory,
    storyIsGenerated: m.story == null,
    generatedStory,
    discoveredById: m.discoveredById,
    creatorId: m.creatorId,
    provenance: m.provenance as Record<string, string>,
    foods: foodRows,
    photos: photoRows.map((p) => ({
      id: p.id,
      thumbUrl: urls[p.storageKey]?.thumb ?? null,
      displayUrl: urls[p.storageKey]?.display ?? null,
      width: p.width,
      height: p.height,
      isCover: p.isCover,
      position: p.position,
      takenAt: p.takenAt,
      contentHash: p.contentHash,
      bytes: p.bytes,
    })),
    reviews: reviewList,
    reactions: reactionRows,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    // "prev" is older, "next" is newer, matching reading a journal forward in time.
    prevId: index >= 0 && index < ordered.length - 1 ? ordered[index + 1].id : null,
    nextId: index > 0 ? ordered[index - 1].id : null,
  };
}

/** Saved photos of the duo, for duplicate warnings. Only fingerprint columns. */
export async function knownPhotoFingerprints(duoId: string, hashes: string[], takenAts: string[], excludeMemoryId?: string) {
  if (hashes.length === 0 && takenAts.length === 0) return [];
  const db = await getDb();
  const conditions = [eq(memoryPhotos.duoId, duoId)];
  if (excludeMemoryId) conditions.push(ne(memoryPhotos.memoryId, excludeMemoryId));
  const byHash = hashes.length
    ? await db
        .select({ memoryId: memoryPhotos.memoryId, hash: memoryPhotos.contentHash, takenAt: memoryPhotos.takenAt, width: memoryPhotos.width, height: memoryPhotos.height })
        .from(memoryPhotos)
        .where(and(...conditions, inArray(memoryPhotos.contentHash, hashes)))
    : [];
  const byTime = takenAts.length
    ? await db
        .select({ memoryId: memoryPhotos.memoryId, hash: memoryPhotos.contentHash, takenAt: memoryPhotos.takenAt, width: memoryPhotos.width, height: memoryPhotos.height })
        .from(memoryPhotos)
        .where(and(...conditions, inArray(memoryPhotos.takenAt, takenAts)))
    : [];
  return [...byHash, ...byTime];
}
