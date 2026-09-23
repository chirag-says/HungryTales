/**
 * DEVELOPMENT DATA ONLY.
 * Adds ~40 deterministic demo memories to the local (PGlite) journal so the
 * timeline, search, map, roulette and Wrapped can be exercised with realistic volume.
 * Refuses to run against a real database. Every seeded memory's notes start with "[demo]".
 *
 *   npm run db:seed-dev          (stop `npm run dev` first; PGlite allows one process)
 */
import { copyFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "../src/lib/db/schema.ts";

if (process.env.DATABASE_URL || process.env.NODE_ENV === "production") {
  console.error("Refusing to seed: this script only writes to the local development database.");
  process.exit(1);
}

const root = process.cwd();
const client = new PGlite(path.join(root, ".data", "pglite"));
const db = drizzle(client, { schema });
await migrate(db, { migrationsFolder: path.join(root, "drizzle") });

const [duo] = await db.select().from(schema.duos).limit(1);
if (!duo) {
  console.error("No journal yet. Finish setup in the app first.");
  process.exit(1);
}
const people = await db.select().from(schema.persons).where(eq(schema.persons.duoId, duo.id)).orderBy(schema.persons.slot);
const [a, b] = people;

// Deterministic PRNG so every run produces the same data.
let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const PLACES = [
  { name: "Empire Restaurant", area: "Indiranagar", lat: 12.9719, lng: 77.6412, cat: "Biryani", foods: ["Paneer Biryani", "Chicken Kebab", "Ghee Rice"], cost: 540 },
  { name: "MTR", area: "Lalbagh", lat: 12.9552, lng: 77.5857, cat: "South Indian", foods: ["Rava Idli", "Masala Dosa", "Filter Coffee"], cost: 320 },
  { name: "Vidyarthi Bhavan", area: "Basavanagudi", lat: 12.9451, lng: 77.5712, cat: "South Indian", foods: ["Masala Dosa", "Kesari Bath"], cost: 180 },
  { name: "Truffles", area: "Koramangala", lat: 12.9336, lng: 77.6147, cat: "Burgers", foods: ["All American Burger", "Peri Peri Fries"], cost: 760 },
  { name: "Meghana Foods", area: "Residency Road", lat: 12.9667, lng: 77.6078, cat: "Biryani", foods: ["Boneless Chicken Biryani", "Paneer Biryani"], cost: 690 },
  { name: "Brahmin's Coffee Bar", area: "Shankarapuram", lat: 12.9486, lng: 77.5694, cat: "South Indian", foods: ["Idli Vada", "Filter Coffee"], cost: 120 },
  { name: "Toit", area: "Indiranagar", lat: 12.9791, lng: 77.6408, cat: "Pizza", foods: ["Pepperoni Pizza", "Nachos"], cost: 1450 },
  { name: "Corner House", area: "Residency Road", lat: 12.9695, lng: 77.6025, cat: "Desserts", foods: ["Death by Chocolate"], cost: 380 },
  { name: "Rameshwaram Cafe", area: "Indiranagar", lat: 12.9784, lng: 77.6405, cat: "South Indian", foods: ["Ghee Podi Idli", "Masala Dosa"], cost: 260 },
  { name: "Mainland China", area: "Church Street", lat: 12.9749, lng: 77.6053, cat: "Chinese", foods: ["Hakka Noodles", "Chilli Paneer"], cost: 1280 },
];
const COMMENTS = ["Really good.", "Too spicy.", "Would come back for this.", "Portions were small.", "Perfect after a long day.", "Crispy and hot.", "Overhyped.", "Best one yet."];
const REACTIONS = ["love", "yum", "fire", "laugh"] as const;

await db.delete(schema.memories).where(eq(schema.memories.notes, "[demo] seeded")); // idempotent re-runs
const placeIds = new Map<string, string>();
for (const p of PLACES) {
  const existing = (await db.select().from(schema.places).where(eq(schema.places.normalizedName, norm(p.name))))[0];
  if (existing) {
    placeIds.set(p.name, existing.id);
    continue;
  }
  const [row] = await db
    .insert(schema.places)
    .values({ duoId: duo.id, name: p.name, normalizedName: norm(p.name), area: p.area, latitude: p.lat, longitude: p.lng, discoveredById: rand() < 0.5 ? a.id : b.id })
    .returning();
  placeIds.set(p.name, row.id);
}

// Reuse any locally uploaded photo files as covers, so seeded cards have images.
const storageDir = path.join(root, ".data", "storage", "hungrytales", duo.id);
const photoFiles = await readdir(storageDir).catch(() => [] as string[]);

const start = Date.UTC(2025, 6, 1);
const today = Date.UTC(2026, 8, 22);
let created = 0;
for (let i = 0; i < 40; i++) {
  const t = start + Math.floor(rand() * (today - start));
  const d = new Date(t);
  const eatenOn = d.toISOString().slice(0, 10);
  const hour = pick([9, 13, 14, 20, 21, 22, 23]);
  const place = rand() < 0.3 ? PLACES[i % 3] : pick(PLACES);
  const foods = place.foods.slice(0, 1 + Math.floor(rand() * place.foods.length));
  const cost = Math.round(place.cost * (0.8 + rand() * 0.5)) * 100;
  const [m] = await db
    .insert(schema.memories)
    .values({
      duoId: duo.id,
      creatorId: rand() < 0.5 ? a.id : b.id,
      eatenOn,
      eatenAt: `${String(hour).padStart(2, "0")}:${String(Math.floor(rand() * 60)).padStart(2, "0")}`,
      placeId: placeIds.get(place.name),
      latitude: place.lat,
      longitude: place.lng,
      category: place.cat,
      costMinor: cost,
      shares: rand() < 0.5 ? { [a.id]: Math.ceil(cost / 2), [b.id]: Math.floor(cost / 2) } : null,
      notes: "[demo] seeded",
      provenance: { date: "user", time: "user", location: "user" },
    })
    .returning();
  for (const [pos, name] of foods.entries()) {
    const [food] = await db
      .insert(schema.foods)
      .values({ duoId: duo.id, name, normalizedName: norm(name), category: place.cat })
      .onConflictDoUpdate({ target: [schema.foods.duoId, schema.foods.normalizedName], set: { name } })
      .returning();
    await db.insert(schema.memoryFoods).values({ memoryId: m.id, foodId: food.id, position: pos }).onConflictDoNothing();
  }
  for (const person of [a, b]) {
    if (rand() < 0.15) continue;
    const base = place.cost > 1000 ? 6 : 7;
    const r = () => Math.max(1, Math.min(10, base + Math.floor(rand() * 4)));
    const taste = r();
    await db.insert(schema.reviews).values({
      memoryId: m.id,
      personId: person.id,
      taste,
      quantity: r(),
      value: r(),
      overall: null,
      wouldEatAgain: taste >= 8 ? "yes" : taste >= 6 ? "maybe" : "no",
      comment: rand() < 0.5 ? pick(COMMENTS) : null,
    });
    if (rand() < 0.4) await db.insert(schema.reactions).values({ memoryId: m.id, personId: person.id, kind: pick([...REACTIONS]) }).onConflictDoNothing();
  }
  if (photoFiles.length && rand() < 0.6) {
    const photoId = crypto.randomUUID();
    await mkdir(storageDir, { recursive: true });
    await copyFile(path.join(storageDir, pick(photoFiles)), path.join(storageDir, `${photoId}.jpg`));
    await db.insert(schema.memoryPhotos).values({
      id: photoId,
      memoryId: m.id,
      duoId: duo.id,
      storageKey: `hungrytales/${duo.id}/${photoId}`,
      width: 1600,
      height: 1200,
      position: 0,
      isCover: true,
      bytes: 50_000,
    });
  }
  created++;
}

const wishes = [
  { title: "Glen's Bakehouse", area: "Indiranagar", est: 60000 },
  { title: "Karavalli", area: "Residency Road", est: 400000 },
  { title: "CTR", area: "Malleshwaram", est: 20000 },
];
for (const w of wishes) {
  await db.insert(schema.wishlistItems).values({ duoId: duo.id, title: w.title, placeName: w.title, area: w.area, estimatedCostMinor: w.est, addedById: b.id, note: "[demo]" });
}
console.log(`Seeded ${created} demo memories and ${wishes.length} want-to-try items into "${duo.name}". Demo memories have notes "[demo] seeded".`);
await client.close();
