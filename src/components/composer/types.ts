/** Shapes shared between the composer's server page and its client fields. */

export interface CatalogPlace {
  id: string;
  name: string;
  area: string | null;
  latitude: number | null;
  longitude: number | null;
  visits: number;
}

export interface CatalogFood {
  id: string;
  name: string;
  category: string | null;
  count: number;
  lastEatenOn: string | null;
  /** [placeId, times eaten there] */
  places: [string, number][];
}

export interface ComposerCatalog {
  places: CatalogPlace[];
  foods: CatalogFood[];
  usedCategories: string[];
}

export type PlaceValue =
  | { mode: "existing"; id: string; name: string; area: string | null }
  | { mode: "new"; name: string; area: string }
  | null;

export interface LocationValue {
  lat: number;
  lng: number;
  source: "photo" | "device" | "user";
}
