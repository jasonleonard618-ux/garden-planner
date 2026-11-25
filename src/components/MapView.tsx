"use client";

import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, ImageSource, Map as MLMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import { closeRing, fmt, measure } from "@/lib/geo";
import type { LngLat, SiteObject } from "@/lib/types";

export type DrawMode = "idle" | "garden" | "structure" | "clear" | "tree";

type Props = {
  flyTo: { center: LngLat; zoom: number; key: number } | null;
  imagery: "usgs" | "esri";
  garden: LngLat[] | null;
  objects: SiteObject[];
  overlay: { url: string; corners: [LngLat, LngLat, LngLat, LngLat] } | null;
  overlayVisible: boolean;
  marker: LngLat | null;
  mode: DrawMode;
  onRingComplete: (ring: LngLat[]) => void;
  onPoint: (p: LngLat) => void;
  draftRef: React.MutableRefObject<{ undo: () => void; finish: () => void; count: () => number } | null>;
  onDraftChange: (n: number) => void;
};

const SOURCES = {
  usgs:
    "https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPPlus/ImageServer/exportImage?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&format=jpgpng&f=image",
  esri: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
};

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

export default function MapView(props: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const ready = useRef(false);
  const draft = useRef<LngLat[]>([]);
  const labelMarkers = useRef<maplibregl.Marker[]>([]);
  const pin = useRef<maplibregl.Marker | null>(null);
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
          usgs: { type: "raster", tiles: [SOURCES.usgs], tileSize: 256, maxzoom: 20, attribution: "Imagery: USDA NAIP via USGS The National Map" },
          esri: { type: "raster", tiles: [SOURCES.esri], tileSize: 256, maxzoom: 19, attribution: "Imagery: Esri, Maxar, Earthstar Geographics" },
        },
        layers: [
          { id: "bg", type: "background", paint: { "background-color": "#dfe6dc" } },
          { id: "usgs", type: "raster", source: "usgs" },
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
      for (const id of ["garden", "objects", "draft"]) m.addSource(id, { type: "geojson", data: EMPTY });
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
      m.addLayer({ id: "draft-line", type: "line", source: "draft", filter: ["==", "$type", "LineString"], paint: { "line-color": "#ffe27a", "line-width": 2.5 } });
      m.addLayer({ id: "draft-pts", type: "circle", source: "draft", filter: ["==", "$type", "Point"], paint: { "circle-radius": 5, "circle-color": "#ffe27a", "circle-stroke-color": "#3b3b1a", "circle-stroke-width": 1.5 } });
      ready.current = true;
      syncAll();
    });

    m.on("click", (e) => {
      const p = latest.current;
      const ll: LngLat = [e.lngLat.lng, e.lngLat.lat];
      if (p.mode === "tree") return p.onPoint(ll);
      if (p.mode === "idle") return;
      const pts = draft.current;
      if (pts.length >= 3) {
        const first = m.project(pts[0]);
        if (Math.hypot(first.x - e.point.x, first.y - e.point.y) < 14) return finish();
      }
      pts.push(ll);
      renderDraft();
    });
    m.on("dblclick", (e) => {
      if (latest.current.mode !== "idle" && latest.current.mode !== "tree") {
        e.preventDefault();
        finish();
      }
    });
    m.on("mousemove", (e) => {
      if (latest.current.mode === "idle" || latest.current.mode === "tree" || !draft.current.length) return;
      renderDraft([e.lngLat.lng, e.lngLat.lat]);
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

  function renderDraft(cursor?: LngLat) {
    const m = map.current;
    latest.current.onDraftChange(draft.current.length);
    if (!m || !ready.current) return;
    const pts = draft.current;
    const line = cursor ? [...pts, cursor] : pts;
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
    finish,
    count: () => draft.current.length,
  };

  // ---------- keep the map in step with props ----------
  function syncAll() {
    syncImagery();
    syncGarden();
    syncObjects();
    syncOverlay();
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
    if (!ring) return;
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
  useEffect(syncGarden, [props.garden]);  
  useEffect(syncObjects, [props.objects]);  
  useEffect(syncOverlay, [props.overlay, props.overlayVisible]);  

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

  useEffect(() => {
    if (props.flyTo && map.current) map.current.flyTo({ center: props.flyTo.center, zoom: props.flyTo.zoom, speed: 1.6 });
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
