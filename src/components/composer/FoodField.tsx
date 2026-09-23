"use client";

import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { LIMITS } from "@/lib/domain";
import { normalizeText } from "@/lib/engine/text";
import { suggestFoods, type UsageStat } from "@/lib/engine/suggest";
import { SuggestInput } from "./SuggestInput";
import type { CatalogFood } from "./types";

export function FoodField({
  value,
  onChange,
  foods,
  placeId,
  today,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  foods: CatalogFood[];
  placeId: string | null;
  today: string;
}) {
  const [query, setQuery] = useState("");

  const usage = useMemo(
    () =>
      new Map<string, UsageStat>(
        foods.map((f) => [f.id, { id: f.id, name: f.name, category: f.category, count: f.count, lastEatenOn: f.lastEatenOn, places: new Map(f.places) }]),
      ),
    [foods],
  );

  const chosen = useMemo(() => new Set(value.map(normalizeText)), [value]);

  const options = useMemo(() => {
    const exclude = new Set(foods.filter((f) => chosen.has(normalizeText(f.name))).map((f) => f.id));
    return suggestFoods(query, foods, usage, { placeId, today, exclude, limit: 6 }).map((s) => ({ key: s.id, label: s.name, hint: s.hint ?? undefined }));
  }, [query, foods, usage, placeId, today, chosen]);

  const add = (...names: string[]) => {
    const next = [...value];
    const seen = new Set(chosen);
    for (const name of names) {
      const clean = name.trim().replace(/\s+/g, " ").slice(0, LIMITS.nameMax);
      const key = normalizeText(clean);
      if (!key || seen.has(key) || next.length >= LIMITS.foodsPerMemory) continue;
      seen.add(key);
      next.push(clean);
    }
    if (next.length !== value.length) onChange(next);
    setQuery("");
  };

  return (
    <div className="flex flex-col gap-2.5">
      {value.length ? (
        <ul className="flex flex-wrap gap-2" aria-label="Dishes">
          {value.map((name) => (
            <li key={name} className="inline-flex h-10 items-center gap-1 rounded-full bg-ink pr-1 pl-3.5 text-sm text-paper">
              {name}
              <button type="button" onClick={() => onChange(value.filter((v) => v !== name))} aria-label={`Remove ${name}`} className="grid size-8 place-items-center rounded-full hover:bg-paper/15">
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {value.length < LIMITS.foodsPerMemory ? (
        <SuggestInput
          id="food"
          label="What did you eat?"
          value={query}
          placeholder={value.length ? "Add another dish" : "Paneer biryani, masala dosa…"}
          options={options}
          enterKeyHint="enter"
          onChange={(v) => {
            // Comma acts as a separator so a whole order can be typed in one go.
            if (v.includes(",")) {
              const parts = v.split(",");
              add(...parts.slice(0, -1));
              setQuery(parts[parts.length - 1]);
            } else setQuery(v);
          }}
          onPick={(key) => add(foods.find((f) => f.id === key)?.name ?? "")}
          onCommit={() => add(query)}
        />
      ) : null}
    </div>
  );
}
