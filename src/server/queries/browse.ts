import "server-only";
import type { Session } from "@/lib/auth/session";
import { chronoKey, compareChronoDesc } from "@/lib/engine/dates";
import { minorDigits } from "@/lib/engine/money";
import { applyFilters, parseSearchQuery, searchMemories, type MemoryFilters, type ParsedQuery } from "@/lib/engine/search";
import { loadHistory } from "./history";
import { hydrateCards, type MemoryCardData } from "./memories";

export const PAGE_SIZE = 24;

export interface BrowseParams {
  q?: string | null;
  filters?: MemoryFilters;
  cursor?: string | null;
  limit?: number;
}

export interface BrowsePage {
  items: MemoryCardData[];
  nextCursor: string | null;
  total: number;
  understood: string[];
  /** Per-year counts across the whole filtered result, so timeline grouping is stable across pages. */
  yearCounts: Record<number, number>;
}

function cursorOf(m: { eatenOn: string; eatenAt: string | null; id: string }): string {
  return `${chronoKey(m.eatenOn, m.eatenAt)}|${m.id}`;
}

/**
 * One entry point for timeline, gallery, filtered lists and search.
 * Chronological lists use a keyset cursor (stable while new memories arrive);
 * ranked search results use an offset cursor ("o:24").
 */
export async function browseMemories(session: Session, params: BrowseParams): Promise<BrowsePage> {
  const limit = Math.min(Math.max(params.limit ?? PAGE_SIZE, 1), 60);
  const history = await loadHistory(session.duo.id);
  const filtered = applyFilters(history.memories, params.filters ?? {});
  const q = params.q?.trim() ?? "";

  let ordered: typeof filtered;
  let understood: string[] = [];
  let ranked = false;
  if (q) {
    const parsed: ParsedQuery = parseSearchQuery(q);
    understood = parsed.understood;
    const hits = searchMemories(filtered, parsed, session.persons, { minorDigits: minorDigits(session.duo.currency) });
    ranked = parsed.terms.length > 0;
    ordered = hits.map((h) => h.memory);
  } else {
    ordered = [...filtered].sort(compareChronoDesc);
  }

  let start = 0;
  if (params.cursor) {
    if (params.cursor.startsWith("o:")) start = Math.max(0, Number(params.cursor.slice(2)) || 0);
    else {
      const index = ordered.findIndex((m) => cursorOf(m) < params.cursor!);
      start = index === -1 ? ordered.length : index;
    }
  }
  const page = ordered.slice(start, start + limit);
  const hasMore = start + limit < ordered.length;
  const yearCounts: Record<number, number> = {};
  for (const m of ordered) {
    const y = Number(m.eatenOn.slice(0, 4));
    yearCounts[y] = (yearCounts[y] ?? 0) + 1;
  }

  return {
    items: await hydrateCards(page),
    nextCursor: hasMore ? (ranked ? `o:${start + limit}` : cursorOf(page[page.length - 1])) : null,
    total: ordered.length,
    understood,
    yearCounts,
  };
}

/** Parse filter query-string params shared by pages and the API route. */
export function filtersFromParams(get: (key: string) => string | null | undefined): MemoryFilters {
  const str = (k: string) => {
    const v = get(k);
    return v && v.length <= 120 ? v : null;
  };
  const num = (k: string) => {
    const v = Number(get(k));
    return get(k) != null && Number.isFinite(v) ? v : null;
  };
  const isDate = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const isUuid = (v: string | null) => (v && /^[0-9a-f-]{36}$/i.test(v) ? v : null);
  return {
    placeId: isUuid(str("place")),
    foodId: isUuid(str("food")),
    category: str("category"),
    minRating: num("rating"),
    maxCostMinor: num("maxCost"),
    reviewedBy: isUuid(str("by")),
    from: isDate(str("from")),
    to: isDate(str("to")),
    hasPhotos: get("photos") === "1" ? true : null,
  };
}
