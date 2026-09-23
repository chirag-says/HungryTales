import type { MealTime } from "./dates";
import { formatRating } from "./ratings";
import { stableHash } from "./text";

/**
 * Facts a story line may use. Anything absent is simply left out of the sentence;
 * the generator never adds a feeling, event, person or dish that is not here.
 */
export interface StoryFacts {
  memoryId: string;
  mealTime: MealTime | null;
  placeName: string | null;
  foods: string[];
  /** 1 for a first visit; null when there is no place. */
  visitNumber: number | null;
  ratings: { name: string; overall: number }[];
  previousCombined: number | null;
  combined: number | null;
  discoveredBy: string | null;
  bothWouldEatAgain: boolean;
}

export function listFoods(foods: string[], max = 2): string {
  if (foods.length === 0) return "";
  if (foods.length === 1) return foods[0];
  if (foods.length <= max) return `${foods.slice(0, -1).join(", ")} and ${foods[foods.length - 1]}`;
  const extra = foods.length - max;
  return `${foods.slice(0, max).join(", ")} and ${extra} more`;
}

function article(word: string): string {
  return /^[aeiou]/i.test(word) ? "An" : "A";
}

function opening(f: StoryFacts, variant: number): string {
  const food = listFoods(f.foods);
  const time = f.mealTime;
  if (f.placeName && f.visitNumber === 1) {
    const base = time ? `${article(time)} ${time} first visit to ${f.placeName}` : `First time at ${f.placeName}`;
    return food ? `${base} for ${food}` : base;
  }
  if (f.placeName && f.visitNumber && f.visitNumber > 1) {
    const base = variant % 2 === 0 ? `Back at ${f.placeName}, visit #${f.visitNumber}` : `Visit #${f.visitNumber} to ${f.placeName}`;
    return food ? `${base}: ${food}` : base;
  }
  if (f.placeName) return food ? `${food} at ${f.placeName}` : `A meal at ${f.placeName}`;
  if (food) return time ? `${capitalize(time)} ${food}` : food;
  return time ? `${article(time)} ${time} meal` : "";
}

function ratingSentence(f: StoryFacts): string {
  if (f.ratings.length === 2) {
    const [a, b] = f.ratings;
    if (a.overall >= 8 && b.overall >= 8) return "You both rated it highly.";
    if (Math.abs(a.overall - b.overall) >= 3) return `${a.name} gave it ${formatRating(a.overall)}, ${b.name} ${formatRating(b.overall)}.`;
    if (a.overall <= 4 && b.overall <= 4) return "Neither of you rated it well.";
  }
  if (f.ratings.length === 1) return `${f.ratings[0].name} rated it ${formatRating(f.ratings[0].overall)}/10.`;
  return "";
}

function comparisonSentence(f: StoryFacts): string {
  if (f.previousCombined == null || f.combined == null) return "";
  const diff = Math.round((f.combined - f.previousCombined) * 10) / 10;
  if (Math.abs(diff) < 1) return "About the same as last time.";
  return diff > 0 ? `Up from ${formatRating(f.previousCombined)} last time.` : `Down from ${formatRating(f.previousCombined)} last time.`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** One or two short sentences built only from facts. Returns "" when there is nothing to say. */
export function generateStory(f: StoryFacts): string {
  const variant = stableHash(f.memoryId);
  const parts: string[] = [];
  const open = opening(f, variant);
  if (open) parts.push(`${capitalize(open)}.`);
  const rating = ratingSentence(f);
  if (rating) parts.push(rating);
  const comparison = comparisonSentence(f);
  if (comparison && parts.length < 3) parts.push(comparison);
  if (f.bothWouldEatAgain && parts.length < 3) parts.push("You'd both have it again.");
  if (f.discoveredBy && f.visitNumber === 1 && parts.length < 3) parts.push(`${f.discoveredBy} found this one.`);
  return parts.join(" ");
}
