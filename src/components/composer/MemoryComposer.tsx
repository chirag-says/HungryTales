"use client";

import { ArrowLeft, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button, Chip, cx, Field, inputClass, textareaClass } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toaster";
import { takeCapture, type CaptureSource } from "@/lib/client/capture-store";
import { LIMITS, SUGGESTED_CATEGORIES, type FieldSource, type Person } from "@/lib/domain";
import { formatLongDate } from "@/lib/engine/dates";
import { suggestCategories } from "@/lib/engine/suggest";
import { createMemory, updateMemory } from "@/server/actions/memories";
import { resolveCost, type CostValue } from "./cost";
import { CostField } from "./CostField";
import { FoodField } from "./FoodField";
import { LocationField } from "./LocationField";
import { PhotoStrip } from "./PhotoStrip";
import { PlaceField } from "./PlaceField";
import type { ComposerCatalog, LocationValue, PlaceValue } from "./types";
import { usePhotoQueue, type ExistingPhoto } from "./usePhotoQueue";

export interface ComposerInitial {
  eatenOn: string;
  eatenAt: string | null;
  place: PlaceValue;
  location: LocationValue | null;
  locationLabel: string;
  category: string;
  foods: string[];
  cost: CostValue;
  notes: string;
  discoveredById: string | null;
  provenance: { date?: FieldSource; time?: FieldSource; location?: FieldSource };
  story: string | null;
  photos: ExistingPhoto[];
}

const SOURCE_NOTE: Partial<Record<FieldSource, string>> = { photo: "From the photo", device: "Now" };

