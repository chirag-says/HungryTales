import "server-only";
import type { Session } from "@/lib/auth/session";
import { compareChronoDesc } from "@/lib/engine/dates";
import { mean, summarizeRatings } from "@/lib/engine/ratings";
import { loadHistory } from "./history";

export interface PlaceSummary {
  id: string;
  name: string;
  area: string | null;
  latitude: number | null;
  longitude: number | null;
  visits: number;
  firstOn: string | null;
  lastOn: string | null;
  lastMemoryId: string | null;
  avgRating: number | null;
  ratingByPerson: Record<string, number>;
  totalSpentMinor: number;
  discoveredById: string | null;
  topFoods: { id: string; name: string; count: number }[];
  memoryIds: string[];
}

function round1(n: number | null): number | null {
  return n == null ? null : Math.round(n * 10) / 10;
}

/** Every place with visit statistics derived from the memories that reference it. */
export async function listPlaces(session: Session): Promise<PlaceSummary[]> {
  const history = await loadHistory(session.duo.id);
  const byPlace = new Map<string, typeof history.memories>();
  for (const m of history.memories) {
    if (!m.placeId) continue;
    byPlace.set(m.placeId, [...(byPlace.get(m.placeId) ?? []), m]);
  }

  return history.places
    .map((p) => {
      const visits = (byPlace.get(p.id) ?? []).sort(compareChronoDesc);
      const perPerson = new Map<string, number[]>();
      const combined: number[] = [];
      const foodCounts = new Map<string, { id: string; name: string; count: number }>();
      let spent = 0;
      for (const m of visits) {
        const s = summarizeRatings(m.reviews);
        if (s.combined != null) combined.push(s.combined);
        for (const [pid, v] of s.byPerson) perPerson.set(pid, [...(perPerson.get(pid) ?? []), v]);
        spent += m.costMinor ?? 0;
        for (const f of m.foods) {
          const e = foodCounts.get(f.id) ?? { id: f.id, name: f.name, count: 0 };
          e.count++;
          foodCounts.set(f.id, e);
        }
      }
      // Coordinates: the place's own, else the latest memory there that had some.
      const located = visits.find((m) => m.latitude != null && m.longitude != null);
      return {
        id: p.id,
        name: p.name,
        area: p.area,
        latitude: p.latitude ?? located?.latitude ?? null,
        longitude: p.longitude ?? located?.longitude ?? null,
        visits: visits.length,
        firstOn: visits[visits.length - 1]?.eatenOn ?? null,
        lastOn: visits[0]?.eatenOn ?? null,
        lastMemoryId: visits[0]?.id ?? null,
        avgRating: round1(mean(combined)),
        ratingByPerson: Object.fromEntries([...perPerson].map(([pid, list]) => [pid, round1(mean(list)) as number])),
        totalSpentMinor: spent,
        discoveredById: p.discoveredById,
        topFoods: [...foodCounts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 5),
        memoryIds: visits.map((m) => m.id),
      };
    })
    .sort((a, b) => b.visits - a.visits || (b.lastOn ?? "").localeCompare(a.lastOn ?? ""));
}
