"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fmt, measure, ringBbox, ringCenter, slopeAdvice, terrainStats, toMerc, uid } from "@/lib/geo";
import { clockOffsetHours, dayWindow, gridCorners, lightAt, prepare, SEASON_DATES, sunColor } from "@/lib/shade";
import { deleteSite, downloadSite, listSites, readSiteFile, saveSite } from "@/lib/storage";
import type { BedKind, LngLat, MyBed, Place, Road, Season, SiteData, SiteObject, SiteProfile, SunStats, SurfaceGrid, Terrain, TerrainStats } from "@/lib/types";
import { LastYearStep, rectAt, RoadQuestion, YourBedsStep } from "./HaveSteps";
import { familyOf, FAMILY_LABEL, ROTATION_YEARS } from "@/data/families";
import type { DraftApi, DrawMode } from "./MapView";
import WindRose from "./WindRose";
import { Wordmark } from "./Logo";
import { Checklist, LocalNotes, Problems, Timeline, type ToolView } from "./GrowTools";
import { guideFor, type RegionGuide } from "@/data/regions";
import { BuildPlanSheets, type BuildChoices } from "./BuildPlan";
import { BuildStudio } from "./BuildStudio";
import { DEFAULT_GOALS, GoalsStep, type Goals } from "./GoalsStep";
import { sizeGarden } from "@/lib/sizing";
import { Feedback, listAccountPlans, saveToAccount, SignIn, useSession } from "./Account";
import { supabase, track } from "@/lib/supabase";
import { sunnierSpots } from "@/lib/bestspot";
import { bedsArea, bedSun, DEFAULT_BEDS, fitBeds, type BedFit, type BedOptions } from "@/lib/beds";
import { planBeds, type Square } from "@/lib/layout";
import { CROPS, cropFit, KIND_LABEL, PAIRINGS, plantsPerSquare, SOURCES, SUN_PRACTICAL, type Crop, type FitTag, type Kind } from "@/data/crops";

const MapView = dynamic(() => import("./MapView"), { ssr: false, loading: () => <div className="map map-loading" /> });

type Grid = SurfaceGrid & { fromLidar: boolean };
type Load<T> = { state: "idle" } | { state: "loading" } | { state: "error"; message: string } | { state: "done"; data: T };

