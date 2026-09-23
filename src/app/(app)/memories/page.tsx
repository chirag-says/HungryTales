import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { MemoryBrowser, SearchBox, ViewTabs } from "@/components/memory/MemoryBrowser";
import { MemoryCard } from "@/components/memory/MemoryCard";
import { MemoryFilters } from "@/components/memory/MemoryFilters";
import { AddMemoryButton } from "@/components/shell/AddMemoryLauncher";
import { EmptyState, cx } from "@/components/ui/primitives";
import { requireMember } from "@/lib/auth/session";
import { buildCalendarMonth, compareChronoDesc, formatLongDate, monthKey, monthName, parseDate, shiftMonth, todayIn } from "@/lib/engine/dates";
import { minorDigits } from "@/lib/engine/money";
import { applyFilters, parseSearchQuery, searchMemories } from "@/lib/engine/search";
import { browseMemories, filtersFromParams } from "@/server/queries/browse";
import { filterOptionsFrom } from "@/server/queries/filter-options";
import { loadHistory } from "@/server/queries/history";
import { hydrateCards } from "@/server/queries/memories";

export const metadata: Metadata = { title: "Memories" };

type SP = Record<string, string | string[] | undefined>;
const VIEWS = ["timeline", "gallery", "calendar"] as const;

function one(v: string | string[] | undefined): string | null {
  return typeof v === "string" ? v : null;
}

export default async function MemoriesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const session = await requireMember();
  const sp = await searchParams;
  const view = (VIEWS as readonly string[]).includes(one(sp.view) ?? "") ? (one(sp.view) as (typeof VIEWS)[number]) : "timeline";
  const q = one(sp.q)?.slice(0, 200) ?? "";
  const filters = filtersFromParams((k) => one(sp[k]));
  const history = await loadHistory(session.duo.id);
  const today = todayIn(session.duo.timezone);
  const currentYear = parseDate(today).year;

  const query = new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string" && !["view", "month", "day", "cursor"].includes(e[0])));
  const hrefFor = (v: string) => {
    const next = new URLSearchParams(query);
    if (v !== "timeline") next.set("view", v);
    return `/memories${next.size ? `?${next}` : ""}`;
  };

  if (history.memories.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-5 pt-16">
        <EmptyState title="Your food story starts here." body="Memories you save show up here as a timeline, a photo gallery and a calendar." action={<AddMemoryButton />} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-5 pt-6 md:px-8 md:pt-10">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl">Memories</h1>
        <ViewTabs
          current={view}
          views={[
            { id: "timeline", label: "Timeline", href: hrefFor("timeline") },
            { id: "gallery", label: "Gallery", href: hrefFor("gallery") },
            { id: "calendar", label: "Calendar", href: hrefFor("calendar") },
          ]}
        />
      </header>
      <div className="mb-6 flex flex-col gap-3">
        <SearchBox />
        <MemoryFilters options={filterOptionsFrom(history)} persons={session.persons} currency={session.duo.currency} />
      </div>

      {view === "calendar" ? (
        <CalendarView session={session} sp={sp} q={q} filters={filters} today={today} />
      ) : (
        <BrowseView session={session} view={view} q={q} filters={filters} query={query.toString()} currentYear={currentYear} />
      )}
    </div>
  );
}

async function BrowseView({
  session,
  view,
  q,
  filters,
  query,
  currentYear,
}: {
  session: Awaited<ReturnType<typeof requireMember>>;
  view: "timeline" | "gallery";
  q: string;
  filters: ReturnType<typeof filtersFromParams>;
  query: string;
  currentYear: number;
}) {
  const page = await browseMemories(session, { q, filters, limit: view === "gallery" ? 30 : 24 });
  return (
    <>
      {q || page.understood.length ? (
        <p className="mb-4 text-sm text-ink-3" aria-live="polite">
          {page.total} {page.total === 1 ? "memory" : "memories"}
          {page.understood.length ? ` · understood: ${page.understood.join(", ")}` : ""}
        </p>
      ) : null}
      <MemoryBrowser
        key={`${view}:${query}`}
        view={view}
        initial={page}
        persons={session.persons}
        currency={session.duo.currency}
        currentYear={currentYear}
        query={query}
        emptyTitle={q ? "Nothing matched that memory." : "No memories match these filters."}
        emptyBody={q ? "Try a dish, a place, a month like “September”, or a rating like “9”." : "Loosen a filter or clear them all."}
      />
    </>
  );
}

