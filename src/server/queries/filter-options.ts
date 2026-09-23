import "server-only";
import type { FilterOptions } from "@/components/memory/MemoryFilters";
import type { DuoHistory } from "./history";

/** Filter choices drawn only from what exists in the duo's history. */
export function filterOptionsFrom(history: DuoHistory): FilterOptions {
  const categoryCounts = new Map<string, number>();
  for (const m of history.memories) if (m.category) categoryCounts.set(m.category, (categoryCounts.get(m.category) ?? 0) + 1);
  return {
    places: [...history.places].sort((a, b) => a.name.localeCompare(b.name)).map((p) => ({ id: p.id, name: p.name })),
    foods: [...history.foods].sort((a, b) => a.name.localeCompare(b.name)).map((f) => ({ id: f.id, name: f.name })),
    categories: [...categoryCounts].sort((a, b) => b[1] - a[1]).map(([c]) => c),
  };
}
