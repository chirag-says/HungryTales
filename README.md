# HungryTales

A private food journal for two people. Every meal becomes a memory: photos, the place, what you ate, what it cost, and what each of you thought, kept separately.

Everything that looks smart (search, suggestions, recommendations, roulette, the story lines, Food Wrapped) is plain deterministic code in `src/lib/engine`. There are no AI or vision APIs.

## Stack

| Concern | Choice |
| --- | --- |
| App | Next.js 16 (App Router, Server Actions), React 19, TypeScript, Tailwind v4 |
| Database | Supabase Postgres through Drizzle ORM (embedded PGlite for local dev) |
| Photos | Cloudinary, `authenticated` assets with server-signed delivery URLs (local disk for dev) |
| Map | Leaflet + OpenStreetMap tiles, own clustering |
| Auth | One shared passphrase (scrypt), DB-backed httpOnly sessions, then "who's here" |
| Tests | Vitest for the engine (search, fuzzy matching, dates, ratings, money, recommendations, roulette, stats, narrative, duplicates) |

## Run it locally

```bash
npm install
cp .env.example .env.local    # then set SESSION_SECRET
npm run dev
```

Open http://localhost:3000 and create the journal. With no `DATABASE_URL` or Cloudinary keys, data lives in `.data/` (PGlite database and photo files), which is git-ignored.

To try the app with volume, stop the dev server and run `npm run db:seed-dev`. It adds ~40 demo memories whose notes read `[demo] seeded`, and it refuses to run when `DATABASE_URL` is set.

## Deploy (Vercel + Supabase + Cloudinary)

1. **Supabase:** create a project, then click **Connect** at the top of the dashboard. Copy two strings: the **Session pooler** (port 5432) for migrations and the **Transaction pooler** (port 6543) for the app. Skip "Direct connection"; it is IPv6-only and fails on many networks.
2. **Migrate:** `DATABASE_URL=<session pooler url> npm run db:migrate`. Migration `0001` enables row-level security with no policies on every table, so Supabase's public REST API (anon key) cannot read anything. The app connects as the owner role and is unaffected.
3. **Cloudinary:** copy the cloud name, API key and API secret. No bucket or preset is needed; uploads are signed per photo.
4. **Vercel:** import the repo and set `DATABASE_URL` (Transaction pooler URL, port 6543), `CLOUDINARY_*`, `SESSION_SECRET` and `SETUP_CODE`. Deploy, open the site, and complete setup with the setup code.
5. Share the passphrase with your friend. Each of you picks your own name on your phone.

## How it's put together

```
src/lib/engine/      pure, tested logic: search, fuzzy, dates, ratings, money, places,
                     candidates, recommend, roulette, stats, narrative, duplicates
src/lib/db/          schema + client (postgres-js in prod, PGlite in dev)
src/lib/auth/        passphrase hashing, sessions, rate limiting
src/lib/storage/     storage driver: Cloudinary (prod) / signed local disk (dev)
src/lib/client/      on-device photo pipeline (EXIF read, hash, re-encode, upload)
src/server/queries/  read models for pages (history, cards, places, catalog)
src/server/actions/  mutations; every one re-checks the session and scopes to the duo
src/components/      composer, memory card/detail, map, plan, UI primitives
src/app/             routes: (auth) setup/unlock/who, (app) the five tabs + detail pages
```

**Photos:** the phone reads EXIF (date, GPS) as *suggestions*, hashes the file for duplicate warnings, then re-encodes it (max 2560px JPEG). Re-encoding strips all EXIF, so GPS never reaches storage. The browser uploads straight to Cloudinary with a server-signed request, and the server verifies Cloudinary's signed receipt before saving. Thumbnails and display sizes come from signed transformation URLs.

**Provenance:** date, time and location record where they came from (you, the photo, or the phone), and the UI labels imported values.

**Security:** CSP with per-request nonces, HSTS, frame denial, no raw IPs stored, passphrase brute-force limits (per client and global, kept in Postgres), passphrase change signs out every device, all inputs validated with zod at the server boundary.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | engine unit tests |
| `npm run lint` / `typecheck` | ESLint / tsc |
| `npm run db:generate` | new migration from schema changes |
| `npm run db:migrate` | apply migrations to `DATABASE_URL` |
| `npm run db:seed-dev` | demo data into the local database only |

## Known limits

- History is loaded per request as compact rows (no photos) and filtered in memory. That's fast for a duo's scale (thousands of memories). Past ~20k memories, move filtering into SQL.
- Cloudinary signed URLs don't expire on standard plans. They are unguessable and never shown publicly, but a leaked URL keeps working. Token-based expiring URLs need a higher Cloudinary plan.
- iOS may strip GPS from photos picked through the browser; the date usually survives. Location then falls back to "Use my location" or typing the place.
- Offline: the app shell and an offline page are cached; viewing and saving memories need a connection. Nothing is queued offline.
- Orphaned uploads (photos picked but never saved) stay in Cloudinary. `pending_uploads` records them, so a cleanup job can remove them later.
