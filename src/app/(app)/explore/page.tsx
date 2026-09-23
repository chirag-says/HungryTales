import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ExploreMap } from "@/components/map/ExploreMap";
import { MemoryBrowser, SearchBox, ViewTabs } from "@/components/memory/MemoryBrowser";
import { MemoryCard } from "@/components/memory/MemoryCard";
import { AddMemoryButton } from "@/components/shell/AddMemoryLauncher";
import { EmptyState, SectionHeading } from "@/components/ui/primitives";
import { requireMember } from "@/lib/auth/session";
import { categoryCounts } from "@/lib/engine/candidates";
import { compareChronoDesc, formatLongDate, mealTimeOf, parseDate, todayIn, weekdayOf } from "@/lib/engine/dates";
import { formatMoney } from "@/lib/engine/money";
import { formatRating, mean, summarizeRatings } from "@/lib/engine/ratings";
import { foodUsage } from "@/lib/engine/suggest";
import { browseMemories, filtersFromParams } from "@/server/queries/browse";
import { loadHistory } from "@/server/queries/history";
import { hydrateCards } from "@/server/queries/memories";
import { listPlaces } from "@/server/queries/places";

export const metadata: Metadata = { title: "Explore" };

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : null);

export default async function ExplorePage({ searchParams }: { searchParams: Promise<SP> }) {
  const session = await requireMember();
  const sp = await searchParams;
  const view = one(sp.view) === "map" ? "map" : one(sp.view) === "places" ? "places" : "discover";
  const history = await loadHistory(session.duo.id);

  if (history.memories.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-5 pt-16">
        <EmptyState title="Nothing to explore yet." body="Explore is built from your own food history: places, dishes, ratings and a map. Save a few meals and it fills in." action={<AddMemoryButton />} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-5 pt-6 md:px-8 md:pt-10">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl">Explore</h1>
        <ViewTabs
          current={view}
          views={[
            { id: "discover", label: "Discover", href: "/explore" },
            { id: "map", label: "Map", href: "/explore?view=map" },
            { id: "places", label: "Places", href: "/explore?view=places" },
          ]}
        />
      </header>
      {view === "map" ? <MapView session={session} focus={one(sp.focus)} /> : view === "places" ? <PlacesView session={session} /> : <DiscoverView session={session} sp={sp} />}
    </div>
  );
}

type Session = Awaited<ReturnType<typeof requireMember>>;

async function MapView({ session, focus }: { session: Session; focus: string | null }) {
  const places = await listPlaces(session);
  const mapped = places.filter((p) => p.latitude != null && p.longitude != null && p.visits > 0);
  return (
    <ExploreMap
      focusId={focus}
      unmapped={places.filter((p) => p.visits > 0).length - mapped.length}
      places={mapped.map((p) => ({
        id: p.id,
        name: p.name,
        area: p.area,
        lat: p.latitude as number,
        lng: p.longitude as number,
        visits: p.visits,
        avgRating: p.avgRating,
        lastOn: p.lastOn,
        lastMemoryId: p.lastMemoryId,
      }))}
    />
  );
}

