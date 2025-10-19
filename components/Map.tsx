"use client";

import { useEffect, useRef } from "react";
import mapboxgl, {
  type LngLatLike,
  type Map as MapboxMap,
  type HeatmapLayer,
  type GeoJSONSource,
} from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

// Map CHP county codes (1..58) to names for popup display
const COUNTY_BY_CODE: (string | null)[] = [
  null,
  "Alameda",
  "Alpine",
  "Amador",
  "Butte",
  "Calaveras",
  "Colusa",
  "Contra Costa",
  "Del Norte",
  "El Dorado",
  "Fresno",
  "Glenn",
  "Humboldt",
  "Imperial",
  "Inyo",
  "Kern",
  "Kings",
  "Lake",
  "Lassen",
  "Los Angeles",
  "Madera",
  "Marin",
  "Mariposa",
  "Mendocino",
  "Merced",
  "Modoc",
  "Mono",
  "Monterey",
  "Napa",
  "Nevada",
  "Orange",
  "Placer",
  "Plumas",
  "Riverside",
  "Sacramento",
  "San Benito",
  "San Bernardino",
  "San Diego",
  "San Francisco",
  "San Joaquin",
  "San Luis Obispo",
  "San Mateo",
  "Santa Barbara",
  "Santa Clara",
  "Santa Cruz",
  "Shasta",
  "Sierra",
  "Siskiyou",
  "Solano",
  "Sonoma",
  "Stanislaus",
  "Sutter",
  "Tehama",
  "Trinity",
  "Tulare",
  "Tuolumne",
  "Ventura",
  "Yolo",
  "Yuba",
];

function countyCodeToName(code: unknown): string | undefined {
  if (code == null) return undefined;
  const n = typeof code === "string" ? parseInt(code, 10) : (code as number);
  if (!Number.isFinite(n)) return undefined;
  return COUNTY_BY_CODE[n] ?? undefined;
}

const initialView = {
  longitude: -119.4179,
  latitude: 36.7783,
  zoom: 5,
} as const;

const heatmapPaint: HeatmapLayer["paint"] = {
  "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 5, 2, 9, 20, 13, 40],
  "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 5, 0.5, 13, 2],
  // Prefer bin counts when present; otherwise fall back to severity
  "heatmap-weight": [
    "case",
    ["has", "count"],
    [
      "interpolate",
      ["linear"],
      ["to-number", ["get", "count"], 1],
      1,
      0.2,
      50,
      1.0,
    ],
    [
      "interpolate",
      ["linear"],
      ["to-number", ["get", "severity"], 0],
      0,
      0.2,
      4,
      1.0,
    ],
  ],
  "heatmap-color": [
    "interpolate",
    ["linear"],
    ["heatmap-density"],
    0,
    "rgba(0,0,255,0)",
    0.2,
    "#2DC4B2",
    0.4,
    "#3BB3C3",
    0.6,
    "#669EC4",
    0.8,
    "#8B88B6",
    1,
    "#A2719B",
  ],
  "heatmap-opacity": 0.85,
};

type CrashFeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: { type: "Point"; coordinates: [number, number] };
    properties: { severity?: string };
  }>;
};

