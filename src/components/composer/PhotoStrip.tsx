"use client";

import { AlertTriangle, Camera, ChevronLeft, ChevronRight, ImagePlus, RotateCcw, Star, X } from "lucide-react";
import { cx } from "@/components/ui/primitives";
import type { DraftPhoto } from "./usePhotoQueue";

export function PhotoStrip({
  photos,
  coverKey,
  onCover,
  onRemove,
  onMove,
  onRetry,
  onRetake,
  onTakePhoto,
  onPickPhotos,
  canAdd,
}: {
  photos: DraftPhoto[];
  coverKey: string | null;
  onCover: (key: string) => void;
  onRemove: (key: string) => void;
  onMove: (key: string, delta: -1 | 1) => void;
  onRetry: (key: string) => void;
  onRetake: (key: string) => void;
  onTakePhoto: () => void;
  onPickPhotos: () => void;
  canAdd: boolean;
}) {
  return (
    <div className="-mx-5 overflow-x-auto px-5 no-scrollbar md:mx-0 md:px-0">
      <ul className="flex gap-3 pb-1">
        {photos.map((p, i) => {
          const isCover = p.key === coverKey;
          return (
            <li key={p.key} className="w-40 shrink-0 sm:w-44">
              <div className={cx("relative aspect-[4/5] overflow-hidden rounded-2xl bg-paper-2", isCover && "ring-2 ring-ink ring-offset-2 ring-offset-paper")}>
                {p.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
                  <img src={p.previewUrl} alt={`Photo ${i + 1}`} className="size-full object-cover" />
                ) : null}

                {p.status === "reading" || p.status === "uploading" ? (
                  <div className="absolute inset-x-3 bottom-3" aria-live="polite">
                    <div className="h-1.5 overflow-hidden rounded-full bg-paper/60">
                      <div className="h-full rounded-full bg-ink transition-[width]" style={{ width: `${Math.max(6, Math.round(p.progress * 100))}%` }} />
                    </div>
                    <p className="mt-1 text-center text-xs font-medium text-ink drop-shadow-[0_0_4px_var(--paper)]">
                      {p.status === "reading" ? "Preparing…" : `Uploading ${Math.round(p.progress * 100)}%`}
                    </p>
                  </div>
                ) : null}

                {p.status === "error" ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-paper/90 p-3 text-center">
                    <AlertTriangle className="size-5 text-accent" aria-hidden />
                    <p className="text-xs text-ink-2">{p.error}</p>
                    {p.retryable ? (
                      <button type="button" onClick={() => onRetry(p.key)} className="inline-flex h-8 items-center gap-1 rounded-full bg-ink px-3 text-xs font-medium text-paper">
                        <RotateCcw className="size-3.5" aria-hidden /> Retry
                      </button>
                    ) : null}
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => onRemove(p.key)}
                  aria-label={`Remove photo ${i + 1}`}
                  className="absolute top-2 right-2 grid size-9 place-items-center rounded-full bg-ink/70 text-paper backdrop-blur"
                >
                  <X className="size-4" aria-hidden />
                </button>
                {isCover ? <span className="absolute top-2 left-2 rounded-full bg-ink px-2.5 py-1 text-xs font-medium text-paper">Cover</span> : null}
              </div>

              {p.duplicate ? (
                <p className="mt-1.5 text-xs text-warn">
                  {p.duplicate.kind === "identical"
                    ? p.duplicate.memoryId
                      ? "Already saved in another memory"
                      : "Same photo twice"
                    : "Looks like a photo you already saved"}
                </p>
              ) : null}

              <div className="mt-1.5 flex items-center justify-between">
                <div className="flex">
                  <button type="button" onClick={() => onMove(p.key, -1)} disabled={i === 0} aria-label="Move earlier" className="grid size-9 place-items-center rounded-full text-ink-2 hover:bg-paper-2 disabled:opacity-30">
                    <ChevronLeft className="size-4" aria-hidden />
                  </button>
                  <button type="button" onClick={() => onMove(p.key, 1)} disabled={i === photos.length - 1} aria-label="Move later" className="grid size-9 place-items-center rounded-full text-ink-2 hover:bg-paper-2 disabled:opacity-30">
                    <ChevronRight className="size-4" aria-hidden />
                  </button>
                </div>
                <div className="flex">
                  {p.source === "camera" ? (
                    <button type="button" onClick={() => onRetake(p.key)} aria-label="Retake photo" className="grid size-9 place-items-center rounded-full text-ink-2 hover:bg-paper-2">
                      <RotateCcw className="size-4" aria-hidden />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onCover(p.key)}
                    aria-pressed={isCover}
                    aria-label={isCover ? "Cover photo" : "Make cover photo"}
                    className="grid size-9 place-items-center rounded-full text-ink-2 hover:bg-paper-2"
                  >
                    <Star className={cx("size-4", isCover && "fill-ink text-ink")} aria-hidden />
                  </button>
                </div>
              </div>
            </li>
          );
        })}

        {canAdd ? (
          <li className="flex w-32 shrink-0 flex-col gap-2 sm:w-36">
            <button type="button" onClick={onTakePhoto} className="flex flex-1 flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line text-sm text-ink-2 hover:border-ink-3">
              <Camera className="size-5" aria-hidden />
              {photos.length ? "Take another" : "Take photo"}
            </button>
            <button type="button" onClick={onPickPhotos} className="flex flex-1 flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line text-sm text-ink-2 hover:border-ink-3">
              <ImagePlus className="size-5" aria-hidden />
              From gallery
            </button>
          </li>
        ) : null}
      </ul>
    </div>
  );
}
