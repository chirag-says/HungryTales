import "server-only";
import { asc, count, eq } from "drizzle-orm";
import { cache } from "react";
import { getDb } from "@/lib/db/client";
import { foods, memories, memoryFoods, memoryPhotos, places, reviews } from "@/lib/db/schema";
import type { SearchDoc } from "@/lib/engine/search";
import type { HistoryPlace } from "@/lib/engine/types";

export interface DuoHistory {
  memories: SearchDoc[];
  places: HistoryPlace[];
  foods: { id: string; name: string; category: string | null }[];
}

/**
 * The compact, photo-free history of one duo, loaded in five narrow queries and
 * shared by search, filters, recommendations, roulette, stats and On This Day.
 * Cached per request. At a few thousand memories this is tens of milliseconds;
 * if a duo ever grows past ~20k memories, move filtering into SQL.
 */
export const loadHistory = cache(async (duoId: string): Promise<DuoHistory> => {
  const db = await getDb();
  const [memoryRows, foodRows, reviewRows, photoCounts, placeRows, catalog] = await Promise.all([
    db
      .select({
        id: memories.id,
        eatenOn: memories.eatenOn,
        eatenAt: memories.eatenAt,
        placeId: memories.placeId,
        placeName: places.name,
        area: places.area,
        locationLabel: memories.locationLabel,
        latitude: memories.latitude,
        longitude: memories.longitude,
        placeLat: places.latitude,
        placeLng: places.longitude,
        category: memories.category,
        costMinor: memories.costMinor,
        shares: memories.shares,
        notes: memories.notes,
        discoveredById: memories.discoveredById,
        creatorId: memories.creatorId,
      })
      .from(memories)
      .leftJoin(places, eq(places.id, memories.placeId))
      .where(eq(memories.duoId, duoId)),
    db
      .select({ memoryId: memoryFoods.memoryId, id: foods.id, name: foods.name, category: foods.category })
      .from(memoryFoods)
      .innerJoin(foods, eq(foods.id, memoryFoods.foodId))
      .where(eq(foods.duoId, duoId))
      .orderBy(asc(memoryFoods.position)),
    db
      .select({
        memoryId: reviews.memoryId,
        personId: reviews.personId,
        taste: reviews.taste,
        quantity: reviews.quantity,
        value: reviews.value,
        overall: reviews.overall,
        wouldEatAgain: reviews.wouldEatAgain,
        comment: reviews.comment,
      })
      .from(reviews)
      .innerJoin(memories, eq(memories.id, reviews.memoryId))
      .where(eq(memories.duoId, duoId)),
    db
      .select({ memoryId: memoryPhotos.memoryId, n: count() })
      .from(memoryPhotos)
      .where(eq(memoryPhotos.duoId, duoId))
      .groupBy(memoryPhotos.memoryId),
    db
      .select({
        id: places.id,
        name: places.name,
        area: places.area,
        latitude: places.latitude,
        longitude: places.longitude,
        discoveredById: places.discoveredById,
        createdAt: places.createdAt,
      })
      .from(places)
      .where(eq(places.duoId, duoId)),
    db.select({ id: foods.id, name: foods.name, category: foods.category }).from(foods).where(eq(foods.duoId, duoId)),
  ]);

  const foodsByMemory = new Map<string, SearchDoc["foods"]>();
  for (const f of foodRows) {
    const list = foodsByMemory.get(f.memoryId) ?? [];
    list.push({ id: f.id, name: f.name, category: f.category });
    foodsByMemory.set(f.memoryId, list);
  }
  const reviewsByMemory = new Map<string, SearchDoc["reviews"]>();
  const commentsByMemory = new Map<string, string[]>();
  for (const r of reviewRows) {
    const list = reviewsByMemory.get(r.memoryId) ?? [];
    list.push({ personId: r.personId, taste: r.taste, quantity: r.quantity, value: r.value, overall: r.overall, wouldEatAgain: r.wouldEatAgain });
    reviewsByMemory.set(r.memoryId, list);
    if (r.comment) commentsByMemory.set(r.memoryId, [...(commentsByMemory.get(r.memoryId) ?? []), r.comment]);
  }
  const photosByMemory = new Map(photoCounts.map((p) => [p.memoryId, Number(p.n)]));

  return {
    memories: memoryRows.map(({ placeLat, placeLng, ...m }) => ({
      ...m,
      // A memory without its own coordinates is still mappable through its place.
      latitude: m.latitude ?? placeLat,
      longitude: m.longitude ?? placeLng,
      foods: foodsByMemory.get(m.id) ?? [],
      reviews: reviewsByMemory.get(m.id) ?? [],
      comments: commentsByMemory.get(m.id) ?? [],
      photoCount: photosByMemory.get(m.id) ?? 0,
    })),
    places: placeRows.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() })),
    foods: catalog,
  };
});
