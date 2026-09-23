import { ArrowRight, Star } from "lucide-react";
import Link from "next/link";
import { MemoryCard } from "@/components/memory/MemoryCard";
import { AddMemoryButton } from "@/components/shell/AddMemoryLauncher";
import { EmptyState, SectionHeading } from "@/components/ui/primitives";
import { requireMember } from "@/lib/auth/session";
import { compareChronoDesc, daysBetween, findOnThisDay, formatLongDate, monthKey, monthName, parseDate, todayIn } from "@/lib/engine/dates";
import { formatMoney } from "@/lib/engine/money";
import { recommend } from "@/lib/engine/recommend";
import { loadHistory } from "@/server/queries/history";
import { hydrateCards } from "@/server/queries/memories";

export default async function HomePage() {
  const session = await requireMember();
  const { duo, persons, me } = session;
  const history = await loadHistory(duo.id);
  const today = todayIn(duo.timezone);
  const { year } = parseDate(today);

  if (history.memories.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-5 pt-16 md:pt-24">
        <EmptyState
          title="Your food story starts here."
          body={`Every meal you share becomes a memory: the photo, the place, and what each of you thought. Add the first one, ${me.name}.`}
          action={<AddMemoryButton label="Add your first memory" />}
        />
      </div>
    );
  }

  const ordered = [...history.memories].sort(compareChronoDesc);
  const onThisDay = findOnThisDay(ordered, today)[0] ?? null;
  // "Continue your story": recent meals this person hasn't reviewed yet.
  const toReview = ordered.filter((m) => daysBetween(m.eatenOn, today) <= 30 && !m.reviews.some((r) => r.personId === me.id)).slice(0, 3);

  const [cards, otdCards, reviewCards] = await Promise.all([
    hydrateCards(ordered.slice(0, 9)),
    onThisDay ? hydrateCards(onThisDay.items.slice(0, 4)) : Promise.resolve([]),
    hydrateCards(toReview),
  ]);
  const [latest, ...recent] = cards;

  const thisMonth = ordered.filter((m) => monthKey(m.eatenOn) === monthKey(today));
  const monthSpend = thisMonth.reduce((a, m) => a + (m.costMinor ?? 0), 0);
  const firstOn = ordered[ordered.length - 1].eatenOn;
  const rec = recommend(history.memories, persons, today);
  const topPick = rec.status === "ok" ? rec.items[0] : null;

  return (
    <div className="mx-auto max-w-5xl px-5 pt-6 md:px-8 md:pt-10">
      <header className="mb-6 flex items-end justify-between gap-4 md:mb-8">
        <div>
          <p className="eyebrow">{duo.name}</p>
          <h1 className="font-display mt-1 text-3xl leading-tight sm:text-4xl">
            {ordered.length} {ordered.length === 1 ? "meal" : "meals"} together
          </h1>
          <p className="mt-1 text-ink-3">since {formatLongDate(firstOn)}</p>
        </div>
        <Link href="/settings" className="inline-flex min-h-11 items-center px-2 text-sm text-ink-3 md:hidden">
          {me.name}
        </Link>
      </header>

      <MemoryCard memory={latest} persons={persons} currency={duo.currency} variant="feature" currentYear={year} eager />

      {reviewCards.length ? (
        <section className="mt-10" aria-labelledby="continue-heading">
          <SectionHeading eyebrow="Continue your story" title={<span id="continue-heading">Waiting for your review</span>} />
          <ul className="flex flex-col gap-1">
            {reviewCards.map((m) => (
              <li key={m.id}>
                <Link href={`/memories/${m.id}?new=1`} className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 hover:bg-paper-2">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{m.title}</span>
                    <span className="block truncate text-sm text-ink-3">{m.subtitle ?? formatLongDate(m.eatenOn)}</span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 text-sm text-accent">
                    <Star className="size-4" aria-hidden /> Rate it
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {onThisDay && otdCards.length ? (
        <section className="mt-12" aria-labelledby="otd-heading">
          <SectionHeading eyebrow="On this day" title={<span id="otd-heading">{onThisDay.label}…</span>} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {otdCards.slice(0, 2).map((m) => (
              <MemoryCard key={m.id} memory={m} persons={persons} currency={duo.currency} variant="row" />
            ))}
          </div>
        </section>
      ) : null}

      {recent.length ? (
        <section className="mt-12" aria-labelledby="recent-heading">
          <SectionHeading
            eyebrow="Recently"
            title={<span id="recent-heading">Your latest memories</span>}
            action={
              <Link href="/memories" className="inline-flex min-h-10 items-center gap-1 text-sm text-ink-2 hover:text-ink">
                All <ArrowRight className="size-4" aria-hidden />
              </Link>
            }
          />
          <div className="-mx-5 overflow-x-auto px-5 no-scrollbar md:mx-0 md:px-0">
            <div className="flex gap-4 pb-2">
              {recent.map((m) => (
                <MemoryCard key={m.id} memory={m} persons={persons} currency={duo.currency} variant="compact" currentYear={year} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label="Small insights">
        <Link href={`/us/wrapped/${monthKey(today)}`} className="rounded-2xl bg-paper-2/70 p-5 hover:bg-paper-2">
          <p className="eyebrow">{monthName(parseDate(today).month)} so far</p>
          <p className="font-display mt-2 text-2xl">
            {thisMonth.length} {thisMonth.length === 1 ? "meal" : "meals"}
            {monthSpend > 0 ? <span className="text-ink-3"> · {formatMoney(monthSpend, duo.currency)}</span> : null}
          </p>
        </Link>
        {topPick ? (
          <Link href="/plan" className="rounded-2xl bg-paper-2/70 p-5 hover:bg-paper-2">
            <p className="eyebrow">Worth going back</p>
            <p className="font-display mt-2 text-2xl">{topPick.candidate.title}</p>
            <p className="mt-1 text-sm text-ink-2">{topPick.reasons[0]}</p>
          </Link>
        ) : null}
      </section>
    </div>
  );
}
