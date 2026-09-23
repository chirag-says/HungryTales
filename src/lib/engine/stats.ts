import type { Person } from "@/lib/domain";
import { STATS as CFG } from "./config";
import { compareChronoDesc, mealTimeOf, monthKey, type MealTime } from "./dates";
import { spendByPerson } from "./money";
import { summarizeRatings } from "./ratings";
import type { HistoryMemory } from "./types";

export interface Period {
  kind: "month" | "year" | "all";
  /** "2026-09", "2026", or "all" */
  key: string;
  from: string | null;
  to: string | null;
}

export function periodFor(key: string): Period {
  if (key === "all") return { kind: "all", key, from: null, to: null };
  if (/^\d{4}$/.test(key)) return { kind: "year", key, from: `${key}-01-01`, to: `${key}-12-31` };
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(key)) return { kind: "month", key, from: `${key}-01`, to: `${key}-31` };
  throw new Error(`Invalid period: ${key}`);
}

export function inPeriod(m: { eatenOn: string }, p: Period): boolean {
  return (p.from == null || m.eatenOn >= p.from) && (p.to == null || m.eatenOn <= p.to);
}

export interface Ranked {
  id: string;
  name: string;
  count: number;
}

export interface MealHighlight {
  memoryId: string;
  title: string;
  eatenOn: string;
  rating: number;
}

export interface PeriodStats {
  period: Period;
  memoryCount: number;
  photoCount: number;
  placesVisited: number;
  newPlaces: number;
  totalSpentMinor: number;
  costedMemories: number;
  avgSpendMinor: number | null;
  spendByPerson: Record<string, number>;
  avgRating: number | null;
  ratedMemories: number;
  /** Rankings are null when the sample is too small to mean anything. */
  mostVisitedPlace: Ranked | null;
  topCategory: Ranked | null;
  topFood: Ranked | null;
  topSpendPlace: (Ranked & { spentMinor: number }) | null;
  bestMeal: MealHighlight | null;
  worstMeal: MealHighlight | null;
  biggestDisagreement: (MealHighlight & { gap: number; ratings: Record<string, number> }) | null;
  /** personId -> places first visited in this period that they found. */
  discoveries: Record<string, number>;
  topDiscoverer: { personId: string; count: number } | null;
  months: { key: string; count: number; spentMinor: number }[];
  mostActiveMonth: { key: string; count: number } | null;
  mealTimes: { label: MealTime; count: number }[];
  isThin: boolean;
}

function titleOf(m: HistoryMemory): string {
  const food = m.foods[0]?.name;
  if (food && m.placeName) return `${food} at ${m.placeName}`;
  return food ?? m.placeName ?? m.category ?? "A meal";
}

function topOf(counts: Map<string, { name: string; count: number }>, minCount = 2): Ranked | null {
  let best: Ranked | null = null;
  for (const [id, { name, count }] of counts) {
    if (count >= minCount && (!best || count > best.count || (count === best.count && name < best.name))) best = { id, name, count };
  }
  return best;
}

function bump(map: Map<string, { name: string; count: number }>, id: string, name: string) {
  const e = map.get(id) ?? { name, count: 0 };
  e.count++;
  map.set(id, e);
}