export default function CrashHeatmap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const fetchAbortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Helper to request crashes from our backend by bbox
  const requestCrashes = (map: MapboxMap) => {
    const b = map.getBounds();
    if (!b) return;
    const minLon = b.getWest();
    const minLat = b.getSouth();
    const maxLon = b.getEast();
    const maxLat = b.getNorth();
    const zoom = map.getZoom();
    const useBins = zoom < 10;
    const bin = zoom < 6 ? 0.1 : zoom < 8 ? 0.05 : 0.02;
    const limit = useBins ? 5000 : zoom >= 10 ? 10000 : 5000;
    const url = useBins
      ? `/api/crashes?mode=bin&bbox=${minLon},${minLat},${maxLon},${maxLat}&bin=${bin}&limit=${limit}`
      : `/api/crashes?bbox=${minLon},${minLat},${maxLon},${maxLat}&limit=${limit}`;

    if (fetchAbortRef.current) fetchAbortRef.current.abort();
    const ac = new AbortController();
    fetchAbortRef.current = ac;
    fetch(url, { signal: ac.signal })
      .then((r) => r.json())
      .then((geo: CrashFeatureCollection) => {
        const src = map.getSource("crashes") as GeoJSONSource | undefined;
        if (src) src.setData(geo as unknown as GeoJSON.FeatureCollection);
      })
      .catch(() => {
        /* ignore abort/errors for now */
      });
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [initialView.longitude, initialView.latitude] as LngLatLike,
      zoom: initialView.zoom,
    });
    mapRef.current = map;

    map.on("load", () => {
      map.addSource("crashes", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      const layer: HeatmapLayer = {
        id: "crash-heat",
        type: "heatmap",
        source: "crashes",
        paint: heatmapPaint,
      };
      map.addLayer(layer);

      // Interactive overlays: bins and points
      map.addLayer({
        id: "bins-circles",
        type: "circle",
        source: "crashes",
        filter: ["has", "count"],
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["to-number", ["get", "count"], 1],
            1,
            4,
            50,
            12,
          ],
          "circle-color": "#ff9500",
          "circle-opacity": 0.6,
          "circle-stroke-color": "#202020",
          "circle-stroke-width": 0.5,
          "circle-stroke-opacity": 0.6,
        },
      });

      map.addLayer({
        id: "point-circles",
        type: "circle",
        source: "crashes",
        minzoom: 10,
        filter: ["!", ["has", "count"]],
        paint: {
          "circle-radius": 3,
          "circle-color": "#ffffff",
          "circle-opacity": 0.7,
          "circle-stroke-color": "#202020",
          "circle-stroke-width": 0.5,
          "circle-stroke-opacity": 0.7,
        },
      });

      // Cursor hints
      map.on("mouseenter", "bins-circles", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "bins-circles", () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("mouseenter", "point-circles", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "point-circles", () => {
        map.getCanvas().style.cursor = "";
      });

      // Popups for bins
      map.on("click", "bins-circles", (e) => {
        const f = (e as mapboxgl.MapLayerMouseEvent).features?.[0];
        const p = (f && f.properties) as Record<string, unknown> | undefined;
        const count = p?.count as number | string | undefined;
        const first = p?.first_date as string | undefined;
        const last = p?.last_date as string | undefined;
        const html = `<div style="font:12px sans-serif"><div><b>Crashes</b>: ${
          count ?? "?"
        }</div>${first ? `<div><b>From</b>: ${first}</div>` : ""}${
          last ? `<div><b>To</b>: ${last}</div>` : ""
        }</div>`;
        new mapboxgl.Popup({ closeButton: true })
          .setLngLat(e.lngLat)
          .setHTML(html)
          .addTo(map);
      });

      // Popups for individual points
      map.on("click", "point-circles", (e) => {
        const f = (e as mapboxgl.MapLayerMouseEvent).features?.[0];
        const p = (f && f.properties) as Record<string, unknown> | undefined;
        const sev = p?.severity as string | undefined;
        const killed = p?.killed as string | number | undefined;
        const date = p?.date as string | undefined;
        const county = p?.county as string | number | undefined;
        const countyName = countyCodeToName(county);
        const html = `<div style=\"font:12px sans-serif\">${
          sev != null ? `<div><b>Number injured</b>: ${sev}</div>` : ""
        }${killed != null ? `<div><b>Number killed</b>: ${killed}</div>` : ""}${
          date ? `<div><b>Date</b>: ${date}</div>` : ""
        }${countyName ? `<div><b>County</b>: ${countyName}</div>` : ""}</div>`;
        new mapboxgl.Popup({ closeButton: true })
          .setLngLat(e.lngLat)
          .setHTML(html)
          .addTo(map);
      });

      requestCrashes(map);
      map.on("moveend", () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => requestCrashes(map), 250);
      });
    });

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (fetchAbortRef.current) fetchAbortRef.current.abort();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className="map-wrap" />;
}
