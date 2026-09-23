"use client";

import { ImageOff, UtensilsCrossed } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cx } from "./primitives";

/**
 * Every photo in the app goes through here: lazy by default, fades in once decoded,
 * and shows a calm placeholder instead of a broken-image icon when a URL fails or expires.
 */
export function Photo({
  src,
  alt,
  className,
  imgClassName,
  eager,
  fit = "cover",
  width,
  height,
}: {
  src: string | null;
  alt: string;
  className?: string;
  imgClassName?: string;
  eager?: boolean;
  fit?: "cover" | "contain";
  width?: number;
  height?: number;
}) {
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");
  const imgRef = useRef<HTMLImageElement>(null);
  const [lastSrc, setLastSrc] = useState(src);
  if (src !== lastSrc) {
    setLastSrc(src);
    setState("loading");
  }

  // Server-rendered images can finish loading before hydration attaches onLoad.
  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete) setState(img.naturalWidth > 0 ? "loaded" : "error");
  }, [src]);

  return (
    <div className={cx("relative overflow-hidden bg-paper-2", className)}>
      {src && state !== "error" ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed Cloudinary URLs already sized by transformation
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          width={width}
          height={height}
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : undefined}
          decoding="async"
          draggable={false}
          onLoad={() => setState("loaded")}
          onError={() => setState("error")}
          className={cx(
            "photo-fade absolute inset-0 size-full",
            fit === "cover" ? "object-cover" : "object-contain",
            state === "loaded" ? "opacity-100" : "opacity-0",
            imgClassName,
          )}
        />
      ) : null}
      {!src || state === "error" ? (
        <div className="absolute inset-0 grid place-items-center text-ink-3" role={state === "error" ? "img" : undefined} aria-label={state === "error" ? "Photo unavailable" : undefined}>
          {state === "error" ? <ImageOff className="size-6" aria-hidden /> : <UtensilsCrossed className="size-6 opacity-60" aria-hidden />}
        </div>
      ) : null}
    </div>
  );
}
