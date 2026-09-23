import { Skeleton } from "@/components/ui/primitives";

/** Shown while a tab's server data loads: the shape of a page, not a spinner. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-5 pt-6 md:px-8 md:pt-10" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-3 h-9 w-64 max-w-full" />
      <Skeleton className="mt-8 aspect-[4/5] w-full rounded-3xl sm:aspect-[16/9]" />
      <div className="mt-8 flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="size-24 shrink-0" />
            <div className="flex flex-1 flex-col gap-2 py-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
