"use client";

import { ArrowRight, Dices, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Button, cx } from "@/components/ui/primitives";
import { getCurrentPosition } from "@/lib/client/geolocation";
import { formatMoney } from "@/lib/engine/money";
import { formatRating } from "@/lib/engine/ratings";
import { ROULETTE_MODES, type RouletteMode } from "@/lib/engine/roulette";
import { spin, type SpinView } from "@/server/actions/plan";

const BUDGETS = [null, 30000, 50000, 100000] as const;

/**
 * "What are we eating?" Picks from their own history (or want-to-try list),
 * shows why, and offers two alternates. The short reveal is the only animation.
 */
export function FoodRoulette({ currency, categories }: { currency: string; categories: string[] }) {
  const [mode, setMode] = useState<RouletteMode>("love");
  const [budget, setBudget] = useState<number | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [result, setResult] = useState<SpinView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealKey, setRevealKey] = useState(0);
  const [pending, startTransition] = useTransition();

  const go = () =>
    startTransition(async () => {
      setError(null);
      let here: { lat: number; lng: number } | null = null;
      if (mode === "nearby") {
        const pos = await getCurrentPosition();
        if (!pos.ok) {
          setError(pos.message);
          return;
        }
        here = { lat: pos.lat, lng: pos.lng };
      }
      const res = await spin({ mode, maxCostMinor: budget, category, here });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResult(res.data);
      setRevealKey((k) => k + 1);
    });

  return (
    <section aria-labelledby="roulette-heading" className="rounded-3xl bg-ink p-5 text-paper sm:p-7">
      <h2 id="roulette-heading" className="font-display text-3xl sm:text-4xl">
        What are we eating?
      </h2>

      <div className="mt-5 -mx-5 overflow-x-auto px-5 no-scrollbar sm:mx-0 sm:px-0">
        <div className="flex gap-2 pb-1" role="radiogroup" aria-label="Mode">
          {ROULETTE_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={mode === m.id}
              onClick={() => setMode(m.id)}
              className={cx("h-10 shrink-0 rounded-full px-4 text-sm transition-colors", mode === m.id ? "bg-paper text-ink" : "bg-paper/10 text-paper hover:bg-paper/20")}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-2 text-sm text-paper/70">{ROULETTE_MODES.find((m) => m.id === mode)?.hint}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-paper/70">Budget</span>
        {BUDGETS.map((b) => (
          <Pill key={b ?? "any"} active={budget === b} onClick={() => setBudget(b)}>
            {b == null ? "Any" : `≤ ${formatMoney(b, currency)}`}
          </Pill>
        ))}
      </div>
      {categories.length ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-paper/70">Craving</span>
          <Pill active={category == null} onClick={() => setCategory(null)}>
            Anything
          </Pill>
          {categories.slice(0, 6).map((c) => (
            <Pill key={c} active={category === c} onClick={() => setCategory(category === c ? null : c)}>
              {c}
            </Pill>
          ))}
        </div>
      ) : null}

      <Button variant="primary" size="lg" className="mt-6 w-full sm:w-auto" onClick={go} busy={pending}>
        {result?.status === "picked" ? <RotateCcw className="size-5" aria-hidden /> : <Dices className="size-5" aria-hidden />}
        {result?.status === "picked" ? "Pick again" : "Pick for us"}
      </Button>

      <div aria-live="polite" className="mt-6 empty:hidden">
        {error ? <p className="rounded-2xl bg-paper/10 p-4 text-sm">{error}</p> : null}
        {!error && result?.status === "empty" ? <p className="rounded-2xl bg-paper/10 p-4 text-sm">{result.reason}</p> : null}
        {!error && result?.status === "picked" ? (
          <div key={revealKey} className="animate-[reveal_420ms_var(--ease-out-soft)] rounded-2xl bg-paper p-5 text-ink">
            <p className="eyebrow">Tonight</p>
            <p className="font-display mt-1 text-3xl leading-tight">{result.pick.title}</p>
            {result.pick.subtitle ? <p className="mt-1 text-ink-2">{result.pick.subtitle}</p> : null}
            <ul className="mt-3 flex flex-col gap-1 text-sm text-ink-2">
              {result.pick.reasons.map((r) => (
                <li key={r}>· {r}</li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-3">
              {result.pick.avgRating != null ? <span>Avg {formatRating(result.pick.avgRating)}/10</span> : null}
              {result.pick.avgCostMinor != null ? <span>Usually {formatMoney(result.pick.avgCostMinor, currency, { compact: true })}</span> : null}
              <span>Picked from {result.poolSize} {result.poolSize === 1 ? "option" : "options"}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {result.pick.href ? (
                <Link href={result.pick.href} className="inline-flex h-10 items-center gap-1 rounded-full bg-ink px-4 text-sm font-medium text-paper">
                  Past visits <ArrowRight className="size-4" aria-hidden />
                </Link>
              ) : null}
              {result.pick.wishId ? (
                <Link href={`/add?wish=${result.pick.wishId}`} className="inline-flex h-10 items-center gap-1 rounded-full bg-ink px-4 text-sm font-medium text-paper">
                  We went! Save it
                </Link>
              ) : null}
            </div>
            {result.alternates.length ? (
              <div className="mt-5 border-t border-line pt-4">
                <p className="text-sm text-ink-3">Or maybe</p>
                <ul className="mt-1 flex flex-col">
                  {result.alternates.map((a) => (
                    <li key={a.title} className="flex items-center justify-between gap-3 py-1.5">
                      <span className="font-medium">{a.title}</span>
                      <span className="truncate text-sm text-ink-3">{a.reasons[0]}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** Pill on the dark roulette panel: inverted colours so it reads in light and dark themes. */
function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx("inline-flex h-9 items-center rounded-full border px-3.5 text-sm transition-colors", active ? "border-paper bg-paper text-ink" : "border-paper/25 text-paper hover:border-paper/60")}
    >
      {children}
    </button>
  );
}
