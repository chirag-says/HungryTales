"use client";

import { ArrowRight, MapPinOff, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { EmptyState, cx } from "@/components/ui/primitives";
import { formatLongDate } from "@/lib/engine/dates";
import { formatRating } from "@/lib/engine/ratings";
import { FoodMap } from "./FoodMap";

export interface MapPlace {
  id: string;
  name: string;
  area: string | null;
  lat: number;
  lng: number;
  visits: number;
  avgRating: number | null;
  lastOn: string | null;
  lastMemoryId: string | null;
}

/** Full food map with a selectable list: side-by-side on desktop, stacked on phones. */
export function ExploreMap({ places, unmapped, focusId }: { places: MapPlace[]; unmapped: number; focusId: string | null }) {
  const [selectedId, setSelectedId] = useState<string | null>(focusId && places.some((p) => p.id === focusId) ? focusId : null);
  const selected = places.find((p) => p.id === selectedId) ?? null;
  const points = useMemo(() => places.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, label: `${p.name}, ${p.visits} ${p.visits === 1 ? "visit" : "visits"}`, weight: p.visits })), [places]);

  if (places.length === 0) {
    return (
      <EmptyState
        icon={<MapPinOff className="size-8" />}
        title="Add locations to start building your food map."
        body="When you save a memory, tap “Use my location”, or use the location from a photo. Places with coordinates appear here."
      />
    );
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="relative">
        <FoodMap points={points} selectedId={selectedId} onSelect={setSelectedId} className="h-[62dvh] min-h-80 overflow-hidden rounded-3xl lg:h-[72dvh]" />
        {selected ? (
          <div className="pb-safe absolute inset-x-3 bottom-3 z-[500] rounded-2xl bg-surface p-4 shadow-xl lg:hidden" role="dialog" aria-label={selected.name}>
            <PlaceSummaryCard place={selected} onClose={() => setSelectedId(null)} />
          </div>
        ) : null}
      </div>
      <div className="hidden flex-col gap-2 lg:flex">
        {selected ? (
          <div className="rounded-2xl bg-surface p-4">
            <PlaceSummaryCard place={selected} onClose={() => setSelectedId(null)} />
          </div>
        ) : (
          <p className="px-1 text-sm text-ink-3">Select a pin, or a place below.</p>
        )}
        <ul className="flex max-h-[56dvh] flex-col overflow-y-auto">
          {places.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setSelectedId(p.id)}
                aria-pressed={p.id === selectedId}
                className={cx("flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left", p.id === selectedId ? "bg-paper-2" : "hover:bg-paper-2/60")}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.name}</span>
                  <span className="block truncate text-xs text-ink-3">{p.area ?? `${p.visits} visits`}</span>
                </span>
                <span className="shrink-0 text-sm tabular-nums text-ink-2">{p.visits}×</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      {unmapped > 0 ? <p className="text-sm text-ink-3 lg:col-span-2">{unmapped} {unmapped === 1 ? "place has" : "places have"} no location yet, so {unmapped === 1 ? "it isn't" : "they aren't"} on the map.</p> : null}
    </div>
  );
}

function PlaceSummaryCard({ place, onClose }: { place: MapPlace; onClose: () => void }) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display truncate text-xl">{place.name}</h3>
          {place.area ? <p className="truncate text-sm text-ink-3">{place.area}</p> : null}
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="-mt-1 -mr-1 grid size-10 place-items-center rounded-full text-ink-2 hover:bg-paper-2">
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-xs text-ink-3">Visits</dt>
          <dd className="font-display text-lg">{place.visits}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-3">Avg rating</dt>
          <dd className="font-display text-lg">{place.avgRating != null ? formatRating(place.avgRating) : "–"}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-3">Last visit</dt>
          <dd className="text-sm">{place.lastOn ? formatLongDate(place.lastOn).replace(/, \d{4}$/, "") : "–"}</dd>
        </div>
      </dl>
      <Link href={`/explore/places/${place.id}`} className="mt-3 inline-flex min-h-10 items-center gap-1 text-sm font-medium text-accent">
        See all memories here <ArrowRight className="size-4" aria-hidden />
      </Link>
    </div>
  );
}
