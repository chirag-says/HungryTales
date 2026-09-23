"use client";

import { Camera, Images, PencilLine, Plus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { cx } from "@/components/ui/primitives";
import { stashCapture, type CaptureSource } from "@/lib/client/capture-store";

const LauncherContext = createContext<() => void>(() => {});

export function useAddMemory() {
  return useContext(LauncherContext);
}

/**
 * The always-available "+ Add memory" action. The camera and gallery inputs live
 * here so the native picker opens directly from the tap (browsers require a user
 * gesture), then the chosen files are handed to /add.
 */
export function AddMemoryLauncher({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  // Only on the five main tabs; detail screens have their own primary action and must not be covered.
  const showFab = ["/", "/memories", "/explore", "/plan", "/us"].includes(pathname);
  const [open, setOpen] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const openSheet = useCallback(() => setOpen(true), []);
  const value = useMemo(() => openSheet, [openSheet]);

  const go = (files: File[], source: CaptureSource) => {
    stashCapture(files, source);
    setOpen(false);
    router.push(`/add?from=${source}`);
  };

  const onFiles = (source: CaptureSource) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length) go(files, source);
  };

  const openCamera = () => cameraRef.current?.click();
  const openGallery = () => galleryRef.current?.click();
  const addManually = () => go([], "manual");

  return (
    <LauncherContext.Provider value={value}>
      {children}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={onFiles("camera")} />
      <input ref={galleryRef} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} aria-hidden onChange={onFiles("gallery")} />

      {showFab ? (
      <button
        type="button"
        onClick={openSheet}
        aria-label="Add memory"
        className={cx(
          "fixed right-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-40 flex h-14 items-center justify-center gap-2 rounded-full bg-accent font-medium text-on-accent shadow-lg shadow-accent/25 transition-transform active:scale-95 md:hidden",
          // Labelled on Home; a compact circle elsewhere so it never hides content.
          pathname === "/" ? "pr-5 pl-4" : "w-14",
        )}
      >
        <Plus className="size-6" aria-hidden />
        {pathname === "/" ? "Add memory" : null}
      </button>
      ) : null}

      <Sheet open={open} onClose={() => setOpen(false)} title="Add a memory">
        <div className="flex flex-col gap-2 pt-1">
          <LaunchOption icon={Camera} label="Take photo" hint="Snap it now, add details after" onSelect={openCamera} primary />
          <LaunchOption icon={Images} label="Upload photos" hint="From your gallery. We'll read the date and place if the photo has them" onSelect={openGallery} />
          <LaunchOption icon={PencilLine} label="Add without a photo" hint="Just write it down" onSelect={addManually} />
        </div>
      </Sheet>
    </LauncherContext.Provider>
  );
}

function LaunchOption({ icon: Icon, label, hint, onSelect, primary }: { icon: typeof Camera; label: string; hint: string; onSelect: () => void; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cx("flex items-center gap-4 rounded-2xl p-4 text-left transition-colors", primary ? "bg-ink text-paper hover:opacity-95" : "bg-paper-2 text-ink hover:bg-line/60")}
    >
      <span className={cx("grid size-12 shrink-0 place-items-center rounded-full", primary ? "bg-paper/15" : "bg-surface")}>
        <Icon className="size-6" aria-hidden />
      </span>
      <span>
        <span className="block text-lg font-medium">{label}</span>
        <span className={cx("block text-sm", primary ? "text-paper/75" : "text-ink-2")}>{hint}</span>
      </span>
    </button>
  );
}

export function AddMemoryButton({ className, label = "Add memory" }: { className?: string; label?: string }) {
  const open = useAddMemory();
  return (
    <button
      type="button"
      onClick={open}
      className={cx(
        "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-accent px-5 font-medium text-on-accent shadow-sm transition-[filter,transform] hover:brightness-110 active:scale-[0.98]",
        className,
      )}
    >
      <Plus className="size-5" aria-hidden />
      {label}
    </button>
  );
}
