import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FoodMap } from "@/components/map/FoodMap";
import { MemoryCard } from "@/components/memory/MemoryCard";
import { Avatar, Eyebrow } from "@/components/ui/primitives";
import { requireMember } from "@/lib/auth/session";
import { formatLongDate, parseDate, todayIn } from "@/lib/engine/dates";
import { formatMoney } from "@/lib/engine/money";
import { formatRating } from "@/lib/engine/ratings";
import { loadHistory } from "@/server/queries/history";
import { hydrateCards } from "@/server/queries/memories";
import { listPlaces } from "@/server/queries/places";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Place" };

export default async function PlacePage({ params }: Props) {
  const session = await requireMember();
  const { id } = await params;
  const place = (await listPlaces(session)).find((p) => p.id === id);
  if (!place) notFound();
  const history = await loadHistory(session.duo.id);
  const cards = await hydrateCards(place.memoryIds.map((mid) => history.memories.find((m) => m.id === mid)!).filter(Boolean));
  const discoverer = session.persons.find((p) => p.id === place.discoveredById);
  const currentYear = parseDate(todayIn(session.duo.timezone)).year;

  return (
    <div className="mx-auto max-w-5xl px-5 pt-4 md:px-8 md:pt-8">
      <Link href="/explore?view=places" aria-label="Back to places" className="-ml-3 grid size-11 place-items-center rounded-full text-ink-2 hover:bg-paper-2">
        <ArrowLeft className="size-5" aria-hidden />
      </Link>
      <header className="mt-2">
        <Eyebrow>{place.area ?? "Place"}</Eyebrow>
        <h1 className="font-display mt-1 text-4xl sm:text-5xl">{place.name}</h1>
      </header>

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="visits-heading">
          <h2 id="visits-heading" className="eyebrow mb-3">
            Every visit
          </h2>
          {cards.length ? (
            <ul className="flex flex-col gap-2">
              {cards.map((m) => (
                <li key={m.id}>
                  <MemoryCard memory={m} persons={session.persons} currency={session.duo.currency} currentYear={currentYear} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-3">No memories reference this place anymore.</p>
          )}
        </section>

        <aside className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-4 rounded-2xl bg-paper-2/60 p-5">
            <div>
              <dt className="eyebrow mb-1">Visits</dt>
              <dd className="font-display text-2xl">{place.visits}</dd>
            </div>
            <div>
              <dt className="eyebrow mb-1">Spent</dt>
              <dd className="font-display text-2xl">{place.totalSpentMinor ? formatMoney(place.totalSpentMinor, session.duo.currency) : "–"}</dd>
            </div>
            {session.persons.map((p) => (
              <div key={p.id}>
                <dt className="eyebrow mb-1">{p.name}&apos;s avg</dt>
                <dd className="font-display text-2xl">{place.ratingByPerson[p.id] != null ? formatRating(place.ratingByPerson[p.id]) : "–"}</dd>
              </div>
            ))}
            {place.firstOn ? (
              <div className="col-span-2 text-sm text-ink-2">
                <dt className="sr-only">Visited</dt>
                <dd>
                  First {formatLongDate(place.firstOn)}
                  {place.lastOn && place.lastOn !== place.firstOn ? ` · last ${formatLongDate(place.lastOn)}` : ""}
                </dd>
              </div>
            ) : null}
            {discoverer ? (
              <div className="col-span-2 flex items-center gap-2">
                <dt className="sr-only">Discovered by</dt>
                <Avatar person={discoverer} size="sm" />
                <dd className="text-sm text-ink-2">{discoverer.name} found it</dd>
              </div>
            ) : null}
          </dl>
          {place.topFoods.length ? (
            <div className="rounded-2xl bg-surface p-5">
              <h2 className="eyebrow mb-2">What you order here</h2>
              <ul className="flex flex-col gap-1.5">
                {place.topFoods.map((f) => (
                  <li key={f.id} className="flex items-center justify-between text-sm">
                    <Link href={`/explore?food=${f.id}`} className="inline-flex min-h-10 items-center hover:underline">
                      {f.name}
                    </Link>
                    <span className="text-ink-3">{f.count}×</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {place.latitude != null && place.longitude != null ? (
            <FoodMap interactive={false} points={[{ id: place.id, lat: place.latitude, lng: place.longitude, label: place.name }]} className="h-48 overflow-hidden rounded-2xl" />
          ) : null}
        </aside>
      </div>
    </div>
  );
}
