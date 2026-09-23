import type { Person, WouldEatAgain } from "@/lib/domain";

/** A person's review, reduced to what the engine scores. */
export interface HistoryReview {
  personId: string;
  taste: number | null;
  quantity: number | null;
  value: number | null;
  overall: number | null;
  wouldEatAgain: WouldEatAgain | null;
}

export interface HistoryFood {
  id: string;
  name: string;
  category: string | null;
}

/**
 * The compact, photo-free shape of one memory that every engine module works on.
 * Loaded once per request on the server; never shipped wholesale to the browser.
 */
export interface HistoryMemory {
  id: string;
  eatenOn: string; // YYYY-MM-DD
  eatenAt: string | null; // HH:MM
  placeId: string | null;
  placeName: string | null;
  area: string | null;
  locationLabel: string | null;
  latitude: number | null;
  longitude: number | null;
  category: string | null;
  costMinor: number | null;
  shares: Record<string, number> | null;
  notes: string | null;
  discoveredById: string | null;
  creatorId: string | null;
  foods: HistoryFood[];
  reviews: HistoryReview[];
  photoCount: number;
}

export interface HistoryPlace {
  id: string;
  name: string;
  area: string | null;
  latitude: number | null;
  longitude: number | null;
  discoveredById: string | null;
  createdAt: string; // ISO
}

export interface History {
  persons: Person[];
  memories: HistoryMemory[]; // any order; modules sort as needed
  places: HistoryPlace[];
}

export interface LatLng {
  lat: number;
  lng: number;
}
