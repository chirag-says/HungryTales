"use client";

import { MapPin, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Chip, inputClass } from "@/components/ui/primitives";
import { LIMITS } from "@/lib/domain";
import { matchPlaces, placesNear } from "@/lib/engine/places";
import { fuzzyScore } from "@/lib/engine/text";
import { SuggestInput } from "./SuggestInput";
import type { CatalogPlace, LocationValue, PlaceValue } from "./types";

export function PlaceField({
  value,
  onChange,
  places,
  location,
  dismissedMatches,
  onDismissMatch,
}: {
  value: PlaceValue;
  onChange: (value: PlaceValue) => void;
  places: CatalogPlace[];
  location: LocationValue | null;
  dismissedMatches: Set<string>;
  onDismissMatch: (placeId: string) => void;
}) {
  const [query, setQuery] = useState(value?.mode === "new" ? value.name : "");
  const coords = useMemo(() => (location ? { lat: location.lat, lng: location.lng } : null), [location]);

  const nearby = useMemo(() => (coords && !value ? placesNear(coords, places).slice(0, 3) : []), [coords, places, value]);

  const options = useMemo(() => {
    const q = query.trim();
    if (!q) return places.slice(0, 6).map((p) => ({ key: p.id, label: p.name, hint: p.area ?? (p.visits > 1 ? `${p.visits} visits` : undefined) }));
    const ranked = places
      .map((p) => ({ p, s: fuzzyScore(q, `${p.name} ${p.area ?? ""}`) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || b.p.visits - a.p.visits)
      .slice(0, 6)
      .map(({ p }) => ({ key: p.id, label: p.name, hint: p.area ?? undefined }));
    const exact = places.some((p) => p.name.toLowerCase() === q.toLowerCase());
    return exact ? ranked : [...ranked, { key: "__new__", label: <>Add “{q}” as a new place</>, hint: "New" }];
  }, [query, places]);

  // Soft duplicate guard: a typed new name that looks like a saved place.
  const likely = useMemo(() => {
    if (value?.mode !== "new") return null;
    const match = matchPlaces(value.name, coords, places).find((m) => m.confidence !== "possible" && !dismissedMatches.has(m.place.id));
    return match ?? null;
  }, [value, coords, places, dismissedMatches]);

  const pickExisting = (id: string) => {
    const p = places.find((x) => x.id === id);
    if (p) onChange({ mode: "existing", id: p.id, name: p.name, area: p.area });
  };

  if (value?.mode === "existing") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5">
        <MapPin className="size-5 shrink-0 text-ink-3" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-ink">{value.name}</p>
          {value.area ? <p className="truncate text-sm text-ink-3">{value.area}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => {
            setQuery("");
            onChange(null);
          }}
          aria-label="Change place"
          className="grid size-10 place-items-center rounded-full text-ink-2 hover:bg-paper-2"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {nearby.length ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-ink-3">Near you:</span>
          {nearby.map(({ place, meters }) => (
            <Chip key={place.id} onClick={() => pickExisting(place.id)}>
              {place.name} <span className="text-ink-3">{meters < 50 ? "here" : `${Math.round(meters)} m`}</span>
            </Chip>
          ))}
        </div>
      ) : null}
      <SuggestInput
        id="place"
        label="Restaurant or place"
        value={query}
        placeholder="Restaurant, café, street stall, home…"
        options={options}
        onChange={(v) => {
          setQuery(v);
          const name = v.trim().slice(0, LIMITS.placeNameMax);
          onChange(name ? { mode: "new", name, area: value?.mode === "new" ? value.area : "" } : null);
        }}
        onPick={(key) => {
          if (key === "__new__") return;
          pickExisting(key);
        }}
      />
      {likely ? (
        <div role="status" className="rounded-xl bg-paper-2 p-3 text-sm">
          <p className="text-ink">
            Is this <strong className="font-medium">{likely.place.name}</strong>
            {likely.place.area ? ` in ${likely.place.area}` : ""}? You&apos;ve saved it before.
          </p>
          <div className="mt-2 flex gap-2">
            <Chip onClick={() => pickExisting(likely.place.id)} className="border-ink bg-ink text-paper hover:border-ink">
              Yes, same place
            </Chip>
            <Chip onClick={() => onDismissMatch(likely.place.id)}>No, it&apos;s different</Chip>
          </div>
        </div>
      ) : null}
      {value?.mode === "new" ? (
        <input
          aria-label="Area or neighbourhood"
          value={value.area}
          onChange={(e) => onChange({ ...value, area: e.target.value.slice(0, LIMITS.areaMax) })}
          placeholder="Area, e.g. Indiranagar (optional)"
          className={inputClass}
        />
      ) : null}
    </div>
  );
}