export function computeStats(all: HistoryMemory[], persons: Person[], period: Period): PeriodStats {
  const memories = all.filter((m) => inPeriod(m, period)).sort(compareChronoDesc);
  const n = memories.length;
  const canRank = n >= CFG.minForRankings;

  // First visit per place across *all* history decides "new place" and discoverer.
  const firstVisit = new Map<string, HistoryMemory>();
  for (const m of [...all].sort(compareChronoDesc).reverse()) {
    if (m.placeId && !firstVisit.has(m.placeId)) firstVisit.set(m.placeId, m);
  }

  const places = new Map<string, { name: string; count: number }>();
  const categories = new Map<string, { name: string; count: number }>();
  const foods = new Map<string, { name: string; count: number }>();
  const placeSpend = new Map<string, { name: string; count: number; spent: number }>();
  const months = new Map<string, { count: number; spentMinor: number }>();
  const mealTimes = new Map<MealTime, number>();
  const discoveries: Record<string, number> = Object.fromEntries(persons.map((p) => [p.id, 0]));
  const rated: { m: HistoryMemory; combined: number; byPerson: Map<string, number>; gap: number | null }[] = [];
  let photoCount = 0;
  let totalSpent = 0;
  let costed = 0;
  let newPlaces = 0;

  for (const m of memories) {
    photoCount += m.photoCount;
    if (m.costMinor != null) {
      totalSpent += m.costMinor;
      costed++;
    }
    if (m.placeId && m.placeName) {
      bump(places, m.placeId, m.placeName);
      if (m.costMinor != null) {
        const e = placeSpend.get(m.placeId) ?? { name: m.placeName, count: 0, spent: 0 };
        e.count++;
        e.spent += m.costMinor;
        placeSpend.set(m.placeId, e);
      }
      if (firstVisit.get(m.placeId)?.id === m.id) {
        newPlaces++;
        if (m.discoveredById && m.discoveredById in discoveries) discoveries[m.discoveredById]++;
      }
    }
    const category = m.category ?? m.foods.find((f) => f.category)?.category;
    if (category) bump(categories, category.toLowerCase(), category);
    for (const f of m.foods) bump(foods, f.id, f.name);
    const mk = monthKey(m.eatenOn);
    const month = months.get(mk) ?? { count: 0, spentMinor: 0 };
    month.count++;
    month.spentMinor += m.costMinor ?? 0;
    months.set(mk, month);
    const mt = mealTimeOf(m.eatenAt);
    if (mt) mealTimes.set(mt, (mealTimes.get(mt) ?? 0) + 1);
    const summary = summarizeRatings(m.reviews);
    if (summary.combined != null) rated.push({ m, combined: summary.combined, byPerson: summary.byPerson, gap: summary.gap });
  }

  const highlight = (r: (typeof rated)[number]): MealHighlight => ({ memoryId: r.m.id, title: titleOf(r.m), eatenOn: r.m.eatenOn, rating: r.combined });
  let bestMeal: MealHighlight | null = null;
  let worstMeal: MealHighlight | null = null;
  if (rated.length >= CFG.minRatedForExtremes) {
    const byRating = [...rated].sort((a, b) => b.combined - a.combined || compareChronoDesc(a.m, b.m));
    bestMeal = highlight(byRating[0]);
    const worst = byRating[byRating.length - 1];
    if (worst.combined < byRating[0].combined) worstMeal = highlight(worst);
  }

  const disagreements = rated.filter((r) => r.gap != null && r.gap >= 3).sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0));
  const biggestDisagreement = disagreements[0]
    ? { ...highlight(disagreements[0]), gap: disagreements[0].gap as number, ratings: Object.fromEntries(disagreements[0].byPerson) }
    : null;

  const topDiscovererEntry = Object.entries(discoveries).sort((a, b) => b[1] - a[1]);
  const topDiscoverer =
    topDiscovererEntry.length && topDiscovererEntry[0][1] > 0 && (topDiscovererEntry[1]?.[1] ?? 0) < topDiscovererEntry[0][1]
      ? { personId: topDiscovererEntry[0][0], count: topDiscovererEntry[0][1] }
      : null;

  const monthList = [...months].map(([key, v]) => ({ key, ...v })).sort((a, b) => (a.key < b.key ? -1 : 1));
  const mostActive =
    period.kind !== "month" && monthList.length >= CFG.minMonthsForTrend ? [...monthList].sort((a, b) => b.count - a.count || (a.key < b.key ? -1 : 1))[0] : null;

  let topSpendPlace: PeriodStats["topSpendPlace"] = null;
  if (canRank) {
    for (const [id, e] of placeSpend) {
      if (!topSpendPlace || e.spent > topSpendPlace.spentMinor) topSpendPlace = { id, name: e.name, count: e.count, spentMinor: e.spent };
    }
  }

  return {
    period,
    memoryCount: n,
    photoCount,
    placesVisited: places.size,
    newPlaces,
    totalSpentMinor: totalSpent,
    costedMemories: costed,
    avgSpendMinor: costed ? Math.round(totalSpent / costed) : null,
    spendByPerson: spendByPerson(memories, persons.map((p) => p.id)),
    avgRating: rated.length ? Math.round((rated.reduce((a, r) => a + r.combined, 0) / rated.length) * 10) / 10 : null,
    ratedMemories: rated.length,
    mostVisitedPlace: canRank ? topOf(places) : null,
    topCategory: canRank ? topOf(categories) : null,
    topFood: canRank ? topOf(foods) : null,
    topSpendPlace,
    bestMeal,
    worstMeal,
    biggestDisagreement,
    discoveries,
    topDiscoverer,
    months: monthList,
    mostActiveMonth: mostActive ? { key: mostActive.key, count: mostActive.count } : null,
    mealTimes: [...mealTimes].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
    isThin: n < CFG.minForRankings,
  };
}

export interface Milestone {
  label: string;
  eatenOn: string;
  memoryId: string;
}

/** Real milestones only: counts reached, first perfect score, first repeat visit. */
export function computeMilestones(all: HistoryMemory[]): { reached: Milestone[]; next: { count: number; remaining: number } | null } {
  const asc = [...all].sort(compareChronoDesc).reverse();
  const reached: Milestone[] = [];
  CFG.milestoneCounts.forEach((count) => {
    const m = asc[count - 1];
    if (m) reached.push({ label: count === 1 ? "Your first memory" : `Memory #${count}`, eatenOn: m.eatenOn, memoryId: m.id });
  });
  const perfect = asc.find((m) => [...summarizeRatings(m.reviews).byPerson.values()].some((v) => v === 10));
  if (perfect) reached.push({ label: "First 10/10", eatenOn: perfect.eatenOn, memoryId: perfect.id });
  const seen = new Set<string>();
  const repeat = asc.find((m) => {
    if (!m.placeId) return false;
    if (seen.has(m.placeId)) return true;
    seen.add(m.placeId);
    return false;
  });
  if (repeat) reached.push({ label: `First return visit${repeat.placeName ? `: ${repeat.placeName}` : ""}`, eatenOn: repeat.eatenOn, memoryId: repeat.id });
  const nextCount = CFG.milestoneCounts.find((c) => c > asc.length);
  return {
    reached: reached.sort((a, b) => (a.eatenOn < b.eatenOn ? 1 : -1)),
    next: nextCount ? { count: nextCount, remaining: nextCount - asc.length } : null,
  };
}
