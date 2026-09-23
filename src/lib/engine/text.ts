import { FUZZY, PLACE_MATCH } from "./config";

/** Lowercase, strip accents and punctuation, collapse whitespace. "Café  Coffee-Day!" -> "cafe coffee day" */
export function normalizeText(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function tokenize(input: string): string[] {
  const normalized = normalizeText(input);
  return normalized ? normalized.split(" ") : [];
}

/** Collapse user-typed display text: trim and single-space it, keep casing. */
export function cleanDisplayText(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

const GENERIC = new Set<string>(PLACE_MATCH.genericWords);

/** Tokens that actually identify a place ("Empire Restaurant" -> ["empire"]). */
export function placeCoreTokens(name: string): string[] {
  const tokens = tokenize(name);
  const core = tokens.filter((t) => !GENERIC.has(t));
  return core.length > 0 ? core : tokens;
}

/**
 * Restricted Damerau-Levenshtein distance with an early exit once `max` is exceeded.
 * Returns max + 1 when the distance is larger than `max`.
 */
export function editDistance(a: string, b: string, max = Infinity): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows = a.length + 1;
  const cols = b.length + 1;
  let prevPrev = new Array<number>(cols).fill(0);
  let prev = Array.from({ length: cols }, (_, j) => j);
  for (let i = 1; i < rows; i++) {
    const current = new Array<number>(cols);
    current[0] = i;
    let rowMin = current[0];
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(prev[j] + 1, current[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, prevPrev[j - 2] + 1);
      }
      current[j] = value;
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > max) return max + 1;
    prevPrev = prev;
    prev = current;
  }
  return prev[cols - 1];
}

/**
 * How well a single query token matches a single target token, 0..1.
 * exact 1, prefix 0.9, infix 0.7, fuzzy (within the allowed edits) 0.6 - 0.1 per edit.
 */
export function tokenMatchScore(query: string, target: string): number {
  if (!query || !target) return 0;
  if (query === target) return 1;
  if (target.startsWith(query)) return 0.9;
  if (query.length >= 3 && target.includes(query)) return 0.7;
  const maxEdits = FUZZY.maxEditsFor(query.length);
  if (maxEdits === 0) return 0;
  // Compare against the same-length prefix too, so "biriyani" still finds "biryani".
  const whole = editDistance(query, target, maxEdits);
  const prefix = target.length > query.length ? editDistance(query, target.slice(0, query.length), maxEdits) : whole;
  const distance = Math.min(whole, prefix);
  return distance <= maxEdits ? 0.6 - 0.1 * distance : 0;
}

/**
 * Score a whole query against a text: every query token must match some target token.
 * Returns the mean best-token score, or 0 if any query token finds nothing.
 */
export function fuzzyScore(query: string, text: string): number {
  const queryTokens = tokenize(query);
  const targetTokens = tokenize(text);
  if (queryTokens.length === 0 || targetTokens.length === 0) return 0;
  let total = 0;
  for (const q of queryTokens) {
    let best = 0;
    for (const t of targetTokens) {
      const s = tokenMatchScore(q, t);
      if (s > best) best = s;
      if (best === 1) break;
    }
    if (best === 0) return 0;
    total += best;
  }
  return total / queryTokens.length;
}

/** Deterministic 32-bit string hash (FNV-1a). Used to pick stable template variants. */
export function stableHash(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