const TOOL_LABEL: Record<ToolView, string> = { timeline: "Seed to harvest", problems: "What's wrong?", checklist: "Season checklist" };
const LABEL: Record<number, string> = { 0: "Address", 1: "Sun", 2: "Goals", 3: "Beds", 4: "Plants", 5: "Layout", 6: "Build", 7: "Grow", 8: "Save", 9: "Your beds", 10: "Last year" };
// Two roads: starting fresh (all steps), or already have beds (skips sizing and building; adds Your beds and Last year).
const ROADS: Record<Road, number[]> = { new: [0, 1, 2, 3, 4, 5, 6, 7, 8], have: [0, 9, 10, 4, 5, 7, 8] };
const SEASONS: Season[] = ["spring", "summer", "fall"];
const SEASON_SHORT: Record<Season, string> = { spring: "Spring", summer: "Summer", fall: "Late summer" };
const YEAR = new Date().getFullYear() + (new Date().getMonth() > 8 ? 1 : 0);

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Request failed (${r.status})`);
  return (await r.json()) as T;
}

/** When there is no lidar, fall back to bare ground so the person's own trees and buildings can still cast shade. */
async function groundOnlyGrid(center: LngLat): Promise<Grid> {
  const half = 80;
  const dLon = half / (111320 * Math.cos((center[1] * Math.PI) / 180));
  const dLat = half / 110574;
  const bbox = [center[0] - dLon, center[1] - dLat, center[0] + dLon, center[1] + dLat];
  const t = await getJson<Terrain>(`/api/terrain?bbox=${bbox.join(",")}&size=160`);
  const [x0, y0] = toMerc([bbox[0], bbox[1]]);
  const [x1, y1] = toMerc([bbox[2], bbox[3]]);
  return {
    available: true, fromLidar: false, project: "", year: 0, cell: (2 * half) / t.cols, cols: t.cols, rows: t.rows,
    bounds: [x0, y0, x1, y1], k: 1 / Math.cos((center[1] * Math.PI) / 180),
    surface: t.elevation, ground: t.elevation, kind: new Array(t.cols * t.rows).fill(0), classified: false,
  };
}

function gridCenter(g: Grid): LngLat {
  const x = (g.bounds[0] + g.bounds[2]) / 2, y = (g.bounds[1] + g.bounds[3]) / 2;
  return [(x / 6378137) * (180 / Math.PI), (2 * Math.atan(Math.exp(y / 6378137)) - Math.PI / 2) * (180 / Math.PI)];
}

function ringInsideGrid(ring: LngLat[], g: Grid, marginM = 25) {
  const m = marginM * g.k;
  return ring.every((p) => {
    const [x, y] = toMerc(p);
    return x > g.bounds[0] + m && x < g.bounds[2] - m && y > g.bounds[1] + m && y < g.bounds[3] - m;
  });
}

function pointInPoly(x: number, y: number, poly: [number, number][]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export default function GardenApp({ initialQuery }: { initialQuery?: string }) {
  // ---------- core state ----------
  const [place, setPlace] = useState<Place | null>(null);
  const [flyTo, setFlyTo] = useState<{ center: LngLat; zoom: number; key: number; padLeft?: number; padBottom?: number } | null>(null);
  const [garden, setGarden] = useState<LngLat[] | null>(null);
  const [objects, setObjects] = useState<SiteObject[]>([]);
  const [imagery, setImagery] = useState<"usgs" | "esri">("usgs");
  const [mode, setMode] = useState<DrawMode>("idle");
  const [draftCount, setDraftCount] = useState(0);
  const draftRef = useRef<DraftApi | null>(null);
  const [shape, setShape] = useState<"rect" | "free">("rect");
  const [square, setSquare] = useState(true);
  const [editing, setEditing] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const [site, setSite] = useState<Load<SiteData>>({ state: "idle" });
  const [grid, setGrid] = useState<Load<Grid>>({ state: "idle" });
  const [terrain, setTerrain] = useState<Load<Terrain>>({ state: "idle" });
  const [season, setSeason] = useState<Season>("summer");
  const [sun, setSun] = useState<{ key: string; hours: Float32Array } | null>(null);
  const [sunBusy, setSunBusy] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [sunBySeason, setSunBySeason] = useState<Partial<Record<Season, SunStats>>>({});

  const [profileId, setProfileId] = useState<string>(uid());
  const [profileName, setProfileName] = useState("");
  const [saved, setSaved] = useState<SiteProfile[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [road, setRoad] = useState<Road | null>(null);
  const [myBeds, setMyBeds] = useState<MyBed[]>([]);
  const [bedKind, setBedKind] = useState<BedKind>("raised");
  const [bedSize, setBedSize] = useState({ w: 4, l: 8 });
  const [editBed, setEditBed] = useState<string | null>(null);
  const [bedOpts, setBedOpts] = useState<BedOptions>(DEFAULT_BEDS);
  const [picks, setPicks] = useState<string[]>([]);
  const [goals, setGoals] = useState<Goals>(DEFAULT_GOALS);
  const [growTab, setGrowTab] = useState<ToolView>("timeline");
  const [view, setView] = useState<ToolView | null>(null);
  const [build, setBuild] = useState<BuildChoices>({ bed: "better", fence: "better", drip: true });
  const [sheets, setSheets] = useState(false);
  const session = useSession();
  const [cloud, setCloud] = useState<SiteProfile[]>([]);
  useEffect(() => { if (session) listAccountPlans().then(setCloud).catch(() => {}); else setCloud([]); }, [session]);
  useEffect(() => { track("step_reached", String(step + 1)); }, [step]);
  useEffect(() => { if (view) track("tool_opened", view); }, [view]);
  useEffect(() => { if (sheets) track("build_plan_opened"); }, [sheets]);
  const [kindFilter, setKindFilter] = useState<Kind | "all">("all");
  const panelRef = useRef<HTMLElement>(null);

  const [treeForm, setTreeForm] = useState({ heightFt: 30, widthFt: 20, leaves: "deciduous" as "deciduous" | "evergreen" });
  const [structForm, setStructForm] = useState({ heightFt: 6, label: "Fence" });

  useEffect(() => setSaved(listSites()), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  // ---------- choosing a location ----------
  const choosePlace = useCallback((p: Place, keep?: { garden: LngLat[] | null; objects: SiteObject[] }) => {
    setPlace(p);
    setFlyTo({ center: keep?.garden ? ringCenter(keep.garden) : [p.lon, p.lat], zoom: 19, key: Date.now() });
    setGarden(keep?.garden ?? null);
    setObjects(keep?.objects ?? []);
    setSun(null);
    setSunBySeason({});
    setTerrain({ state: "idle" });
    setMode("idle");
    setProfileName((n) => (keep ? n : p.label.split(",")[0]));
    setSite({ state: "loading" });
    getJson<SiteData>(`/api/site?lat=${p.lat}&lon=${p.lon}`)
      .then((d) => setSite({ state: "done", data: d }))
      .catch((e) => setSite({ state: "error", message: String(e.message ?? e) }));
    loadGrid(keep?.garden ? ringCenter(keep.garden) : [p.lon, p.lat]);
  }, []);  

  const gridReq = useRef(0);
  function loadGrid(center: LngLat) {
    const req = ++gridReq.current;
    setGrid({ state: "loading" });
    setSun(null);
    getJson<SurfaceGrid | { available: false }>(`/api/surface?lat=${center[1]}&lon=${center[0]}`)
      .then(async (d) => (d.available ? ({ ...d, fromLidar: true } as Grid) : await groundOnlyGrid(center)))
      .then((g) => req === gridReq.current && setGrid({ state: "done", data: g }))
      .catch((e) => req === gridReq.current && setGrid({ state: "error", message: String(e.message ?? e) }));
  }

  // ---------- drawing ----------
  const onRingComplete = (ring: LngLat[]) => {
    if (mode === "bed") {
      setMyBeds((b) => [...b, { id: uid(), n: b.length + 1, ring, center: ringCenter(ring), kind: bedKind, history: {} }]);
    } else if (mode === "garden") {
      setGarden(ring);
      setSunBySeason({});
    } else if (mode === "structure") {
      setObjects((o) => [...o, { id: uid(), type: "structure", ring, heightFt: structForm.heightFt, label: structForm.label || "Structure" }]);
    } else if (mode === "clear") {
      setObjects((o) => [...o, { id: uid(), type: "clear", ring }]);
    }
    setMode("idle");
  };
  const onPoint = (p: LngLat) => {
    if (mode === "pin") {
      setProfileId(uid());
      choosePlace({ label: `Dropped pin, ${p[1].toFixed(5)}, ${p[0].toFixed(5)}`, lat: p[1], lon: p[0] });
      return;
    }
    if (mode === "bedpoint") {
      const ring = rectAt(p, bedSize.w, bedSize.l);
      setMyBeds((b) => [...b, { id: uid(), n: b.length + 1, ring, center: p, kind: bedKind, history: {} }]);
      setMode("idle");
      return;
    }
    if (mode !== "tree") return;
    setObjects((o) => [...o, { id: uid(), type: "tree", at: p, ...treeForm }]);
    setMode("idle");
  };

  const measured = useMemo(() => (garden ? measure(garden) : null), [garden]);

  // Garden drawn: get terrain for it, and re-centre the shade grid if needed.
  useEffect(() => {
    if (!garden) return;
    setTerrain({ state: "loading" });
    getJson<Terrain>(`/api/terrain?bbox=${ringBbox(garden).join(",")}`)
      .then((t) => setTerrain({ state: "done", data: t }))
      .catch((e) => setTerrain({ state: "error", message: String(e.message ?? e) }));
    if (grid.state === "done" && !ringInsideGrid(garden, grid.data)) loadGrid(ringCenter(garden));
  }, [garden]); // eslint-disable-line react-hooks/exhaustive-deps

  const tStats: TerrainStats | null = useMemo(
    () => (garden && terrain.state === "done" ? terrainStats(terrain.data, garden) : null),
    [garden, terrain],
  );

  // ---------- sun hours (web worker) ----------
  const worker = useRef<Worker | null>(null);
  const jobId = useRef(0);
  useEffect(() => {
    worker.current = new Worker(new URL("../lib/shade.worker.ts", import.meta.url));
    return () => worker.current?.terminate();
  }, []);

  const sunKey = grid.state === "done" ? `${grid.data.bounds.join()}|${season}|${JSON.stringify(objects)}` : "";
  useEffect(() => {
    if (grid.state !== "done" || !worker.current || !place) return;
    const id = ++jobId.current;
    setSunBusy(true);
    const g = grid.data;
    const c = gridCenter(g);
    worker.current.onmessage = (e: MessageEvent<{ id: number; hours?: Float32Array; error?: string }>) => {
      if (e.data.id !== jobId.current) return;
      setSunBusy(false);
      if (e.data.hours) setSun({ key: sunKey, hours: e.data.hours });
      else setToast("Couldn't work out sun hours: " + e.data.error);
    };
    worker.current.postMessage({
      id,
      input: {
        grid: { cols: g.cols, rows: g.rows, bounds: g.bounds, cell: g.cell, surface: g.surface, ground: g.ground, kind: g.kind },
        objects, lat: c[1], lon: c[0], season, year: YEAR,
      },
    });
  }, [sunKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const overlay = useMemo(() => {
    if (!sun || grid.state !== "done") return null;
    const g = grid.data;
    const canvas = document.createElement("canvas");
    canvas.width = g.cols;
    canvas.height = g.rows;
    const ctx = canvas.getContext("2d")!;
    const img = ctx.createImageData(g.cols, g.rows);
    sun.hours.forEach((h, i) => img.data.set(sunColor(h), i * 4));
    ctx.putImageData(img, 0, 0);
    return { url: canvas.toDataURL(), corners: gridCorners(g.bounds) };
  }, [sun, grid]);

  // ---------- sun study: shadows at one moment, with a time slider ----------
  const [study, setStudy] = useState(false);
  const [studyMin, setStudyMin] = useState<number | null>(null); // minutes after sunrise
  const [playing, setPlaying] = useState(false);
  const prepared = useMemo(() => {
    if (!study || grid.state !== "done") return null;
    const g = grid.data;
    return prepare({ grid: { cols: g.cols, rows: g.rows, bounds: g.bounds, cell: g.cell, surface: g.surface, ground: g.ground, kind: g.kind }, objects });
  }, [study, grid, objects]);
  const win = useMemo(() => {
    if (grid.state !== "done") return null;
    const c = gridCenter(grid.data);
    const w = dayWindow(season, YEAR, c[1], c[0]);
    if (!w.rise || !w.set) return null;
    return { rise: w.rise.getTime(), span: Math.round((w.set.getTime() - w.rise.getTime()) / 60000), lat: c[1], lon: c[0] };
  }, [grid, season]);
  const minute = win ? Math.min(win.span, studyMin ?? Math.round(win.span * 0.62)) : 0;
  useEffect(() => {
    if (!playing || !win) return;
    const t = setInterval(() => setStudyMin((m) => { const v = (m ?? Math.round(win.span * 0.62)) + 8; return v > win.span ? 0 : v; }), 110);
    return () => clearInterval(t);
  }, [playing, win]);
  const studyShot = useMemo(() => {
    if (!study || !prepared || !win || grid.state !== "done") return null;
    const g = grid.data;
    const light = lightAt(prepared, new Date(win.rise + minute * 60000), win.lat, win.lon, SEASON_DATES[season].leafOff);
    const canvas = document.createElement("canvas");
    canvas.width = g.cols; canvas.height = g.rows;
    const ctx = canvas.getContext("2d")!;
    const img = ctx.createImageData(g.cols, g.rows);
    let lit = 0, n = 0;
    const poly = garden ? garden.map(toMerc) : null;
    const step = (g.bounds[2] - g.bounds[0]) / g.cols;
    for (let i = 0; i < g.cols * g.rows; i++) {
      const v = light ? light[i] : 0;
      img.data.set(v >= 0.99 ? [255, 200, 120, 26] : [6, 24, 34, Math.round(150 * (1 - v)) + 20], i * 4);
      if (poly) {
        const r = Math.floor(i / g.cols), c = i % g.cols;
        if (pointInPoly(g.bounds[0] + (c + 0.5) * step, g.bounds[3] - (r + 0.5) * step, poly)) { n++; lit += v; }
      }
    }
    ctx.putImageData(img, 0, 0);
    // soften the 1 m cells so shadow edges read as shadows, not pixels
    const K = 4, big = document.createElement("canvas");
    big.width = g.cols * K; big.height = g.rows * K;
    const bx = big.getContext("2d")!;
    bx.imageSmoothingEnabled = true; bx.filter = `blur(${K * 0.6}px)`;
    bx.drawImage(canvas, 0, 0, big.width, big.height);
    const clock = new Date(win.rise + minute * 60000 + clockOffsetHours(win.lon) * 3600000);
    const h = clock.getUTCHours(), mm = clock.getUTCMinutes();
    return {
      overlay: { url: big.toDataURL(), corners: gridCorners(g.bounds) },
      litPct: n ? Math.round((lit / n) * 100) : null,
      time: `${((h + 11) % 12) + 1}:${String(mm).padStart(2, "0")}`, ampm: h < 12 ? "AM" : "PM",
    };
  }, [study, prepared, win, minute, grid, garden, season]);

  const sunStats: SunStats | null = useMemo(() => {
    if (!sun || !garden || grid.state !== "done") return null;
    const g = grid.data;
    const poly = garden.map(toMerc);
    const step = (g.bounds[2] - g.bounds[0]) / g.cols;
    let n = 0, sum = 0, full = 0, part = 0, shade = 0;
    for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) {
      if (!pointInPoly(g.bounds[0] + (c + 0.5) * step, g.bounds[3] - (r + 0.5) * step, poly)) continue;
      const h = sun.hours[r * g.cols + c];
      n++; sum += h;
      if (h >= 6) full++; else if (h >= 4) part++; else shade++;
    }
    if (!n) return null;
    return { avgHours: sum / n, full: (full / n) * 100, part: (part / n) * 100, shade: (shade / n) * 100 };
  }, [sun, garden, grid]);

  useEffect(() => {
    if (sunStats) setSunBySeason((s) => ({ ...s, [season]: sunStats }));
  }, [sunStats]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- sunnier spots nearby (sun step) ----------
  const spotResult = useMemo(() => {
    if (step !== 1 || !sun || !garden || grid.state !== "done" || sun.key !== sunKey || !place || !sunStats) return null;
    // Already mostly full sun: nothing worth moving for.
    if (sunStats.full >= 80) return { current: sunStats.avgHours, spots: [], fullSun: true };
    return { ...sunnierSpots(grid.data, objects, place.lat, place.lon, sun.hours, garden, { radiusM: 20, max: 3 }) ?? { current: sunStats.avgHours, spots: [] }, fullSun: false };
  }, [step, sun, garden, grid, sunKey, objects, place, sunStats]);
  const mapSpots = useMemo(() => (editing || !spotResult ? [] : spotResult.spots.map((s) => ({ ...s, label: `${s.id} · ${fmt(s.avg, 1)} hrs` }))), [spotResult, editing]);

  // ---------- beds, plants, layout ----------
  const fitAll = useMemo(() => (garden ? fitBeds(garden, bedOpts) : null), [garden, bedOpts]);
  const allCols = useMemo(() => (garden ? fitBeds(garden, { ...bedOpts, walkways: [] }) : null), [garden, bedOpts]);
  const allSuns = useMemo(() => {
    if (!fitAll || !sun || grid.state !== "done" || sun.key !== sunKey) return null;
    return fitAll.beds.map((b) => bedSun(b, sun.hours, grid.data));
  }, [fitAll, sun, grid, sunKey]);
  // How much garden the household needs (step 3), and the sunniest beds that cover it.
  const size = useMemo(() => sizeGarden(picks, goals.people, goals.use), [picks, goals.people, goals.use]);
  const wantBeds = goals.fill || !picks.length ? Infinity : goals.beds ?? size.recommended;
  const { fit, bedSuns } = useMemo(() => {
    if (!fitAll || wantBeds >= fitAll.beds.length) return { fit: fitAll, bedSuns: allSuns };
    const keep = pickBeds(fitAll.beds, allSuns, wantBeds);
    return {
      fit: { ...fitAll, beds: keep.map((i, k) => ({ ...fitAll.beds[i], n: k + 1 })) },
      bedSuns: allSuns ? keep.map((i) => allSuns[i]) : null,
    };
  }, [fitAll, allSuns, wantBeds]);
  // When only some of the beds that fit are built, the fence and drip wrap just those beds.
  const area = useMemo(() => {
    if (!garden || !fit || !fitAll || fit.beds.length >= fitAll.beds.length || !fit.beds.length) return garden;
    return bedsArea(fit.beds, fit.angle, bedOpts.edgeFt ?? 1.5);
  }, [garden, fit, fitAll, bedOpts.edgeFt]);
  const bedRows = useMemo(() => (fit ? fit.beds.map((b, i) => ({ n: b.n, sun: bedSuns?.[i] ?? null })) : []), [fit, bedSuns]);
  const bestSun = bedSuns?.length ? Math.max(...bedSuns.map((h) => h ?? 0)) : sunStats?.avgHours ?? null;
  const frost = site.state === "done" ? site.data.frost ?? null : null;
  const siteState = site.state === "done" ? site.data.state ?? null : null;
  // ---------- returning gardener road: the beds they already have ----------
  const have = road === "have";
  const mySuns = useMemo(() => {
    if (!have || !sun || grid.state !== "done" || sun.key !== sunKey) return null;
    return myBeds.map((b) => bedSun(b, sun.hours, grid.data));
  }, [have, myBeds, sun, grid, sunKey]);
  // Perennial patches stay as they are, so only the other beds are planned.
  const annual = useMemo(() => myBeds.map((b, i) => ({ b, h: mySuns?.[i] ?? null })).filter((x) => x.b.kind !== "perennial"), [myBeds, mySuns]);
  const haveRows = useMemo(() => annual.map((x) => ({ n: x.b.n, sun: x.h })), [annual]);
  // Families grown in each bed over the last few years.
  const recent = useMemo(() => {
    const out = new Map<number, Map<string, number>>(); // bed n -> family -> latest year
    for (const b of myBeds) {
      const m = new Map<string, number>();
      for (const [y, crops] of Object.entries(b.history)) {
        const yr = +y;
        if (yr >= YEAR || yr < YEAR - ROTATION_YEARS) continue;
        for (const id of crops) { const f = familyOf(id); if (f && (m.get(f) ?? 0) < yr) m.set(f, yr); }
      }
      out.set(b.n, m);
    }
    return out;
  }, [myBeds]);
  const plan = useMemo(() => have
    ? planBeds(haveRows, picks, { avoid: (n, c) => { const f = familyOf(c.id); return !c.perennial && !!f && !!recent.get(n)?.has(f); } })
    : planBeds(bedRows, picks), [have, haveRows, bedRows, picks, recent]);
  const plantSuns = have ? annual.map((x) => x.h) : bedSuns;
  const plantBest = have ? (plantSuns?.length ? Math.max(...plantSuns.map((h) => h ?? 0)) : null) : bestSun;
  const lastYearByBed = useMemo(() => {
    if (!have) return null;
    const m = new Map<number, string>();
    for (const b of myBeds) {
      const fams = [...(recent.get(b.n)?.entries() ?? [])].sort((a, z) => z[1] - a[1]).map(([f, y]) => `${FAMILY_LABEL[f as keyof typeof FAMILY_LABEL]} ${y}`);
      if (fams.length) m.set(b.n, fams.join(", "));
    }
    return m;
  }, [have, myBeds, recent]);
  // Frame the garden in the map area beside the panel when moving past step 1.
  const framed = useRef<string>("");
  useEffect(() => {
    if (!garden || step < 1) return;
    const key = JSON.stringify([garden, mapSpots.map((m) => m.id + m.center.join())]);
    if (framed.current === key) return;
    framed.current = key;
    // Include any suggested spots so they're on screen too.
    const pts = [...garden, ...mapSpots.flatMap((m) => m.ring)];
    const lat = ringCenter(garden)[1];
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const wM = Math.max((Math.max(...xs) - Math.min(...xs)) * 111320 * Math.cos((lat * Math.PI) / 180), (Math.max(...ys) - Math.min(...ys)) * 110574, 5);
    const phone = window.innerWidth <= 760;
    const target = mapSpots.length ? (phone ? 300 : 620) : phone ? 200 : 360; // width on screen, px
    const zoom = Math.max(17, Math.min(20, Math.log2((156543.03 * Math.cos((lat * Math.PI) / 180) * target) / wM)));
    const center: LngLat = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
    setFlyTo({ center: mapSpots.length ? center : ringCenter(garden), zoom, key: Date.now(), padLeft: phone ? 0 : 440, padBottom: phone ? Math.round(window.innerHeight * 0.56) : 0 });
  }, [garden, step, mapSpots]);

  const mapBeds = useMemo(() => {
    if (have) {
      if (![9, 10, 4, 5].includes(step)) return [];
      return myBeds.flatMap((b, i) => {
        if (step === 9 && b.id === editBed) return [];
        const h = mySuns?.[i];
        const sq = plan.beds.find((x) => x.n === b.n);
        const low = h != null && (step === 5 && sq ? sq.north.lowSun || sq.south.lowSun : b.kind !== "perennial" && h < 6);
        return [{ n: b.n, ring: b.ring, center: b.center, label: `${b.n}`, tone: (b.kind === "perennial" ? "walk" : low ? "low" : "ok") as "ok" | "low" | "walk" }];
      });
    }
    if (!fit || step < 2 || step > 6) return [];
    return fit.beds.map((b, i) => {
      const h = bedSuns?.[i];
      const sq = plan.beds[i];
      const low = h != null && (step >= 5 && sq ? sq.north.lowSun || sq.south.lowSun : h < 6);
      return { n: b.n, ring: b.ring, center: b.center, label: `${b.n}`, tone: (low ? "low" : "ok") as "ok" | "low" };
    });
  }, [have, myBeds, mySuns, fit, bedSuns, plan, step, editBed]);

  // ---------- saving ----------
  const buildProfile = (): SiteProfile | null =>
    place && {
      id: profileId,
      name: profileName.trim() || place.label.split(",")[0],
      savedAt: new Date().toISOString(),
      place, garden, objects, imagery,
      beds: bedOpts, picks, build, goals,
      road: road ?? undefined,
      // Record this year's plan in each bed's history, so next year's rotation fills in by itself.
      myBeds: have ? myBeds.map((b) => {
        const sq = plan.beds.find((x) => x.n === b.n);
        const crops = sq ? [...new Set([sq.north.crop?.id, sq.south.crop?.id].filter(Boolean) as string[])] : [];
        return crops.length ? { ...b, history: { ...b.history, [String(YEAR)]: crops } } : b;
      }) : myBeds.length ? myBeds : undefined,
      summary: {
        areaSqFt: measured?.areaSqFt,
        perimeterFt: measured?.perimeterFt,
        terrain: tStats,
        sun: sunBySeason,
        site: site.state === "done" ? site.data : null,
      },
    };

  const onSave = async () => {
    const p = buildProfile();
    if (!p) return;
    saveSite(p);
    setSaved(listSites());
    if (session) {
      try {
        await saveToAccount(p, session.user.id);
        setCloud(await listAccountPlans());
        setToast(`Saved “${p.name}” to your account`);
      } catch {
        setToast(`Saved “${p.name}” in this browser. Your account didn't respond, so try again later.`);
      }
    } else {
      track("plan_saved", "browser");
      setToast(`Saved “${p.name}” in this browser`);
    }
  };
  const onOpen = (p: SiteProfile) => {
    setProfileId(p.id);
    setProfileName(p.name);
    setImagery(p.imagery ?? "usgs");
    setBedOpts({ ...DEFAULT_BEDS, ...(p.beds ?? {}) });
    setPicks(p.picks ?? []);
    setGoals({ ...DEFAULT_GOALS, ...(p.goals ?? {}) });
    if (p.build) setBuild(p.build as BuildChoices);
    choosePlace(p.place, { garden: p.garden, objects: p.objects ?? [] });
    const r: Road | null = p.road ?? (p.garden ? "new" : null);
    setRoad(r);
    setMyBeds(p.myBeds ?? []);
    setStep(r === "have" ? 9 : p.garden ? 1 : 0);
  };
  const fileInput = useRef<HTMLInputElement>(null);

  const drawing = mode !== "idle";
  // On phones, tuck the panel away while drawing or adjusting so the map has room; bring it back after.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia("(max-width: 760px)").matches) return;
    setCollapsed(drawing || editing);
  }, [drawing, editing]);
  const rectMode = (mode === "garden" || mode === "bed") && shape === "rect";
  const s = site.state === "done" ? site.data : null;
  const mainSoil = s?.soil?.components.find((c) => c.texture) ?? s?.soil?.components[0];

  const steps = ROADS[road ?? "new"];
  const pos = Math.max(0, steps.indexOf(step));
  const hasBeds = myBeds.length > 0;
  const reachedNew = [true, !!garden, !!garden, !!garden, !!garden, !!garden, !!garden, true, !!place];
  const reachedOf = (i: number) => have ? ({ 0: true, 9: !!place, 10: hasBeds, 4: hasBeds, 5: hasBeds, 7: true, 8: !!place } as Record<number, boolean>)[i] ?? false : reachedNew[i] ?? false;
  const show = (i: number) => { setView(null); setEditBed(null); setStep(i); setMode("idle"); setEditing(false); panelRef.current?.scrollTo({ top: 0 }); };
  const go = (i: number) => { if (reachedOf(i)) show(i); };
  const nextStep = steps[pos + 1];
  const nextOk = nextStep != null && reachedOf(nextStep);
  // Zoom in close enough to trace a 4 ft bed when the returning gardener starts tracing.
  const toBeds = () => {
    show(9);
    if (place && !myBeds.length) {
      const phone = window.innerWidth <= 760;
      setFlyTo({ center: [place.lon, place.lat], zoom: 20.5, key: Date.now(), padLeft: phone ? 0 : 440, padBottom: phone ? Math.round(window.innerHeight * 0.56) : 0 });
    }
  };
  const pickRoad = (r: Road) => { setRoad(r); track("road_picked", r); if (r === "have") toBeds(); };

  return (
    <div className="app">
      <header className="topbar">
        <Link className="brand" href="/?intro=0" aria-label="Light & Loam home">
          <Wordmark />
        </Link>
        <nav className="stepbar" aria-label="Steps">
          <ol>
            {steps.map((i, k) => (
              <li key={LABEL[i]}>
                <button
                  className={`step${i === step ? " on" : ""}${k < pos && reachedOf(i) ? " done" : ""}`}
                  onClick={() => go(i)}
                  disabled={!reachedOf(i)}
                  aria-current={i === step ? "step" : undefined}
                >
                  <span className="step-n">{k < pos && reachedOf(i) ? "✓" : k + 1}</span>
                  <span className="step-l">{LABEL[i]}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <span className="step-mobile">{view ? TOOL_LABEL[view] : `Step ${pos + 1} of ${steps.length} · ${LABEL[step]}`}</span>
        <Feedback step={view ?? LABEL[step]} />
      </header>

      <main className="mapwrap">
        <MapView
          flyTo={flyTo}
          imagery={imagery}
          garden={garden}
          objects={objects}
          overlay={study && step === 1 && studyShot ? studyShot.overlay : overlay}
          overlayVisible={(study && step === 1 && !!studyShot) || (overlayVisible && (step === 1 || step === 3))}
          marker={place && !garden ? [place.lon, place.lat] : null}
          mode={mode}
          onRingComplete={onRingComplete}
          onPoint={onPoint}
          draftRef={draftRef}
          onDraftChange={setDraftCount}
          shape={shape}
          square={square}
          editRing={editing && step <= 1 ? garden : step === 9 && editBed ? myBeds.find((b) => b.id === editBed)?.ring ?? null : null}
          editRigid={step === 9 && !!editBed}
          spots={mapSpots}
          onEditRing={(r) => {
            if (step === 9 && editBed) { setMyBeds((all) => all.map((b) => (b.id === editBed ? { ...b, ring: r, center: ringCenter(r) } : b))); return; }
            setGarden(r); setSunBySeason({});
          }}
          beds={mapBeds}
          showSides={step < 1 || (step === 1 && !mapSpots.length)}
        />
        <div className="map-ui top-right">
          <div className="seg glass">
            <button className={imagery === "usgs" ? "on" : ""} onClick={() => setImagery("usgs")}>USGS aerial</button>
            <button className={imagery === "esri" ? "on" : ""} onClick={() => setImagery("esri")}>Esri satellite</button>
          </div>
        </div>
        {study && step === 1 && studyShot && win && (
          <div className="map-ui study-bar glass"><StudyBar shot={studyShot} minute={minute} span={win.span} setMinute={(m) => { setPlaying(false); setStudyMin(m); }} playing={playing} setPlaying={setPlaying} riseLabel={clockLabel(win.rise, win.lon)} setLabel={clockLabel(win.rise + win.span * 60000, win.lon)} /></div>
        )}
        {overlay && overlayVisible && !(study && step === 1) && (step === 1 || step === 3) && (
          <div className="map-ui bottom-right legend glass">
            <span>Direct sun, {SEASON_SHORT[season].toLowerCase()}</span>
            <div className="ramp" />
            <div className="ramp-labels"><span>0</span><span>2</span><span>4</span><span>6</span><span>8+ hrs</span></div>
          </div>
        )}
        {drawing && (
          <div className="map-ui top-center hint">
            {mode === "pin" ? "Tap your yard" : mode === "tree" ? "Tap the centre of the tree" : mode === "bedpoint" ? "Tap the middle of the bed"
              : rectMode ? [mode === "bed" ? "Tap one corner of the bed" : "Tap one corner of the garden", "Tap the next corner along the same side", "Tap the opposite side to set the depth"][Math.min(draftCount, 2)]
              : draftCount < 3 ? "Tap each corner" : "Tap the first point or press Finish to close the shape"}
          </div>
        )}
        {(mode === "garden" || mode === "bed" || mode === "structure" || mode === "clear") && (
          <div className="map-ui draw-bar glass" role="toolbar" aria-label="Drawing tools">
            <button className="btn" disabled={draftCount < 1} onClick={() => draftRef.current?.undo()}>↶ Undo</button>
            <button className="btn" disabled={draftCount < 1} onClick={() => draftRef.current?.clear()}>Erase</button>
            {!rectMode && <button className="btn primary" disabled={draftCount < 3} onClick={() => draftRef.current?.finish()}>Finish</button>}
            <button className="btn ghost" onClick={() => setMode("idle")}>Cancel</button>
          </div>
        )}
        {editing && step <= 1 && (
          <div className="map-ui draw-bar glass" role="toolbar" aria-label="Adjust outline">
            <span className="small">Drag a corner, or drag ✥ to move the whole outline.</span>
            <button className="btn primary" onClick={() => setEditing(false)}>Done</button>
          </div>
        )}
        {toast && <div className="toast" role="status">{toast}</div>}
      </main>

      <aside className={`panel glass${view || step === 7 ? " wide" : ""}${collapsed ? " collapsed" : ""}`} ref={panelRef}>
        <button className="sheet-handle" aria-expanded={!collapsed} aria-label={collapsed ? "Show the panel" : "Hide the panel to see more map"} onClick={() => setCollapsed((c) => !c)}>
          <span aria-hidden /> {collapsed ? "Show" : "Hide"}
        </button>
        {view ? (
          <>
            <p className="eyebrow">Grow tools · {TOOL_LABEL[view]}</p>
            {view === "timeline" && <Timeline picks={picks} frost={frost} state={siteState} onPick={() => go(garden ? 4 : 0)} />}
            {view === "problems" && <Problems />}
            {view === "checklist" && <Checklist frost={frost} />}
            <div className="stepnav">
              <button className="btn ghost" onClick={() => setView(null)}>← Back to step {pos + 1}: {LABEL[step]}</button>
              <span />
            </div>
          </>
        ) : (<>
        <p className="eyebrow">Step {pos + 1} · {LABEL[step]}</p>

        {step === 0 && (
          <>
            <h1 className="title">{!place ? "Find your yard" : road === "new" ? "Outline your garden" : have ? "Your yard is found" : "Found it"}</h1>
            <p className="lede">
              {place
                ? road === "new" ? "Trace the area you want to plant. Tap each corner on the map." : have ? "Next you'll trace the beds you already grow in." : "We're pulling up the sun and soil for this spot while you answer."
                : "Type your address. We'll pull up a photo of your yard from above and measure the sun it gets."}
            </p>
            <AddressSearch initial={initialQuery} onPick={(p) => { setProfileId(uid()); setRoad(null); setMyBeds([]); choosePlace(p); }} onDropPin={() => setMode("pin")} />
            {mode === "pin" && <div className="draw-help"><p>Tap your yard on the map. Zoom in first if you need to.</p><button className="btn ghost" onClick={() => setMode("idle")}>Cancel</button></div>}
            {place && <p className="muted small place">{place.label}</p>}
            {place && !garden && !road && mode !== "pin" && <RoadQuestion onPick={pickRoad} />}
            {place && have && (
              <div className="road-note">
                <p className="small">You already grow here, so we&apos;ll skip sizing and building. Next, trace the beds you have.</p>
                <div className="row">
                  <button className="btn primary" onClick={toBeds}>Trace my beds</button>
                  <button className="link" onClick={() => setRoad("new")}>Switch to starting fresh</button>
                </div>
              </div>
            )}
            {place && !garden && road === "new" && mode !== "garden" && (
              <>
                <button className="btn primary" onClick={() => setMode("garden")}>Draw garden outline</button>
                <p className="muted small">Already have beds? <button className="link" onClick={() => pickRoad("have")}>Plan the beds you have</button></p>
              </>
            )}
            {mode === "garden" && <ShapePicker shape={shape} setShape={(v) => { setShape(v); draftRef.current?.clear(); }} square={square} setSquare={setSquare} />}
            {garden && measured && mode !== "garden" && (
              <>
                <div className="stats">
                  <Stat label="Area" value={`${fmt(measured.areaSqFt)} sq ft`} />
                  <Stat label="Edge length" value={`${fmt(measured.perimeterFt)} ft`} />
                </div>
                <p className="muted small">Side lengths are shown on the map.</p>
                <div className="row">
                  <button className={editing ? "btn primary" : "btn"} onClick={() => setEditing((e) => !e)}>{editing ? "Done adjusting" : "Adjust shape"}</button>
                  <button className="btn" onClick={() => { setEditing(false); setMode("garden"); }}>Redraw</button>
                  <button className="btn ghost" onClick={() => { setEditing(false); setGarden(null); setTerrain({ state: "idle" }); }}>Delete outline</button>
                </div>
              </>
            )}
            {!place && saved.length > 0 && (
              <section className="saved">
                <h2>Pick up where you left off</h2>
                <ul>
                  {saved.map((p) => (
                    <li key={p.id}>
                      <button className="link strong" onClick={() => onOpen(p)}>{p.name}</button>
                      <span className="muted small">{new Date(p.savedAt).toLocaleDateString()}</span>
                      <button className="link" onClick={() => { deleteSite(p.id); setSaved(listSites()); }}>Delete</button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {!place && (
              <div className="footer-actions">
                <button className="link" onClick={() => fileInput.current?.click()}>Open a downloaded plan file</button>
              </div>
            )}
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="title">How much sun it gets</h1>
            <p className="lede">Trees and buildings around you are measured from a government height survey, then we trace the sun across a whole day.</p>
            <div className="tabs" role="tablist" aria-label="Season">
              {SEASONS.map((k) => (
                <button key={k} role="tab" aria-selected={season === k} className={season === k ? "tab on" : "tab"} onClick={() => setSeason(k)}>
                  {SEASON_SHORT[k]}
                </button>
              ))}
            </div>
            <p className="muted small">{SEASON_DATES[season].label}</p>
            {grid.state === "done" && win && (
              <div className={study ? "study-card on" : "study-card"}>
                <div className="study-head">
                  <span><b>Sun study</b><small>Watch the shadows move across your yard, hour by hour.</small></span>
                  <button className={study ? "btn" : "btn primary"} onClick={() => { setStudy((v) => !v); setPlaying(!study); }}>{study ? "Show sun hours" : "▶ Watch the light move"}</button>
                </div>
                {study && studyShot && <div className="study-inline"><StudyBar shot={studyShot} minute={minute} span={win.span} setMinute={(m) => { setPlaying(false); setStudyMin(m); }} playing={playing} setPlaying={setPlaying} riseLabel={clockLabel(win.rise, win.lon)} setLabel={clockLabel(win.rise + win.span * 60000, win.lon)} /></div>}
                {study && <p className="muted small">Shadows come from the measured height of every roof and tree. Times are clock time with daylight saving.</p>}
              </div>
            )}
            {grid.state === "loading" && <Busy text="Measuring trees and buildings near you…" />}
            {(grid.state === "loading" || (grid.state === "done" && sunBusy)) && <p className="muted small">This takes 10 to 30 seconds. We read the government height survey for your block, then trace the sun every few minutes from sunrise to sunset.</p>}
            {grid.state === "error" && <p className="warn">Couldn&apos;t load height data ({grid.message}). <button className="link" onClick={() => place && loadGrid(garden ? ringCenter(garden) : [place.lon, place.lat])}>Try again</button></p>}
            {grid.state === "done" && sunBusy && <Busy text="Tracing the sun across your yard…" />}
            {grid.state === "done" && !grid.data.fromLidar && (
              <p className="warn">No height survey covers this spot yet, so trees and buildings aren&apos;t included automatically. Add them under &ldquo;Fix what the data missed&rdquo; and the map will update.</p>
            )}
            {sunStats && (
              <>
                <div className="stats">
                  <Stat label="Average direct sun" value={`${fmt(sunStats.avgHours, 1)} hrs/day`} />
                </div>
                <SunBar stats={sunStats} />
                <p className="small">{sunAdvice(sunStats)} <Why href="https://yardandgarden.extension.iastate.edu/faq/which-vegetables-will-grow-partial-shade" /></p>
                {sunStats.full < 3 && (
                  <div className="notice">
                    <p><b>No part of this outline gets 6 hours of sun{season === "summer" ? "" : ` in ${SEASON_SHORT[season].toLowerCase()}`}.</b> Tomatoes, peppers and squash won&apos;t do well here. You can:</p>
                    <ul>
                      <li>Grow leafy greens, which manage with 3 to 4 hours.</li>
                      <li>Put fruiting crops in large pots in your sunniest spot.</li>
                      <li><button className="link" onClick={() => go(0)}>Outline a different spot</button> and compare.</li>
                    </ul>
                  </div>
                )}
              </>
            )}
            {overlay && (
              <label className="check">
                <input type="checkbox" checked={overlayVisible} onChange={(e) => setOverlayVisible(e.target.checked)} /> Show sun map
              </label>
            )}
            {garden && (
              <div className="row">
                <button className={editing ? "btn primary" : "btn"} onClick={() => setEditing((e) => !e)}>{editing ? "Done adjusting" : "Move or adjust the outline"}</button>
              </div>
            )}
            {spotResult && !editing && (
              spotResult.spots.length > 0 ? (
                <section className="spots">
                  <h3>Sunnier spots nearby</h3>
                  <p className="muted small">The same shape, shifted a short way onto open ground (no buildings or trees), gets more sun here. Your outline now: {fmt(spotResult.current, 1)} hrs.</p>
                  <ul>
                    {spotResult.spots.map((sp) => (
                      <li key={sp.id}>
                        <span className="spot-id">{sp.id}</span>
                        <span><b>{fmt(sp.avg, 1)} hrs</b> <span className="muted small">(+{fmt(sp.gain, 1)}) · {Math.round(sp.metres * 3.28084)} ft {sp.dir}</span></span>
                        <button className="btn" onClick={() => { setGarden(sp.ring); setSunBySeason({}); }}>Move here</button>
                      </li>
                    ))}
                  </ul>
                  <p className="muted small">Check it&apos;s inside your yard and not a driveway, patio or septic field. The photo can&apos;t tell lawn from pavement or show property lines.</p>
                </section>
              ) : (
                <p className="muted small">{spotResult.fullSun ? "Your outline already gets full sun, so there's no need to move it." : "No sunnier open spot nearby: your outline is already in one of the sunniest clear areas around."}</p>
              )
            )}

            <details className="sub">
              <summary>Fix what the data missed ({objects.length})</summary>
              <p className="muted small">Add a tree, shed or fence that&apos;s new or missing, or mark something that&apos;s been removed. Sun hours update automatically.</p>
              {mode === "tree" ? (
                <div className="draw-help">
                  <p>Tap the centre of the tree on the map.</p>
                  <button className="btn ghost" onClick={() => setMode("idle")}>Cancel</button>
                </div>
              ) : mode === "structure" || mode === "clear" ? (
                <p className="muted small">Tap the corners of {mode === "clear" ? "the removed area" : "its outline"} on the map. Use the buttons on the map to undo, erase or finish.</p>
              ) : (
                <div className="obj-forms">
                  <fieldset>
                    <legend>Tree</legend>
                    <label>Height <input type="number" min={3} max={150} value={treeForm.heightFt} onChange={(e) => setTreeForm({ ...treeForm, heightFt: +e.target.value })} /> ft</label>
                    <label>Width <input type="number" min={2} max={100} value={treeForm.widthFt} onChange={(e) => setTreeForm({ ...treeForm, widthFt: +e.target.value })} /> ft</label>
                    <select aria-label="Leaf type" value={treeForm.leaves} onChange={(e) => setTreeForm({ ...treeForm, leaves: e.target.value as "deciduous" | "evergreen" })}>
                      <option value="deciduous">Loses leaves in winter</option>
                      <option value="evergreen">Evergreen</option>
                    </select>
                    <button className="btn" onClick={() => setMode("tree")}>Place tree</button>
                  </fieldset>
                  <fieldset>
                    <legend>Building, shed or fence</legend>
                    <label>Name <input value={structForm.label} onChange={(e) => setStructForm({ ...structForm, label: e.target.value })} /></label>
                    <label>Height <input type="number" min={1} max={80} value={structForm.heightFt} onChange={(e) => setStructForm({ ...structForm, heightFt: +e.target.value })} /> ft</label>
                    <button className="btn" onClick={() => setMode("structure")}>Draw outline</button>
                  </fieldset>
                  <button className="btn ghost" onClick={() => setMode("clear")}>Mark something as removed</button>
                </div>
              )}
              {objects.length > 0 && (
                <ul className="obj-list">
                  {objects.map((o) => (
                    <li key={o.id}>
                      <span>{o.type === "tree" ? `Tree, ${o.heightFt} ft tall, ${o.leaves}` : o.type === "structure" ? `${o.label}, ${o.heightFt} ft` : "Removed area"}</span>
                      <button className="link" onClick={() => setObjects((all) => all.filter((x) => x.id !== o.id))}>Remove</button>
                    </li>
                  ))}
                </ul>
              )}
            </details>

            <details className="sub">
              <summary>Slope, climate, wind and soil</summary>
              {terrain.state === "loading" && <Busy text="Checking the ground…" />}
              {terrain.state === "error" && <p className="warn">Couldn&apos;t load elevation: {terrain.message}</p>}
              {tStats && (
                <>
                  <h3>Slope</h3>
                  <div className="stats">
                    <Stat label="Average slope" value={`${fmt(tStats.avgSlopePct, 1)}%`} />
                    <Stat label="Height change" value={`${fmt(tStats.maxFt - tStats.minFt, 1)} ft`} />
                    <Stat label="Faces" value={tStats.facing ? cap(tStats.facing) : "Level"} />
                  </div>
                  <p className="muted small">{slopeAdvice(tStats.avgSlopePct)}{tStats.facing && ["south", "southeast", "southwest"].includes(tStats.facing) ? " A south-leaning slope warms up early in spring, which is a plus." : ""}</p>
                  <p className="source">Bare-earth elevation from USGS 3DEP. Ground about {fmt(tStats.minFt)}–{fmt(tStats.maxFt)} ft above sea level.</p>
                </>
              )}
              {site.state === "loading" && <Busy text="Looking up climate, wind and soil…" />}
              {site.state === "error" && <p className="warn">Couldn&apos;t load site facts: {site.message}</p>}
              {s && (
                <>
                  <h3>Hardiness zone</h3>
                  {s.zone ? (
                    <p><strong className="big">Zone {s.zone.zone}</strong> <span className="muted">· coldest winter nights average {s.zone.tempRangeF} °F</span></p>
                  ) : (
                    <p className="muted small">Not available for this spot.</p>
                  )}
                  <h3>Wind (growing season)</h3>
                  {s.wind ? (
                    <div className="wind">
                      <WindRose wind={s.wind} />
                      <div>
                        <p>Mostly from the <strong>{s.wind.prevailing}</strong>. Strongest from the <strong>{s.wind.strongest}</strong>.</p>
                        <p className="muted small">Calm {fmt(s.wind.calmPercent)}% of the time. A fence, hedge or trellis on the {s.wind.strongest} side shelters tall crops like tomatoes, corn and beans.</p>
                        <p className="source">{s.wind.stationName} weather station ({s.wind.station}), {fmt(s.wind.distanceMiles, 1)} mi away, {s.wind.period}. Dark = 10 mph and up.</p>
                      </div>
                    </div>
                  ) : (
                    <p className="muted small">No nearby weather station found.</p>
                  )}
                  <h3>Soil</h3>
                  {s.soil && mainSoil ? (
                    <>
                      <p><strong>{cap(mainSoil.texture ?? mainSoil.name)}</strong>{mainSoil.drainage ? `, ${mainSoil.drainage.toLowerCase()}` : ""}</p>
                      <p className="muted small">{soilAdvice(mainSoil)}</p>
                      <p className="source">USDA NRCS soil survey: {s.soil.mapUnit}. Yards are often regraded, so a soil test from your county Extension office is worth doing before planting.</p>
                    </>
                  ) : (
                    <p className="muted small">No soil survey data for this spot.</p>
                  )}
                </>
              )}
            </details>
            {grid.state === "done" && grid.data.fromLidar && (
              <p className="source">Heights from USGS 3DEP lidar ({grid.data.project.replace(/_/g, " ")}, {grid.data.year || "date unknown"}). Sun path from SunCalc.</p>
            )}
          </>
        )}

        {step === 2 && fitAll && (
          <GoalsStep goals={goals} setGoals={setGoals} picks={picks} setPicks={setPicks} size={size} fits={fitAll.beds.length} using={fit?.beds.length ?? 0} />
        )}
        {step === 3 && fit && fitAll && (
          <BedsStep
            total={fitAll.beds.length} onGoals={() => go(2)}
            fit={fit} cols={allCols?.cols ?? 0} opts={bedOpts} setOpts={setBedOpts} suns={bedSuns}
            season={SEASON_SHORT[season]} sunBusy={sunBusy || grid.state === "loading"}
          />
        )}
        {step === 9 && (
          <YourBedsStep
            beds={myBeds} setBeds={setMyBeds} suns={mySuns} sunBusy={sunBusy || grid.state === "loading"} season={SEASON_SHORT[season]}
            kind={bedKind} setKind={setBedKind} size={bedSize} setSize={setBedSize}
            drawing={mode === "bed" || mode === "bedpoint" ? mode : null}
            onDraw={() => { setShape("rect"); setMode("bed"); }} onPlace={() => setMode("bedpoint")} onCancel={() => setMode("idle")}
            onSwitch={() => { setRoad("new"); show(0); }} gridMissing={grid.state === "done" && !grid.data.fromLidar}
            editing={editBed} setEditing={(id) => {
              setMode("idle"); setEditBed(id);
              // Zoom in on the bed so its handles have room.
              const b = myBeds.find((x) => x.id === id);
              if (b) { const phone = window.innerWidth <= 760; setFlyTo({ center: b.center, zoom: 21, key: Date.now(), padLeft: phone ? 0 : 440, padBottom: phone ? Math.round(window.innerHeight * 0.56) : 0 }); }
            }}
          />
        )}
        {step === 10 && <LastYearStep beds={myBeds} setBeds={setMyBeds} year={YEAR} />}
        {step === 4 && (
          <PlantsStep onTimeline={() => { setGrowTab("timeline"); go(7); }} picks={picks} setPicks={setPicks} bestSun={plantBest} frost={frost} kind={kindFilter} setKind={setKindFilter} bedSuns={plantSuns} state={siteState} />
        )}
        {step === 5 && <LayoutStep plan={plan} picks={picks} onPick={() => go(4)} ends={have ? ["north", "south"] : fit?.ends ?? ["north", "south"]} lastYear={lastYearByBed} perennials={have ? myBeds.filter((b) => b.kind === "perennial").map((b) => b.n) : []} />}
        {step === 6 && area && fit && <BuildStudio garden={area} trimmed={area !== garden} beds={fit.beds} choices={build} setChoices={setBuild} onOpen={() => setSheets(true)} />}

        {step === 7 && (
          <>
            <p className="lede">{have ? "These tools follow your crops and frost dates through the season." : "Your plan doesn't stop at the build. These tools follow your crops and frost dates through the season."}</p>
            {have && <div className="notice"><p><b>Season planner, free for your first year.</b> Save your plan and next year we&apos;ll suggest a new rotated layout from what you grew this year.</p></div>}
            <div className="tabs grow-tabs" role="tablist" aria-label="Grow tools">
              {(Object.keys(TOOL_LABEL) as ToolView[]).map((k) => (
                <button key={k} role="tab" aria-selected={growTab === k} className={growTab === k ? "tab on" : "tab"} onClick={() => setGrowTab(k)}>{TOOL_LABEL[k]}</button>
              ))}
            </div>
            {growTab === "timeline" && <Timeline picks={picks} frost={frost} state={siteState} onPick={() => go(garden ? 4 : 0)} />}
            {growTab === "problems" && <Problems />}
            {growTab === "checklist" && <Checklist frost={frost} />}
          </>
        )}

        {step === 8 && (
          <>
            <h1 className="title">Save your plan</h1>
            <p className="lede">Give it a name so you can come back to it.</p>
            <label className="field">
              Name
              <input value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="Back yard" />
            </label>
            <div className="row">
              <button className="btn primary" onClick={onSave} disabled={!place}>Save</button>
              <button className="btn" onClick={() => { const p = buildProfile(); if (p) downloadSite(p); }} disabled={!place}>Download file</button>
            </div>
            {supabase ? (
              session ? (
                <p className="muted small">Signed in as {session.user.email}. Plans save to your account and this browser. <button className="link" onClick={() => supabase!.auth.signOut()}>Sign out</button></p>
              ) : (
                <SignIn />
              )
            ) : (
              <p className="muted small">Saved in this browser for this test version. Free accounts that sync between phone and computer switch on when the app goes live.</p>
            )}
            {cloud.length > 0 && (
              <section className="saved">
                <h2>Your plans</h2>
                <ul>
                  {cloud.map((p) => (
                    <li key={p.id}>
                      <button className="link strong" onClick={() => onOpen(p)}>{p.name}</button>
                      <span className="muted small">{new Date(p.savedAt).toLocaleDateString()}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try { onOpen(await readSiteFile(f)); } catch (err) { setToast(String((err as Error).message)); }
          e.target.value = "";
        }} />

        <div className="stepnav">
          {pos > 0 ? <button className="btn ghost" onClick={() => go(steps[pos - 1])}>Back</button> : <span />}
          {nextStep != null && (step !== 0 || road) && (
            <button className="btn primary pill" onClick={() => go(nextStep)} disabled={!nextOk}>
              {step === 10 && !myBeds.some((b) => Object.keys(b.history).length) ? "Skip" : "Next"}: {LABEL[nextStep]} →
            </button>
          )}
        </div>
        </>)}
      </aside>
      <nav className="tabbar" aria-label="Sections">
        {([[null, "Plan"], ["timeline", "Seed to harvest"], ["problems", "What's wrong?"], ["checklist", "Checklist"]] as [ToolView | null, string][]).map(([k, label]) => (
          <button key={label} className={view === k ? "on" : ""} aria-current={view === k ? "page" : undefined} onClick={() => { setView(k); setCollapsed(false); panelRef.current?.scrollTo({ top: 0 }); }}>
            <TabIcon k={k} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {sheets && area && fit && (
        <BuildPlanSheets name={profileName.trim() || place?.label.split(",")[0] || "My garden"} garden={area} beds={fit.beds} ends={fit.ends} plan={plan} trimmed={area !== garden} choices={build} onClose={() => setSheets(false)} />
      )}
    </div>
  );
}

// ---------- small pieces ----------

/** Line icons for the phone tab bar, in the storyboard's style. */
function TabIcon({ k }: { k: ToolView | null }) {
  const d = k === null ? "M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11zM12 7.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z"
    : k === "timeline" ? "M12 21v-9M12 12c0-4 3-6 7-6 0 4-3 6-7 6zM12 15c0-3-2.5-5-6-5 0 3 2.5 5 6 5z"
    : k === "problems" ? "M10.5 18a7.5 7.5 0 110-15 7.5 7.5 0 010 15zM16 16l5 5M10.5 7v4M10.5 14h.01"
    : "M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2";
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span className="stat-v">{value}</span>
      <span className="stat-l">{label}</span>
    </div>
  );
}

function Busy({ text }: { text: string }) {
  return <p className="busy"><span className="spinner" aria-hidden /> {text}</p>;
}

function ShapePicker({ shape, setShape, square, setSquare }: { shape: "rect" | "free"; setShape: (s: "rect" | "free") => void; square: boolean; setSquare: (b: boolean) => void }) {
  return (
    <div className="draw-help">
      <div className="tabs" role="radiogroup" aria-label="Outline shape">
        <button role="radio" aria-checked={shape === "rect"} className={shape === "rect" ? "tab on" : "tab"} onClick={() => setShape("rect")}>Rectangle</button>
        <button role="radio" aria-checked={shape === "free"} className={shape === "free" ? "tab on" : "tab"} onClick={() => setShape("free")}>Any shape</button>
      </div>
      {shape === "rect" ? (
        <p className="small">Tap two corners along one side, then tap the opposite side. You get a true rectangle, turned to match your yard.</p>
      ) : (
        <>
          <p className="small">Tap each corner. Tap the first point again, or press Finish on the map, to close it.</p>
          <label className="check small"><input type="checkbox" checked={square} onChange={(e) => setSquare(e.target.checked)} /> Square up corners (snaps sides that are nearly straight or square)</label>
        </>
      )}
      <p className="muted small">Undo and Erase are on the map. After you finish, use Adjust shape to drag corners or move the outline.</p>
    </div>
  );
}

function SunBar({ stats }: { stats: SunStats }) {
  return (
    <div className="sunbar-wrap">
      <div className="sunbar">
        <span style={{ width: `${stats.full}%`, background: "#f2c14e" }} />
        <span style={{ width: `${stats.part}%`, background: "#7fb069" }} />
        <span style={{ width: `${stats.shade}%`, background: "#46608f" }} />
      </div>
      <div className="sunbar-key small">
        <span><i style={{ background: "#f2c14e" }} />Full sun 6+ hrs: {fmt(stats.full)}%</span>
        <span><i style={{ background: "#7fb069" }} />Part sun 4–6: {fmt(stats.part)}%</span>
        <span><i style={{ background: "#46608f" }} />Shade under 4: {fmt(stats.shade)}%</span>
      </div>
    </div>
  );
}

function sunAdvice(s: SunStats) {
  if (s.avgHours >= 6) return "Great for sun lovers like tomatoes, peppers, squash, cucumbers and beans.";
  if (s.avgHours >= 4) return "Good for leafy greens, peas, herbs and root crops. Fruiting crops will produce less.";
  return "Mostly shaded. Lettuce, spinach, kale and mint can manage; consider a sunnier spot for vegetables.";
}

function soilAdvice(c: { texture: string | null; drainage: string | null; ph: number | null; organicMatter: number | null }) {
  const out: string[] = [];
  const t = c.texture ?? "";
  if (t.includes("clay")) out.push("Clay holds water and nutrients but drains slowly; compost and raised beds help a lot.");
  else if (t.includes("sand")) out.push("Sandy soil drains fast and warms early, but needs compost and more frequent watering.");
  else if (t) out.push("A loamy soil, which is about as good as it gets for vegetables.");
  if (c.ph != null) out.push(c.ph < 6 ? `pH around ${c.ph} is a bit acidic; most vegetables like 6.2–7.0, so lime may help.` : c.ph > 7.3 ? `pH around ${c.ph} is alkaline; sulfur or compost can bring it down.` : `pH around ${c.ph} suits most vegetables.`);
  if (c.drainage && /poorly/i.test(c.drainage)) out.push("Drainage is poor, so raised beds are strongly recommended.");
  return out.join(" ");
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Why({ href }: { href: string }) {
  return <a className="why" href={href} target="_blank" rel="noreferrer">Why?</a>;
}

/**
 * Choose n beds that sit together in the sun: start at the sunniest bed, then keep adding the bed
 * with the best sun minus a distance penalty (¼ hr per foot from the group), so the garden stays
 * one compact block instead of scattered beds (practical choice).
 */
function pickBeds(beds: BedFit["beds"], suns: (number | null)[] | null, n: number): number[] {
  const lat = beds[0]?.center[1] ?? 0;
  const ft = (a: LngLat, b: LngLat) => Math.hypot((a[0] - b[0]) * 365223 * Math.cos((lat * Math.PI) / 180), (a[1] - b[1]) * 362776);
  const sunAt = (i: number) => suns?.[i] ?? 0;
  let seed = 0;
  beds.forEach((_, i) => { if (sunAt(i) > sunAt(seed)) seed = i; });
  const keep = [seed];
  const left = new Set(beds.map((_, i) => i).filter((i) => i !== seed));
  while (keep.length < n && left.size) {
    let best = -1, bestScore = -Infinity;
    for (const i of left) {
      const d = Math.min(...keep.map((k) => ft(beds[i].center, beds[k].center)));
      const score = sunAt(i) - 0.25 * d;
      if (score > bestScore) { bestScore = score; best = i; }
    }
    keep.push(best);
    left.delete(best);
  }
  return keep.sort((a, b) => a - b);
}

// ---------- step 4: beds ----------

const DIRS = [
  { id: "auto", label: "Best fit" },
  { id: "ns", label: "North–south" },
  { id: "outline", label: "Along outline" },
  { id: "ew", label: "East–west" },
] as const;
const DIR_NAME = { ns: "north–south", outline: "the outline's direction", ew: "east–west" } as const;

function BedsStep({ total, onGoals, fit, cols, opts, setOpts, suns, season, sunBusy }: {
  total: number; onGoals: () => void;
  fit: ReturnType<typeof fitBeds>; cols: number; opts: BedOptions; setOpts: (o: BedOptions) => void;
  suns: (number | null)[] | null; season: string; sunBusy: boolean;
}) {
  const n = fit.beds.length;
  const full = suns ? suns.filter((h) => h != null && h >= 6).length : null;
  const toggleWalk = (c: number) => setOpts({ ...opts, walkways: opts.walkways.includes(c) ? opts.walkways.filter((x) => x !== c) : [...opts.walkways, c] });
  return (
    <>
      <h1 className="title">Fit your raised beds</h1>
      <p className="lede">4 × 8 ft beds with paths between them, kept 1½ ft inside your outline so you can walk around the edge.</p>
      <h3>Bed direction</h3>
      <div className="tabs dir-tabs" role="radiogroup" aria-label="Bed direction">
        {DIRS.filter((d) => d.id !== "outline" || fit.counts.outline != null).map((d) => {
          const on = (opts.orient ?? "auto") === d.id;
          const count = d.id === "auto" ? Math.max(fit.counts.ns, fit.counts.ew, fit.counts.outline ?? 0) : fit.counts[d.id];
          return (
            <button key={d.id} role="radio" aria-checked={on} className={on ? "tab on" : "tab"} onClick={() => setOpts({ ...opts, orient: d.id, walkways: [] })}>
              {d.label}<small>{count} bed{count === 1 ? "" : "s"}</small>
            </button>
          );
        })}
      </div>
      <p className="muted small">
        {(opts.orient ?? "auto") === "auto" ? `Using ${DIR_NAME[fit.orient]}, which fits the most beds. ` : ""}
        North–south beds shade each other least, so pick it when the count is close (practical choice).
      </p>
      {n === 0 ? (
        <p className="warn">No 4 × 8 ft bed fits inside this outline with {opts.pathFt} ft paths. Try narrower paths or redraw a larger area.</p>
      ) : (
        <div className="stats">
          <Stat label="Beds" value={n < total ? `${n} of ${total}` : `${n}`} />
          <Stat label="Growing area" value={`${n * opts.widthFt * opts.lengthFt} sq ft`} />
          <Stat label={`Full sun, ${season.toLowerCase()}`} value={full == null ? "…" : `${full} of ${n}`} />
        </div>
      )}
      {n > 0 && n < total && <p className="muted small">Using {n} of the {total} beds that fit, grouped in the sunniest part of your outline, from your goals. The rest stays lawn for now. <button className="link" onClick={onGoals}>Change goals</button></p>}
      {sunBusy && <Busy text="Measuring sun on each bed…" />}
      <h3>Path width</h3>
      <div className="tabs" role="radiogroup" aria-label="Path width">
        {[2, 3, 4].map((w) => (
          <button key={w} role="radio" aria-checked={opts.pathFt === w} className={opts.pathFt === w ? "tab on" : "tab"} onClick={() => setOpts({ ...opts, pathFt: w, walkways: [] })}>
            {w} ft{w === 3 ? " · wheelbarrow" : ""}
          </button>
        ))}
      </div>
      {cols > 1 && (
        <>
          <h3>Walkway</h3>
          <p className="muted small">Turn a column of beds into a wide front-to-back path. Columns are counted from the {fit.colsFrom}.</p>
          <div className="chips">
            {Array.from({ length: cols }, (_, c) => (
              <button key={c} className={opts.walkways.includes(c) ? "chip on" : "chip"} aria-pressed={opts.walkways.includes(c)} onClick={() => toggleWalk(c)}>
                Column {String.fromCharCode(65 + c)}
              </button>
            ))}
          </div>
        </>
      )}
      {suns && n > 0 && full === 0 && (
        <div className="notice">
          <p><b>None of these beds gets 6 hours of sun.</b> Plan on leafy greens, roots and herbs here, and grow tomatoes or peppers in large pots in your sunniest spot.</p>
        </div>
      )}
      {suns && n > 0 && (
        <>
          <h3>Sun on each bed, {season.toLowerCase()}</h3>
          <ul className="bedlist">
            {fit.beds.map((b, i) => {
              const h = suns[i];
              return (
                <li key={b.id}>
                  <span className="bed-n">{b.n}</span>
                  <span className="bed-bar"><i style={{ width: `${Math.min(100, ((h ?? 0) / 12) * 100)}%`, background: (h ?? 0) >= 6 ? "#F2B544" : (h ?? 0) >= 4 ? "#6FB08A" : "#46608F" }} /></span>
                  <span className="bed-h">{h == null ? "–" : `${fmt(h, 1)} hrs`}</span>
                  <span className="bed-tag">{h == null ? "" : h >= 6 ? "Fruiting crops" : h >= 3 ? "Greens, roots" : "Too shady"}</span>
                </li>
              );
            })}
          </ul>
          <p className="small muted">Fruiting crops need 6+ hours of direct sun; leafy greens manage with 3 to 4. <Why href={SOURCES.isu.href} /></p>
        </>
      )}
    </>
  );
}

// ---------- step 5: plants ----------

const FIT_LABEL: Record<FitTag, string> = { fits: "Fits", "needs-sun": "Needs more sun", "season-short": "Season too short", fall: "Plant in fall", perennial: "Comes back yearly" };

function PlantsStep({ onTimeline, picks, setPicks, bestSun, frost, kind, setKind, bedSuns, state }: {
  onTimeline: () => void; picks: string[]; setPicks: (p: string[]) => void; bestSun: number | null; frost: SiteData["frost"] | null;
  kind: Kind | "all"; setKind: (k: Kind | "all") => void; bedSuns: (number | null)[] | null; state: string | null;
}) {
  const guide = guideFor(state);
  const [open, setOpen] = useState<string | null>(null);
  const kinds = Object.keys(KIND_LABEL) as Kind[];
  const list = CROPS.filter((c) => kind === "all" || c.kind === kind);
  const toggle = (id: string) => setPicks(picks.includes(id) ? picks.filter((x) => x !== id) : [...picks, id]);
  const fmtMD = (md: string) => new Date(`2021-${md.replace("/", "-")}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return (
    <>
      <h1 className="title">Choose what to grow</h1>
      <p className="lede">Each crop is checked against the sun on your sunniest bed{frost ? " and your frost dates" : ""}. Tap a crop for the details.</p>
      {frost ? (
        <div className="stats">
          <Stat label="Last spring frost" value={fmtMD(frost.lastSpring)} />
          <Stat label="First fall frost" value={fmtMD(frost.firstFall)} />
          <Stat label="Frost-free days" value={`${frost.frostFreeDays}`} />
        </div>
      ) : (
        <p className="warn">We couldn&apos;t find frost dates near you, so season length isn&apos;t checked.</p>
      )}
      {frost && <p className="source">{frost.source}. {frost.stationName}, {fmt(frost.distanceMiles, 0)} mi away. Half of years have a frost after the spring date or before the fall one.</p>}
      {guide && <p className="source">Varieties and pests to watch come from {guide.extension}.</p>}
      <div className="chips" role="group" aria-label="Filter by type">
        <button className={kind === "all" ? "chip on" : "chip"} aria-pressed={kind === "all"} onClick={() => setKind("all")}>All</button>
        {kinds.map((k) => <button key={k} className={kind === k ? "chip on" : "chip"} aria-pressed={kind === k} onClick={() => setKind(k)}>{KIND_LABEL[k]}</button>)}
      </div>
      <ul className="croplist">
        {list.map((c) => {
          const tag = cropFit(c, bestSun, frost?.frostFreeDays ?? null);
          const on = picks.includes(c.id);
          const bedsOk = bedSuns ? bedSuns.filter((h) => (h ?? 0) >= c.sun).length : null;
          return (
            <li key={c.id} className={on ? "on" : ""}>
              <div className="crop-row">
                <button className="crop-name" onClick={() => setOpen(open === c.id ? null : c.id)} aria-expanded={open === c.id}>
                  <strong>{c.name}</strong>
                  <span className={`fit fit-${tag}`}>{tag === "fits" ? "✓ " : tag === "needs-sun" || tag === "season-short" ? "! " : ""}{FIT_LABEL[tag]}</span>
                </button>
                <button className={on ? "btn add on" : "btn add"} onClick={() => toggle(c.id)} aria-pressed={on} aria-label={`${on ? "Remove" : "Add"} ${c.name}`}>{on ? "Added" : "Add"}</button>
              </div>
              {open === c.id && <CropFacts c={c} bedsOk={bedsOk} beds={bedSuns?.length ?? 0} frost={frost} guide={guide} />}
            </li>
          );
        })}
      </ul>
      <p className="muted small">{picks.length ? <>{picks.length} crop{picks.length > 1 ? "s" : ""} picked. <button className="link" onClick={onTimeline}>See when to start each one</button> in Grow tools.</> : "Pick a few crops, then see them laid out in your beds."}</p>
    </>
  );
}

function CropFacts({ c, bedsOk, beds, frost, guide }: { c: Crop; bedsOk: number | null; beds: number; frost: SiteData["frost"] | null; guide: RegionGuide | null }) {
  const pair = PAIRINGS.find((p) => p.a === c.id || p.b === c.id);
  const partner = pair && CROPS.find((x) => x.id === (pair.a === c.id ? pair.b : pair.a));
  return (
    <div className="facts">
      <p><b>Sun:</b> {c.sun === 6 ? "6+ hours" : c.sun === 4 ? "about 4+ hours (part shade is OK)" : "3 to 4 hours is enough"}
        {bedsOk != null && beds > 0 && <> · fits {bedsOk} of your {beds} beds</>}
        {SUN_PRACTICAL.has(c.id) || c.sunSource === "practical" ? <span className="label-pc">practical choice</span> : <> <Why href={(c.sunSource === "ref" && c.ref ? SOURCES[c.ref] : SOURCES.isu).href} /></>}</p>
      <p><b>Spacing:</b> {c.spacing[0]} in{c.spacing[1] !== c.spacing[0] ? ` × ${c.spacing[1]} in` : " apart"} · about {plantsPerSquare(c)} per 4 × 4 ft square
        {c.spacingSource === "practical" ? <span className="label-pc">practical choice</span> : <> <Why href={(c.spacingSource === "ref" && c.ref ? SOURCES[c.ref] : c.spacingSource === "mu" ? SOURCES.mu : SOURCES.csu).href} /></>}</p>
      <p><b>Harvest:</b> {c.perennial ? c.firstHarvest ?? "the year after planting" : c.start === "fall" ? "next summer" : `about ${c.days} days ${c.start === "transplant" ? "after planting out" : "after sowing"}`}{c.firstHarvest ? <> <Why href={(c.ref ? SOURCES[c.ref] : SOURCES.mu).href} /></> : <span className="label-pc">packet guidance</span>}</p>
      <p><b>Goes in:</b> {c.warm ? `after your last frost${frost ? ` (${frost.lastSpring})` : ""}; it can't take frost` : c.start === "fall" ? "in fall" : "early, as a cool-season crop"}{c.start === "transplant" ? ", as plants" : c.start === "sets" ? ", from sets" : c.start === "seed" ? ", sown as seed" : ""}.</p>
      {c.note && <p>{c.note}</p>}
      {pair && partner && <p className="pair"><b>Pairs with {partner.name.toLowerCase()}:</b> {pair.claim} <a className="why" href={pair.source.href} target="_blank" rel="noreferrer">Why?</a></p>}
      <LocalNotes g={guide} id={c.id} />
    </div>
  );
}

// ---------- step 5: layout ----------

function LayoutStep({ plan, picks, onPick, ends, lastYear = null, perennials = [] }: { plan: ReturnType<typeof planBeds>; picks: string[]; onPick: () => void; ends: BedFit["ends"]; lastYear?: Map<number, string> | null; perennials?: number[] }) {
  const [e1, e2] = ends;
  const cap = (w: string) => w[0].toUpperCase() + w.slice(1);
  if (!picks.length) {
    return (
      <>
        <h1 className="title">Lay out each bed</h1>
        <p className="lede">Pick some crops first and they&apos;ll be placed bed by bed, sun lovers in the sunniest spots.</p>
        <button className="btn primary" onClick={onPick}>Choose crops</button>
      </>
    );
  }
  const low = plan.beds.flatMap((b) => [b.north, b.south]).filter((s) => s.crop && s.lowSun);
  const open = plan.beds.flatMap((b) => [b.north, b.south]).filter((s) => !s.crop).length;
  return (
    <>
      <h1 className="title">Lay out each bed</h1>
      <p className="lede">{lastYear
        ? <>Each bed is split into two halves, one crop per half. Tall crops go on the north half so they don&apos;t shade the rest.</>
        : e1 === "north"
        ? <>Each bed is split into a north and a south 4 × 4 ft square. Tall crops sit on the north end so they don&apos;t shade the rest.</>
        : <>Each bed is split into a west and an east 4 × 4 ft square. With east–west beds, put trellised crops along the north side of the garden where you can.</>}</p>
      <div className="bedgrid">
        {plan.beds.map((b) => (
          <figure key={b.n} className="bedcard">
            <figcaption><b>Bed {b.n}</b><span>{b.sun == null ? "" : `${fmt(b.sun, 1)} hrs sun`}</span></figcaption>
            {lastYear && <span className="bed-was">{lastYear.get(b.n) ? `Grew: ${lastYear.get(b.n)}` : "No history yet"}</span>}
            <BedSvg north={b.north} south={b.south} ends={ends} />
            <dl className="bedkey">
              {([[cap(e1)[0], b.north], [cap(e2)[0], b.south]] as const).map(([k, sq]) => (
                <div key={k} className={sq.lowSun ? "low" : ""}>
                  <dt>{k}</dt>
                  <dd>{sq.crop ? <><i style={{ background: dotColor(sq.crop.id) }} />{sq.crop.name.split(" /")[0].replace(" (flower)", "")} ×{sq.plants}</> : <span className="muted">open</span>}</dd>
                </div>
              ))}
            </dl>
          </figure>
        ))}
      </div>
      <p className="muted small">{cap(e1)} end is at the top of each drawing. Dots show plant positions at Extension spacing.</p>
      {lastYear && (
        <p className="small">Each crop goes to a bed its plant family hasn&apos;t grown in for {ROTATION_YEARS} years, where there&apos;s one with enough sun. <a className="why" href={SOURCES.isuRotation.href} target="_blank" rel="noreferrer">Why?</a></p>
      )}
      {(() => {
        const rep = plan.beds.flatMap((b) => [b.north, b.south]).filter((sq) => sq.crop && sq.repeat);
        const seen = new Set<string>();
        const list = rep.filter((sq) => { const k = `${sq.crop!.id}-${sq.bed}`; if (seen.has(k)) return false; seen.add(k); return true; });
        return list.length > 0 && <p className="warn">{list.map((sq) => `${sq.crop!.name} in bed ${sq.bed}`).join(", ")}: every bed with room already grew this plant family recently, so {list.length > 1 ? "these repeat" : "it repeats"}. Pick fewer crops from that family, or accept a smaller harvest risk from soil pests.</p>;
      })()}
      {perennials.length > 0 && <p className="muted small">Bed{perennials.length > 1 ? "s" : ""} {perennials.join(", ")} {perennials.length > 1 ? "are perennial patches and stay" : "is a perennial patch and stays"} as {perennials.length > 1 ? "they are" : "it is"}.</p>}
      {plan.pairs.map((p) => (
        <p key={p.a} className="pair small"><b>Backed by trials:</b> {p.claim} <a className="why" href={p.source.href} target="_blank" rel="noreferrer">Why?</a></p>
      ))}
      {low.length > 0 && <p className="warn">{low.map((s) => `${s.crop!.name} in bed ${s.bed}`).join(", ")} {low.length > 1 ? "get" : "gets"} less sun than {low.length > 1 ? "they need" : "it needs"}. Expect a smaller harvest, or swap for greens.</p>}
      {plan.unplaced.length > 0 && <p className="warn">No room left for {plan.unplaced.map((c) => c.name.toLowerCase()).join(", ")}. Remove a walkway or pick fewer crops.</p>}
      {open > 0 && <p className="muted small">{open} square{open > 1 ? "s are" : " is"} still open. <button className="link" onClick={onPick}>Add more crops</button></p>}
    </>
  );
}

const DOT = ["#FF6F47", "#145049", "#F2B544", "#6FB08A", "#B8401F", "#7A9E3B", "#4F7CAC", "#C98A2B"];
const dotColor = (id: string) => DOT[CROPS.findIndex((c) => c.id === id) % DOT.length];

function BedSvg({ north, south, ends }: { north: Square; south: Square; ends: BedFit["ends"] }) {
  const half = (s: Square, y0: number) => {
    if (!s.crop) return null;
    const [a, b] = s.crop.spacing;
    const nx = Math.max(1, Math.floor(48 / a)), ny = Math.max(1, Math.floor(48 / b));
    const showX = Math.min(nx, 8), showY = Math.min(ny, 8);
    const color = dotColor(s.crop.id);
    const r = Math.max(1.2, Math.min(5, 20 / Math.max(showX, showY)));
    return (
      <>
        {Array.from({ length: showX * showY }, (_, i) => (
          <circle key={i} cx={(48 / showX) * ((i % showX) + 0.5)} cy={y0 + (48 / showY) * (Math.floor(i / showX) + 0.5)} r={r} fill={color} opacity={s.lowSun ? 0.45 : 0.9} />
        ))}
      </>
    );
  };
  return (
    <svg viewBox="-1 -1 50 98" width="100%" role="img" aria-label={`${ends[0]}: ${north.crop?.name ?? "open"}. ${ends[1]}: ${south.crop?.name ?? "open"}.`}>
      <rect x="0" y="0" width="48" height="96" rx="2" fill="#F4EFE6" stroke="#0B3530" strokeWidth="1" />
      <line x1="0" y1="48" x2="48" y2="48" stroke="#0B3530" strokeWidth="0.5" strokeDasharray="2 1.5" />
      {half(north, 0)}
      {half(south, 48)}
    </svg>
  );
}

// ---------- address search ----------

function AddressSearch({ onPick, initial = "", onDropPin }: { onPick: (p: Place) => void; initial?: string; onDropPin: () => void }) {
  const [q, setQ] = useState(initial);
  const [items, setItems] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [near, setNear] = useState<Place[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The place picked from the list. Pressing Go without changing the text keeps it, instead of
  // looking the words up again (the address service can match a different house).
  const chosen = useRef<Place | null>(null);

  const onChange = (v: string) => {
    setQ(v);
    chosen.current = null;
    setMsg(null);
    if (timer.current) clearTimeout(timer.current);
    if (v.trim().length < 4) return setItems([]);
    timer.current = setTimeout(async () => {
      try {
        const d = await getJson<{ places: Place[] }>(`/api/suggest?q=${encodeURIComponent(v)}`);
        setItems(d.places);
        setOpen(true);
      } catch {
        /* suggestions are optional */
      }
    }, 300);
  };

  const pick = (p: Place) => {
    chosen.current = p;
    setQ(p.label);
    setOpen(false);
    setItems([]);
    onPick(p);
  };

  const search = async (text: string) => {
    if (!text.trim()) return;
    if (chosen.current && chosen.current.label === text) return pick(chosen.current);
    const listed = items.find((p) => p.label.trim().toLowerCase() === text.trim().toLowerCase());
    if (listed) return pick(listed);
    setBusy(true);
    setNear(null);
    setMsg(null);
    try {
      const d = await getJson<{ places: Place[] }>(`/api/geocode?q=${encodeURIComponent(text)}`);
      if (d.places[0]) pick(d.places[0]);
      else {
        setMsg("We couldn't find that address.");
        const s2 = await getJson<{ places: Place[] }>(`/api/suggest?q=${encodeURIComponent(text)}`).catch(() => ({ places: [] as Place[] }));
        setNear(s2.places.slice(0, 4));
      }
    } catch {
      setMsg("Search isn't responding. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  const submit = (e: React.FormEvent) => { e.preventDefault(); search(q); };
  const ran = useRef(false);
  useEffect(() => {
    if (initial && !ran.current) { ran.current = true; search(initial); }
  }, [initial]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <form className="search" onSubmit={submit} autoComplete="off">
      <div className="search-box">
        <input
          type="search"
          value={q}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => items.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Street address, city, state"
          aria-label="Address"
        />
        <button className="btn primary" type="submit" disabled={busy}>{busy ? "…" : "Go"}</button>
      </div>
      {open && items.length > 0 && (
        <ul className="suggest">
          {items.map((p, i) => (
            <li key={i}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(p)}>{p.label}</button>
            </li>
          ))}
        </ul>
      )}
      {msg && (
        <div className="notfound">
          <p className="warn small">{msg}{near && near.length ? " Is it one of these?" : ""}</p>
          {near && near.length > 0 && (
            <ul className="near">
              {near.map((p, i) => <li key={i}><button type="button" className="link strong" onClick={() => pick(p)}>{p.label}</button></li>)}
            </ul>
          )}
          {near && <p className="small">Or <button type="button" className="link" onClick={() => { setMsg(null); setNear(null); onDropPin(); }}>drop a pin on your yard</button>. New homes often aren&apos;t in the address database yet.</p>}
        </div>
      )}
    </form>
  );
}


function clockLabel(t: number, lon: number) {
  const d = new Date(t + clockOffsetHours(lon) * 3600000);
  const h = d.getUTCHours();
  return `${((h + 11) % 12) + 1}${h < 12 ? "a" : "p"}`;
}

function StudyBar({ shot, minute, span, setMinute, playing, setPlaying, riseLabel, setLabel }: {
  shot: { time: string; ampm: string; litPct: number | null }; minute: number; span: number; setMinute: (m: number) => void;
  playing: boolean; setPlaying: (p: boolean) => void; riseLabel: string; setLabel: string;
}) {
  return (
    <div className="study">
      <button className="study-play" aria-label={playing ? "Pause" : "Play"} onClick={() => setPlaying(!playing)}>{playing ? "❚❚" : "▶"}</button>
      <span className="study-time"><b>{shot.time}</b><small>{shot.ampm}</small></span>
      <label className="study-slider">
        <span className="sr-only">Time of day</span>
        <input type="range" min={0} max={span} step={5} value={minute} onChange={(e) => setMinute(Number(e.target.value))} style={{ ["--p" as string]: `${(minute / span) * 100}%` }} />
        <span className="study-ends"><span>{riseLabel} sunrise</span><span>sunset {setLabel}</span></span>
      </label>
      {shot.litPct != null && <span className="study-lit"><small>In sun now</small><b>{shot.litPct}%</b><small>of your outline</small></span>}
    </div>
  );
}
