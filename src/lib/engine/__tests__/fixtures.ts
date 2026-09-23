import type { Person } from "@/lib/domain";
import type { HistoryMemory, HistoryReview } from "../types";

export const ASHA: Person = { id: "p-asha", name: "Asha", slot: 1 };
export const RAVI: Person = { id: "p-ravi", name: "Ravi", slot: 2 };
export const PERSONS = [ASHA, RAVI];

let counter = 0;

export function review(personId: string, overall: number | null, extra: Partial<HistoryReview> = {}): HistoryReview {
  return { personId, taste: null, quantity: null, value: null, overall, wouldEatAgain: null, ...extra };
}

export function memory(overrides: Partial<HistoryMemory> = {}): HistoryMemory {
  counter++;
  return {
    id: overrides.id ?? `m-${String(counter).padStart(3, "0")}`,
    eatenOn: "2026-09-01",
    eatenAt: "20:00",
    placeId: null,
    placeName: null,
    area: null,
    locationLabel: null,
    latitude: null,
    longitude: null,
    category: null,
    costMinor: null,
    shares: null,
    notes: null,
    discoveredById: null,
    creatorId: ASHA.id,
    foods: [],
    reviews: [],
    photoCount: 0,
    ...overrides,
  };
}

export const EMPIRE = { placeId: "pl-empire", placeName: "Empire", area: "Indiranagar", latitude: 12.9719, longitude: 77.6412 };
export const MTR = { placeId: "pl-mtr", placeName: "MTR", area: "Lalbagh", latitude: 12.9552, longitude: 77.5857 };
export const BIRYANI = { id: "f-biryani", name: "Paneer Biryani", category: "Biryani" };
export const DOSA = { id: "f-dosa", name: "Masala Dosa", category: "South Indian" };
export const TIKKA = { id: "f-tikka", name: "Paneer Tikka", category: "North Indian" };
