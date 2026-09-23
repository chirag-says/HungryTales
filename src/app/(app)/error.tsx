"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/primitives";

/** Friendly fallback for unexpected server/render errors. Details go to the console, not the screen. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
      <p className="eyebrow">Something went wrong</p>
      <h1 className="font-display mt-3 text-3xl">We couldn&apos;t open this page.</h1>
      <p className="mt-3 text-ink-2">Your memories are safe. This is usually a connection hiccup; trying again often fixes it.</p>
      {error.digest ? <p className="mt-2 text-xs text-ink-3">Reference: {error.digest}</p> : null}
      <div className="mt-8 flex gap-2">
        <Button variant="ink" onClick={reset}>
          Try again
        </Button>
        <ButtonLink href="/" variant="ghost">
          Go home
        </ButtonLink>
      </div>
    </div>
  );
}
