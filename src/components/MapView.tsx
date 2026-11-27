"use client";

import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, ImageSource, Map as MLMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import { closeRing, fmt, measure } from "@/lib/geo";
import type { LngLat, SiteObject } from "@/lib/types";

export type DraftApi = { undo: () => void; clear: () => void; finish: () => void; count: () => number };

// Small local flat projection (metres) around a reference point; plenty accurate across a yard.
function flat(ref: LngLat) {
  const mx = 111320 * Math.cos((ref[1] * Math.PI) / 180), my = 110574;
  return {
    to: (p: LngLat): [number, number] => [(p[0] - ref[0]) * mx, (p[1] - ref[1]) * my],
    from: ([x, y]: [number, number]): LngLat => [ref[0] + x / mx, ref[1] + y / my],
  };
}

/** Rectangle from one side (a to b) and any point c on the opposite side. */
export function rectFrom(a: LngLat, b: LngLat, c: LngLat): LngLat[] {
  const f = flat(a);
  const B = f.to(b), C = f.to(c);
  const L = Math.hypot(B[0], B[1]) || 1;
  const n: [number, number] = [-B[1] / L, B[0] / L];
  const d = C[0] * n[0] + C[1] * n[1];
  return [a, b, f.from([B[0] + n[0] * d, B[1] + n[1] * d]), f.from([n[0] * d, n[1] * d])];
}

/** Snap the side from the last point to p so it runs parallel or square to the first side. */
function squareUp(pts: LngLat[], p: LngLat): LngLat {
  if (pts.length < 2) return p;
  const f = flat(pts[pts.length - 1]);
  const A = f.to(pts[0]), B = f.to(pts[1]), P = f.to(p);
  const base = Math.atan2(B[1] - A[1], B[0] - A[0]);
  const ang = Math.atan2(P[1], P[0]);
  const q = Math.PI / 2;
  const snapped = base + Math.round((ang - base) / q) * q;
  let diff = Math.abs(ang - snapped) % (2 * Math.PI);
  if (diff > Math.PI) diff = 2 * Math.PI - diff;
  if (diff > (12 * Math.PI) / 180) return p;
  const len = P[0] * Math.cos(snapped) + P[1] * Math.sin(snapped);
  return f.from([Math.cos(snapped) * len, Math.sin(snapped) * len]);
}

export type DrawMode = "idle" | "garden" | "bed" | "structure" | "clear" | "tree" | "pin" | "bedpoint";

type Props = {
  flyTo: { center: LngLat; zoom: number; key: number; padLeft?: number; padBottom?: number } | null;
  showSides?: boolean;
  imagery: "usgs" | "esri";
  garden: LngLat[] | null;
  objects: SiteObject[];
  overlay: { url: string; corners: [LngLat, LngLat, LngLat, LngLat] } | null;
  overlayVisible: boolean;
  marker: LngLat | null;
  mode: DrawMode;
  onRingComplete: (ring: LngLat[]) => void;
  onPoint: (p: LngLat) => void;
  draftRef: React.MutableRefObject<DraftApi | null>;
  /** "rect": tap two corners along one side, then a third tap sets the depth. "free": tap each corner. */
  shape?: "rect" | "free";
  /** In free mode, snap each side to run parallel or square to the first side when it's within 12°. */
  square?: boolean;
  /** When set, shows draggable corner handles and a move handle for this outline. */
  editRing?: LngLat[] | null;
  /** Suggested sunnier spots: dashed outlines with a letter. */
  spots?: { id: string; ring: LngLat[]; center: LngLat; label: string }[];
  onEditRing?: (ring: LngLat[]) => void;
  onDraftChange: (n: number) => void;
  beds?: { n: number; ring: LngLat[]; center: LngLat; label: string; tone: "ok" | "low" | "walk" }[];
};

const SOURCES = {
  usgs:
    "https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPPlus/ImageServer/exportImage?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=512,512&format=jpgpng&f=image",
  esri: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
};

maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

export default function MapView(props: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const ready = useRef(false);
  const draft = useRef<LngLat[]>([]);
  const labelMarkers = useRef<maplibregl.Marker[]>([]);
  const pin = useRef<maplibregl.Marker | null>(null);
  const bedMarkers = useRef<maplibregl.Marker[]>([]);
  const latest = useRef(props);
  latest.current = props;

  // ---------- create map once ----------
  useEffect(() => {
    if (!el.current) return;
    const m = new maplibregl.Map({
      container: el.current,
      center: [-96.5, 39.5],
      zoom: 3.4,
      maxZoom: 21,
      attributionControl: { compact: true },
      style: {
        version: 8,
        sources: {
          usgs: { type: "raster", tiles: [SOURCES.usgs], tileSize: 512, minzoom: 10, maxzoom: 20, attribution: "Imagery: USDA NAIP via USGS The National Map" },
          esri: { type: "raster", tiles: [SOURCES.esri], tileSize: 256, maxzoom: 19, attribution: "Imagery: Esri, Maxar, Earthstar Geographics" },
        },
        layers: [
          { id: "bg", type: "background", paint: { "background-color": "#dfe6dc" } },
          // Zoomed out, use Esri's cached tiles: USGS draws every tile on request, which is slow.
          { id: "overview", type: "raster", source: "esri", maxzoom: 12 },
          { id: "usgs", type: "raster", source: "usgs", minzoom: 12, paint: { "raster-fade-duration": 150 } },
          { id: "esri", type: "raster", source: "esri", layout: { visibility: "none" } },
        ],
      },
    });
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
    m.addControl(new maplibregl.ScaleControl({ unit: "imperial" }), "bottom-right");
    m.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true } }), "top-right");
    m.on("load", () => {
      m.addSource("shade", { type: "image", url: transparentPng, coordinates: [[0, 0.001], [0.001, 0.001], [0.001, 0], [0, 0]] });
      m.addLayer({ id: "shade", type: "raster", source: "shade", paint: { "raster-opacity": 0.72, "raster-fade-duration": 0, "raster-resampling": "nearest" }, layout: { visibility: "none" } });
      for (const id of ["garden", "objects", "draft", "beds", "spots"]) m.addSource(id, { type: "geojson", data: EMPTY });
      m.addLayer({ id: "garden-fill", type: "fill", source: "garden", paint: { "fill-color": "#9fd18b", "fill-opacity": 0.18 } });
      m.addLayer({ id: "garden-line", type: "line", source: "garden", paint: { "line-color": "#f4f9ef", "line-width": 3 } });
      m.addLayer({ id: "garden-line-inner", type: "line", source: "garden", paint: { "line-color": "#3f7a3a", "line-width": 1.5, "line-dasharray": [2, 1.5] } });
      m.addLayer({
        id: "objects-fill", type: "fill", source: "objects",
        paint: {
          "fill-color": ["match", ["get", "kind"], "tree", "#2e6b34", "clear", "#ffffff", "#b5654a"],
          "fill-opacity": ["match", ["get", "kind"], "clear", 0.25, 0.45],
        },
      });
      m.addLayer({
        id: "objects-line", type: "line", source: "objects",
        paint: { "line-color": ["match", ["get", "kind"], "tree", "#d9f2c7", "clear", "#ffffff", "#ffd7c4"], "line-width": 2, "line-dasharray": [3, 2] },
      });
      m.addLayer({ id: "spots-fill", type: "fill", source: "spots", paint: { "fill-color": "#FF6F47", "fill-opacity": 0.12 } });
      m.addLayer({ id: "spots-line", type: "line", source: "spots", paint: { "line-color": "#FF6F47", "line-width": 2.5, "line-dasharray": [2, 1.5] } });
      m.addLayer({ id: "beds-fill", type: "fill", source: "beds", paint: { "fill-color": ["match", ["get", "tone"], "low", "#FF6F47", "#BFE3D0"], "fill-opacity": 0.55 } });
      m.addLayer({ id: "beds-line", type: "line", source: "beds", paint: { "line-color": "#0B3530", "line-width": 1.6 } });
      m.addLayer({ id: "draft-line", type: "line", source: "draft", filter: ["==", "$type", "LineString"], paint: { "line-color": "#ffe27a", "line-width": 2.5 } });
      m.addLayer({ id: "draft-pts", type: "circle", source: "draft", filter: ["==", "$type", "Point"], paint: { "circle-radius": 5, "circle-color": "#ffe27a", "circle-stroke-color": "#3b3b1a", "circle-stroke-width": 1.5 } });
      ready.current = true;
      syncAll();
    });

    m.on("click", (e) => {
      const p = latest.current;
      const ll: LngLat = [e.lngLat.lng, e.lngLat.lat];
      if (p.mode === "tree" || p.mode === "pin" || p.mode === "bedpoint") return p.onPoint(ll);
      if (p.mode === "idle") return;
      const pts = draft.current;
      if (p.shape === "rect" && (p.mode === "garden" || p.mode === "bed")) {
        if (pts.length === 2) { draft.current = rectFrom(pts[0], pts[1], ll); return finish(); }
        pts.push(ll);
        return renderDraft();
      }
      if (pts.length >= 3) {
        const first = m.project(pts[0]);
        if (Math.hypot(first.x - e.point.x, first.y - e.point.y) < 14) return finish();
      }
      pts.push(p.square ? squareUp(pts, ll) : ll);
      renderDraft();
    });
    m.on("dblclick", (e) => {
      if (latest.current.mode !== "idle" && latest.current.mode !== "tree" && latest.current.mode !== "pin" && latest.current.mode !== "bedpoint") {
        e.preventDefault();
        finish();
      }
    });
    m.on("mousemove", (e) => {
      if (latest.current.mode === "idle" || latest.current.mode === "tree" || latest.current.mode === "pin" || latest.current.mode === "bedpoint" || !draft.current.length) return;
      const p = latest.current, ll: LngLat = [e.lngLat.lng, e.lngLat.lat], pts = draft.current;
      if (p.shape === "rect" && (p.mode === "garden" || p.mode === "bed") && pts.length === 2) return renderDraft(undefined, rectFrom(pts[0], pts[1], ll));
      renderDraft(p.square && p.shape !== "rect" ? squareUp(pts, ll) : ll);
    });

    map.current = m;
    return () => m.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function finish() {
    // A double-click adds the same point twice; drop near-duplicates.
    const pts = draft.current.filter((p, i, a) => i === 0 || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > 1e-7);
    draft.current = [];
    renderDraft();
    if (pts.length >= 3) latest.current.onRingComplete(pts);
  }

  function renderDraft(cursor?: LngLat, preview?: LngLat[]) {
    const m = map.current;
    latest.current.onDraftChange(draft.current.length);
    if (!m || !ready.current) return;
    const pts = draft.current;
    const line = preview ? [...preview, preview[0]] : cursor ? [...pts, cursor] : pts;
    (m.getSource("draft") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: [
        ...pts.map((c) => ({ type: "Feature" as const, properties: {}, geometry: { type: "Point" as const, coordinates: c } })),
        ...(line.length > 1 ? [{ type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: line } }] : []),
      ],
    });
  }

  props.draftRef.current = {
    undo: () => { draft.current.pop(); renderDraft(); },
    clear: () => { draft.current = []; renderDraft(); },
    finish,
    count: () => draft.current.length,
  };

  // ---------- keep the map in step with props ----------
  function syncAll() {
    syncImagery();
    syncGarden();
    syncObjects();
    syncOverlay();
    syncBeds();
    syncSpots();
  }

  const spotMarkers = useRef<maplibregl.Marker[]>([]);
  function syncSpots() {
    const m = map.current;
    if (!m || !ready.current) return;
    spotMarkers.current.forEach((mk) => mk.remove());
    spotMarkers.current = [];
    const spots = props.spots ?? [];
    (m.getSource("spots") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: spots.map((s) => ({ type: "Feature" as const, properties: {}, geometry: { type: "Polygon" as const, coordinates: [closeRing(s.ring)] } })),
    });
    for (const s of spots) {
      const div = document.createElement("div");
      div.className = "spot-label";
      div.textContent = s.label;
      spotMarkers.current.push(new maplibregl.Marker({ element: div }).setLngLat(s.center).addTo(m));
    }
  }

  function syncBeds() {
    const m = map.current;
    if (!m || !ready.current) return;
    bedMarkers.current.forEach((mk) => mk.remove());
    bedMarkers.current = [];
    const beds = props.beds ?? [];
    (m.getSource("beds") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: beds.map((b) => ({ type: "Feature" as const, properties: { tone: b.tone }, geometry: { type: "Polygon" as const, coordinates: [closeRing(b.ring)] } })),
    });
    for (const b of beds) {
      const div = document.createElement("div");
      div.className = "bed-label";
      div.textContent = b.label;
      bedMarkers.current.push(new maplibregl.Marker({ element: div }).setLngLat(b.center).addTo(m));
    }
  }

  function syncImagery() {
    const m = map.current;
    if (!m || !ready.current) return;
    m.setLayoutProperty("usgs", "visibility", props.imagery === "usgs" ? "visible" : "none");
    m.setLayoutProperty("esri", "visibility", props.imagery === "esri" ? "visible" : "none");
  }

  function syncGarden() {
    const m = map.current;
    if (!m || !ready.current) return;
    labelMarkers.current.forEach((mk) => mk.remove());
    labelMarkers.current = [];
    const ring = props.garden;
    (m.getSource("garden") as GeoJSONSource).setData(
      ring ? { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [closeRing(ring)] } } : EMPTY,
    );
    if (!ring || props.showSides === false) return;
    for (const s of measure(ring).sides) {
      const div = document.createElement("div");
      div.className = "side-label";
      div.textContent = `${fmt(s.ft, s.ft < 20 ? 1 : 0)} ft`;
      labelMarkers.current.push(new maplibregl.Marker({ element: div }).setLngLat(s.mid).addTo(m));
    }
  }

  function syncObjects() {
    const m = map.current;
    if (!m || !ready.current) return;
    const features: GeoJSON.Feature[] = props.objects.map((o) => {
      if (o.type === "tree") {
        const r = (o.widthFt / 2) * 0.3048;
        const lat = o.at[1];
        const ring: LngLat[] = Array.from({ length: 33 }, (_, i) => {
          const a = (i / 32) * 2 * Math.PI;
          return [o.at[0] + (r * Math.cos(a)) / (111320 * Math.cos((lat * Math.PI) / 180)), lat + (r * Math.sin(a)) / 110574];
        });
        return { type: "Feature", properties: { kind: "tree" }, geometry: { type: "Polygon", coordinates: [ring] } };
      }
      return { type: "Feature", properties: { kind: o.type }, geometry: { type: "Polygon", coordinates: [closeRing(o.ring)] } };
    });
    (m.getSource("objects") as GeoJSONSource).setData({ type: "FeatureCollection", features });
  }

  function syncOverlay() {
    const m = map.current;
    if (!m || !ready.current) return;
    const src = m.getSource("shade") as ImageSource;
    if (props.overlay) src.updateImage({ url: props.overlay.url, coordinates: props.overlay.corners });
    m.setLayoutProperty("shade", "visibility", props.overlay && props.overlayVisible ? "visible" : "none");
  }

  useEffect(syncImagery, [props.imagery]);  
  useEffect(syncGarden, [props.garden, props.showSides]);  
  useEffect(syncObjects, [props.objects]);  
  useEffect(syncOverlay, [props.overlay, props.overlayVisible]);
  useEffect(syncBeds, [props.beds]);
  useEffect(syncSpots, [props.spots]);  

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const drawing = props.mode !== "idle";
    if (drawing) m.doubleClickZoom.disable();
    else m.doubleClickZoom.enable();
    m.getCanvas().style.cursor = drawing ? "crosshair" : "";
    draft.current = [];
    renderDraft();
  }, [props.mode]);  

  // ---------- edit an outline: drag corners, or drag the centre handle to move it all ----------
  const editMarkers = useRef<maplibregl.Marker[]>([]);
  useEffect(() => {
    const m = map.current;
    editMarkers.current.forEach((mk) => mk.remove());
    editMarkers.current = [];
    const ring = props.editRing;
    if (!m || !ring) return;
    let cur = [...ring];
    const show = (r: LngLat[]) => {
      if (!ready.current) return;
      (m.getSource("garden") as GeoJSONSource).setData({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [closeRing(r)] } });
    };
    const centroid = (r: LngLat[]): LngLat => [r.reduce((a, p) => a + p[0], 0) / r.length, r.reduce((a, p) => a + p[1], 0) / r.length];
    const corners = cur.map((pt, i) => {
      const div = document.createElement("div");
      div.className = "vertex-handle";
      div.setAttribute("aria-label", `Corner ${i + 1}`);
      const mk = new maplibregl.Marker({ element: div, draggable: true }).setLngLat(pt).addTo(m);
      mk.on("drag", () => { const ll = mk.getLngLat(); cur[i] = [ll.lng, ll.lat]; show(cur); mover.setLngLat(centroid(cur)); });
      mk.on("dragend", () => latest.current.onEditRing?.([...cur]));
      return mk;
    });
    const mdiv = document.createElement("div");
    mdiv.className = "move-handle";
    mdiv.title = "Drag to move the whole outline";
    mdiv.textContent = "✥";
    const mover = new maplibregl.Marker({ element: mdiv, draggable: true }).setLngLat(centroid(cur)).addTo(m);
    let start: LngLat = centroid(cur), base = cur;
    mover.on("dragstart", () => { start = centroid(cur); base = [...cur]; });
    mover.on("drag", () => {
      const ll = mover.getLngLat(), dx = ll.lng - start[0], dy = ll.lat - start[1];
      cur = base.map(([x, y]) => [x + dx, y + dy] as LngLat);
      cur.forEach((pt, i) => corners[i].setLngLat(pt));
      show(cur);
    });
    mover.on("dragend", () => latest.current.onEditRing?.([...cur]));
    editMarkers.current = [...corners, mover];
    return () => { editMarkers.current.forEach((mk) => mk.remove()); editMarkers.current = []; };
  }, [props.editRing]);

  useEffect(() => {
    const m = map.current, f = props.flyTo;
    if (!f || !m) return;
    const padding = { left: f.padLeft ?? 0, top: 0, right: 0, bottom: f.padBottom ?? 0 };
    // A long trip (like the first jump to an address) goes straight there, so the map doesn't
    // request imagery for every zoom level along the way.
    const c = m.getCenter();
    const far = m.getZoom() < 12 || Math.hypot(c.lng - f.center[0], c.lat - f.center[1]) > 0.05;
    if (far) m.jumpTo({ center: f.center, zoom: f.zoom, padding });
    else m.flyTo({ center: f.center, zoom: f.zoom, speed: 1.6, padding });
  }, [props.flyTo]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    pin.current?.remove();
    pin.current = props.marker ? new maplibregl.Marker({ color: "#b5654a", scale: 0.8 }).setLngLat(props.marker).addTo(m) : null;
  }, [props.marker]);

  return <div ref={el} className="map" />;
}

const transparentPng =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
