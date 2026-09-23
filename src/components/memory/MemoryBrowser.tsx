"use client";

import { Loader2, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EmptyState, cx } from "@/components/ui/primitives";
import type { Person } from "@/lib/domain";
import { formatLongDate, groupTimeline, monthName, weekdayOf } from "@/lib/engine/dates";
import type { BrowsePage } from "@/server/queries/browse";
import type { MemoryCardData } from "@/server/queries/memories";
import { MemoryCard } from "./MemoryCard";

/**
 * Timeline and gallery over one paginated, filterable result set.
 * The first page is rendered on the server; later pages stream in as you scroll.
 */
export function MemoryBrowser({
  view,
  initial,
  persons,
  currency,
  currentYear,
  query,
  emptyTitle,
  emptyBody,
}: {
  view: "timeline" | "gallery";
  initial: BrowsePage;
  persons: Person[];
  currency: string;
  currentYear: number;
  query: string;
  emptyTitle: string;
  emptyBody?: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState<MemoryCardData[]>(initial.items);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const [lastInitial, setLastInitial] = useState(initial);
  if (initial !== lastInitial) {
    // New filters or query: the server sent a fresh first page.
    setLastInitial(initial);
    setItems(initial.items);
    setCursor(initial.nextCursor);
    setError(null);
  }

  const loadMore = useCallback(async () => {
    if (!cursor || loading) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams(query);
      params.set("cursor", cursor);
      const res = await fetch(`/api/memories?${params}`, { headers: { accept: "application/json" } });
      if (res.status === 401) {
        router.push("/unlock");
        return;
      }
      if (!res.ok) throw new Error();
      const page = (await res.json()) as BrowsePage;
      setItems((list) => [...list, ...page.items.filter((m) => !list.some((x) => x.id === m.id))]);
      setCursor(page.nextCursor);
    } catch {
      setError("Couldn't load more memories. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, [cursor, loading, query, router]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !cursor) return;
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && loadMore(), { rootMargin: "800px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [cursor, loadMore]);

  const groups = useMemo(() => groupTimeline(items, new Map(Object.entries(initial.yearCounts).map(([y, n]) => [Number(y), n]))), [items, initial.yearCounts]);

  if (items.length === 0) return <EmptyState title={emptyTitle} body={emptyBody} />;

  return (
    <div>
      {view === "gallery" ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((m, i) => (
            <li key={m.id}>
              <MemoryCard memory={m} persons={persons} currency={currency} variant="tile" currentYear={currentYear} eager={i < 6} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col gap-10">
          {groups.map((g) => (
            <section key={g.key} aria-labelledby={`g-${g.key}`}>
              <h2 id={`g-${g.key}`} className="font-display sticky top-0 z-10 -mx-5 bg-paper/92 px-5 py-2 text-2xl backdrop-blur md:-mx-8 md:px-8">
                {g.kind === "month" ? `${monthName(g.month as number)} ${g.year}` : g.year}
                <span className="ml-2 font-sans text-sm text-ink-3">{g.count}</span>
              </h2>
              <ol className="mt-3 flex flex-col gap-5">
                {g.days.map((d) => (
                  <li key={d.date} className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-6">
                    <p className="text-sm text-ink-3 sm:pt-3">
                      <span className="text-ink-2">{weekdayOf(d.date).slice(0, 3)}</span> · {formatLongDate(d.date).replace(/, \d{4}$/, "")}
                      {d.items.length > 1 ? <span className="block text-xs">{d.items.length} meals</span> : null}
                    </p>
                    <ul className="flex flex-col gap-1">
                      {d.items.map((m) => (
                        <li key={m.id}>
                          <MemoryCard memory={m} persons={persons} currency={currency} variant="row" currentYear={currentYear} />
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}

      <div ref={sentinel} className="flex min-h-16 items-center justify-center py-6 text-sm text-ink-3" aria-live="polite">
        {loading ? <Loader2 className="size-5 animate-spin" aria-label="Loading more" /> : null}
        {error ? (
          <button type="button" onClick={loadMore} className="underline underline-offset-4">
            {error} Retry
          </button>
        ) : null}
        {!cursor && !loading && items.length > 8 ? <span>That&apos;s everything. {initial.total} memories.</span> : null}
      </div>
    </div>
  );
}

/** Search box that updates the URL (and so the server-rendered results) as you type. */
export function SearchBox({ placeholder = "Search dishes, places, notes, months…", autoFocus }: { placeholder?: string; autoFocus?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const push = (q: string) => {
    const next = new URLSearchParams(params);
    if (q.trim()) next.set("q", q.trim());
    else next.delete("q");
    router.replace(`${pathname}?${next}`, { scroll: false });
  };

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        push(value);
      }}
      className="relative"
    >
      <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-3" aria-hidden />
      <input
        type="search"
        aria-label="Search memories"
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        enterKeyHint="search"
        onChange={(e) => {
          setValue(e.target.value);
          if (timer.current) clearTimeout(timer.current);
          const q = e.target.value;
          timer.current = setTimeout(() => push(q), 300);
        }}
        className="h-12 w-full rounded-full border border-line bg-surface pr-12 pl-12 text-base text-ink placeholder:text-ink-3 focus:border-ink-3 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setValue("");
            push("");
          }}
          className="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-ink-3 hover:bg-paper-2"
        >
          <X className="size-4" aria-hidden />
        </button>
      ) : null}
    </form>
  );
}

export function ViewTabs({ current, views }: { current: string; views: { id: string; label: string; href: string }[] }) {
  return (
    <nav aria-label="View" className="inline-flex rounded-full bg-paper-2 p-1">
      {views.map((v) => (
        <Link
          key={v.id}
          href={v.href}
          scroll={false}
          aria-current={current === v.id ? "page" : undefined}
          className={cx("inline-flex h-9 items-center rounded-full px-4 text-sm font-medium transition-colors", current === v.id ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink")}
        >
          {v.label}
        </Link>
      ))}
    </nav>
  );
}