async function PlacesView({ session }: { session: Session }) {
  const places = (await listPlaces(session)).filter((p) => p.visits > 0);
  if (!places.length) return <EmptyState title="No places yet." body="Name the restaurant or place when you save a memory and it shows up here." />;
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {places.map((p) => (
        <li key={p.id}>
          <Link href={`/explore/places/${p.id}`} className="flex h-full flex-col rounded-2xl bg-surface p-4 hover:bg-paper-2">
            <span className="font-display text-xl">{p.name}</span>
            {p.area ? <span className="text-sm text-ink-3">{p.area}</span> : null}
            <span className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
              <span>
                {p.visits} {p.visits === 1 ? "visit" : "visits"}
              </span>
              {p.avgRating != null ? <span>{formatRating(p.avgRating)}/10</span> : null}
              {p.totalSpentMinor ? <span>{formatMoney(p.totalSpentMinor, session.duo.currency)}</span> : null}
              {p.lastOn ? <span className="text-ink-3">last {formatLongDate(p.lastOn)}</span> : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function DiscoverView({ session, sp }: { session: Session; sp: SP }) {
  const { persons, duo } = session;
  const history = await loadHistory(duo.id);
  const q = one(sp.q)?.slice(0, 200) ?? "";
  const filters = filtersFromParams((k) => one(sp[k]));
  const today = todayIn(duo.timezone);
  const currentYear = parseDate(today).year;
  const hasFilter = Boolean(q || filters.foodId || filters.category || filters.minRating);

  if (hasFilter) {
    const page = await browseMemories(session, { q, filters });
    const query = new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string" && e[0] !== "view")).toString();
    const food = filters.foodId ? history.foods.find((f) => f.id === filters.foodId) : null;
    const foodMemories = food ? history.memories.filter((m) => m.foods.some((f) => f.id === food.id)) : [];
    const foodRatings = foodMemories.map((m) => summarizeRatings(m.reviews).combined).filter((v): v is number => v != null);
    const foodPlaces = new Set(foodMemories.map((m) => m.placeName).filter(Boolean));
    return (
      <div className="flex flex-col gap-6">
        <SearchBox autoFocus={!food} />
        {food ? (
          <section className="rounded-3xl bg-surface p-5">
            <p className="eyebrow">Dish</p>
            <h2 className="font-display text-3xl">{food.name}</h2>
            <p className="mt-2 text-ink-2">
              Eaten {foodMemories.length} {foodMemories.length === 1 ? "time" : "times"}
              {foodPlaces.size ? ` at ${foodPlaces.size} ${foodPlaces.size === 1 ? "place" : "places"}` : ""}
              {foodRatings.length ? ` · averages ${formatRating(Math.round((mean(foodRatings) as number) * 10) / 10)}/10` : ""}
            </p>
          </section>
        ) : null}
        {page.understood.length || q ? (
          <p className="text-sm text-ink-3" aria-live="polite">
            {page.total} {page.total === 1 ? "memory" : "memories"}
            {page.understood.length ? ` · understood: ${page.understood.join(", ")}` : ""}
          </p>
        ) : null}
        <MemoryBrowser
          key={query}
          view="timeline"
          initial={page}
          persons={persons}
          currency={duo.currency}
          currentYear={currentYear}
          query={query}
          emptyTitle="Nothing matched that memory."
          emptyBody="Try a dish, a place, an area, a month like “September”, or a rating like “9”."
        />
      </div>
    );
  }

  // Discover: everything below is computed from their own history only.
  const ordered = [...history.memories].sort(compareChronoDesc);
  const categories = [...categoryCounts(history.memories)].slice(0, 12);
  const usage = [...foodUsage(history.memories).values()].filter((u) => u.count >= 2).sort((a, b) => b.count - a.count).slice(0, 10);
  const topRated = ordered
    .map((m) => ({ m, s: summarizeRatings(m.reviews) }))
    .filter((x) => x.s.combined != null && x.s.combined >= 8.5)
    .sort((a, b) => (b.s.combined as number) - (a.s.combined as number))
    .slice(0, 6);
  const topRatedCards = await hydrateCards(topRated.map((x) => x.m));

  const weekdays = new Map<string, number>();
  const mealTimes = new Map<string, number>();
  for (const m of history.memories) {
    const w = weekdayOf(m.eatenOn);
    weekdays.set(w, (weekdays.get(w) ?? 0) + 1);
    const t = mealTimeOf(m.eatenAt);
    if (t) mealTimes.set(t, (mealTimes.get(t) ?? 0) + 1);
  }
  const topWeekday = [...weekdays].sort((a, b) => b[1] - a[1])[0];
  const topMealTime = [...mealTimes].sort((a, b) => b[1] - a[1])[0];
  const showPatterns = history.memories.length >= 5;

  return (
    <div className="flex flex-col gap-12">
      <SearchBox />

      {categories.length ? (
        <section aria-labelledby="cat-heading">
          <SectionHeading eyebrow="By category" title={<span id="cat-heading">What you eat</span>} />
          <div className="flex flex-wrap gap-2">
            {categories.map(([c, n]) => (
              <Link key={c} href={`/explore?category=${encodeURIComponent(c)}`} className="inline-flex h-10 items-center gap-2 rounded-full bg-surface px-4 hover:bg-paper-2">
                {c} <span className="text-sm text-ink-3">{n}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {usage.length ? (
        <section aria-labelledby="dish-heading">
          <SectionHeading eyebrow="Dishes" title={<span id="dish-heading">You keep coming back to</span>} />
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {usage.map((u) => (
              <li key={u.id}>
                <Link href={`/explore?food=${u.id}`} className="flex flex-col gap-1 rounded-2xl bg-surface px-4 py-3 hover:bg-paper-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <span className="font-medium">{u.name}</span>
                  <span className="text-sm text-ink-3">
                    {u.count}× · last {formatLongDate(u.lastEatenOn as string)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {topRatedCards.length ? (
        <section aria-labelledby="best-heading">
          <SectionHeading
            eyebrow="Ratings"
            title={<span id="best-heading">Your best-rated meals</span>}
            action={
              <Link href="/explore?rating=9" className="inline-flex min-h-10 items-center gap-1 text-sm text-ink-2">
                All 9+ <ArrowRight className="size-4" aria-hidden />
              </Link>
            }
          />
          <div className="-mx-5 overflow-x-auto px-5 no-scrollbar md:mx-0 md:px-0">
            <div className="flex gap-4 pb-2">
              {topRatedCards.map((m) => (
                <MemoryCard key={m.id} memory={m} persons={persons} currency={duo.currency} variant="compact" currentYear={currentYear} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {showPatterns ? (
        <section aria-labelledby="pattern-heading">
          <SectionHeading eyebrow="Patterns" title={<span id="pattern-heading">How you eat together</span>} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {topWeekday ? (
              <div className="rounded-2xl bg-paper-2/70 p-5">
                <p className="eyebrow">Favourite day</p>
                <p className="font-display mt-2 text-2xl">{topWeekday[0]}s</p>
                <p className="text-sm text-ink-3">
                  {topWeekday[1]} of {history.memories.length} meals
                </p>
              </div>
            ) : null}
            {topMealTime ? (
              <div className="rounded-2xl bg-paper-2/70 p-5">
                <p className="eyebrow">Usually</p>
                <p className="font-display mt-2 text-2xl capitalize">{topMealTime[0]}</p>
                <p className="text-sm text-ink-3">{topMealTime[1]} meals with a time saved</p>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
