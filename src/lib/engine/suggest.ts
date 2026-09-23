import { daysBetween } from "./dates";
import { fuzzyScore, normalizeText } from "./text";
import type { HistoryMemory } from "./types";

export interface UsageStat {
  id: string;
  name: string;
  category: string | null;
  count: number;
  lastEatenOn: string | null;
  /** Place ids this item has been eaten at, with counts. */
  places: Map<string, number>;
}

/** Tally how often and how recently each food was eaten, and where. */
export function foodUsage(memories: HistoryMemory[]): Map<string, UsageStat> {
  const stats = new Map<string, UsageStat>();
  for (const m of memories) {
    for (const f of m.foods) {
      const s = stats.get(f.id) ?? { id: f.id, name: f.name, category: f.category, count: 0, lastEatenOn: null, places: new Map() };
      s.count++;
      if (!s.lastEatenOn || m.eatenOn > s.lastEatenOn) s.lastEatenOn = m.eatenOn;
      if (m.placeId) s.places.set(m.placeId, (s.places.get(m.placeId) ?? 0) + 1);
      stats.set(f.id, s);
    }
  }
  return stats;
}

export interface Suggestion {
  id: string;
  name: string;
  category: string | null;
  hint: string | null;
  score: number;
}

/**
 * Autocomplete for food names from the duo's own history.
 * Empty query: foods eaten at `placeId` first, then the most recent ones.
 * With a query: fuzzy text match, boosted by frequency, recency and place.
 */
export function suggestFoods(
  query: string,
  catalog: { id: string; name: string; category: string | null }[],
  usage: Map<string, UsageStat>,
  opts: { placeId?: string | null; today: string; exclude?: Set<string>; limit?: number },
): Suggestion[] {
  const limit = opts.limit ?? 8;
  const q = normalizeText(query);
  const results: Suggestion[] = [];

  for (const food of catalog) {
    if (opts.exclude?.has(food.id)) continue;
    const u = usage.get(food.id);
    const atPlace = opts.placeId ? (u?.places.get(opts.placeId) ?? 0) : 0;
    const textScore = q ? fuzzyScore(q, food.name) : 0.5;
    if (q && textScore === 0) continue;
    if (!q && !u) continue;

    const frequency = u ? Math.min(1, Math.log2(1 + u.count) / 4) : 0;
    const recency = u?.lastEatenOn ? Math.max(0, 1 - daysBetween(u.lastEatenOn, opts.today) / 180) : 0;
    const score = textScore * 3 + frequency + recency * 0.5 + (atPlace > 0 ? 1.5 : 0);

    let hint: string | null = null;
    if (atPlace > 0) hint = atPlace === 1 ? "Had it here before" : `Had it here ${atPlace} times`;
    else if (u && u.count > 1) hint = `${u.count} times`;
    results.push({ id: food.id, name: food.name, category: food.category, hint, score });
  }

  return results.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, limit);
}

/** Categories seen in history first (most used), then suggested defaults, filtered by query. */
export function suggestCategories(query: string, used: string[], defaults: readonly string[], limit = 10): string[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const c of used) {
    const key = normalizeText(c);
    if (!key) continue;
    const entry = counts.get(key) ?? { label: c, count: 0 };
    entry.count++;
    counts.set(key, entry);
  }
  for (const d of defaults) {
    const key = normalizeText(d);
    if (!counts.has(key)) counts.set(key, { label: d, count: 0 });
  }
  const q = normalizeText(query);
  return [...counts.values()]
    .filter((c) => !q || fuzzyScore(q, c.label) > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit)
    .map((c) => c.label);
}
