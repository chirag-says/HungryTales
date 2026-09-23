/**
 * Shared vocabulary for the whole app: one term per concept, used by the DB,
 * the engine, the server actions and the UI.
 */

export const RATING_MIN = 1;
export const RATING_MAX = 10;
export const RATING_ASPECTS = ["taste", "quantity", "value"] as const;
export type RatingAspect = (typeof RATING_ASPECTS)[number];

export const WOULD_EAT_AGAIN = ["yes", "maybe", "no"] as const;
export type WouldEatAgain = (typeof WOULD_EAT_AGAIN)[number];

export const REACTIONS = [
  { kind: "love", emoji: "❤️", label: "Love" },
  { kind: "yum", emoji: "😋", label: "Yum" },
  { kind: "fire", emoji: "🔥", label: "Fire" },
  { kind: "laugh", emoji: "😂", label: "Funny" },
  { kind: "meh", emoji: "🤢", label: "Not again" },
] as const;
export type ReactionKind = (typeof REACTIONS)[number]["kind"];
export const REACTION_KINDS = REACTIONS.map((r) => r.kind) as [ReactionKind, ...ReactionKind[]];

/** Where a value came from. The UI labels imported/derived values so nothing looks confirmed when it is not. */
export const FIELD_SOURCES = ["user", "photo", "device"] as const;
export type FieldSource = (typeof FIELD_SOURCES)[number];

/** Suggested categories. Users may type their own; these only seed the picker. */
export const SUGGESTED_CATEGORIES = [
  "Biryani",
  "South Indian",
  "North Indian",
  "Street food",
  "Chinese",
  "Pizza",
  "Burgers",
  "Café",
  "Desserts",
  "Bakery",
  "Seafood",
  "Asian",
  "Continental",
  "Healthy",
  "Drinks",
  "Home-cooked",
] as const;

export const LIMITS = {
  nameMax: 60,
  placeNameMax: 120,
  areaMax: 120,
  notesMax: 2000,
  storyMax: 400,
  commentMax: 280,
  foodsPerMemory: 12,
  photosPerMemory: 20,
  /** Largest file accepted from the picker before on-device resizing. */
  photoInputMaxBytes: 40 * 1024 * 1024,
  /** Largest re-encoded file we upload. Matches the bucket limit. */
  photoUploadMaxBytes: 12 * 1024 * 1024,
  costMaxMinor: 10_000_000_00,
  passphraseMin: 10,
  passphraseMax: 200,
} as const;

export type PersonSlot = 1 | 2;

export interface Person {
  id: string;
  name: string;
  slot: PersonSlot;
}
