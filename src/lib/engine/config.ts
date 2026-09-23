/**
 * Every tunable number the engine uses lives here, so behaviour can be adjusted
 * in one place and tests can reason about it.
 */

export const RECOMMENDATION = {
  weights: {
    rating: 0.4,
    repeat: 0.2,
    recency: 0.2,
    value: 0.1,
    novelty: 0.1,
  },
  /** Need at least this many reviewed memories before recommending anything. */
  minReviewedMemories: 3,
  /** Visits in the last N days are "too recent" and get a recency penalty. */
  tooRecentDays: 4,
  /** After this many days since the last visit, the "been a while" signal is saturated. */
  recencySaturationDays: 45,
  highRating: 8,
  veryHighRating: 9,
  maxResults: 6,
  /** A category counts as a favourite when it holds this share of reviewed meals. */
  favouriteCategoryShare: 0.2,
  favouriteCategoryMinCount: 3,
} as const;

export const ROULETTE = {
  loveMinRating: 8,
  highRatedMinRating: 8.5,
  notRecentDays: 21,
  nearbyRadiusKm: 3,
  /** Softmax-ish temperature: higher = more random among eligible candidates. */
  scoreExponent: 2,
  alternates: 2,
} as const;

export const STATS = {
  /** Below this many memories in a period, rankings ("most visited") are hidden. */
  minForRankings: 3,
  /** Below this many rated memories, best/worst meal is hidden. */
  minRatedForExtremes: 3,
  /** Yearly trend lines need this many distinct active months. */
  minMonthsForTrend: 3,
  milestoneCounts: [1, 10, 25, 50, 100, 250, 500, 1000],
} as const;

export const TIMELINE = {
  /** A year with fewer memories than this is shown as a single year group instead of months. */
  minPerYearForMonthGroups: 8,
} as const;

export const ON_THIS_DAY = {
  nearbyWindowDays: 3,
} as const;

export const PLACE_MATCH = {
  /** Words that do not identify a place on their own. */
  genericWords: [
    "the",
    "restaurant",
    "restaurants",
    "resto",
    "cafe",
    "hotel",
    "eatery",
    "kitchen",
    "diner",
    "bistro",
    "and",
    "co",
    "family",
    "veg",
    "pure",
  ],
  /** Two places within this distance with overlapping names are "likely" the same. */
  nearbyMeters: 250,
  /** Suggest existing places this close to the current coordinates. */
  suggestRadiusMeters: 150,
} as const;

export const FUZZY = {
  /** Allowed edit distance by query token length. */
  maxEditsFor(length: number): number {
    if (length <= 3) return 0;
    if (length <= 6) return 1;
    return 2;
  },
} as const;

export const DUPLICATES = {
  /** EXIF capture times within this many seconds count as "same moment". */
  sameMomentSeconds: 2,
} as const;

/** Hour boundaries for the time-of-day words used by the narrative and filters. */
export const MEAL_TIMES = [
  { until: 4, label: "late-night" },
  { until: 11, label: "breakfast" },
  { until: 16, label: "lunch" },
  { until: 19, label: "evening" },
  { until: 23, label: "dinner" },
  { until: 24, label: "late-night" },
] as const;
