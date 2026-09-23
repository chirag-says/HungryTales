"use client";

import { Crosshair, ImageIcon, MapPin, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Spinner } from "@/components/ui/primitives";
import { getCurrentPosition, locationPermission } from "@/lib/client/geolocation";
import type { LocationValue } from "./types";

const SOURCE_LABEL: Record<LocationValue["source"], string> = {
  photo: "From the photo",
  device: "From your phone",
  user: "Set by you",
};

/**
 * Optional coordinates for the map. Never required, never asked for without a tap,
 * and silently used only when permission was already granted (camera flow).
 */
export function LocationField({
  value,
  onChange,
  photoSuggestion,
  autoLocate,
}: {
  value: LocationValue | null;
  onChange: (value: LocationValue | null) => void;
  photoSuggestion: { lat: number; lng: number } | null;
  autoLocate: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);

  const locate = async () => {
    setBusy(true);
    setMessage(null);
    const result = await getCurrentPosition();
    setBusy(false);
    if (result.ok) onChange({ lat: result.lat, lng: result.lng, source: "device" });
    else {
      setMessage(result.message);
      if (result.reason === "denied") setBlocked(true);
    }
  };

  useEffect(() => {
    let cancelled = false;
    locationPermission().then(async (state) => {
      if (cancelled) return;
      if (state === "denied") setBlocked(true);
      if (autoLocate && state === "granted" && !value) {
        const result = await getCurrentPosition();
        if (!cancelled && result.ok) onChange({ lat: result.lat, lng: result.lng, source: "device" });
      }
    });
    return () => {
      cancelled = true;
    };
    // Run once on mount: auto-locate is a one-time convenience, not a watcher.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-paper-2 px-3.5 py-2.5">
        <MapPin className="size-5 shrink-0 text-ink-2" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">Pinned on your food map</p>
          <p className="text-xs text-ink-3">
            {SOURCE_LABEL[value.source]} · {value.lat.toFixed(4)}, {value.lng.toFixed(4)}
          </p>
        </div>
        <button type="button" onClick={() => onChange(null)} aria-label="Remove location" className="grid size-10 place-items-center rounded-full text-ink-2 hover:bg-line/60">
          <X className="size-4" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {photoSuggestion ? (
        <button
          type="button"
          onClick={() => onChange({ ...photoSuggestion, source: "photo" })}
          className="flex items-center gap-3 rounded-xl border border-dashed border-line px-3.5 py-2.5 text-left hover:border-ink-3"
        >
          <ImageIcon className="size-5 shrink-0 text-ink-2" aria-hidden />
          <span className="text-sm">
            <span className="font-medium text-ink">Your photo has a location.</span> <span className="text-ink-2">Use it for the map?</span>
          </span>
        </button>
      ) : null}
      {blocked && !message ? (
        <p className="text-sm text-ink-3">Location is off for this site, so this meal won&apos;t be pinned on the map. Naming the place is enough.</p>
      ) : null}
      {!blocked ? (
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={locate} disabled={busy}>
            {busy ? <Spinner /> : <Crosshair className="size-4" aria-hidden />}
            Use my location
          </Button>
          <span className="text-xs text-ink-3">Only to pin this meal on your map.</span>
        </div>
      ) : null}
      {message ? <p className="text-sm text-ink-2">{message}</p> : null}
    </div>
  );
}
