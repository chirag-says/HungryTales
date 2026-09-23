"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * Keyboard (←/→/Esc) and swipe navigation for Memory Mode. Each step is a normal
 * route change, so the back button and deep links work as expected.
 */
export function StoryControls({ prevHref, nextHref, exitHref, children }: { prevHref: string | null; nextHref: string | null; exitHref: string; children: ReactNode }) {
  const router = useRouter();
  const start = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (prevHref) router.prefetch(prevHref);
    if (nextHref) router.prefetch(nextHref);
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
      if (e.key === "ArrowLeft" && prevHref) router.replace(prevHref, { scroll: false });
      if (e.key === "ArrowRight" && nextHref) router.replace(nextHref, { scroll: false });
      if (e.key === "Escape") router.push(exitHref);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prevHref, nextHref, exitHref, router]);

  return (
    <div
      className="contents"
      onTouchStart={(e) => {
        start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }}
      onTouchEnd={(e) => {
        const s = start.current;
        start.current = null;
        if (!s) return;
        const dx = e.changedTouches[0].clientX - s.x;
        const dy = e.changedTouches[0].clientY - s.y;
        if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx)) return;
        if (dx > 0 && prevHref) router.replace(prevHref, { scroll: false });
        if (dx < 0 && nextHref) router.replace(nextHref, { scroll: false });
      }}
    >
      {children}
    </div>
  );
}