async function CalendarView({
  session,
  sp,
  q,
  filters,
  today,
}: {
  session: Awaited<ReturnType<typeof requireMember>>;
  sp: SP;
  q: string;
  filters: ReturnType<typeof filtersFromParams>;
  today: string;
}) {
  const history = await loadHistory(session.duo.id);
  const monthParam = one(sp.month);
  const base = monthParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam) ? monthParam : monthKey(today);
  const [year, month] = base.split("-").map(Number);
  const filteredAll = applyFilters(history.memories, filters);
  const filtered = q
    ? searchMemories(filteredAll, parseSearchQuery(q), session.persons, { minorDigits: minorDigits(session.duo.currency) }).map((h) => h.memory)
    : filteredAll;
  const counts = new Map<string, number>();
  for (const m of filtered) counts.set(m.eatenOn, (counts.get(m.eatenOn) ?? 0) + 1);
  const weeks = buildCalendarMonth(year, month, counts);
  const monthTotal = [...counts].filter(([d]) => d.startsWith(base)).reduce((a, [, n]) => a + n, 0);
  const dayParam = one(sp.day);
  const selectedDay = dayParam && /^\d{4}-\d{2}-\d{2}$/.test(dayParam) && dayParam.startsWith(base) ? dayParam : null;
  const dayMemories = selectedDay ? filtered.filter((m) => m.eatenOn === selectedDay).sort(compareChronoDesc) : [];
  const dayCards = await hydrateCards(dayMemories);

  const link = (params: Record<string, string | null>) => {
    const next = new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string"));
    next.set("view", "calendar");
    for (const [k, v] of Object.entries(params)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    return `/memories?${next}`;
  };
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const nextKey = `${next.year}-${String(next.month).padStart(2, "0")}`;
  const maxCount = Math.max(1, ...weeks.flat().map((c) => c.count));

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,26rem)_1fr]">
      <section aria-label={`${monthName(month)} ${year}`} className="rounded-3xl bg-surface p-2.5 sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <Link href={link({ month: `${prev.year}-${String(prev.month).padStart(2, "0")}`, day: null })} aria-label="Previous month" className="grid size-11 place-items-center rounded-full hover:bg-paper-2">
            <ChevronLeft className="size-5" aria-hidden />
          </Link>
          <div className="text-center">
            <h2 className="font-display text-2xl">
              {monthName(month)} {year}
            </h2>
            <p className="text-sm text-ink-3">
              {monthTotal} {monthTotal === 1 ? "meal" : "meals"}
            </p>
          </div>
          {nextKey <= monthKey(today) ? (
            <Link href={link({ month: nextKey, day: null })} aria-label="Next month" className="grid size-11 place-items-center rounded-full hover:bg-paper-2">
              <ChevronRight className="size-5" aria-hidden />
            </Link>
          ) : (
            <span className="size-11" />
          )}
        </div>
        <table className="w-full table-fixed border-separate border-spacing-0.5 sm:border-spacing-1">
          <thead>
            <tr>
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                <th key={i} scope="col" className="pb-1 text-xs font-medium text-ink-3">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, wi) => (
              <tr key={wi}>
                {week.map((cell, ci) => (
                  <td key={ci} className="p-0">
                    {cell.date ? (
                      cell.count ? (
                        <Link
                          href={link({ month: base, day: cell.date })}
                          aria-label={`${formatLongDate(cell.date)}: ${cell.count} ${cell.count === 1 ? "meal" : "meals"}`}
                          aria-current={cell.date === selectedDay ? "date" : undefined}
                          className={cx(
                            "relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm font-medium transition-colors",
                            cell.date === selectedDay ? "bg-ink text-paper" : "text-ink hover:ring-2 hover:ring-ink-3",
                          )}
                          style={cell.date === selectedDay ? undefined : { background: `color-mix(in oklab, var(--accent) ${18 + (cell.count / maxCount) * 50}%, transparent)` }}
                        >
                          {Number(cell.date.slice(8))}
                          {cell.count > 1 ? <span className="text-[0.65rem] leading-none opacity-80">×{cell.count}</span> : null}
                        </Link>
                      ) : (
                        <span className={cx("flex aspect-square items-center justify-center rounded-xl text-sm", cell.date === today ? "font-semibold text-ink ring-1 ring-line" : "text-ink-3")}>
                          {Number(cell.date.slice(8))}
                        </span>
                      )
                    ) : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-ink-3">Tinted days have memories; the darker, the more meals.</p>
      </section>

      <section aria-live="polite" aria-label="Selected day">
        {selectedDay ? (
          <>
            <h2 className="font-display mb-4 text-2xl">{formatLongDate(selectedDay)}</h2>
            <ul className="flex flex-col gap-2">
              {dayCards.map((m) => (
                <li key={m.id}>
                  <MemoryCard memory={m} persons={session.persons} currency={session.duo.currency} variant="row" />
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="pt-2 text-ink-3">{monthTotal ? "Pick a tinted day to see what you ate." : "No memories this month."}</p>
        )}
      </section>
    </div>
  );
}
