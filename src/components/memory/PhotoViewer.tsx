"use client";

import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Photo } from "@/components/ui/Photo";
import { cx } from "@/components/ui/primitives";
import type { PhotoView } from "@/server/queries/memories";

/**
 * Hero carousel with native scroll-snap (so swiping feels like the phone's own
 * gallery) plus a full-screen viewer that shows the whole photo uncropped.
 */
export function PhotoViewer({ photos, alt }: { photos: PhotoView[]; alt: string }) {
  const track = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const [full, setFull] = useState<number | null>(null);

  const scrollTo = useCallback((i: number) => {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (full != null && !d.open) d.showModal();
    if (full == null && d.open) d.close();
  }, [full]);

  if (photos.length === 0) return null;

  return (
    <div className="relative">
      <div
        ref={track}
        className="flex snap-x snap-mandatory overflow-x-auto no-scrollbar md:rounded-3xl"
        onScroll={(e) => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / el.clientWidth));
        }}
        aria-roledescription="carousel"
        aria-label="Photos"
      >
        {photos.map((p, i) => (
          <button
            key={p.id}
            type="button"
            className="relative w-full shrink-0 snap-center"
            onClick={() => setFull(i)}
            aria-label={`View photo ${i + 1} of ${photos.length} full screen`}
          >
            <Photo src={p.displayUrl} alt={`${alt}, photo ${i + 1}`} eager={i === 0} className="aspect-[4/5] max-h-[78dvh] w-full sm:aspect-[3/2]" />
          </button>
        ))}
      </div>

      {photos.length > 1 ? (
        <>
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center gap-1.5" aria-hidden>
            {photos.map((p, i) => (
              <span key={p.id} className={cx("h-1.5 rounded-full bg-white/90 shadow transition-all", i === index ? "w-5" : "w-1.5 opacity-60")} />
            ))}
          </div>
          <button type="button" onClick={() => scrollTo(Math.max(0, index - 1))} disabled={index === 0} aria-label="Previous photo" className="absolute top-1/2 left-3 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur disabled:opacity-0 md:grid">
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <button type="button" onClick={() => scrollTo(Math.min(photos.length - 1, index + 1))} disabled={index === photos.length - 1} aria-label="Next photo" className="absolute top-1/2 right-3 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur disabled:opacity-0 md:grid">
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </>
      ) : null}
      <span className="pointer-events-none absolute top-3 right-3 grid size-9 place-items-center rounded-full bg-black/45 text-white backdrop-blur" aria-hidden>
        <Maximize2 className="size-4" />
      </span>

      <dialog
        ref={dialog}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-black p-0 text-white backdrop:bg-black"
        onClose={() => setFull(null)}
        onKeyDown={(e) => {
          if (full == null) return;
          if (e.key === "ArrowRight") setFull(Math.min(photos.length - 1, full + 1));
          if (e.key === "ArrowLeft") setFull(Math.max(0, full - 1));
        }}
        aria-label="Photo viewer"
      >
        {full != null ? (
          <div className="relative flex h-full w-full items-center justify-center">
            <Photo key={photos[full].id} src={photos[full].displayUrl} alt={`${alt}, photo ${full + 1}`} fit="contain" eager className="h-full w-full bg-black" />
            <button type="button" onClick={() => setFull(null)} aria-label="Close" className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 grid size-11 place-items-center rounded-full bg-white/15">
              <X className="size-5" aria-hidden />
            </button>
            {photos.length > 1 ? (
              <>
                <button type="button" onClick={() => setFull(Math.max(0, full - 1))} disabled={full === 0} aria-label="Previous photo" className="absolute left-2 grid size-12 place-items-center rounded-full bg-white/10 disabled:opacity-0">
                  <ChevronLeft className="size-6" aria-hidden />
                </button>
                <button type="button" onClick={() => setFull(Math.min(photos.length - 1, full + 1))} disabled={full === photos.length - 1} aria-label="Next photo" className="absolute right-2 grid size-12 place-items-center rounded-full bg-white/10 disabled:opacity-0">
                  <ChevronRight className="size-6" aria-hidden />
                </button>
                <p className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] text-sm text-white/70">
                  {full + 1} / {photos.length}
                </p>
              </>
            ) : null}
          </div>
        ) : null}
      </dialog>
    </div>
  );
}
