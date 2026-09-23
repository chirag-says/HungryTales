import { MEAL_TIMES, ON_THIS_DAY, TIMELINE } from "./config";

/**
 * Meal dates are timezone-free wall-clock strings ("2026-09-23", "20:42").
 * All arithmetic here goes through UTC so DST and server timezone never shift a day.
 */

const DAY_MS = 86_400_000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidDateString(value: string): boolean {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

export function isValidTimeString(value: string): boolean {
  return TIME_RE.test(value);
}

export function parseDate(value: string): { year: number; month: number; day: number } {
  const m = DATE_RE.exec(value);
  if (!m) throw new Error(`Invalid date: ${value}`);
  return { year: +m[1], month: +m[2], day: +m[3] };
}

function toUtcMs(value: string): number {
  const { year, month, day } = parseDate(value);
  return Date.UTC(year, month - 1, day);
}

export function formatDateString(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function addDays(value: string, days: number): string {
  const d = new Date(toUtcMs(value) + days * DAY_MS);
  return formatDateString(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / DAY_MS);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** "Today" as a date string in the given IANA timezone. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  return localPartsIn(timeZone, now).date;
}

export function localPartsIn(timeZone: string, now: Date = new Date()): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

export function monthKey(value: string): string {
  return value.slice(0, 7);
}

/** Sort key that puts undated times at the start of their day. */
export function chronoKey(eatenOn: string, eatenAt: string | null): string {
  return `${eatenOn}T${eatenAt ?? "00:00"}`;
}

export function compareChronoDesc<T extends { eatenOn: string; eatenAt: string | null; id: string }>(a: T, b: T): number {
  const ka = chronoKey(a.eatenOn, a.eatenAt);
  const kb = chronoKey(b.eatenOn, b.eatenAt);
  if (ka !== kb) return ka < kb ? 1 : -1;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

export type MealTime = (typeof MEAL_TIMES)[number]["label"];

export function mealTimeOf(time: string | null): MealTime | null {
  if (!time || !isValidTimeString(time)) return null;
  const hour = Number(time.slice(0, 2));
  for (const slot of MEAL_TIMES) if (hour < slot.until) return slot.label;
  return null;
}

// ---------------------------------------------------------------- timeline

export interface TimelineDay<T> {
  date: string;
  items: T[];
}

export interface TimelineGroup<T> {
  key: string; // "2026-09" or "2024"
  kind: "month" | "year";
  year: number;
  month: number | null;
  days: TimelineDay<T>[];
  count: number;
}

/**
 * Group memories (newest first) for the timeline. Dense years get month groups;
 * sparse years collapse into one year group so the page is not a wall of headers.
 * `yearCounts` lets paginated callers pass totals for the whole history.
 */
export function groupTimeline<T extends { eatenOn: string; eatenAt: string | null; id: string }>(
  items: T[],
  yearCounts?: Map<number, number>,
): TimelineGroup<T>[] {
  const sorted = [...items].sort(compareChronoDesc);
  const counts = yearCounts ?? new Map<number, number>();
  if (!yearCounts) {
    for (const item of sorted) {
      const y = parseDate(item.eatenOn).year;
      counts.set(y, (counts.get(y) ?? 0) + 1);
    }
  }
  const groups: TimelineGroup<T>[] = [];
  for (const item of sorted) {
    const { year, month } = parseDate(item.eatenOn);
    const byMonth = (counts.get(year) ?? 0) >= TIMELINE.minPerYearForMonthGroups;
    const key = byMonth ? monthKey(item.eatenOn) : String(year);
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      group = { key, kind: byMonth ? "month" : "year", year, month: byMonth ? month : null, days: [], count: 0 };
      groups.push(group);
    }
    let day = group.days[group.days.length - 1];
    if (!day || day.date !== item.eatenOn) {
      day = { date: item.eatenOn, items: [] };
      group.days.push(day);
    }
    day.items.push(item);
    group.count++;
  }
  return groups;
}

// ---------------------------------------------------------------- calendar

export interface CalendarCell {
  date: string | null; // null for padding cells
  count: number;
}

/** Month grid (weeks start Monday) with per-day memory counts. */
export function buildCalendarMonth(year: number, month: number, counts: Map<string, number>): CalendarCell[][] {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0 Sun
  const leading = (first + 6) % 7;
  const cells: CalendarCell[] = Array.from({ length: leading }, () => ({ date: null, count: 0 }));
  for (let d = 1; d <= daysInMonth(year, month); d++) {
    const date = formatDateString(year, month, d);
    cells.push({ date, count: counts.get(date) ?? 0 });
  }
  while (cells.length % 7 !== 0) cells.push({ date: null, count: 0 });
  const weeks: CalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

// ---------------------------------------------------------------- on this day

export interface OnThisDayMatch<T> {
  kind: "years" | "months" | "nearby";
  /** Human label, e.g. "1 year ago", "2 years ago", "3 months ago", "Around this week, 1 year ago". */
  label: string;
  items: T[];
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"} ago`;
}

/**
 * Find memories from the same calendar date in earlier years; failing that, the
 * same day-of-month in earlier months; failing that, within a few days of today
 * in earlier years. Returns an empty list when nothing meaningful exists.
 */
export function findOnThisDay<T extends { eatenOn: string; eatenAt: string | null; id: string }>(
  items: T[],
  today: string,
): OnThisDayMatch<T>[] {
  const t = parseDate(today);
  const past = items.filter((m) => m.eatenOn < today);

  const byYears = new Map<number, T[]>();
  for (const m of past) {
    const d = parseDate(m.eatenOn);
    // Feb 29 memories surface on Feb 28 in non-leap years.
    const sameDay = d.day === t.day || (d.month === 2 && d.day === 29 && t.month === 2 && t.day === 28 && daysInMonth(t.year, 2) === 28);
    if (d.month === t.month && sameDay && d.year < t.year) {
      const ago = t.year - d.year;
      byYears.set(ago, [...(byYears.get(ago) ?? []), m]);
    }
  }
  if (byYears.size > 0) {
    return [...byYears.entries()]
      .sort(([a], [b]) => a - b)
      .map(([ago, list]) => ({ kind: "years" as const, label: plural(ago, "year"), items: list.sort(compareChronoDesc) }));
  }

  const byMonths = new Map<number, T[]>();
  for (const m of past) {
    const d = parseDate(m.eatenOn);
    if (d.day !== t.day) continue;
    const ago = (t.year - d.year) * 12 + (t.month - d.month);
    if (ago >= 1 && ago < 12) byMonths.set(ago, [...(byMonths.get(ago) ?? []), m]);
  }
  if (byMonths.size > 0) {
    return [...byMonths.entries()]
      .sort(([a], [b]) => a - b)
      .map(([ago, list]) => ({ kind: "months" as const, label: plural(ago, "month"), items: list.sort(compareChronoDesc) }));
  }

  const nearby = new Map<number, T[]>();
  for (const m of past) {
    const d = parseDate(m.eatenOn);
    const ago = t.year - d.year;
    if (ago < 1) continue;
    const anniversary = formatDateString(d.year, t.month, Math.min(t.day, daysInMonth(d.year, t.month)));
    if (Math.abs(daysBetween(anniversary, m.eatenOn)) <= ON_THIS_DAY.nearbyWindowDays) {
      nearby.set(ago, [...(nearby.get(ago) ?? []), m]);
    }
  }
  return [...nearby.entries()]
    .sort(([a], [b]) => a - b)
    .map(([ago, list]) => ({
      kind: "nearby" as const,
      label: `Around this week, ${plural(ago, "year")}`,
      items: list.sort(compareChronoDesc),
    }));
}

// ---------------------------------------------------------------- formatting

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function monthName(month: number): string {
  return MONTHS[month - 1];
}

export function monthIndexFromName(token: string): number | null {
  const t = token.toLowerCase();
  if (t.length < 3) return null;
  const i = MONTHS.findIndex((m) => m.toLowerCase().startsWith(t));
  return i === -1 ? null : i + 1;
}

export function weekdayOf(value: string): string {
  return WEEKDAYS[new Date(toUtcMs(value)).getUTCDay()];
}

/** "September 23, 2026" */
export function formatLongDate(value: string): string {
  const { year, month, day } = parseDate(value);
  return `${monthName(month)} ${day}, ${year}`;
}

/** "Sep 23" or "Sep 23, 2025" when not in `currentYear`. */
export function formatShortDate(value: string, currentYear?: number): string {
  const { year, month, day } = parseDate(value);
  const base = `${monthName(month).slice(0, 3)} ${day}`;
  return currentYear === year ? base : `${base}, ${year}`;
}

/** "8:42 PM" */
export function formatTime(value: string | null): string | null {
  if (!value || !isValidTimeString(value)) return null;
  const hour = Number(value.slice(0, 2));
  const minute = value.slice(3, 5);
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${minute} ${hour < 12 ? "AM" : "PM"}`;
}

/** "1 day", "12 days", "3 weeks", "2 months", "1 year" */
export function formatDuration(days: number): string {
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  if (days < 21) return unit(Math.max(0, days), "day");
  if (days < 60) return unit(Math.round(days / 7), "week");
  if (days < 365) return unit(Math.round(days / 30), "month");
  return unit(Math.round(days / 365), "year");
}

/** "today", "yesterday", "3 days ago", "3 weeks ago", "2 months ago", "1 year ago" */
export function formatRelativeDays(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${formatDuration(days)} ago`;
}
