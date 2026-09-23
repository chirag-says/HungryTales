import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StoryControls } from "@/components/story/StoryControls";
import { Photo } from "@/components/ui/Photo";
import { EmptyState, cx } from "@/components/ui/primitives";
import { requireMember } from "@/lib/auth/session";
import { compareChronoDesc, formatLongDate, formatTime } from "@/lib/engine/dates";
import { formatMoney } from "@/lib/engine/money";
import { formatRating, overallOf } from "@/lib/engine/ratings";
import { loadHistory } from "@/server/queries/history";
import { getMemoryDetail } from "@/server/queries/memories";

export const metadata: Metadata = { title: "Memory Mode" };

/**
 * OUR FOOD STORY: one memory at a time, photo first, moving through history in
 * order. Earlier memories are to the left, later to the right, like turning pages.
 */
export default async function StoryPage({ searchParams }: { searchParams: Promise<{ at?: string }> }) {
  const session = await requireMember();
  const { duo, persons } = session;
  const { at } = await searchParams;
  const history = await loadHistory(duo.id);
  const ordered = [...history.memories].sort(compareChronoDesc).reverse(); // oldest first

  if (ordered.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-5 pt-16">
        <EmptyState title="Nothing to relive yet." body="Memory Mode walks through your meals one by one, photo first. Save a few and come back." />
      </div>
    );
  }

  if (!at) {
    return (
      <div className="theme-night fixed inset-0 z-50 flex flex-col items-center justify-center bg-paper px-6 text-center text-ink">
        <Link href="/us" aria-label="Close Memory Mode" className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 grid size-11 place-items-center rounded-full bg-ink/10">
          <X className="size-5" aria-hidden />
        </Link>
        <p className="text-sm tracking-[0.2em] text-ink/60 uppercase">Our food story</p>
        <h1 className="font-display mt-4 text-4xl sm:text-6xl">{duo.name}</h1>
        <p className="mt-4 text-ink/70">
          {ordered.length} {ordered.length === 1 ? "memory" : "memories"} since {formatLongDate(ordered[0].eatenOn)}
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link href={`/story?at=${ordered[0].id}`} className="inline-flex h-13 items-center justify-center rounded-full bg-ink px-7 font-medium text-paper">
            Start from the beginning
          </Link>
          <Link href={`/story?at=${ordered[ordered.length - 1].id}`} className="inline-flex h-13 items-center justify-center rounded-full border border-ink/30 px-7 font-medium">
            Start from the latest
          </Link>
        </div>
      </div>
    );
  }

  const memory = await getMemoryDetail(session, at);
  if (!memory) notFound();
  const index = ordered.findIndex((m) => m.id === memory.id);
  const prevHref = memory.prevId ? `/story?at=${memory.prevId}` : null;
  const nextHref = memory.nextId ? `/story?at=${memory.nextId}` : null;
  const cover = memory.photos.find((p) => p.isCover) ?? memory.photos[0] ?? null;
  const time = formatTime(memory.eatenAt);

  return (
    <StoryControls prevHref={prevHref} nextHref={nextHref} exitHref={`/memories/${memory.id}`}>
      <div className="theme-night fixed inset-0 z-50 overflow-y-auto bg-paper text-ink">
        <div key={memory.id} className="mx-auto flex min-h-full max-w-6xl animate-[reveal_380ms_var(--ease-out-soft)] flex-col md:flex-row md:items-center md:gap-10 md:p-10">
          <div className="relative md:w-[58%]">
            {cover ? (
              <Photo src={cover.displayUrl} alt={memory.title} eager className="aspect-[3/4] max-h-[65dvh] w-full sm:aspect-[4/5] sm:max-h-[72dvh] md:rounded-3xl" />
            ) : (
              <div className="grid aspect-[4/3] place-items-center bg-ink/5 md:rounded-3xl">
                <p className="font-display px-8 text-center text-3xl text-ink/50">{memory.title}</p>
              </div>
            )}
            <Link href={`/memories/${memory.id}`} aria-label="Close Memory Mode" className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 grid size-11 place-items-center rounded-full bg-black/40 backdrop-blur md:hidden">
              <X className="size-5" aria-hidden />
            </Link>
          </div>

          <div className="flex flex-1 flex-col px-6 pt-6 pb-28 md:px-0 md:pb-0">
            <div className="hidden justify-end md:flex">
              <Link href={`/memories/${memory.id}`} aria-label="Close Memory Mode" className="grid size-11 place-items-center rounded-full bg-ink/10 hover:bg-ink/20">
                <X className="size-5" aria-hidden />
              </Link>
            </div>
            <p className="text-sm tracking-wide text-ink/60">
              {formatLongDate(memory.eatenOn)}
              {time ? ` · ${time}` : ""}
            </p>
            <h1 className="font-display mt-2 text-3xl leading-tight sm:text-5xl">{memory.title}</h1>
            {memory.place ? <p className="mt-1 text-lg text-ink/80">{memory.place.name}</p> : null}

            <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
              {persons.map((p) => {
                const r = memory.reviews.find((x) => x.personId === p.id);
                const o = r ? overallOf(r) : null;
                return o != null ? (
                  <div key={p.id}>
                    <dt className="text-sm text-ink/60">{p.name}</dt>
                    <dd className="font-display text-3xl tabular-nums">
                      {formatRating(o)}
                      <span className="text-base text-ink/50">/10</span>
                    </dd>
                  </div>
                ) : null;
              })}
              {memory.costMinor != null ? (
                <div>
                  <dt className="text-sm text-ink/60">Cost</dt>
                  <dd className="font-display text-3xl">{formatMoney(memory.costMinor, duo.currency)}</dd>
                </div>
              ) : null}
            </dl>

            {memory.story ? <p className="font-display mt-6 text-xl leading-snug text-ink/85 italic">“{memory.story}”</p> : null}
            {memory.reviews.find((r) => r.comment) ? (
              <p className="mt-3 text-ink/70">
                {memory.reviews
                  .filter((r) => r.comment)
                  .map((r) => `${persons.find((p) => p.id === r.personId)?.name}: “${r.comment}”`)
                  .join("  ·  ")}
              </p>
            ) : null}

            <p className="mt-8 text-sm text-ink/50">
              {index + 1} of {ordered.length}
            </p>
          </div>
        </div>

        <nav aria-label="Story navigation" className="pb-safe fixed inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-paper via-paper/90 to-transparent px-4 pt-8 pb-4 md:px-10">
          <Link
            href={prevHref ?? "#"}
            replace
            scroll={false}
            aria-disabled={!prevHref}
            className={cx("inline-flex h-12 items-center gap-1 rounded-full bg-ink/10 pr-5 pl-3 hover:bg-ink/20", !prevHref && "pointer-events-none opacity-30")}
          >
            <ChevronLeft className="size-5" aria-hidden /> Earlier
          </Link>
          <Link
            href={nextHref ?? "#"}
            replace
            scroll={false}
            aria-disabled={!nextHref}
            className={cx("inline-flex h-12 items-center gap-1 rounded-full bg-ink px-5 pr-3 font-medium text-paper", !nextHref && "pointer-events-none opacity-30")}
          >
            Later <ChevronRight className="size-5" aria-hidden />
          </Link>
        </nav>
      </div>
    </StoryControls>
  );
}
