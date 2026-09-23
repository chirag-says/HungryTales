import { ArrowLeft, ChevronLeft, ChevronRight, MapPin, Pencil, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FoodMap } from "@/components/map/FoodMap";
import { PhotoViewer } from "@/components/memory/PhotoViewer";
import { ReactionBar } from "@/components/memory/ReactionBar";
import { Reviews } from "@/components/memory/Reviews";
import { StoryLine } from "@/components/memory/StoryLine";
import { Avatar, ButtonLink, Eyebrow } from "@/components/ui/primitives";
import { requireMember } from "@/lib/auth/session";
import { formatLongDate, formatTime, weekdayOf } from "@/lib/engine/dates";
import { formatMoney } from "@/lib/engine/money";
import { getMemoryDetail } from "@/server/queries/memories";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const session = await requireMember();
  const memory = await getMemoryDetail(session, (await params).id);
  return { title: memory ? memory.title : "Memory" };
}

export default async function MemoryPage({ params }: Props) {
  const session = await requireMember();
  const memory = await getMemoryDetail(session, (await params).id);
  if (!memory) notFound();

  const { persons, me, duo } = session;
  const time = formatTime(memory.eatenAt);
  const discoverer = persons.find((p) => p.id === memory.discoveredById);
  const hasCoords = memory.latitude != null && memory.longitude != null;
  const alt = `${memory.title}${memory.place ? ` at ${memory.place.name}` : ""}`;

  return (
    <article className="mx-auto max-w-5xl pb-12 md:px-6 md:pt-6">
      <div className="sticky top-0 z-20 flex h-14 items-center justify-between bg-paper/90 px-2 backdrop-blur md:static md:bg-transparent md:px-0 md:backdrop-blur-none">
        <Link href="/memories" aria-label="Back to memories" className="grid size-11 place-items-center rounded-full text-ink-2 hover:bg-paper-2">
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <div className="flex items-center gap-1">
          <Link href={`/story?at=${memory.id}`} className="inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-sm text-ink-2 hover:bg-paper-2">
            <Sparkles className="size-4" aria-hidden /> Memory Mode
          </Link>
          <ButtonLink href={`/memories/${memory.id}/edit`} variant="outline" size="sm">
            <Pencil className="size-3.5" aria-hidden /> Edit
          </ButtonLink>
        </div>
      </div>

      {memory.photos.length ? <PhotoViewer photos={memory.photos} alt={alt} /> : null}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-10 px-5 pt-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:px-0 md:pt-8">
        <div className="flex flex-col gap-8">
          <header>
            <Eyebrow>
              {weekdayOf(memory.eatenOn)} · {formatLongDate(memory.eatenOn)}
              {time ? ` · ${time}` : ""}
            </Eyebrow>
            <h1 className="font-display mt-2 text-3xl leading-[1.1] text-ink sm:text-5xl">{memory.title}</h1>
            {memory.place ? (
              <p className="mt-3 text-lg text-ink-2">
                <Link href={`/explore/places/${memory.place.id}`} className="underline decoration-line underline-offset-4 hover:decoration-ink-3">
                  {memory.place.name}
                </Link>
                {memory.place.area ? <span className="text-ink-3"> · {memory.place.area}</span> : null}
                <span className="block text-sm text-ink-3">
                  {memory.place.visitNumber === 1 ? "First visit" : `Visit ${memory.place.visitNumber} of ${memory.place.totalVisits}`}
                </span>
              </p>
            ) : memory.locationLabel ? (
              <p className="mt-3 text-lg text-ink-2">{memory.locationLabel}</p>
            ) : null}
          </header>

          <StoryLine memoryId={memory.id} story={memory.story} isGenerated={memory.storyIsGenerated} />

          <Reviews memoryId={memory.id} persons={persons} me={me} reviews={memory.reviews} />

          <section aria-label="Reactions">
            <ReactionBar memoryId={memory.id} reactions={memory.reactions} me={me} persons={persons} />
          </section>

          {memory.notes ? (
            <section aria-labelledby="notes-heading">
              <h2 id="notes-heading" className="eyebrow mb-2">
                Notes
              </h2>
              <p className="whitespace-pre-line text-ink">{memory.notes}</p>
            </section>
          ) : null}
        </div>

        <aside className="flex flex-col gap-6">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-5 rounded-2xl bg-paper-2/60 p-5">
            {memory.foods.length ? (
              <div className="col-span-2">
                <dt className="eyebrow mb-2">Ate</dt>
                <dd className="flex flex-wrap gap-1.5">
                  {memory.foods.map((f) => (
                    <Link key={f.id} href={`/explore?food=${f.id}`} className="rounded-full bg-surface px-3 py-1.5 text-sm text-ink hover:bg-line/50">
                      {f.name}
                    </Link>
                  ))}
                </dd>
              </div>
            ) : null}
            {memory.category ? (
              <div>
                <dt className="eyebrow mb-1">Category</dt>
                <dd>{memory.category}</dd>
              </div>
            ) : null}
            {memory.costMinor != null ? (
              <div>
                <dt className="eyebrow mb-1">Cost</dt>
                <dd className="font-display text-xl">{formatMoney(memory.costMinor, duo.currency)}</dd>
                {memory.shares ? (
                  <dd className="mt-0.5 text-xs text-ink-3">
                    {persons.map((p) => `${p.name} ${formatMoney(memory.shares?.[p.id] ?? 0, duo.currency)}`).join(" · ")}
                  </dd>
                ) : null}
              </div>
            ) : null}
            {discoverer ? (
              <div className="col-span-2 flex items-center gap-2">
                <dt className="sr-only">Discovered by</dt>
                <Avatar person={discoverer} size="sm" />
                <dd className="text-sm text-ink-2">{discoverer.name} found this one</dd>
              </div>
            ) : null}
          </dl>

          {hasCoords ? (
            <section aria-label="Location">
              <FoodMap
                interactive={false}
                points={[{ id: memory.id, lat: memory.latitude as number, lng: memory.longitude as number, label: memory.place?.name ?? memory.title }]}
                className="h-48 overflow-hidden rounded-2xl"
              />
              <Link href={`/explore?view=map&focus=${memory.place?.id ?? ""}`} className="mt-2 inline-flex min-h-10 items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
                <MapPin className="size-4" aria-hidden /> Open on your food map
              </Link>
            </section>
          ) : null}

          <nav aria-label="Nearby memories" className="flex justify-between gap-3">
            {memory.prevId ? (
              <Link href={`/memories/${memory.prevId}`} className="inline-flex min-h-11 items-center gap-1 text-sm text-ink-2 hover:text-ink">
                <ChevronLeft className="size-4" aria-hidden /> Earlier memory
              </Link>
            ) : (
              <span />
            )}
            {memory.nextId ? (
              <Link href={`/memories/${memory.nextId}`} className="inline-flex min-h-11 items-center gap-1 text-sm text-ink-2 hover:text-ink">
                Later memory <ChevronRight className="size-4" aria-hidden />
              </Link>
            ) : null}
          </nav>
          <p className="text-xs text-ink-3">
            Saved by {persons.find((p) => p.id === memory.creatorId)?.name ?? "one of you"}
            {memory.provenance.date === "photo" ? " · date read from the photo" : ""}
            {memory.provenance.location === "photo" ? " · location read from the photo" : ""}
          </p>
        </aside>
      </div>
    </article>
  );
}
