import type { LatLng } from "./types";

const EARTH_RADIUS_M = 6_371_000;

export function isValidLatLng(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0) // (0,0) is what broken EXIF writers emit
  );
}

export function distanceMeters(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface ClusterInput<T> {
  lat: number;
  lng: number;
  item: T;
}

export interface Cluster<T> {
  lat: number;
  lng: number;
  items: T[];
}

/** Web-Mercator pixel coordinates at a zoom level (256px tiles). */
export function project(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const scale = 256 * 2 ** zoom;
  const sin = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

/**
 * Greedy grid clustering in screen space. Points whose projected positions share a
 * `cellPx` grid cell merge; the cluster sits at the mean position of its points.
 */
export function clusterPoints<T>(points: ClusterInput<T>[], zoom: number, cellPx = 56): Cluster<T>[] {
  const cells = new Map<string, { latSum: number; lngSum: number; items: T[] }>();
  for (const p of points) {
    const { x, y } = project(p.lat, p.lng, zoom);
    const key = `${Math.floor(x / cellPx)}:${Math.floor(y / cellPx)}`;
    const cell = cells.get(key) ?? { latSum: 0, lngSum: 0, items: [] };
    cell.latSum += p.lat;
    cell.lngSum += p.lng;
    cell.items.push(p.item);
    cells.set(key, cell);
  }
  return [...cells.values()].map((c) => ({ lat: c.latSum / c.items.length, lng: c.lngSum / c.items.length, items: c.items }));
}
