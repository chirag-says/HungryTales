"use client";

import { useId } from "react";
import { RATING_MAX, RATING_MIN } from "@/lib/domain";
import { cx } from "./primitives";

const STEPS = Array.from({ length: RATING_MAX - RATING_MIN + 1 }, (_, i) => RATING_MIN + i);

/**
 * 1–10 rating as a row of tappable segments. It is a radio group, so arrow keys
 * work, and the number is always shown next to the bar (never colour alone).
 * Tapping the current value clears it.
 */
export function RatingInput({ label, value, onChange, tone = "ink" }: { label: string; value: number | null; onChange: (v: number | null) => void; tone?: "ink" | "p1" | "p2" }) {
  const labelId = useId();
  const fill = { ink: "bg-ink", p1: "bg-p1", p2: "bg-p2" }[tone];
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span id={labelId} className="text-sm font-medium text-ink-2">
          {label}
        </span>
        <span className="font-display text-lg tabular-nums text-ink" aria-hidden>
          {value ?? "–"}
          <span className="text-sm text-ink-3">/10</span>
        </span>
      </div>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="flex gap-1"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowUp") {
            e.preventDefault();
            onChange(Math.min(RATING_MAX, (value ?? RATING_MIN - 1) + 1));
          } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
            e.preventDefault();
            onChange(Math.max(RATING_MIN, (value ?? RATING_MIN + 1) - 1));
          }
        }}
      >
        {STEPS.map((n) => {
          const checked = value === n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={`${n} out of ${RATING_MAX}`}
              tabIndex={checked || (value == null && n === RATING_MIN) ? 0 : -1}
              onClick={() => onChange(checked ? null : n)}
              className="group flex h-11 flex-1 items-center"
            >
              <span className={cx("h-2.5 w-full rounded-full transition-colors", value != null && n <= value ? fill : "bg-line group-hover:bg-ink-3/40")} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
