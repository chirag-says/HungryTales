import type { Person } from "@/lib/domain";
import type { Candidate } from "./candidates";
import { ROULETTE as CFG } from "./config";
import { formatDuration } from "./dates";
import { distanceMeters } from "./geo";
import { formatRating } from "./ratings";
import { explainCandidate, scoreCandidate, totalScore } from "./recommend";
import type { LatLng } from "./types";

export const ROULETTE_MODES = [
  { id: "love", label: "Something we love", hint: "Rated 8+ and worth repeating" },
  { id: "new", label: "Something new", hint: "From your want-to-try list" },
  { id: "not-recent", label: "Not had in a while", hint: `Nothing from the last ${CFG.notRecentDays} days` },
  { id: "high-rated", label: "Only the best", hint: `Averaging ${CFG.highRatedMinRating}+` },
  { id: "nearby", label: "Nearby", hint: `Within ${CFG.nearbyRadiusKm} km of you` },
  { id: "surprise", label: "Surprise us", hint: "Anything you've eaten" },
] as const;
export type RouletteMode = (typeof ROULETTE_MODES)[number]["id"];

export interface WishCandidate {
  id: string;
  title: string;
  placeName: string | null;
  area: string | null;
  category: string | null;
  estimatedCostMinor: number | null;
  addedByName: string | null;
}

export interface RouletteOptions {
  mode: RouletteMode;
  maxCostMinor?: number | null;
  category?: string | null;
  here?: LatLng | null;
}

export type RouletteOutcome =
  | { kind: "candidate"; candidate: Candidate; reasons: string[] }
  | { kind: "wish"; wish: WishCandidate; reasons: string[] };

export type RouletteResult =
  | { status: "picked"; pick: RouletteOutcome; alternates: RouletteOutcome[]; poolSize: number }
  | { status: "empty"; reason: string };

function matchesCategory(category: string | null, wanted: string | null | undefined): boolean {
  return !wanted || (category ?? "").toLowerCase() === wanted.toLowerCase();
}

/** Candidates that satisfy the mode and filters, before any randomness. */
export function eligibleCandidates(candidates: Candidate[], opts: RouletteOptions): Candidate[] {
  return candidates.filter((c) => {
    if (!matchesCategory(c.category, opts.category)) return false;
    if (opts.maxCostMinor != null && (c.avgCostMinor == null || c.avgCostMinor > opts.maxCostMinor)) return false;
    const answers = [...c.lastEatAgain.values()];
    if (answers.length > 0 && answers.every((a) => a === "no")) return false;
    switch (opts.mode) {
      case "love":
        return c.avgRating != null && c.avgRating >= CFG.loveMinRating && (c.eatAgainRatio == null || c.eatAgainRatio >= 0.5);
      case "high-rated":
        return c.avgRating != null && c.avgRating >= CFG.highRatedMinRating;
      case "not-recent":
        return c.daysSince >= CFG.notRecentDays;
      case "nearby":
        return (
          opts.here != null &&
          c.latitude != null &&
          c.longitude != null &&
          distanceMeters(opts.here, { lat: c.latitude, lng: c.longitude }) <= CFG.nearbyRadiusKm * 1000
        );
      case "surprise":
        return true;
      case "new":
        return false;
    }
  });
}

export function eligibleWishes(wishes: WishCandidate[], opts: RouletteOptions): WishCandidate[] {
  if (opts.mode !== "new") return [];
  return wishes.filter(
    (w) =>
      matchesCategory(w.category, opts.category) &&
      (opts.maxCostMinor == null || w.estimatedCostMinor == null || w.estimatedCostMinor <= opts.maxCostMinor),
  );
}

/** Pick an index with probability proportional to its weight. */
export function weightedPick(weights: number[], rng: () => number): number {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return Math.floor(rng() * weights.length);
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}

function candidateReasons(c: Candidate, opts: RouletteOptions, persons: Person[], favourites: Map<string, number>): string[] {
  const lead: string[] = [];
  if (opts.mode === "nearby" && opts.here && c.latitude != null && c.longitude != null) {
    const km = distanceMeters(opts.here, { lat: c.latitude, lng: c.longitude }) / 1000;
    lead.push(km < 1 ? `${Math.round(km * 1000)} m away.` : `${km.toFixed(1)} km away.`);
  }
  if (opts.mode === "not-recent") lead.push(`Last time was ${formatDuration(c.daysSince)} ago.`);
  if (opts.mode === "high-rated" && c.avgRating != null) lead.push(`Averages ${formatRating(Math.round(c.avgRating * 10) / 10)}/10.`);
  const rest = explainCandidate(c, persons, favourites).filter((r) => !lead.some((l) => l.slice(0, 12) === r.slice(0, 12)));
  return [...lead, ...rest].slice(0, 3);
}

function wishReasons(w: WishCandidate): string[] {
  const reasons = ["On your want-to-try list."];
  if (w.addedByName) reasons.push(`${w.addedByName} added it.`);
  return reasons;
}

function drawWithoutReplacement<T>(items: T[], weights: number[], count: number, rng: () => number): T[] {
  const pool = items.map((item, i) => ({ item, weight: weights[i] }));
  const out: T[] = [];
  while (out.length < count && pool.length > 0) {
    const i = weightedPick(pool.map((p) => p.weight), rng);
    out.push(pool[i].item);
    pool.splice(i, 1);
  }
  return out;
}

/**
 * Filter, weight and draw. "Surprise us" and "Something new" are uniform;
 * other modes lean toward higher-scoring options without ever excluding the rest.
 */
export function spinRoulette(
  candidates: Candidate[],
  wishes: WishCandidate[],
  opts: RouletteOptions,
  persons: Person[],
  favourites: Map<string, number>,
  rng: () => number = Math.random,
): RouletteResult {
  if (opts.mode === "nearby" && !opts.here) {
    return { status: "empty", reason: "Nearby needs your location. Allow it, or pick another mode." };
  }
  if (opts.mode === "new") {
    const pool = eligibleWishes(wishes, opts);
    if (pool.length === 0) {
      return {
        status: "empty",
        reason: wishes.length === 0 ? "Your want-to-try list is empty. Add a few places first." : "Nothing on your want-to-try list fits these filters.",
      };
    }
    const [pick, ...alternates] = drawWithoutReplacement(pool, pool.map(() => 1), 1 + CFG.alternates, rng);
    return {
      status: "picked",
      pick: { kind: "wish", wish: pick, reasons: wishReasons(pick) },
      alternates: alternates.map((w) => ({ kind: "wish", wish: w, reasons: wishReasons(w) })),
      poolSize: pool.length,
    };
  }

  const pool = eligibleCandidates(candidates, opts);
  if (pool.length === 0) {
    return {
      status: "empty",
      reason: candidates.length === 0 ? "Save a few memories first; roulette picks from your own history." : "Nothing in your history fits these filters. Try loosening them.",
    };
  }
  const weights =
    opts.mode === "surprise" ? pool.map(() => 1) : pool.map((c) => (0.05 + totalScore(scoreCandidate(c))) ** CFG.scoreExponent);
  const [pick, ...alternates] = drawWithoutReplacement(pool, weights, 1 + CFG.alternates, rng);
  const outcome = (c: Candidate): RouletteOutcome => ({ kind: "candidate", candidate: c, reasons: candidateReasons(c, opts, persons, favourites) });
  return { status: "picked", pick: outcome(pick), alternates: alternates.map(outcome), poolSize: pool.length };
}

/** Small seeded PRNG (mulberry32) so tests are deterministic. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
