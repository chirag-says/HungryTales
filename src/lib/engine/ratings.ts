import type { HistoryReview } from "./types";

type RatingFields = Pick<HistoryReview, "taste" | "quantity" | "value" | "overall">;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * A person's overall score for a meal: their explicit overall if given,
 * otherwise the mean of whatever aspect ratings they gave. Null if they rated nothing.
 */
export function overallOf(review: RatingFields): number | null {
  if (review.overall != null) return review.overall;
  const parts = [review.taste, review.quantity, review.value].filter((v): v is number => v != null);
  if (parts.length === 0) return null;
  return round1(parts.reduce((a, b) => a + b, 0) / parts.length);
}

export interface MemoryRatingSummary {
  /** personId -> that person's overall (only people who rated). Never averaged away. */
  byPerson: Map<string, number>;
  /** Mean of the individual overalls; a convenience, always shown next to both originals. */
  combined: number | null;
  /** |A - B| when both rated. */
  gap: number | null;
  ratedBy: number;
}

export function summarizeRatings(reviews: HistoryReview[]): MemoryRatingSummary {
  const byPerson = new Map<string, number>();
  for (const r of reviews) {
    const o = overallOf(r);
    if (o != null) byPerson.set(r.personId, o);
  }
  const values = [...byPerson.values()];
  const combined = values.length ? round1(values.reduce((a, b) => a + b, 0) / values.length) : null;
  const gap = values.length === 2 ? round1(Math.abs(values[0] - values[1])) : null;
  return { byPerson, combined, gap, ratedBy: values.length };
}

/** Both people rated and both at or above the threshold. */
export function bothRatedAtLeast(reviews: HistoryReview[], threshold: number): boolean {
  const { byPerson } = summarizeRatings(reviews);
  return byPerson.size >= 2 && [...byPerson.values()].every((v) => v >= threshold);
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function formatRating(value: number | null): string {
  if (value == null) return "–";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
