import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Photo } from "@/components/ui/Photo";
import { requireMember } from "@/lib/auth/session";
import { formatLongDate, monthName, parseDate } from "@/lib/engine/dates";
import { formatMoney } from "@/lib/engine/money";
import { formatRating } from "@/lib/engine/ratings";
import { computeStats, periodFor, type Period } from "@/lib/engine/stats";
import { loadHistory } from "@/server/queries/history";
import { hydrateCards } from "@/server/queries/memories";

type Props = { params: Promise<{ period: string }> };

function periodLabel(p: Period): string {
  if (p.kind === "year") return p.key;
  if (p.kind === "month") {
    const [y, m] = p.key.split("-").map(Number);
    return `${monthName(m)} ${y}`;
  }
  return "All time";
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    return { title: `Food Wrapped · ${periodLabel(periodFor((await params).period))}` };
  } catch {
    return { title: "Food Wrapped" };
  }
}

function Panel({ eyebrow, children, tone = "surface" }: { eyebrow: string; children: React.ReactNode; tone?: "surface" | "accent" | "ink" }) {
  const tones = { surface: "bg-surface text-ink", accent: "bg-accent text-on-accent", ink: "bg-ink text-paper" };
  return (
    <section className={`flex min-h-56 flex-col justify-between rounded-3xl p-6 sm:p-8 ${tones[tone]}`}>
      <p className="text-sm font-medium tracking-wide uppercase opacity-75">{eyebrow}</p>
      <div className="mt-6">{children}</div>
    </section>
  );
}

/**
 * Monthly or yearly recap. Every panel is backed by a real number, and panels
 * whose sample would be misleading are left out rather than padded.
 */
