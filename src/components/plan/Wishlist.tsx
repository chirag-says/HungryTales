"use client";

import { Check, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Button, EmptyState, inputClass } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toaster";
import { LIMITS } from "@/lib/domain";
import { formatMoney, parseMoneyInput } from "@/lib/engine/money";
import { addWish, markWishTried, removeWish } from "@/server/actions/plan";
import type { WishView } from "@/server/queries/plan";

/** Places and dishes they want to try. Saving a memory from an item ticks it off. */
export function Wishlist({ wishes, currency }: { wishes: WishView[]; currency: string }) {
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [area, setArea] = useState("");
  const [cost, setCost] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const open = wishes.filter((w) => !w.doneAt);
  const done = wishes.filter((w) => w.doneAt).slice(0, 5);

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const result = await addWish({ title, placeName: title, area: area || null, category: null, note: null, estimatedCostMinor: cost ? parseMoneyInput(cost, currency) : null });
      if (!result.ok) {
        setError(result.fieldErrors?.title ?? result.error);
        return;
      }
      setTitle("");
      setArea("");
      setCost("");
      setAdding(false);
    });

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) toast(r.error ?? "Something went wrong", "error");
    });

  return (
    <div>
      {open.length === 0 && !adding ? (
        <EmptyState title="Nothing on the list yet." body="Heard about a place? Add it here. “Something new” in roulette picks from this list." />
      ) : (
        <ul className="flex flex-col gap-2">
          {open.map((w) => (
            <li key={w.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-surface p-3 pl-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{w.title}</p>
                <p className="truncate text-sm text-ink-3">
                  {[w.area, w.estimatedCostMinor != null ? `~${formatMoney(w.estimatedCostMinor, currency)}` : null, w.addedByName ? `added by ${w.addedByName}` : null].filter(Boolean).join(" · ")}
                </p>
              </div>
              <Link href={`/add?wish=${w.id}`} className="inline-flex h-10 shrink-0 items-center rounded-full bg-ink px-3.5 text-sm font-medium text-paper">
                We went
              </Link>
              <button type="button" onClick={() => act(() => markWishTried(w.id))} aria-label={`Mark ${w.title} as tried without a memory`} className="grid size-10 place-items-center rounded-full text-ink-2 hover:bg-paper-2">
                <Check className="size-4" aria-hidden />
              </button>
              <button type="button" onClick={() => act(() => removeWish(w.id))} aria-label={`Remove ${w.title}`} className="grid size-10 place-items-center rounded-full text-ink-2 hover:bg-paper-2">
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <form
          className="mt-3 flex flex-col gap-2 rounded-2xl bg-surface p-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input aria-label="Place or dish" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={LIMITS.placeNameMax} placeholder="Place or dish, e.g. Toit" autoFocus required className={inputClass} />
          <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-2">
            <input aria-label="Area" value={area} onChange={(e) => setArea(e.target.value)} maxLength={LIMITS.areaMax} placeholder="Area (optional)" className={inputClass} />
            <input aria-label="Rough cost" value={cost} onChange={(e) => setCost(e.target.value)} inputMode="decimal" placeholder="Rough cost" className={inputClass} />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-accent">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="ink" busy={pending} className="flex-1">
              Add to list
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="outline" className="mt-3" onClick={() => setAdding(true)}>
          <Plus className="size-4" aria-hidden /> Want to try something
        </Button>
      )}

      {done.length ? (
        <div className="mt-6">
          <p className="eyebrow mb-2">Tried</p>
          <ul className="flex flex-col gap-1 text-sm text-ink-3">
            {done.map((w) => (
              <li key={w.id}>
                {w.doneMemoryId ? (
                  <Link href={`/memories/${w.doneMemoryId}`} className="underline underline-offset-4">
                    {w.title}
                  </Link>
                ) : (
                  w.title
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
