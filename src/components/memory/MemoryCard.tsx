import { Images, MapPin } from "lucide-react";
import Link from "next/link";
import { Photo } from "@/components/ui/Photo";
import { cx } from "@/components/ui/primitives";
import { REACTIONS, type Person } from "@/lib/domain";
import { formatShortDate, formatTime, weekdayOf } from "@/lib/engine/dates";
import { formatMoney } from "@/lib/engine/money";
import { formatRating } from "@/lib/engine/ratings";
import type { MemoryCardData } from "@/server/queries/memories";

export type MemoryCardVariant = "row" | "tile" | "feature" | "compact";

function Ratings({ memory, persons, light }: { memory: MemoryCardData; persons: Person[]; light?: boolean }) {
  if (!memory.ratings.length) return null;
  return (
    <span className="inline-flex items-center gap-2.5">
      {persons.map((p) => {
        const r = memory.ratings.find((x) => x.personId === p.id);
        if (!r) return null;
        return (
          <span key={p.id} className="inline-flex items-center gap-1 tabular-nums" title={`${p.name}: ${formatRating(r.overall)}/10`}>
            <span className={cx("inline-block size-1.5 rounded-full", p.slot === 1 ? "bg-p1" : "bg-p2", light && "ring-1 ring-white/70")} aria-hidden />
            <span className="sr-only">{p.name}</span>
            {formatRating(r.overall)}
          </span>
        );
      })}
    </span>
  );
}

function Reactions({ memory }: { memory: MemoryCardData }) {
  if (!memory.reactions.length) return null;
  const kinds = [...new Set(memory.reactions.map((r) => r.kind))];
  return (
    <span className="inline-flex" aria-label={`Reactions: ${kinds.map((k) => REACTIONS.find((r) => r.kind === k)?.label).join(", ")}`}>
      {kinds.slice(0, 3).map((k) => (
        <span key={k} aria-hidden className="-ml-0.5 first:ml-0">
          {REACTIONS.find((r) => r.kind === k)?.emoji}
        </span>
      ))}
    </span>
  );
}

/**
 * One memory, four sizes. Every list in the app renders memories through this,
 * so a memory looks like the same object wherever it appears.
 */
export function MemoryCard({
  memory,
  persons,
  currency,
  variant = "row",
  currentYear,
  eager,
  href,
}: {
  memory: MemoryCardData;
  persons: Person[];
  currency: string;
  variant?: MemoryCardVariant;
  currentYear?: number;
  eager?: boolean;
  href?: string;
}) {
  const link = href ?? `/memories/${memory.id}`;
  const time = formatTime(memory.eatenAt);
  const date = formatShortDate(memory.eatenOn, currentYear);
  const alt = `${memory.title}${memory.placeName ? ` at ${memory.placeName}` : ""}`;

  if (variant === "feature" && !memory.cover) {
    // No photo: a text-first hero instead of an empty photo frame.
    return (
      <Link href={link} className="block rounded-3xl bg-surface p-6 transition-colors hover:bg-paper-2 sm:p-8">
        <p className="text-sm text-ink-3">
          {weekdayOf(memory.eatenOn)}, {date}
          {time ? ` · ${time}` : ""}
        </p>
        <h3 className="font-display mt-2 text-3xl leading-tight text-ink sm:text-4xl">{memory.title}</h3>
        {memory.subtitle ? <p className="mt-1 text-ink-2">{memory.subtitle}</p> : null}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-ink-2">
          <Ratings memory={memory} persons={persons} />
          {memory.costMinor != null ? <span>{formatMoney(memory.costMinor, currency)}</span> : null}
          <Reactions memory={memory} />
        </div>
      </Link>
    );
  }

  if (variant === "feature") {
    return (
      <Link href={link} className="group relative block overflow-hidden rounded-3xl bg-paper-2">
        <Photo src={memory.cover?.displayUrl ?? null} alt={alt} eager={eager} className="aspect-[3/4] sm:aspect-[16/10]" imgClassName="transition-transform duration-700 group-hover:scale-[1.02]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 p-4 text-white sm:p-7">
          <p className="text-sm text-white/80">
            {weekdayOf(memory.eatenOn)}, {date}
            {time ? ` · ${time}` : ""}
          </p>
          <h3 className="font-display mt-1 text-3xl leading-tight sm:text-4xl">{memory.title}</h3>
          {memory.subtitle ? <p className="mt-1 text-white/85">{memory.subtitle}</p> : null}
          <div className="mt-3 flex items-center gap-4 text-sm text-white/90">
            <Ratings memory={memory} persons={persons} light />
            {memory.costMinor != null ? <span>{formatMoney(memory.costMinor, currency)}</span> : null}
            <Reactions memory={memory} />
          </div>
        </div>
      </Link>
    );
  }

  if (variant === "tile") {
    return (
      <Link href={link} className="group relative block overflow-hidden rounded-2xl bg-paper-2" aria-label={`${alt}, ${date}`}>
        <Photo src={memory.cover?.thumbUrl ?? null} alt={alt} eager={eager} className="aspect-square" imgClassName="transition-transform duration-500 group-hover:scale-[1.03]" />
        {memory.photoCount > 1 ? (
          <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-xs text-white backdrop-blur">
            <Images className="size-3" aria-hidden />
            {memory.photoCount}
          </span>
        ) : null}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent p-2.5 pt-8 text-white">
          <p className="truncate text-sm font-medium">{memory.title}</p>
          <p className="truncate text-xs text-white/80">{date}</p>
        </div>
      </Link>
    );
  }

  if (variant === "compact") {
    return (
      <Link href={link} className="group flex w-[10.5rem] shrink-0 flex-col gap-2 sm:w-52">
        <Photo src={memory.cover?.thumbUrl ?? null} alt={alt} eager={eager} className="aspect-[4/5] rounded-2xl" imgClassName="transition-transform duration-500 group-hover:scale-[1.03]" />
        <div>
          <p className="truncate font-medium text-ink">{memory.title}</p>
          <p className="truncate text-sm text-ink-3">
            {memory.placeName && memory.title !== memory.placeName ? `${memory.placeName} · ` : ""}
            {date}
          </p>
        </div>
      </Link>
    );
  }

  return (
    <Link href={link} className="group flex gap-4 rounded-2xl p-2 -mx-2 transition-colors hover:bg-paper-2/70">
      <Photo src={memory.cover?.thumbUrl ?? null} alt={alt} eager={eager} className="size-[6.5rem] shrink-0 rounded-xl sm:size-28" />
      <div className="flex min-w-0 flex-1 flex-col py-0.5">
        <p className="text-xs text-ink-3">
          {time ?? weekdayOf(memory.eatenOn)}
          {memory.photoCount > 1 ? ` · ${memory.photoCount} photos` : ""}
        </p>
        <h3 className="font-display mt-0.5 truncate text-xl leading-snug text-ink">{memory.title}</h3>
        {memory.subtitle ? (
          <p className="flex items-center gap-1 truncate text-sm text-ink-2">
            {memory.hasLocation ? <MapPin className="size-3.5 shrink-0 text-ink-3" aria-label="On the map" /> : null}
            <span className="truncate">{memory.subtitle}</span>
          </p>
        ) : null}
        <div className="mt-auto flex items-center gap-3 pt-1.5 text-sm text-ink-2">
          <Ratings memory={memory} persons={persons} />
          {memory.costMinor != null ? <span className="text-ink-3">{formatMoney(memory.costMinor, currency)}</span> : null}
          <Reactions memory={memory} />
        </div>
      </div>
    </Link>
  );
}
