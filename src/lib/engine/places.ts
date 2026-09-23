import { PLACE_MATCH } from "./config";
import { distanceMeters, isValidLatLng } from "./geo";
import { editDistance, normalizeText, placeCoreTokens } from "./text";
import type { LatLng } from "./types";

export interface PlaceCandidate {
  id: string;
  name: string;
  area: string | null;
  latitude: number | null;
  longitude: number | null;
}

export type PlaceMatchConfidence = "exact" | "likely" | "possible";

export interface PlaceMatch<P extends PlaceCandidate> {
  place: P;
  confidence: PlaceMatchConfidence;
  reason: string;
}

function tokensEquivalent(a: string, b: string): boolean {
  if (a === b) return true;
  const longer = Math.max(a.length, b.length);
  return longer >= 5 && editDistance(a, b, 1) <= 1;
}

function isSubset(small: string[], large: string[]): boolean {
  return small.every((s) => large.some((l) => tokensEquivalent(s, l)));
}

function proximity(place: PlaceCandidate, coords: LatLng | null): number | null {
  if (!coords || !isValidLatLng(place.latitude, place.longitude)) return null;
  return distanceMeters(coords, { lat: place.latitude as number, lng: place.longitude as number });
}

/**
 * Compare a typed place name (and optional coordinates) against known places.
 *
 * - exact: same normalized name. Safe to reuse automatically.
 * - likely: one name's identifying words contain the other's ("Empire" vs "Empire Restaurant Bangalore"),
 *   or near-identical spelling, or overlapping names within a short walk. Ask before reusing.
 * - possible: shares an identifying word. Offer as a suggestion only.
 *
 * Nothing here merges records; callers decide with the person in the loop.
 */
export function matchPlaces<P extends PlaceCandidate>(name: string, coords: LatLng | null, places: P[]): PlaceMatch<P>[] {
  const normalized = normalizeText(name);
  if (!normalized) return [];
  const core = placeCoreTokens(name);
  const results: PlaceMatch<P>[] = [];

  for (const place of places) {
    const otherNorm = normalizeText(place.name);
    const otherCore = placeCoreTokens(place.name);
    const meters = proximity(place, coords);
    const isNear = meters != null && meters <= PLACE_MATCH.nearbyMeters;

    if (otherNorm === normalized) {
      results.push({ place, confidence: "exact", reason: "Same name" });
      continue;
    }
    const coreEqual = core.length === otherCore.length && isSubset(core, otherCore);
    const contained = isSubset(core, otherCore) || isSubset(otherCore, core);
    if (coreEqual || contained) {
      results.push({
        place,
        confidence: "likely",
        reason: isNear ? "Similar name, same spot" : coreEqual ? "Nearly the same name" : "One name contains the other",
      });
      continue;
    }
    const overlap = core.filter((t) => otherCore.some((o) => tokensEquivalent(t, o)));
    if (overlap.length > 0) {
      results.push({ place, confidence: isNear ? "likely" : "possible", reason: isNear ? "Similar name, same spot" : "Shares a word" });
    }
  }

  const rank: Record<PlaceMatchConfidence, number> = { exact: 0, likely: 1, possible: 2 };
  return results.sort((a, b) => rank[a.confidence] - rank[b.confidence] || a.place.name.localeCompare(b.place.name));
}

/** Known places within walking distance of a coordinate, nearest first. */
export function placesNear<P extends PlaceCandidate>(coords: LatLng, places: P[], radiusMeters: number = PLACE_MATCH.suggestRadiusMeters) {
  return places
    .map((place) => ({ place, meters: proximity(place, coords) }))
    .filter((p): p is { place: P; meters: number } => p.meters != null && p.meters <= radiusMeters)
    .sort((a, b) => a.meters - b.meters);
}
