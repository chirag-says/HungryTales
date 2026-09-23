/**
 * Money is stored as integer minor units (paise, cents) to avoid float drift.
 */

const MINOR_DIGITS: Record<string, number> = { JPY: 0, KRW: 0 };

export function minorDigits(currency: string): number {
  return MINOR_DIGITS[currency] ?? 2;
}

/** Parse what a person types ("540", "1,299.50", "₹ 80") into minor units. Null when empty or invalid. */
export function parseMoneyInput(input: string, currency: string): number | null {
  const cleaned = input.replace(/[^\d.]/g, "");
  if (!cleaned || cleaned === ".") return null;
  if ((cleaned.match(/\./g) ?? []).length > 1) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 10 ** minorDigits(currency));
}

export function toMajor(minor: number, currency: string): number {
  return minor / 10 ** minorDigits(currency);
}

/** `compact` drops decimals (for averages) and abbreviates very large totals. */
export function formatMoney(minor: number | null, currency: string, opts: { compact?: boolean } = {}): string {
  if (minor == null) return "";
  const major = toMajor(minor, currency);
  const isWhole = Number.isInteger(major);
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en", {
    style: "currency",
    currency,
    maximumFractionDigits: opts.compact || isWhole ? 0 : minorDigits(currency),
    minimumFractionDigits: opts.compact || isWhole ? 0 : minorDigits(currency),
    notation: opts.compact && major >= 100_000 ? "compact" : "standard",
  }).format(major);
}

/** Split a total evenly; the remainder goes to the first ids so shares always sum to the total. */
export function splitEvenly(totalMinor: number, personIds: string[]): Record<string, number> {
  if (personIds.length === 0) return {};
  const base = Math.floor(totalMinor / personIds.length);
  let remainder = totalMinor - base * personIds.length;
  const shares: Record<string, number> = {};
  for (const id of personIds) {
    shares[id] = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder--;
  }
  return shares;
}

export function sharesAreValid(totalMinor: number, shares: Record<string, number>): boolean {
  const values = Object.values(shares);
  return values.every((v) => Number.isInteger(v) && v >= 0) && values.reduce((a, b) => a + b, 0) === totalMinor;
}

/** What each person paid across memories. Unsplit memories are counted as shared equally. */
export function spendByPerson(
  memories: { costMinor: number | null; shares: Record<string, number> | null }[],
  personIds: string[],
): Record<string, number> {
  const totals: Record<string, number> = Object.fromEntries(personIds.map((id) => [id, 0]));
  for (const m of memories) {
    if (m.costMinor == null) continue;
    const shares = m.shares && sharesAreValid(m.costMinor, m.shares) ? m.shares : splitEvenly(m.costMinor, personIds);
    for (const [id, amount] of Object.entries(shares)) if (id in totals) totals[id] += amount;
  }
  return totals;
}
