import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 text-center">
      <p className="eyebrow">Not found</p>
      <h1 className="font-display mt-3 text-4xl">This memory isn&apos;t here.</h1>
      <p className="mt-3 text-ink-2">It may have been deleted, or the link is from somewhere else.</p>
      <Link href="/" className="mx-auto mt-8 inline-flex h-11 items-center rounded-full bg-ink px-6 font-medium text-paper">
        Back to our story
      </Link>
    </main>
  );
}