export function MemoryComposer({
  mode,
  memoryId,
  initial,
  catalog,
  persons,
  me,
  currency,
  today,
  wish,
}: {
  mode: "create" | "edit";
  memoryId?: string;
  initial: ComposerInitial;
  catalog: ComposerCatalog;
  persons: Person[];
  me: Person;
  currency: string;
  today: string;
  wish?: { id: string; title: string } | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const queue = usePhotoQueue(initial.photos, memoryId);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<CaptureSource>(mode === "edit" ? "manual" : "manual");

  const [eatenOn, setEatenOn] = useState(initial.eatenOn);
  const [eatenAt, setEatenAt] = useState(initial.eatenAt ?? "");
  const [provenance, setProvenance] = useState(initial.provenance);
  const [place, setPlace] = useState<PlaceValue>(initial.place);
  const [dismissedMatches, setDismissedMatches] = useState<Set<string>>(new Set());
  const [location, setLocation] = useState<LocationValue | null>(initial.location);
  const [category, setCategory] = useState(initial.category);
  const [foods, setFoods] = useState<string[]>(initial.foods);
  const [cost, setCost] = useState<CostValue>(initial.cost);
  const [notes, setNotes] = useState(initial.notes);
  const [discoveredById, setDiscoveredById] = useState<string | null>(initial.discoveredById);
  const [showMore, setShowMore] = useState(mode === "edit" || Boolean(initial.cost.text || initial.notes));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [waitingForUploads, setWaitingForUploads] = useState(false);
  const [confirmDuplicates, setConfirmDuplicates] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, startSaving] = useTransition();
  const [touchedDate, setTouchedDate] = useState(mode === "edit");
  const retakeKey = useRef<string | null>(null);

  // Photos picked in the Add Memory sheet arrive here exactly once.
  useEffect(() => {
    if (mode !== "create") return;
    const captured = takeCapture();
    if (!captured) return;
    // One-time hand-off from a module store; takeCapture() consumes it, so it can't run during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSource(captured.source);
    if (captured.files.length && captured.source !== "manual") {
      queue.addFiles(captured.files, captured.source);
      setDirty(true);
    }
    // Mount-only hand-off.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Gallery photos: suggest the capture date/time from EXIF until the person edits it.
  const firstTakenAt = queue.photos.find((p) => p.meta.takenAt)?.meta.takenAt ?? null;
  const [appliedTakenAt, setAppliedTakenAt] = useState<string | null>(null);
  if (firstTakenAt && firstTakenAt !== appliedTakenAt && !touchedDate && mode === "create") {
    setAppliedTakenAt(firstTakenAt);
    const date = firstTakenAt.slice(0, 10);
    if (date <= today) {
      setEatenOn(date);
      setEatenAt(firstTakenAt.slice(11, 16));
      setProvenance((p) => ({ ...p, date: "photo", time: "photo" }));
    }
  }

  const photoLocation = useMemo(() => {
    const p = queue.photos.find((x) => x.meta.latitude != null && x.meta.longitude != null);
    return p ? { lat: p.meta.latitude as number, lng: p.meta.longitude as number } : null;
  }, [queue.photos]);

  const categoryOptions = useMemo(() => suggestCategories("", catalog.usedCategories, SUGGESTED_CATEGORIES, 12), [catalog.usedCategories]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const touch = () => setDirty(true);

  const submit = (acknowledgedDuplicates = false) => {
    setFormError(null);
    const nextErrors: Record<string, string> = {};
    if (!eatenOn) nextErrors.eatenOn = "Pick a date.";
    else if (eatenOn > today) nextErrors.eatenOn = "That date is in the future.";
    const money = resolveCost(cost, currency, persons);
    if (money.error) nextErrors.cost = money.error;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      if (nextErrors.cost) setShowMore(true);
      return;
    }
    if (queue.failed.length) {
      setFormError(`${queue.failed.length === 1 ? "A photo" : `${queue.failed.length} photos`} didn't upload. Retry or remove ${queue.failed.length === 1 ? "it" : "them"} first.`);
      return;
    }
    if (queue.busy) {
      setWaitingForUploads(true);
      return;
    }
    if (!acknowledgedDuplicates && queue.photos.some((p) => p.isNew && p.duplicate)) {
      setConfirmDuplicates(true);
      return;
    }

    const cover = queue.photos.find((p) => p.key === queue.coverKey);
    const payload = {
      eatenOn,
      eatenAt: eatenAt || null,
      place: place?.mode === "existing" ? { mode: "existing", id: place.id } : place?.mode === "new" ? { mode: "new", name: place.name, area: place.area || null } : null,
      locationLabel: place?.mode === "new" ? place.area || null : null,
      latitude: location?.lat ?? null,
      longitude: location?.lng ?? null,
      category: category || null,
      foods,
      costMinor: money.costMinor,
      shares: money.shares,
      notes: notes || null,
      story: initial.story,
      discoveredById,
      provenance: { ...provenance, ...(location ? { location: location.source } : {}) },
      photos: queue.photos
        .filter((p) => p.status === "ready" && p.id)
        .map((p) => ({ id: p.id as string, isNew: p.isNew, width: p.width, height: p.height, bytes: p.bytes, contentHash: p.hash, takenAt: p.meta.takenAt, receipt: p.receipt })),
      coverPhotoId: cover?.id ?? null,
    };

    startSaving(async () => {
      const result = mode === "create" ? await createMemory(payload, wish?.id ?? null) : await updateMemory(memoryId as string, payload);
      if (!result.ok) {
        setFormError(result.error);
        if (result.fieldErrors) setErrors(result.fieldErrors);
        if (result.code === "auth") router.push("/unlock");
        return;
      }
      setDirty(false);
      if (mode === "create") {
        router.replace(`/memories/${result.data.id}?new=1`);
      } else {
        toast("Memory updated");
        router.replace(`/memories/${result.data.id}`);
        router.refresh();
      }
    });
  };

  // "Save" tapped while photos were still uploading: save as soon as they finish.
  useEffect(() => {
    if (waitingForUploads && !queue.busy) {
      // Reacting to an external event (uploads finishing), not deriving state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWaitingForUploads(false);
      submit();
    }
    // submit reads the latest state on each render; re-running on its identity would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitingForUploads, queue.busy]);

  const handleFiles = (from: "camera" | "gallery", e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    if (retakeKey.current) {
      queue.remove(retakeKey.current);
      retakeKey.current = null;
    }
    queue.addFiles(files, from);
    touch();
  };

  const dateNote = provenance.date && provenance.date !== "user" ? SOURCE_NOTE[provenance.date] : null;
  const saveLabel = waitingForUploads ? `Finishing uploads… ${Math.round(queue.progress * 100)}%` : mode === "create" ? "Save memory" : "Save changes";

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-paper/95 px-3 backdrop-blur md:px-6">
        <button type="button" onClick={() => router.back()} aria-label="Back" className="grid size-11 place-items-center rounded-full text-ink-2 hover:bg-paper-2">
          <ArrowLeft className="size-5" aria-hidden />
        </button>
        <h1 className="font-display text-xl">{mode === "create" ? (wish ? `Trying ${wish.title}` : "New memory") : "Edit memory"}</h1>
      </header>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => handleFiles("camera", e)} />
      <input ref={galleryRef} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => handleFiles("gallery", e)} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        onChange={touch}
        className="grid grid-cols-[minmax(0,1fr)] gap-8 px-5 pt-6 pb-36 lg:pb-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-10 md:px-6"
      >
        <section aria-labelledby="photos-heading" className="lg:sticky lg:top-20 lg:self-start">
          <h2 id="photos-heading" className="eyebrow mb-3">
            Photos
          </h2>
          <PhotoStrip
            photos={queue.photos}
            coverKey={queue.coverKey}
            onCover={(k) => {
              queue.setCoverKey(k);
              touch();
            }}
            onRemove={(k) => {
              queue.remove(k);
              touch();
            }}
            onMove={(k, d) => {
              queue.move(k, d);
              touch();
            }}
            onRetry={queue.retry}
            onRetake={(k) => {
              retakeKey.current = k;
              cameraRef.current?.click();
            }}
            onTakePhoto={() => cameraRef.current?.click()}
            onPickPhotos={() => galleryRef.current?.click()}
            canAdd={queue.photos.length < LIMITS.photosPerMemory}
          />
          {queue.rejections.length ? (
            <ul role="alert" className="mt-3 space-y-1 text-sm text-accent">
              {queue.rejections.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          ) : null}
          {source === "gallery" && queue.photos.length > 0 && !firstTakenAt && !queue.busy ? (
            <p className="mt-3 text-sm text-ink-3">These photos don&apos;t carry a date, so set it below.</p>
          ) : null}
        </section>

        <div className="flex flex-col gap-8">
          <section aria-labelledby="when-heading" className="flex flex-col gap-4">
            <h2 id="when-heading" className="eyebrow">
              When
            </h2>
            <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-3">
              <Field label="Date" htmlFor="eatenOn" error={errors.eatenOn} hint={dateNote ? `${dateNote} · ${formatLongDate(eatenOn)}` : undefined}>
                <input
                  id="eatenOn"
                  type="date"
                  required
                  max={today}
                  value={eatenOn}
                  onChange={(e) => {
                    setTouchedDate(true);
                    setEatenOn(e.target.value);
                    setProvenance((p) => ({ ...p, date: "user" }));
                  }}
                  className={inputClass}
                />
              </Field>
              <Field label="Time" htmlFor="eatenAt" optional>
                <input
                  id="eatenAt"
                  type="time"
                  value={eatenAt}
                  onChange={(e) => {
                    setTouchedDate(true);
                    setEatenAt(e.target.value);
                    setProvenance((p) => ({ ...p, time: "user" }));
                  }}
                  className={inputClass}
                />
              </Field>
            </div>
            {provenance.date === "photo" ? (
              <button
                type="button"
                className="self-start text-sm text-ink-2 underline underline-offset-4"
                onClick={() => {
                  setTouchedDate(true);
                  const now = new Date();
                  setEatenOn(today);
                  setEatenAt(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
                  setProvenance((p) => ({ ...p, date: "device", time: "device" }));
                }}
              >
                Use today instead
              </button>
            ) : null}
          </section>

          <section aria-labelledby="where-heading" className="flex flex-col gap-3">
            <h2 id="where-heading" className="eyebrow">
              Where
            </h2>
            <PlaceField
              value={place}
              onChange={(v) => {
                setPlace(v);
                touch();
              }}
              places={catalog.places}
              location={location}
              dismissedMatches={dismissedMatches}
              onDismissMatch={(id) => setDismissedMatches((s) => new Set(s).add(id))}
            />
            <LocationField
              value={location}
              onChange={(v) => {
                setLocation(v);
                touch();
              }}
              photoSuggestion={photoLocation}
              autoLocate={mode === "create" && source === "camera"}
            />
          </section>

          <section aria-labelledby="what-heading" className="flex flex-col gap-3">
            <h2 id="what-heading" className="eyebrow">
              What
            </h2>
            <FoodField
              value={foods}
              onChange={(v) => {
                setFoods(v);
                touch();
              }}
              foods={catalog.foods}
              placeId={place?.mode === "existing" ? place.id : null}
              today={today}
            />
            <div className="-mx-5 overflow-x-auto px-5 no-scrollbar md:mx-0 md:px-0">
              <div className="flex gap-2 pb-1" role="group" aria-label="Category">
                {categoryOptions.map((c) => (
                  <Chip
                    key={c}
                    active={category.toLowerCase() === c.toLowerCase()}
                    onClick={() => {
                      setCategory(category.toLowerCase() === c.toLowerCase() ? "" : c);
                      touch();
                    }}
                  >
                    {c}
                  </Chip>
                ))}
              </div>
            </div>
            <input
              aria-label="Custom category"
              value={categoryOptions.some((c) => c.toLowerCase() === category.toLowerCase()) ? "" : category}
              onChange={(e) => setCategory(e.target.value.slice(0, LIMITS.nameMax))}
              placeholder="Or type a category"
              className={cx(inputClass, "h-10 text-sm")}
            />
          </section>

          <section>
            <button
              type="button"
              onClick={() => setShowMore((s) => !s)}
              aria-expanded={showMore}
              className="flex w-full items-center justify-between rounded-xl py-2 text-left"
            >
              <span className="eyebrow">Cost, who found it, notes</span>
              <ChevronDown className={cx("size-5 text-ink-3 transition-transform", showMore && "rotate-180")} aria-hidden />
            </button>
            {showMore ? (
              <div className="mt-4 flex flex-col gap-6">
                <Field label="Cost" optional>
                  <CostField value={cost} onChange={(v) => setCost(v)} currency={currency} persons={persons} error={errors.cost ?? null} />
                </Field>
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium text-ink-2">Who found it?</p>
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Who found it?">
                    {persons.map((p) => (
                      <Chip
                        key={p.id}
                        active={discoveredById === p.id}
                        onClick={() => {
                          setDiscoveredById(discoveredById === p.id ? null : p.id);
                          touch();
                        }}
                      >
                        {p.id === me.id ? `Me (${p.name})` : p.name}
                      </Chip>
                    ))}
                  </div>
                </div>
                <Field label="Notes" htmlFor="notes" optional>
                  <textarea
                    id="notes"
                    value={notes}
                    maxLength={LIMITS.notesMax}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Anything you want to remember"
                    className={textareaClass}
                  />
                </Field>
              </div>
            ) : null}
          </section>

          {formError ? (
            <p role="alert" className="rounded-xl bg-accent-soft px-4 py-3 text-sm text-ink">
              {formError}
            </p>
          ) : null}

          <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 px-5 py-3 backdrop-blur md:left-60 lg:static lg:border-0 lg:bg-transparent lg:p-0">
            <Button type="submit" variant="primary" size="lg" className="w-full" busy={saving || waitingForUploads}>
              {saveLabel}
            </Button>
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={confirmDuplicates}
        title="Save anyway?"
        body="One of these photos looks like a photo you've already saved. You can keep it if that's intended."
        confirmLabel="Save anyway"
        cancelLabel="Review photos"
        onCancel={() => setConfirmDuplicates(false)}
        onConfirm={() => {
          setConfirmDuplicates(false);
          submit(true);
        }}
      />
    </div>
  );
}
