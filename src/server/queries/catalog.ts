import "server-only";
import type { Session } from "@/lib/auth/session";
import type { ComposerCatalog } from "@/components/composer/types";
import { foodUsage } from "@/lib/engine/suggest";
import { loadHistory } from "./history";

/**
 * Everything the composer needs for instant, offline-fast suggestions:
 * known places, known foods with usage stats, and categories used so far.
 * Small for a duo (hundreds of rows), so autocomplete runs on the device.
 */
export async function loadComposerCatalog(session: Session): Promise<ComposerCatalog> {
  const history = await loadHistory(session.duo.id);
  const usage = foodUsage(history.memories);
  const visits = new Map<string, number>();
  for (const m of history.memories) if (m.placeId) visits.set(m.placeId, (visits.get(m.placeId) ?? 0) + 1);

  return {
    places: history.places
      .map((p) => ({ id: p.id, name: p.name, area: p.area, latitude: p.latitude, longitude: p.longitude, visits: visits.get(p.id) ?? 0 }))
      .sort((a, b) => b.visits - a.visits || a.name.localeCompare(b.name)),
    foods: history.foods.map((f) => {
      const u = usage.get(f.id);
      return { id: f.id, name: f.name, category: f.category, count: u?.count ?? 0, lastEatenOn: u?.lastEatenOn ?? null, places: u ? [...u.places] : [] };
    }),
    usedCategories: history.memories.map((m) => m.category).filter((c): c is string => Boolean(c)),
  };
}
