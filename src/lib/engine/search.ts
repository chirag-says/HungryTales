import { RATING_MAX, RATING_MIN, type Person } from "@/lib/domain";
import { compareChronoDesc, monthName, parseDate } from "./dates";
import { summarizeRatings } from "./ratings";
import { tokenMatchScore, tokenize } from "./text";
import type { HistoryMemory } from "./types";

export interface SearchDoc extends HistoryMemory {
  comments: string[];
}

export interface ParsedQuery {
  terms: string[];
  month: number | null;
  year: number | null;
  minRating: number | null;
  maxCostMajor: number | null;
  /** Human-readable chips describing what the parser understood. */
  understood: string[];
}

const MONTH_WORDS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5,
  jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};
const COST_WORDS = new Set(["under", "below", "less", "than", "within", "max", "upto", "up", "to"]);

/**
 * Turn free text into terms plus structured hints:
 * "september" -> month, "2025" -> year, "9" / "9+" / "9/10" -> minimum rating,
 * "under 500" / "<500" / "₹500" -> maximum cost.
 */
export function parseSearchQuery(raw: string): ParsedQuery {
  const parsed: ParsedQuery = { terms: [], month: null, year: null, minRating: null, maxCostMajor: null, understood: [] };
  const rawTokens = raw.toLowerCase().trim().split(/\s+/).filter(Boolean);
  let expectCost = false;

  for (const rawToken of rawTokens) {
    const money = /^(?:<|≤|<=|₹|rs\.?|inr|\$)\s*(\d+(?:\.\d+)?)$/.exec(rawToken);
    if (money) {
      parsed.maxCostMajor = Number(money[1]);
      expectCost = false;
      continue;
    }
    const rating = /^(\d{1,2}(?:\.\d)?)(?:\+|\/10)$/.exec(rawToken);
    if (rating && Number(rating[1]) >= RATING_MIN && Number(rating[1]) <= RATING_MAX) {
      parsed.minRating = Number(rating[1]);
      continue;
    }
    if (/^\d+(?:\.\d+)?$/.test(rawToken)) {
      const n = Number(rawToken);
      if (expectCost) parsed.maxCostMajor = n;
      else if (/^\d{4}$/.test(rawToken) && n >= 1990 && n <= 2100) parsed.year = n;
      else if (n >= RATING_MIN && n <= RATING_MAX) parsed.minRating = n;
      else parsed.maxCostMajor = n;
      expectCost = false;
      continue;
    }
    for (const token of tokenize(rawToken)) {
      if (COST_WORDS.has(token)) {
        expectCost = true;
        continue;
      }
      if (token in MONTH_WORDS) {
        parsed.month = MONTH_WORDS[token];
        continue;
      }
      parsed.terms.push(token);
    }
  }

  if (parsed.month) parsed.understood.push(monthName(parsed.month));
  if (parsed.year) parsed.understood.push(String(parsed.year));
  if (parsed.minRating != null) parsed.understood.push(`Rated ${parsed.minRating}+`);
  if (parsed.maxCostMajor != null) parsed.understood.push(`Up to ${parsed.maxCostMajor}`);
  return parsed;
}

export interface MemoryFilters {
  placeId?: string | null;
  category?: string | null;
  foodId?: string | null;
  minRating?: number | null;
  maxCostMinor?: number | null;
  /** Memories this person reviewed. */
  reviewedBy?: string | null;
  from?: string | null;
  to?: string | null;
  hasPhotos?: boolean | null;
  hasLocation?: boolean | null;
}

export function applyFilters<M extends HistoryMemory>(memories: M[], filters: MemoryFilters): M[] {
  return memories.filter((m) => {
    if (filters.placeId && m.placeId !== filters.placeId) return false;
    if (filters.category && (m.category ?? "").toLowerCase() !== filters.category.toLowerCase()) return false;
    if (filters.foodId && !m.foods.some((f) => f.id === filters.foodId)) return false;
    if (filters.minRating != null) {
      const { byPerson } = summarizeRatings(m.reviews);
      if (![...byPerson.values()].some((v) => v >= (filters.minRating as number))) return false;
    }
    if (filters.maxCostMinor != null && (m.costMinor == null || m.costMinor > filters.maxCostMinor)) return false;
    if (filters.reviewedBy && !m.reviews.some((r) => r.personId === filters.reviewedBy)) return false;
    if (filters.from && m.eatenOn < filters.from) return false;
    if (filters.to && m.eatenOn > filters.to) return false;
    if (filters.hasPhotos != null && m.photoCount > 0 !== filters.hasPhotos) return false;
    if (filters.hasLocation != null && (m.latitude != null && m.longitude != null) !== filters.hasLocation) return false;
    return true;
  });
}

interface Field {
  label: string;
  weight: number;
  tokens: string[];
}

function fieldsOf(doc: SearchDoc, persons: Person[]): Field[] {
  const nameOf = (id: string | null) => persons.find((p) => p.id === id)?.name ?? "";
  const { month } = parseDate(doc.eatenOn);
  return [
    { label: "place", weight: 3, tokens: tokenize(doc.placeName ?? "") },
    { label: "food", weight: 3, tokens: doc.foods.flatMap((f) => tokenize(f.name)) },
    { label: "category", weight: 2, tokens: tokenize([doc.category, ...doc.foods.map((f) => f.category)].filter(Boolean).join(" ")) },
    { label: "location", weight: 2, tokens: tokenize([doc.area, doc.locationLabel].filter(Boolean).join(" ")) },
    { label: "notes", weight: 1, tokens: tokenize([doc.notes, ...doc.comments].filter(Boolean).join(" ")) },
    { label: "person", weight: 1.5, tokens: tokenize(nameOf(doc.discoveredById)) },
    { label: "date", weight: 1, tokens: tokenize(monthName(month)) },
  ];
}

export interface SearchHit<M> {
  memory: M;
  score: number;
  matched: string[];
}

/**
 * Rank memories for a query. Every free-text term must match at least one field
 * (AND semantics); the score favours exact and prefix matches in heavier fields.
 */
export function searchMemories<M extends SearchDoc>(
  docs: M[],
  query: ParsedQuery,
  persons: Person[],
  opts: { minorDigits: number },
): SearchHit<M>[] {
  const filters: MemoryFilters = {
    minRating: query.minRating,
    maxCostMinor: query.maxCostMajor != null ? Math.round(query.maxCostMajor * 10 ** opts.minorDigits) : null,
  };
  const pool = applyFilters(docs, filters).filter((m) => {
    const d = parseDate(m.eatenOn);
    return (query.month == null || d.month === query.month) && (query.year == null || d.year === query.year);
  });

  if (query.terms.length === 0) {
    return pool.sort(compareChronoDesc).map((memory) => ({ memory, score: 0, matched: [] }));
  }

  const hits: SearchHit<M>[] = [];
  for (const doc of pool) {
    const fields = fieldsOf(doc, persons);
    let score = 0;
    const matched = new Set<string>();
    let allTermsMatched = true;
    for (const term of query.terms) {
      let best = 0;
      let bestLabel = "";
      for (const field of fields) {
        for (const token of field.tokens) {
          const s = tokenMatchScore(term, token) * field.weight;
          if (s > best) {
            best = s;
            bestLabel = field.label;
          }
        }
      }
      if (best === 0) {
        allTermsMatched = false;
        break;
      }
      score += best;
      matched.add(bestLabel);
    }
    if (allTermsMatched) hits.push({ memory: doc, score, matched: [...matched] });
  }
  return hits.sort((a, b) => b.score - a.score || compareChronoDesc(a.memory, b.memory));
}
