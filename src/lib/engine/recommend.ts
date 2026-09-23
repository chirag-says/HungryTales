import type { Person } from "@/lib/domain";
import { buildCandidates, categoryCounts, type Candidate } from "./candidates";
import { RECOMMENDATION as CFG } from "./config";
import { formatDuration } from "./dates";
import { formatRating, summarizeRatings } from "./ratings";
import type { HistoryMemory } from "./types";

export interface ScoreBreakdown {
  rating: number;
  repeat: number;
  recency: number;
  value: number;
  novelty: number;
}

export interface Recommendation {
  candidate: Candidate;
  score: number;
  breakdown: ScoreBreakdown;
  /** Every reason is derived from stored data; nothing is phrased that the data does not show. */
  reasons: string[];
}

export type RecommendationResult =
  | { status: "ok"; items: Recommendation[] }
  | { status: "insufficient"; reviewedMemories: number; needed: number };

const unit = (rating: number | null) => (rating == null ? 0.5 : (rating - 1) / 9);

export function scoreCandidate(c: Candidate): ScoreBreakdown {
  const recency =
    c.daysSince < CFG.tooRecentDays ? 0 : Math.min(1, (c.daysSince - CFG.tooRecentDays) / (CFG.recencySaturationDays - CFG.tooRecentDays));
  return {
    rating: unit(c.avgRating),
    repeat: c.eatAgainRatio ?? 0.5,
    recency,
    value: unit(c.avgValue),
    novelty: 1 / c.visits,
  };
}

export function totalScore(b: ScoreBreakdown): number {
  const w = CFG.weights;
  return b.rating * w.rating + b.repeat * w.repeat + b.recency * w.recency + b.value * w.value + b.novelty * w.novelty;
}

/** Everyone who answered on the latest visit said "no". */
function isRejected(c: Candidate): boolean {
  const answers = [...c.lastEatAgain.values()];
  return answers.length > 0 && answers.every((a) => a === "no");
}

export function explainCandidate(c: Candidate, persons: Person[], favouriteCategories: Map<string, number>): string[] {
  const reasons: string[] = [];
  const lastRatings = persons.map((p) => c.lastRatingByPerson.get(p.id)).filter((v): v is number => v != null);
  const bothRated = lastRatings.length === persons.length && persons.length === 2;

  if (bothRated && lastRatings.every((r) => r >= CFG.veryHighRating)) {
    reasons.push(`You both rated it ${CFG.veryHighRating}+ last time.`);
  } else if (bothRated && lastRatings.every((r) => r >= CFG.highRating)) {
    reasons.push(`You both rated it ${CFG.highRating}+ last time.`);
  } else if (c.avgRating != null && c.avgRating >= CFG.highRating) {
    reasons.push(c.visits > 1 ? `Averages ${formatRating(round1(c.avgRating))}/10 over ${c.visits} visits.` : `Rated ${formatRating(round1(c.avgRating))}/10.`);
  }

  const answers = [...c.lastEatAgain.values()];
  if (answers.length === 2 && answers.every((a) => a === "yes")) reasons.push("You both said you'd eat it again.");

  if (c.daysSince >= 14) {
    const what = c.kind === "place" ? "been here" : "had this";
    reasons.push(`You haven't ${what} in ${formatDuration(c.daysSince)}.`);
  }

  if (c.category && favouriteCategories.has(c.category)) {
    reasons.push(`${c.category} is one of your most eaten categories (${favouriteCategories.get(c.category)} meals).`);
  }
  if (c.avgValue != null && c.avgValue >= CFG.highRating) reasons.push(`Good value: ${formatRating(round1(c.avgValue))}/10.`);
  if (c.visits >= 3 && reasons.length < 2) reasons.push(`A regular: ${c.visits} visits so far.`);
  if (c.visits === 1 && reasons.length < 2) reasons.push("You've only been once.");
  return reasons.slice(0, 3);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function favouriteCategories(memories: HistoryMemory[]): Map<string, number> {
  const counts = categoryCounts(memories);
  const total = memories.length;
  return new Map(
    [...counts].filter(([, n]) => n >= CFG.favouriteCategoryMinCount && n / Math.max(1, total) >= CFG.favouriteCategoryShare),
  );
}

export function recommend(memories: HistoryMemory[], persons: Person[], today: string): RecommendationResult {
  const reviewed = memories.filter((m) => summarizeRatings(m.reviews).ratedBy > 0).length;
  if (reviewed < CFG.minReviewedMemories) {
    return { status: "insufficient", reviewedMemories: reviewed, needed: CFG.minReviewedMemories };
  }
  const favourites = favouriteCategories(memories);
  const items = buildCandidates(memories, today)
    .filter((c) => !isRejected(c) && c.avgRating != null)
    .map((candidate) => {
      const breakdown = scoreCandidate(candidate);
      return { candidate, breakdown, score: totalScore(breakdown), reasons: explainCandidate(candidate, persons, favourites) };
    })
    .filter((r) => r.reasons.length > 0)
    .sort((a, b) => b.score - a.score || a.candidate.title.localeCompare(b.candidate.title))
    .slice(0, CFG.maxResults);
  return { status: "ok", items };
}
