import { compareChronoDesc, daysBetween } from "./dates";
import { mean, overallOf, summarizeRatings } from "./ratings";
import type { HistoryMemory } from "./types";

/**
 * A thing they could eat again: a place, or (for meals without a place) a food.
 * Shared by the recommendation engine and food roulette so both reason about
 * exactly the same facts.
 */
export interface Candidate {
  key: string;
  kind: "place" | "food";
  placeId: string | null;
  foodId: string | null;
  title: string;
  area: string | null;
  category: string | null;
  latitude: number | null;
  longitude: number | null;
  visits: number;
  firstOn: string;
  lastOn: string;
  daysSince: number;
  lastMemoryId: string;
  /** personId -> mean overall across visits */
  ratingByPerson: Map<string, number>;
  /** personId -> overall on the most recent visit they rated */
  lastRatingByPerson: Map<string, number>;
  /** Mean of the per-person means (each person weighs the same). */
  avgRating: number | null;
  avgValue: number | null;
  /** yes=1, maybe=0.5, no=0 over all answers; null if nobody answered. */
  eatAgainRatio: number | null;
  /** Latest answers per person. */
  lastEatAgain: Map<string, "yes" | "maybe" | "no">;
  avgCostMinor: number | null;
  /** Best-rated food at this place (for place candidates). */
  topFood: { id: string; name: string; rating: number } | null;
}

const EAT_AGAIN_VALUE = { yes: 1, maybe: 0.5, no: 0 } as const;

function buildCandidate(key: string, kind: Candidate["kind"], memories: HistoryMemory[], today: string): Candidate {
  const sorted = [...memories].sort(compareChronoDesc);
  const latest = sorted[0];
  const oldest = sorted[sorted.length - 1];

  const perPerson = new Map<string, number[]>();
  const lastRatingByPerson = new Map<string, number>();
  const lastEatAgain = new Map<string, "yes" | "maybe" | "no">();
  const values: number[] = [];
  const eatAgain: number[] = [];
  const costs: number[] = [];
  const foodRatings = new Map<string, { name: string; ratings: number[] }>();

  for (const m of sorted) {
    if (m.costMinor != null) costs.push(m.costMinor);
    const combined = summarizeRatings(m.reviews).combined;
    for (const f of m.foods) {
      const entry = foodRatings.get(f.id) ?? { name: f.name, ratings: [] };
      if (combined != null) entry.ratings.push(combined);
      foodRatings.set(f.id, entry);
    }
    for (const r of m.reviews) {
      const o = overallOf(r);
      if (o != null) {
        perPerson.set(r.personId, [...(perPerson.get(r.personId) ?? []), o]);
        if (!lastRatingByPerson.has(r.personId)) lastRatingByPerson.set(r.personId, o);
      }
      if (r.value != null) values.push(r.value);
      if (r.wouldEatAgain) {
        eatAgain.push(EAT_AGAIN_VALUE[r.wouldEatAgain]);
        if (!lastEatAgain.has(r.personId)) lastEatAgain.set(r.personId, r.wouldEatAgain);
      }
    }
  }

  const ratingByPerson = new Map([...perPerson].map(([id, list]) => [id, mean(list) as number]));
  let topFood: Candidate["topFood"] = null;
  if (kind === "place") {
    for (const [id, { name, ratings }] of foodRatings) {
      const avg = mean(ratings);
      if (avg != null && (!topFood || avg > topFood.rating)) topFood = { id, name, rating: avg };
    }
  }

  const withCoords = sorted.find((m) => m.latitude != null && m.longitude != null);
  const categoryCounts = new Map<string, number>();
  for (const m of sorted) {
    const c = m.category ?? m.foods.find((f) => f.category)?.category;
    if (c) categoryCounts.set(c, (categoryCounts.get(c) ?? 0) + 1);
  }
  const category = [...categoryCounts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const avgCost = mean(costs);

  return {
    key,
    kind,
    placeId: kind === "place" ? latest.placeId : null,
    foodId: kind === "food" ? key.slice("food:".length) : null,
    title: kind === "place" ? (latest.placeName ?? "Unknown place") : (latest.foods.find((f) => `food:${f.id}` === key)?.name ?? "Unknown food"),
    area: latest.area ?? latest.locationLabel,
    category,
    latitude: withCoords?.latitude ?? null,
    longitude: withCoords?.longitude ?? null,
    visits: sorted.length,
    firstOn: oldest.eatenOn,
    lastOn: latest.eatenOn,
    daysSince: daysBetween(latest.eatenOn, today),
    lastMemoryId: latest.id,
    ratingByPerson,
    lastRatingByPerson,
    avgRating: mean([...ratingByPerson.values()]),
    avgValue: mean(values),
    eatAgainRatio: mean(eatAgain),
    lastEatAgain,
    avgCostMinor: avgCost == null ? null : Math.round(avgCost),
    topFood,
  };
}

/**
 * Places they have eaten at, plus foods from meals with no place attached
 * (home-cooked, delivery, street carts they never named).
 */
export function buildCandidates(memories: HistoryMemory[], today: string): Candidate[] {
  const groups = new Map<string, { kind: Candidate["kind"]; memories: HistoryMemory[] }>();
  for (const m of memories) {
    if (m.eatenOn > today) continue;
    if (m.placeId) {
      const key = `place:${m.placeId}`;
      const g = groups.get(key) ?? { kind: "place" as const, memories: [] };
      g.memories.push(m);
      groups.set(key, g);
    } else {
      for (const f of m.foods) {
        const key = `food:${f.id}`;
        const g = groups.get(key) ?? { kind: "food" as const, memories: [] };
        g.memories.push(m);
        groups.set(key, g);
      }
    }
  }
  return [...groups].map(([key, g]) => buildCandidate(key, g.kind, g.memories, today));
}

/** Categories by number of meals, most eaten first. */
export function categoryCounts(memories: HistoryMemory[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const m of memories) {
    const c = m.category ?? m.foods.find((f) => f.category)?.category;
    if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return new Map([...counts].sort((a, b) => b[1] - a[1]));
}
