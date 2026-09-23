import { ArrowRight, Settings } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AddMemoryButton } from "@/components/shell/AddMemoryLauncher";
import { Avatar, EmptyState, SectionHeading } from "@/components/ui/primitives";
import { requireMember } from "@/lib/auth/session";
import { formatLongDate, monthKey, monthName, parseDate, todayIn } from "@/lib/engine/dates";
import { formatMoney } from "@/lib/engine/money";
import { formatRating } from "@/lib/engine/ratings";
import { computeMilestones, computeStats, periodFor } from "@/lib/engine/stats";
import { loadHistory } from "@/server/queries/history";

export const metadata: Metadata = { title: "Us" };

function Stat({ label, value, note }: { label: string; value: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface p-4">
      <p className="text-sm text-ink-3">{label}</p>
      <p className="font-display mt-1 text-2xl tabular-nums sm:text-3xl">{value}</p>
      {note ? <p className="mt-0.5 text-sm text-ink-3">{note}</p> : null}
    </div>
  );
}

export default async function UsPage() {
  const session = await requireMember();
  const { duo, persons } = session;
  const history = await loadHistory(duo.id);
  const today = todayIn(duo.timezone);

  if (history.memories.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-5 pt-16">
        <EmptyState title="Your shared story is just beginning." body="Stats, milestones and your Food Wrapped appear here once you've saved a few meals together." action={<AddMemoryButton />} />
      </div>
    );
  }

  const stats = computeStats(history.memories, persons, periodFor("all"));
  const milestones = computeMilestones(history.memories);
  const years = [...new Set(history.memories.map((m) => parseDate(m.eatenOn).year))].sort((a, b) => b - a);
  const recentMonths = [...new Set(history.memories.map((m) => monthKey(m.eatenOn)))].sort().reverse().slice(0, 6);

  return (
    <div className="mx-auto max-w-5xl px-5 pt-6 md:px-8 md:pt-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{duo.name}</p>
          <h1 className="font-display mt-1 text-4xl">Us</h1>
          <div className="mt-3 flex items-center gap-2">
            {persons.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-2 text-ink-2">
                <Avatar person={p} size="sm" />
                {p.name}
              </span>
            ))}
          </div>
        </div>
        <Link href="/settings" aria-label="Settings" className="grid size-11 place-items-center rounded-full text-ink-2 hover:bg-paper-2 md:hidden">
          <Settings className="size-5" aria-hidden />
        </Link>
      </header>

      <section aria-labelledby="wrapped-heading">
        <SectionHeading eyebrow="Food Wrapped" title={<span id="wrapped-heading">Look back together</span>} />
        <div className="-mx-5 overflow-x-auto px-5 no-scrollbar md:mx-0 md:px-0">
          <div className="flex gap-3 pb-2">
            {years.map((y) => (
              <Link key={y} href={`/us/wrapped/${y}`} className="flex h-32 w-40 shrink-0 flex-col justify-between rounded-3xl bg-accent p-4 text-on-accent hover:brightness-110">
                <span className="text-sm opacity-80">The year</span>
                <span className="font-display text-4xl">{y}</span>
              </Link>
            ))}
            {recentMonths.map((m) => {
              const [y, mo] = m.split("-").map(Number);
              return (
                <Link key={m} href={`/us/wrapped/${m}`} className="flex h-32 w-40 shrink-0 flex-col justify-between rounded-3xl bg-surface p-4 hover:bg-paper-2">
                  <span className="text-sm text-ink-3">{y}</span>
                  <span className="font-display text-2xl">{monthName(mo)}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mt-12" aria-labelledby="total-heading">
        <SectionHeading eyebrow="All time" title={<span id="total-heading">So far</span>} />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Meals" value={stats.memoryCount} note={`${stats.photoCount} photos`} />
          <Stat label="Places" value={stats.placesVisited} />
          <Stat label="Spent together" value={stats.totalSpentMinor ? formatMoney(stats.totalSpentMinor, duo.currency, { compact: true }) : "–"} note={stats.avgSpendMinor ? `~${formatMoney(stats.avgSpendMinor, duo.currency, { compact: true })} a meal` : undefined} />
          <Stat label="Average rating" value={stats.avgRating != null ? formatRating(stats.avgRating) : "–"} note={`${stats.ratedMemories} rated`} />
        </div>
        {stats.costedMemories ? (
          <p className="mt-3 text-sm text-ink-3">
            Who paid what (unsplit bills count as halves):{" "}
            {persons.map((p) => `${p.name} ${formatMoney(stats.spendByPerson[p.id] ?? 0, duo.currency)}`).join(" · ")}
          </p>
        ) : null}
      </section>

      {!stats.isThin ? (
        <section className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label="Favourites">
          {stats.mostVisitedPlace ? (
            <Link href={`/explore/places/${stats.mostVisitedPlace.id}`} className="rounded-2xl bg-paper-2/70 p-5 hover:bg-paper-2">
              <p className="eyebrow">Your place</p>
              <p className="font-display mt-2 text-2xl">{stats.mostVisitedPlace.name}</p>
              <p className="text-sm text-ink-3">{stats.mostVisitedPlace.count} visits</p>
            </Link>
          ) : null}
          {stats.topFood ? (
            <Link href={`/explore?food=${stats.topFood.id}`} className="rounded-2xl bg-paper-2/70 p-5 hover:bg-paper-2">
              <p className="eyebrow">Your dish</p>
              <p className="font-display mt-2 text-2xl">{stats.topFood.name}</p>
              <p className="text-sm text-ink-3">{stats.topFood.count} times</p>
            </Link>
          ) : null}
          {stats.bestMeal ? (
            <Link href={`/memories/${stats.bestMeal.memoryId}`} className="rounded-2xl bg-paper-2/70 p-5 hover:bg-paper-2">
              <p className="eyebrow">Best meal</p>
              <p className="font-display mt-2 text-2xl">{stats.bestMeal.title}</p>
              <p className="text-sm text-ink-3">
                {formatRating(stats.bestMeal.rating)}/10 · {formatLongDate(stats.bestMeal.eatenOn)}
              </p>
            </Link>
          ) : null}
          <div className="rounded-2xl bg-paper-2/70 p-5">
            <p className="eyebrow">Who found new places</p>
            <ul className="mt-2 flex flex-col gap-1">
              {persons.map((p) => (
                <li key={p.id} className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2">
                    <Avatar person={p} size="sm" />
                    {p.name}
                  </span>
                  <span className="font-display text-xl tabular-nums">{stats.discoveries[p.id] ?? 0}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink-3">Counted when you mark who found a place on its first visit.</p>
          </div>
        </section>
      ) : null}

      <section className="mt-12" aria-labelledby="milestones-heading">
        <SectionHeading eyebrow="Milestones" title={<span id="milestones-heading">Along the way</span>} />
        <ol className="relative ml-2 border-l border-line">
          {milestones.reached.map((m) => (
            <li key={`${m.label}-${m.memoryId}`} className="relative pb-5 pl-6">
              <span className="absolute top-1.5 -left-[5px] size-2.5 rounded-full bg-accent" aria-hidden />
              <Link href={`/memories/${m.memoryId}`} className="group">
                <p className="font-medium group-hover:underline">{m.label}</p>
                <p className="text-sm text-ink-3">{formatLongDate(m.eatenOn)}</p>
              </Link>
            </li>
          ))}
        </ol>
        {milestones.next ? (
          <p className="text-sm text-ink-3">
            {milestones.next.remaining} more {milestones.next.remaining === 1 ? "meal" : "meals"} to memory #{milestones.next.count}.
          </p>
        ) : null}
      </section>

      <Link href="/story" className="mt-12 flex items-center justify-between rounded-3xl bg-ink p-6 text-paper hover:opacity-95">
        <span>
          <span className="block text-sm text-paper/70">Memory Mode</span>
          <span className="font-display text-2xl">Relive our food story</span>
        </span>
        <ArrowRight className="size-6" aria-hidden />
      </Link>
      <p className="mt-6 text-center text-xs text-ink-3">Today is {formatLongDate(today)}.</p>
    </div>
  );
}
