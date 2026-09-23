"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button, Chip, inputClass } from "@/components/ui/primitives";
import type { Person } from "@/lib/domain";
import { formatMoney } from "@/lib/engine/money";

const FILTER_KEYS = ["place", "food", "category", "rating", "maxCost", "by", "from", "to", "photos"] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

export interface FilterOptions {
  places: { id: string; name: string }[];
  foods: { id: string; name: string }[];
  categories: string[];
}

/**
 * Quick filters as chips, everything else in a bottom sheet. State lives in the
 * URL so filtered views can be shared, reloaded and navigated back to.
 */
export function MemoryFilters({ options, persons, currency }: { options: FilterOptions; persons: Person[]; currency: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const get = (k: FilterKey) => params.get(k);
  const apply = (changes: Partial<Record<FilterKey, string | null>>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    router.replace(`${pathname}?${next}`, { scroll: false });
  };

  const active: { key: FilterKey; label: string }[] = [];
  const place = options.places.find((p) => p.id === get("place"));
  if (place) active.push({ key: "place", label: place.name });
  const food = options.foods.find((f) => f.id === get("food"));
  if (food) active.push({ key: "food", label: food.name });
  if (get("category")) active.push({ key: "category", label: get("category") as string });
  if (get("rating")) active.push({ key: "rating", label: `Rated ${get("rating")}+` });
  if (get("maxCost")) active.push({ key: "maxCost", label: `Up to ${formatMoney(Number(get("maxCost")), currency)}` });
  const by = persons.find((p) => p.id === get("by"));
  if (by) active.push({ key: "by", label: `Reviewed by ${by.name}` });
  if (get("from")) active.push({ key: "from", label: `From ${get("from")}` });
  if (get("to")) active.push({ key: "to", label: `Until ${get("to")}` });
  if (get("photos")) active.push({ key: "photos", label: "With photos" });

  const openSheet = () => {
    setDraft(Object.fromEntries(FILTER_KEYS.map((k) => [k, get(k) ?? ""])));
    setOpen(true);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 no-scrollbar md:mx-0 md:px-0">
        <Chip onClick={openSheet} aria-haspopup="dialog">
          <SlidersHorizontal className="size-4" aria-hidden />
          Filters{active.length ? ` · ${active.length}` : ""}
        </Chip>
        <Chip active={get("rating") === "8"} onClick={() => apply({ rating: get("rating") === "8" ? null : "8" })}>
          8+ rated
        </Chip>
        <Chip active={get("photos") === "1"} onClick={() => apply({ photos: get("photos") ? null : "1" })}>
          With photos
        </Chip>
        {options.categories.slice(0, 6).map((c) => (
          <Chip key={c} active={get("category") === c} onClick={() => apply({ category: get("category") === c ? null : c })}>
            {c}
          </Chip>
        ))}
      </div>

      {active.length ? (
        <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
          {active.map((a) => (
            <button key={a.key} type="button" onClick={() => apply({ [a.key]: null })} className="inline-flex h-8 items-center gap-1 rounded-full bg-ink px-3 text-sm text-paper" aria-label={`Remove filter ${a.label}`}>
              {a.label} <X className="size-3.5" aria-hidden />
            </button>
          ))}
          <button type="button" onClick={() => apply(Object.fromEntries(FILTER_KEYS.map((k) => [k, null])))} className="min-h-8 text-sm text-ink-2 underline underline-offset-4">
            Clear all
          </button>
        </div>
      ) : null}

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Filter memories"
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setDraft(Object.fromEntries(FILTER_KEYS.map((k) => [k, ""])))}>
              Reset
            </Button>
            <Button
              variant="ink"
              className="flex-[2]"
              onClick={() => {
                apply(Object.fromEntries(FILTER_KEYS.map((k) => [k, draft[k] || null])));
                setOpen(false);
              }}
            >
              Show memories
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-5 pt-2">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-2">
            Place
            <select value={draft.place ?? ""} onChange={(e) => setDraft({ ...draft, place: e.target.value })} className={inputClass}>
              <option value="">Any place</option>
              {options.places.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-2">
            Dish
            <select value={draft.food ?? ""} onChange={(e) => setDraft({ ...draft, food: e.target.value })} className={inputClass}>
              <option value="">Any dish</option>
              {options.foods.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-2">
            Category
            <select value={draft.category ?? ""} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className={inputClass}>
              <option value="">Any category</option>
              {options.categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink-2">Rated at least</legend>
            <div className="flex flex-wrap gap-2">
              {["", "6", "7", "8", "9"].map((r) => (
                <Chip key={r || "any"} active={(draft.rating ?? "") === r} onClick={() => setDraft({ ...draft, rating: r })}>
                  {r ? `${r}+` : "Any"}
                </Chip>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink-2">Cost up to</legend>
            <div className="flex flex-wrap gap-2">
              {["", "30000", "50000", "100000", "200000"].map((c) => (
                <Chip key={c || "any"} active={(draft.maxCost ?? "") === c} onClick={() => setDraft({ ...draft, maxCost: c })}>
                  {c ? formatMoney(Number(c), currency) : "Any"}
                </Chip>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink-2">Reviewed by</legend>
            <div className="flex flex-wrap gap-2">
              <Chip active={!draft.by} onClick={() => setDraft({ ...draft, by: "" })}>
                Anyone
              </Chip>
              {persons.map((p) => (
                <Chip key={p.id} active={draft.by === p.id} onClick={() => setDraft({ ...draft, by: p.id })}>
                  {p.name}
                </Chip>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-2">
              From
              <input type="date" value={draft.from ?? ""} onChange={(e) => setDraft({ ...draft, from: e.target.value })} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-2">
              Until
              <input type="date" value={draft.to ?? ""} onChange={(e) => setDraft({ ...draft, to: e.target.value })} className={inputClass} />
            </label>
          </div>
          <label className="flex items-center gap-3 text-sm text-ink">
            <input type="checkbox" checked={draft.photos === "1"} onChange={(e) => setDraft({ ...draft, photos: e.target.checked ? "1" : "" })} className="size-5 accent-[var(--accent)]" />
            Only memories with photos
          </label>
        </div>
      </Sheet>
    </div>
  );
}
