"use client";

import "leaflet/dist/leaflet.css";
import type { LayerGroup, Map as LeafletMap } from "leaflet";
import { useEffect, useRef } from "react";
import { clusterPoints } from "@/lib/engine/geo";

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  label: string;
  /** Number drawn in the pin, e.g. visit count. */
  weight?: number;
}

type LeafletModule = typeof import("leaflet");

const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/**
 * Leaflet + OpenStreetMap tiles (no API key; restyled in CSS to match the palette). Pins are clustered with our own grid clustering
 * (lib/engine/geo) and re-clustered on zoom.
 */
export function FoodMap({
  points,
  selectedId = null,
  onSelect,
  interactive = true,
  className,
}: {
  points: MapPoint[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  interactive?: boolean;
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const leaflet = useRef<{ L: LeafletModule; map: LeafletMap; layer: LayerGroup } | null>(null);
  const latest = useRef({ points, selectedId, onSelect });
  const framed = useRef(false);

  useEffect(() => {
    latest.current = { points, selectedId, onSelect };
  });

  const draw = () => {
    const ctx = leaflet.current;
    if (!ctx) return;
    const { L, map, layer } = ctx;
    const { points: pts, selectedId: selected } = latest.current;
    layer.clearLayers();
    for (const c of clusterPoints(pts.map((p) => ({ lat: p.lat, lng: p.lng, item: p })), map.getZoom())) {
      const single = c.items.length === 1 ? c.items[0] : null;
      const label = single ? single.label : `${c.items.length} places`;
      const count = single ? (single.weight ?? 1) : c.items.length;
      const classes = ["ht-pin", single ? "" : "ht-pin--cluster", single && single.id === selected ? "ht-pin--selected" : ""].filter(Boolean).join(" ");
      const size = single ? 30 : 38;
      const marker = L.marker([c.lat, c.lng], {
        icon: L.divIcon({ html: `<span class="${classes}">${count > 1 ? count : ""}</span>`, className: "", iconSize: [size, size], iconAnchor: [size / 2, size / 2] }),
        title: label,
        alt: label,
        keyboard: interactive,
      });
      marker.on("click", () => {
        if (single) latest.current.onSelect?.(single.id);
        else map.flyToBounds(L.latLngBounds(c.items.map((p) => [p.lat, p.lng] as [number, number])).pad(0.3), { maxZoom: 17, duration: 0.5 });
      });
      marker.addTo(layer);
    }
  };

  const frame = () => {
    const ctx = leaflet.current;
    if (!ctx) return;
    const pts = latest.current.points;
    if (pts.length === 1) ctx.map.setView([pts[0].lat, pts[0].lng], 15);
    else if (pts.length > 1) ctx.map.fitBounds(pts.map((p) => [p.lat, p.lng] as [number, number]), { padding: [40, 40], maxZoom: 15 });
    else ctx.map.setView([20.59, 78.96], 4);
    framed.current = true;
  };

  useEffect(() => {
    let disposed = false;
    let map: LeafletMap | null = null;
    import("leaflet").then(({ default: L }) => {
      if (disposed || !container.current) return;
      map = L.map(container.current, {
        zoomControl: interactive,
        dragging: interactive,
        scrollWheelZoom: interactive ? "center" : false,
        touchZoom: interactive,
        doubleClickZoom: interactive,
        keyboard: interactive,
        boxZoom: false,
      });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: ATTRIBUTION, maxZoom: 19, className: "ht-tiles" }).addTo(map);
      leaflet.current = { L, map, layer: L.layerGroup().addTo(map) };
      map.on("zoomend", draw);
      frame();
      draw();
    });
    return () => {
      disposed = true;
      map?.remove();
      leaflet.current = null;
      framed.current = false;
    };
    // Created once per mount; data changes flow through `latest` and the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive]);

  useEffect(() => {
    if (!leaflet.current) return;
    if (!interactive || !framed.current) frame();
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, selectedId]);

  useEffect(() => {
    const ctx = leaflet.current;
    const p = selectedId ? points.find((x) => x.id === selectedId) : null;
    if (ctx && p) ctx.map.panTo([p.lat, p.lng], { animate: true });
  }, [selectedId, points]);

  return <div ref={container} className={className} role="region" aria-label="Food map" />;
}
