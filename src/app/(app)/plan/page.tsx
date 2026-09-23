import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { FoodRoulette } from "@/components/plan/FoodRoulette";
import { Wishlist } from "@/components/plan/Wishlist";
import { SectionHeading } from "@/components/ui/primitives";
import { requireMember } from "@/lib/auth/session";
import { categoryCounts } from "@/lib/engine/candidates";
import { todayIn } from "@/lib/engine/dates";
import { formatMoney } from "@/lib/engine/money";
import { formatRating } from "@/lib/engine/ratings";
import { recommend } from "@/lib/engine/recommend";
import { loadHistory } from "@/server/queries/history";
import { loadWishes } from "@/server/queries/plan";

export const metadata: Metadata = { title: "Plan" };

export default async function PlanPage() {
  const session = await requireMember();
  const { duo, persons } = session;
  const [history, wishes] = await Promise.all([loadHistory(duo.id), loadWishes(session)]);
  const rec = recommend(history.memories, persons, todayIn(duo.timezone));
  const categories = [...categoryCounts(history.memories).keys()];

  return (
    <div className="mx-auto max-w-5xl px-5 pt-6 md:px-8 md:pt-10">
      <h1 className="font-display mb-6 text-4xl">Plan</h1>

      <FoodRoulette currency={duo.currency} categories={categories} />

      <section className="mt-12" aria-labelledby="rec-heading">
        <SectionHeading eyebrow="From your history" title={<span id="rec-heading">Worth going back to</span>} />
        {rec.status === "insufficient" ? (
          <p className="rounded-2xl bg-paper-2/70 p-5 text-ink-2">
            We need a little more food history before we can make useful suggestions. Rate {rec.needed - rec.reviewedMemories} more{" "}
            {rec.needed - rec.reviewedMemories === 1 ? "meal" : "meals"} and they&apos;ll start showing up here.
          </p>
        ) : rec.items.length === 0 ? (
          <p className="rounded-2xl bg-paper-2/70 p-5 text-ink-2">Nothing stands out right now. Keep rating meals and this will fill in.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {rec.items.map(({ candidate: c, reasons }) => (
              <li key={c.key}>
                <Link href={c.placeId ? `/explore/places/${c.placeId}` : `/memories/${c.lastMemoryId}`} className="flex h-full flex-col rounded-2xl bg-surface p-5 transition-colors hover:bg-paper-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display text-xl leading-snug sm:text-2xl">{c.title}</p>
                      <p className="truncate text-sm text-ink-3">{[c.area, c.topFood ? `Try: ${c.topFood.name}` : null].filter(Boolean).join(" · ")}</p>
                    </div>
                    {c.avgRating != null ? (
                      <p className="font-display shrink-0 text-2xl tabular-nums">
                        {formatRating(Math.round(c.avgRating * 10) / 10)}
                        <span className="text-sm text-ink-3">/10</span>
                      </p>
                    ) : null}
                  </div>
                  <ul className="mt-3 flex flex-col gap-1 text-sm text-ink-2">
                    {reasons.map((r) => (
                      <li key={r}>· {r}</li>
                    ))}
                  </ul>
                  <p className="mt-auto flex items-center justify-between pt-4 text-sm text-ink-3">
                    <span>
                      {c.visits} {c.visits === 1 ? "visit" : "visits"}
                      {c.avgCostMinor != null ? ` · usually ${formatMoney(c.avgCostMinor, duo.currency, { compact: true })}` : ""}
                    </span>
                    <ArrowRight className="size-4" aria-hidden />
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12" aria-labelledby="wish-heading">
        <SectionHeading eyebrow="Want to try" title={<span id="wish-heading">On our list</span>} />
        <Wishlist wishes={wishes} currency={duo.currency} />
      </section>
    </div>
  );
}
