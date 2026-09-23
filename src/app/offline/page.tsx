import type { Metadata } from "next";

export const metadata: Metadata = { title: "Offline" };
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 text-center">
      <p className="eyebrow">Offline</p>
      <h1 className="font-display mt-3 text-4xl">Your memories are waiting.</h1>
      <p className="mt-3 text-ink-2">HungryTales needs a connection to open your journal. Check your signal and try again.</p>
      {/* A full reload is intended here: client navigation can't work while offline. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" className="mx-auto mt-8 inline-flex h-11 items-center rounded-full bg-ink px-6 font-medium text-paper">
        Try again
      </a>
    </main>
  );
}
