import type { Person } from "@/lib/domain";
import { formatMoney, parseMoneyInput, splitEvenly, toMajor } from "@/lib/engine/money";

/** Cost form state and its conversion to stored minor units. Shared by server pages and the client field. */
export type SplitMode = "none" | "even" | "custom";

export interface CostValue {
  text: string;
  split: SplitMode;
  /** personId -> typed share, only for custom splits */
  shareText: Record<string, string>;
}

export function costFromMinor(costMinor: number | null, shares: Record<string, number> | null, currency: string, persons: Person[]): CostValue {
  if (costMinor == null) return { text: "", split: "none", shareText: {} };
  const even = splitEvenly(costMinor, persons.map((p) => p.id));
  const isEven = shares != null && persons.every((p) => shares[p.id] === even[p.id]);
  return {
    text: String(toMajor(costMinor, currency)),
    split: shares == null ? "none" : isEven ? "even" : "custom",
    shareText: shares ? Object.fromEntries(Object.entries(shares).map(([k, v]) => [k, String(toMajor(v, currency))])) : {},
  };
}

/** Resolve the typed cost into minor units, or an error to show. */
export function resolveCost(value: CostValue, currency: string, persons: Person[]): { costMinor: number | null; shares: Record<string, number> | null; error: string | null } {
  if (!value.text.trim()) return { costMinor: null, shares: null, error: null };
  const costMinor = parseMoneyInput(value.text, currency);
  if (costMinor == null) return { costMinor: null, shares: null, error: "That amount doesn't look right." };
  if (value.split === "none") return { costMinor, shares: null, error: null };
  if (value.split === "even") return { costMinor, shares: splitEvenly(costMinor, persons.map((p) => p.id)), error: null };
  const shares: Record<string, number> = {};
  for (const p of persons) {
    const v = parseMoneyInput(value.shareText[p.id] ?? "", currency);
    if (v == null) return { costMinor, shares: null, error: `Add ${p.name}'s share.` };
    shares[p.id] = v;
  }
  const sum = Object.values(shares).reduce((a, b) => a + b, 0);
  if (sum !== costMinor) return { costMinor, shares: null, error: `The shares add up to ${formatMoney(sum, currency)}, not ${formatMoney(costMinor, currency)}.` };
  return { costMinor, shares, error: null };
}

