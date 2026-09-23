"use client";

import { useState } from "react";
import { Chip, inputClass } from "@/components/ui/primitives";
import type { Person } from "@/lib/domain";
import { formatMoney, parseMoneyInput } from "@/lib/engine/money";
import type { CostValue } from "./cost";

export function CostField({ value, onChange, currency, persons, error }: { value: CostValue; onChange: (v: CostValue) => void; currency: string; persons: Person[]; error: string | null }) {
  const [symbol] = useState(() => formatMoney(0, currency).replace(/[\d.,\s]/g, "") || currency);
  const total = parseMoneyInput(value.text, currency);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3" aria-hidden>
          {symbol}
        </span>
        <input
          id="cost"
          inputMode="decimal"
          aria-label="Total cost"
          value={value.text}
          onChange={(e) => onChange({ ...value, text: e.target.value.slice(0, 12) })}
          placeholder="Total bill"
          className={`${inputClass} pl-8`}
        />
      </div>
      {total != null && total > 0 ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="How was it split?">
          <Chip active={value.split === "none"} onClick={() => onChange({ ...value, split: "none" })}>
            Not tracking split
          </Chip>
          <Chip active={value.split === "even"} onClick={() => onChange({ ...value, split: "even" })}>
            Split evenly
          </Chip>
          <Chip active={value.split === "custom"} onClick={() => onChange({ ...value, split: "custom" })}>
            Custom
          </Chip>
        </div>
      ) : null}
      {value.split === "custom" && total != null ? (
        <div className="grid grid-cols-2 gap-3">
          {persons.map((p) => (
            <label key={p.id} className="flex flex-col gap-1 text-sm text-ink-2">
              {p.name} paid
              <input
                inputMode="decimal"
                value={value.shareText[p.id] ?? ""}
                onChange={(e) => onChange({ ...value, shareText: { ...value.shareText, [p.id]: e.target.value.slice(0, 12) } })}
                className={inputClass}
              />
            </label>
          ))}
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-accent">
          {error}
        </p>
      ) : null}
    </div>
  );
}
