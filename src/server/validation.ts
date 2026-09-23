import "server-only";
import { z } from "zod";
import { FIELD_SOURCES, LIMITS, RATING_MAX, RATING_MIN, REACTION_KINDS, WOULD_EAT_AGAIN } from "@/lib/domain";
import { isValidDateString, isValidTimeString } from "@/lib/engine/dates";
import { isValidLatLng } from "@/lib/engine/geo";

const text = (max: number) =>
  z
    .string()
    .transform((s) => s.trim().replace(/\s+/g, " "))
    .pipe(z.string().max(max, `Keep it under ${max} characters.`));

const optionalText = (max: number) =>
  z
    .string()
    .nullish()
    .transform((s) => (s == null ? null : s.trim()))
    .pipe(z.string().max(max, `Keep it under ${max} characters.`).nullable())
    .transform((s) => (s ? s : null));

export const uuid = z.string().uuid("Invalid id.");

export const dateString = z.string().refine(isValidDateString, "Pick a valid date.");
export const timeString = z.string().refine(isValidTimeString, "Pick a valid time.");

const rating = z.number().int().min(RATING_MIN).max(RATING_MAX).nullable();

export const photoInput = z.object({
  id: uuid,
  isNew: z.boolean(),
  width: z.number().int().positive().max(20_000),
  height: z.number().int().positive().max(20_000),
  bytes: z.number().int().positive().max(LIMITS.photoUploadMaxBytes),
  contentHash: z.string().regex(/^[0-9a-f]{64}$/).nullable(),
  takenAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/).nullable(),
  /** Storage service's signed upload response, verified on save. */
  receipt: z.object({ version: z.number().int().optional(), signature: z.string().max(200).optional() }).nullable(),
});

const placeInput = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("existing"), id: uuid }),
  z.object({
    mode: z.literal("new"),
    name: text(LIMITS.placeNameMax).pipe(z.string().min(1, "Name the place.")),
    area: optionalText(LIMITS.areaMax),
  }),
]);

export const memoryInput = z
  .object({
    eatenOn: dateString,
    eatenAt: timeString.nullable(),
    place: placeInput.nullable(),
    locationLabel: optionalText(LIMITS.areaMax),
    latitude: z.number().nullable(),
    longitude: z.number().nullable(),
    category: optionalText(LIMITS.nameMax),
    foods: z.array(text(LIMITS.nameMax).pipe(z.string().min(1))).max(LIMITS.foodsPerMemory, `Up to ${LIMITS.foodsPerMemory} dishes.`),
    costMinor: z.number().int().min(0).max(LIMITS.costMaxMinor).nullable(),
    shares: z.record(uuid, z.number().int().min(0)).nullable(),
    notes: optionalText(LIMITS.notesMax),
    story: optionalText(LIMITS.storyMax),
    discoveredById: uuid.nullable(),
    provenance: z.object({ date: z.enum(FIELD_SOURCES).optional(), time: z.enum(FIELD_SOURCES).optional(), location: z.enum(FIELD_SOURCES).optional() }),
    photos: z.array(photoInput).max(LIMITS.photosPerMemory, `Up to ${LIMITS.photosPerMemory} photos per memory.`),
    coverPhotoId: uuid.nullable(),
  })
  .superRefine((v, ctx) => {
    if ((v.latitude == null) !== (v.longitude == null) || (v.latitude != null && !isValidLatLng(v.latitude, v.longitude))) {
      ctx.addIssue({ code: "custom", path: ["latitude"], message: "That location doesn't look valid." });
    }
    if (v.shares && v.costMinor == null) ctx.addIssue({ code: "custom", path: ["shares"], message: "Add the total before splitting it." });
    if (v.coverPhotoId && !v.photos.some((p) => p.id === v.coverPhotoId)) {
      ctx.addIssue({ code: "custom", path: ["coverPhotoId"], message: "Cover photo must be one of the photos." });
    }
    if (new Set(v.photos.map((p) => p.id)).size !== v.photos.length) {
      ctx.addIssue({ code: "custom", path: ["photos"], message: "A photo was added twice." });
    }
  });
export type MemoryInput = z.infer<typeof memoryInput>;

export const reviewInput = z
  .object({
    memoryId: uuid,
    taste: rating,
    quantity: rating,
    value: rating,
    overall: rating,
    wouldEatAgain: z.enum(WOULD_EAT_AGAIN).nullable(),
    comment: optionalText(LIMITS.commentMax),
  })
  .refine((r) => r.taste != null || r.quantity != null || r.value != null || r.overall != null || r.wouldEatAgain != null || r.comment != null, {
    message: "Add at least one rating or a note.",
  });

export const reactionInput = z.object({ memoryId: uuid, kind: z.enum(REACTION_KINDS) });

export const wishInput = z.object({
  title: text(LIMITS.placeNameMax).pipe(z.string().min(1, "What do you want to try?")),
  placeName: optionalText(LIMITS.placeNameMax),
  area: optionalText(LIMITS.areaMax),
  category: optionalText(LIMITS.nameMax),
  note: optionalText(LIMITS.commentMax),
  estimatedCostMinor: z.number().int().min(0).max(LIMITS.costMaxMinor).nullable(),
});

export const personName = text(LIMITS.nameMax).pipe(z.string().min(1, "Add a name."));

export const passphrase = z
  .string()
  .min(LIMITS.passphraseMin, `Use at least ${LIMITS.passphraseMin} characters. A short sentence works well.`)
  .max(LIMITS.passphraseMax);

export const setupInput = z
  .object({
    myName: personName,
    friendName: personName,
    journalName: text(LIMITS.nameMax).pipe(z.string().min(1, "Name your journal.")),
    passphrase,
    confirm: z.string(),
    timezone: z.string().max(64),
    currency: z.string().regex(/^[A-Z]{3}$/),
    setupCode: z.string().max(200).optional(),
  })
  .refine((v) => v.passphrase === v.confirm, { path: ["confirm"], message: "The two passphrases don't match." })
  .refine((v) => v.myName.toLowerCase() !== v.friendName.toLowerCase(), { path: ["friendName"], message: "Use two different names." });