export default async function WrappedPage({ params }: Props) {
  const session = await requireMember();
  const { duo, persons } = session;
  let period: Period;
  try {
    period = periodFor((await params).period);
  } catch {
    notFound();
  }
  const history = await loadHistory(duo.id);
  const stats = computeStats(history.memories, persons, period);
  const label = periodLabel(period);
  const [best] = stats.bestMeal ? await hydrateCards(history.memories.filter((m) => m.id === stats.bestMeal!.memoryId)) : [];
  const topDiscoverer = stats.topDiscoverer ? persons.find((p) => p.id === stats.topDiscoverer!.personId) : null;

  return (
    <div className="mx-auto max-w-3xl px-5 pt-4 pb-10 md:pt-8">
      <Link href="/us" aria-label="Back to Us" className="-ml-3 grid size-11 place-items-center rounded-full text-ink-2 hover:bg-paper-2">
        <ArrowLeft className="size-5" aria-hidden />
      </Link>
      <header className="mt-4 mb-8">
        <p className="eyebrow">Food Wrapped</p>
        <h1 className="font-display mt-2 text-6xl leading-none sm:text-7xl">{label}</h1>
      </header>

      {stats.memoryCount === 0 ? (
        <p className="rounded-3xl bg-surface p-6 text-ink-2">No memories in {label}. Nothing to wrap up here.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <Panel eyebrow="Together you ate" tone="accent">
            <p className="font-display text-7xl leading-none">{stats.memoryCount}</p>
            <p className="mt-2 text-xl">
              {stats.memoryCount === 1 ? "meal" : "meals"} at {stats.placesVisited} {stats.placesVisited === 1 ? "place" : "places"}
              {stats.photoCount ? `, with ${stats.photoCount} photos` : ""}.
            </p>
          </Panel>

          {stats.isThin ? (
            <p className="rounded-3xl bg-paper-2/70 p-6 text-ink-2">
              That&apos;s a small sample, so we&apos;re keeping this one short. Rankings and favourites appear once there are a few more meals in {label}.
            </p>
          ) : null}

          {stats.newPlaces ? (
            <Panel eyebrow="New to you">
              <p className="font-display text-6xl leading-none">{stats.newPlaces}</p>
              <p className="mt-2 text-lg text-ink-2">{stats.newPlaces === 1 ? "place you tried for the first time" : "places you tried for the first time"}.</p>
              {topDiscoverer ? <p className="mt-1 text-ink-3">{topDiscoverer.name} found the most of them ({stats.topDiscoverer!.count}).</p> : null}
            </Panel>
          ) : null}

          {stats.mostVisitedPlace ? (
            <Panel eyebrow="Your place" tone="ink">
              <p className="font-display text-5xl leading-tight">{stats.mostVisitedPlace.name}</p>
              <p className="mt-2 text-paper/75">{stats.mostVisitedPlace.count} visits</p>
            </Panel>
          ) : null}

          {stats.topFood || stats.topCategory ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {stats.topFood ? (
                <Panel eyebrow="Most eaten dish">
                  <p className="font-display text-4xl leading-tight">{stats.topFood.name}</p>
                  <p className="mt-1 text-ink-3">{stats.topFood.count} times</p>
                </Panel>
              ) : null}
              {stats.topCategory ? (
                <Panel eyebrow="Most eaten kind">
                  <p className="font-display text-4xl leading-tight">{stats.topCategory.name}</p>
                  <p className="mt-1 text-ink-3">{stats.topCategory.count} meals</p>
                </Panel>
              ) : null}
            </div>
          ) : null}

          {best && stats.bestMeal ? (
            <Link href={`/memories/${best.id}`} className="group relative block overflow-hidden rounded-3xl">
              <Photo src={best.cover?.displayUrl ?? null} alt={best.title} className="aspect-[4/5] sm:aspect-[16/10]" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" aria-hidden />
              <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-8">
                <p className="text-sm font-medium tracking-wide uppercase opacity-80">Best meal</p>
                <p className="font-display mt-2 text-4xl leading-tight">{stats.bestMeal.title}</p>
                <p className="mt-1 text-white/85">
                  {formatRating(stats.bestMeal.rating)}/10 · {formatLongDate(stats.bestMeal.eatenOn)}
                </p>
              </div>
            </Link>
          ) : null}

          {stats.biggestDisagreement ? (
            <Panel eyebrow="You didn't agree on">
              <p className="font-display text-3xl leading-tight">{stats.biggestDisagreement.title}</p>
              <p className="mt-2 text-ink-2">
                {persons
                  .filter((p) => stats.biggestDisagreement!.ratings[p.id] != null)
                  .map((p) => `${p.name} ${formatRating(stats.biggestDisagreement!.ratings[p.id])}`)
                  .join(" vs ")}
              </p>
            </Panel>
          ) : null}

          {stats.costedMemories ? (
            <Panel eyebrow="Spent on food together">
              <p className="font-display text-5xl leading-none">{formatMoney(stats.totalSpentMinor, duo.currency)}</p>
              <p className="mt-2 text-ink-2">
                {stats.costedMemories > 1
                  ? `About ${formatMoney(stats.avgSpendMinor, duo.currency, { compact: true })} per meal, across ${stats.costedMemories} bills you logged.`
                  : "From the one bill you logged."}
              </p>
              {stats.topSpendPlace ? <p className="mt-1 text-ink-3">Most at {stats.topSpendPlace.name}: {formatMoney(stats.topSpendPlace.spentMinor, duo.currency)}.</p> : null}
            </Panel>
          ) : null}

          {stats.mostActiveMonth ? (
            <Panel eyebrow="Busiest month">
              <p className="font-display text-5xl leading-none">{monthName(parseDate(`${stats.mostActiveMonth.key}-01`).month)}</p>
              <p className="mt-2 text-ink-2">{stats.mostActiveMonth.count} meals</p>
              <div className="mt-5 flex h-20 items-end gap-1" aria-hidden>
                {stats.months.map((m) => (
                  <div key={m.key} className="flex-1 rounded-t bg-accent/80" style={{ height: `${Math.max(6, (m.count / stats.mostActiveMonth!.count) * 100)}%` }} title={`${m.key}: ${m.count}`} />
                ))}
              </div>
            </Panel>
          ) : null}

          {stats.avgRating != null && stats.ratedMemories >= 3 ? (
            <Panel eyebrow="On average you rated meals" tone="ink">
              <p className="font-display text-7xl leading-none">
                {formatRating(stats.avgRating)}
                <span className="text-2xl text-paper/60">/10</span>
              </p>
              <p className="mt-2 text-paper/75">across {stats.ratedMemories} rated meals.</p>
            </Panel>
          ) : null}
        </div>
      )}
    </div>
  );
}
