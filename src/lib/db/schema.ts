import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { FieldSource, ReactionKind, WouldEatAgain } from "@/lib/domain";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

/** The shared journal. One deployment normally holds exactly one duo. */
export const duos = pgTable("duos", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  passphraseHash: text("passphrase_hash").notNull(),
  /** Bumped when the passphrase changes; sessions from older epochs are rejected. */
  sessionEpoch: integer("session_epoch").notNull().default(0),
  currency: text("currency").notNull().default("INR"),
  /** IANA zone used to decide what "today" is for On This Day and date defaults. */
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const persons = pgTable(
  "persons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    duoId: uuid("duo_id").notNull().references(() => duos.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slot: smallint("slot").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("persons_duo_slot_uq").on(t.duoId, t.slot)],
);

export const sessions = pgTable(
  "sessions",
  {
    /** sha256(token) hex. The raw token only ever lives in the cookie. */
    id: text("id").primaryKey(),
    duoId: uuid("duo_id").notNull().references(() => duos.id, { onDelete: "cascade" }),
    personId: uuid("person_id").references(() => persons.id, { onDelete: "set null" }),
    epoch: integer("epoch").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_expires_idx").on(t.expiresAt)],
);

export const authAttempts = pgTable(
  "auth_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** HMAC of the client IP; raw IPs are never stored. */
    clientKey: text("client_key").notNull(),
    succeeded: boolean("succeeded").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("auth_attempts_client_idx").on(t.clientKey, t.createdAt), index("auth_attempts_created_idx").on(t.createdAt)],
);

export const places = pgTable(
  "places",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    duoId: uuid("duo_id").notNull().references(() => duos.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    area: text("area"),
    address: text("address"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    discoveredById: uuid("discovered_by_id").references(() => persons.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("places_duo_norm_idx").on(t.duoId, t.normalizedName)],
);

export const foods = pgTable(
  "foods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    duoId: uuid("duo_id").notNull().references(() => duos.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    category: text("category"),
    discoveredById: uuid("discovered_by_id").references(() => persons.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("foods_duo_norm_uq").on(t.duoId, t.normalizedName)],
);

export type Provenance = Partial<Record<"date" | "time" | "location", FieldSource>>;

export const memories = pgTable(
  "memories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    duoId: uuid("duo_id").notNull().references(() => duos.id, { onDelete: "cascade" }),
    creatorId: uuid("creator_id").references(() => persons.id, { onDelete: "set null" }),
    /** Wall-clock date/time of the meal. Deliberately timezone-free: it is when *they* ate. */
    eatenOn: date("eaten_on", { mode: "string" }).notNull(),
    eatenAt: text("eaten_at"),
    placeId: uuid("place_id").references(() => places.id, { onDelete: "set null" }),
    locationLabel: text("location_label"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    category: text("category"),
    costMinor: integer("cost_minor"),
    /** personId -> share in minor units. Null means not split / not tracked. */
    shares: jsonb("shares").$type<Record<string, number>>(),
    notes: text("notes"),
    /** User-edited story line. Null means the generated narrative is shown. */
    story: text("story"),
    discoveredById: uuid("discovered_by_id").references(() => persons.id, { onDelete: "set null" }),
    provenance: jsonb("provenance").$type<Provenance>().notNull().default(sql`'{}'::jsonb`),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("memories_duo_date_idx").on(t.duoId, t.eatenOn.desc(), t.eatenAt.desc(), t.id),
    index("memories_place_idx").on(t.placeId),
  ],
);

/** Photo ids are issued before upload; a row here proves the id belongs to this duo. */
export const pendingUploads = pgTable(
  "pending_uploads",
  {
    id: uuid("id").primaryKey(),
    duoId: uuid("duo_id").notNull().references(() => duos.id, { onDelete: "cascade" }),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("pending_uploads_duo_idx").on(t.duoId, t.createdAt)],
);

export const memoryPhotos = pgTable(
  "memory_photos",
  {
    id: uuid("id").primaryKey(),
    memoryId: uuid("memory_id").notNull().references(() => memories.id, { onDelete: "cascade" }),
    duoId: uuid("duo_id").notNull().references(() => duos.id, { onDelete: "cascade" }),
    /** Storage object id (Cloudinary public_id). Sizes are derived on delivery. */
    storageKey: text("storage_key").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    position: integer("position").notNull(),
    isCover: boolean("is_cover").notNull().default(false),
    /** sha256 of the original file, used only for duplicate warnings. */
    contentHash: text("content_hash"),
    /** Capture time from EXIF (local wall clock, no timezone), if the photo had one. */
    takenAt: text("taken_at"),
    bytes: integer("bytes").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("memory_photos_memory_idx").on(t.memoryId, t.position),
    index("memory_photos_hash_idx").on(t.duoId, t.contentHash),
  ],
);

export const memoryFoods = pgTable(
  "memory_foods",
  {
    memoryId: uuid("memory_id").notNull().references(() => memories.id, { onDelete: "cascade" }),
    foodId: uuid("food_id").notNull().references(() => foods.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
  },
  (t) => [primaryKey({ columns: [t.memoryId, t.foodId] }), index("memory_foods_food_idx").on(t.foodId)],
);

export const reviews = pgTable(
  "reviews",
  {
    memoryId: uuid("memory_id").notNull().references(() => memories.id, { onDelete: "cascade" }),
    personId: uuid("person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    taste: smallint("taste"),
    quantity: smallint("quantity"),
    value: smallint("value"),
    overall: smallint("overall"),
    wouldEatAgain: text("would_eat_again").$type<WouldEatAgain>(),
    comment: text("comment"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.memoryId, t.personId] })],
);

export const reactions = pgTable(
  "reactions",
  {
    memoryId: uuid("memory_id").notNull().references(() => memories.id, { onDelete: "cascade" }),
    personId: uuid("person_id").notNull().references(() => persons.id, { onDelete: "cascade" }),
    kind: text("kind").$type<ReactionKind>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.memoryId, t.personId, t.kind] })],
);

export const wishlistItems = pgTable(
  "wishlist_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    duoId: uuid("duo_id").notNull().references(() => duos.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    placeName: text("place_name"),
    area: text("area"),
    category: text("category"),
    note: text("note"),
    estimatedCostMinor: integer("estimated_cost_minor"),
    addedById: uuid("added_by_id").references(() => persons.id, { onDelete: "set null" }),
    doneMemoryId: uuid("done_memory_id").references(() => memories.id, { onDelete: "set null" }),
    doneAt: timestamp("done_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("wishlist_duo_idx").on(t.duoId, t.createdAt)],
);
