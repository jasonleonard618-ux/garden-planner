"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fmt, measure, ringBbox, ringCenter, slopeAdvice, terrainStats, toMerc, uid } from "@/lib/geo";
import { gridCorners, SEASON_DATES, sunColor } from "@/lib/shade";
import { deleteSite, downloadSite, listSites, readSiteFile, saveSite } from "@/lib/storage";
import type { LngLat, Place, Season, SiteData, SiteObject, SiteProfile, SunStats, SurfaceGrid, Terrain, TerrainStats } from "@/lib/types";
import type { DrawMode } from "./MapView";
import WindRose from "./WindRose";
import { Wordmark } from "./Logo";
import { bedSun, DEFAULT_BEDS, fitBeds, type BedOptions } from "@/lib/beds";
import { planBeds, type Square } from "@/lib/layout";
import { CROPS, cropFit, KIND_LABEL, PAIRINGS, plantsPerSquare, SOURCES, SUN_PRACTICAL, type Crop, type FitTag, type Kind } from "@/data/crops";

const MapView = dynamic(() => import("./MapView"), { ssr: false, loading: () => <div className="map map-loading" /> });

type Grid = SurfaceGrid & { fromLidar: boolean };
type Load<T> = { state: "idle" } | { state: "loading" } | { state: "error"; message: string } | { state: "done"; data: T };

const STEPS = ["Address", "Sun", "Beds", "Plants", "Layout", "Build", "Save"];
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
  const draftRef = useRef<{ undo: () => void; finish: () => void; count: () => number } | null>(null);

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
  const [bedOpts, setBedOpts] = useState<BedOptions>(DEFAULT_BEDS);
  const [picks, setPicks] = useState<string[]>([]);
  const [kindFilter, setKindFilter] = useState<Kind | "all">("all");
  const panelRef = useRef<HTMLElement>(null);

  const [treeForm, setTreeForm] = useState({ heightFt: 30, widthFt: 20, leaves: "deciduous" as "deciduous" | "evergreen" });
  const [structForm, setStructForm] = useState({ heightFt: 6, label: "Fence" });

  useEffect(() => setSaved(listSites()), []);
  useEffect(() => {
    if (!initialQuery) return;
    getJson<{ places: Place[] }>(`/api/geocode?q=${encodeURIComponent(initialQuery)}`)
      .then((d) => (d.places[0] ? choosePlace(d.places[0]) : setToast("We couldn't find that address. Try adding the city and state.")))
      .catch(() => setToast("Search isn't responding. Please try again."));
  }, [initialQuery]); // eslint-disable-line react-hooks/exhaustive-deps
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
    if (mode === "garden") {
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

  // ---------- beds, plants, layout ----------
  const fit = useMemo(() => (garden ? fitBeds(garden, bedOpts) : null), [garden, bedOpts]);
  const allCols = useMemo(() => (garden ? fitBeds(garden, { ...bedOpts, walkways: [] }) : null), [garden, bedOpts]);
  const bedSuns = useMemo(() => {
    if (!fit || !sun || grid.state !== "done" || sun.key !== sunKey) return null;
    return fit.beds.map((b) => bedSun(b, sun.hours, grid.data));
  }, [fit, sun, grid, sunKey]);
  const bedRows = useMemo(() => (fit ? fit.beds.map((b, i) => ({ n: b.n, sun: bedSuns?.[i] ?? null })) : []), [fit, bedSuns]);
  const bestSun = bedSuns?.length ? Math.max(...bedSuns.map((h) => h ?? 0)) : sunStats?.avgHours ?? null;
  const frost = site.state === "done" ? site.data.frost ?? null : null;
  const plan = useMemo(() => planBeds(bedRows, picks), [bedRows, picks]);
  // Frame the garden in the map area beside the panel when moving past step 1.
  const framed = useRef<string>("");
  useEffect(() => {
    if (!garden || step < 1) return;
    const key = JSON.stringify(garden);
    if (framed.current === key) return;
    framed.current = key;
    const lat = ringCenter(garden)[1];
    const xs = garden.map((p) => p[0]), ys = garden.map((p) => p[1]);
    const wM = Math.max((Math.max(...xs) - Math.min(...xs)) * 111320 * Math.cos((lat * Math.PI) / 180), (Math.max(...ys) - Math.min(...ys)) * 110574, 5);
    const phone = window.innerWidth <= 760;
    const target = phone ? 200 : 360; // garden width on screen, px
    const zoom = Math.max(17, Math.min(20, Math.log2((156543.03 * Math.cos((lat * Math.PI) / 180) * target) / wM)));
    setFlyTo({ center: ringCenter(garden), zoom, key: Date.now(), padLeft: phone ? 0 : 440, padBottom: phone ? Math.round(window.innerHeight * 0.56) : 0 });
  }, [garden, step]);

  const mapBeds = useMemo(() => {
    if (!fit || step < 2 || step > 5) return [];
    return fit.beds.map((b, i) => {
      const h = bedSuns?.[i];
      const sq = plan.beds[i];
      const low = h != null && (step >= 4 && sq ? sq.north.lowSun || sq.south.lowSun : h < 6);
      return { n: b.n, ring: b.ring, center: b.center, label: `${b.n}`, tone: (low ? "low" : "ok") as "ok" | "low" };
    });
  }, [fit, bedSuns, plan, step]);

  // ---------- saving ----------
  const buildProfile = (): SiteProfile | null =>
    place && {
      id: profileId,
      name: profileName.trim() || place.label.split(",")[0],
      savedAt: new Date().toISOString(),
      place, garden, objects, imagery,
      summary: {
        areaSqFt: measured?.areaSqFt,
        perimeterFt: measured?.perimeterFt,
        terrain: tStats,
        sun: sunBySeason,
        site: site.state === "done" ? site.data : null,
      },
    };

  const onSave = () => {
    const p = buildProfile();
    if (!p) return;
    saveSite(p);
    setSaved(listSites());
    setToast(`Saved “${p.name}” on this device`);
  };
  const onOpen = (p: SiteProfile) => {
    setProfileId(p.id);
    setProfileName(p.name);
    setImagery(p.imagery ?? "usgs");
    setBedOpts(p.beds ?? DEFAULT_BEDS);
    setPicks(p.picks ?? []);
    choosePlace(p.place, { garden: p.garden, objects: p.objects ?? [] });
    setStep(p.garden ? 1 : 0);
  };
  const fileInput = useRef<HTMLInputElement>(null);

  const drawing = mode !== "idle";
  const s = site.state === "done" ? site.data : null;
  const mainSoil = s?.soil?.components.find((c) => c.texture) ?? s?.soil?.components[0];

  const reached = [true, !!garden, !!garden, !!garden, !!garden, !!garden, !!place];
  const go = (i: number) => { if (reached[i]) { setStep(i); setMode("idle"); panelRef.current?.scrollTo({ top: 0 }); } };
  const nextOk = step < STEPS.length - 1 && reached[step + 1];

  return (
    <div className="app">
      <header className="topbar">
        <Link className="brand" href="/?intro=0" aria-label="Light & Loam home">
          <Wordmark />
        </Link>
        <nav className="stepbar" aria-label="Steps">
          <ol>
            {STEPS.map((label, i) => (
              <li key={label}>
                <button
                  className={`step${i === step ? " on" : ""}${i < step && reached[i] ? " done" : ""}`}
                  onClick={() => go(i)}
                  disabled={!reached[i]}
                  aria-current={i === step ? "step" : undefined}
                >
                  <span className="step-n">{i < step && reached[i] ? "✓" : i + 1}</span>
                  <span className="step-l">{label}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <span className="step-mobile">Step {step + 1} of {STEPS.length} · {STEPS[step]}</span>
      </header>

      <main className="mapwrap">
        <MapView
          flyTo={flyTo}
          imagery={imagery}
          garden={garden}
          objects={objects}
          overlay={overlay}
          overlayVisible={overlayVisible && (step === 1 || step === 2)}
          marker={place && !garden ? [place.lon, place.lat] : null}
          mode={mode}
          onRingComplete={onRingComplete}
          onPoint={onPoint}
          draftRef={draftRef}
          onDraftChange={setDraftCount}
          beds={mapBeds}
          showSides={step < 2}
        />
        <div className="map-ui top-right">
          <div className="seg glass">
            <button className={imagery === "usgs" ? "on" : ""} onClick={() => setImagery("usgs")}>USGS aerial</button>
            <button className={imagery === "esri" ? "on" : ""} onClick={() => setImagery("esri")}>Esri satellite</button>
          </div>
        </div>
        {overlay && overlayVisible && (step === 1 || step === 2) && (
          <div className="map-ui bottom-right legend glass">
            <span>Direct sun, {SEASON_SHORT[season].toLowerCase()}</span>
            <div className="ramp" />
            <div className="ramp-labels"><span>0</span><span>2</span><span>4</span><span>6</span><span>8+ hrs</span></div>
          </div>
        )}
        {drawing && (
          <div className="map-ui top-center hint">
            {mode === "tree" ? "Tap the centre of the tree" : draftCount < 3 ? "Tap each corner" : "Tap the first point or press Finish to close the shape"}
          </div>
        )}
        {toast && <div className="toast" role="status">{toast}</div>}
      </main>

      <aside className="panel glass" ref={panelRef}>
        <p className="eyebrow">Step {step + 1} · {STEPS[step]}</p>

        {step === 0 && (
          <>
            <h1 className="title">{place ? "Outline your garden" : "Find your yard"}</h1>
            <p className="lede">
              {place
                ? "Trace the area you want to plant. Tap each corner on the map."
                : "Type your address. We'll pull up a photo of your yard from above and measure the sun it gets."}
            </p>
            <AddressSearch initial={initialQuery} onPick={(p) => { setProfileId(uid()); choosePlace(p); }} />
            {place && <p className="muted small place">{place.label}</p>}
            {place && !garden && mode !== "garden" && (
              <button className="btn primary" onClick={() => setMode("garden")}>Draw garden outline</button>
            )}
            {mode === "garden" && <DrawHelp count={draftCount} draftRef={draftRef} onCancel={() => setMode("idle")} />}
            {garden && measured && mode !== "garden" && (
              <>
                <div className="stats">
                  <Stat label="Area" value={`${fmt(measured.areaSqFt)} sq ft`} />
                  <Stat label="Edge length" value={`${fmt(measured.perimeterFt)} ft`} />
                </div>
                <p className="muted small">Side lengths are shown on the map.</p>
                <div className="row">
                  <button className="btn" onClick={() => setMode("garden")}>Redraw</button>
                  <button className="btn ghost" onClick={() => { setGarden(null); setTerrain({ state: "idle" }); }}>Clear</button>
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
            {grid.state === "loading" && <Busy text="Measuring trees and buildings near you…" />}
            {grid.state === "error" && <p className="warn">Couldn&apos;t load height data: {grid.message}</p>}
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
              </>
            )}
            {overlay && (
              <label className="check">
                <input type="checkbox" checked={overlayVisible} onChange={(e) => setOverlayVisible(e.target.checked)} /> Show sun map
              </label>
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
                <DrawHelp count={draftCount} draftRef={draftRef} onCancel={() => setMode("idle")} what={mode === "clear" ? "the removed area" : "its outline"} />
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

        {step === 2 && fit && (
          <BedsStep
            fit={fit} cols={allCols?.cols ?? 0} opts={bedOpts} setOpts={setBedOpts} suns={bedSuns}
            season={SEASON_SHORT[season]} sunBusy={sunBusy || grid.state === "loading"}
          />
        )}
        {step === 3 && (
          <PlantsStep picks={picks} setPicks={setPicks} bestSun={bestSun} frost={frost} kind={kindFilter} setKind={setKindFilter} bedSuns={bedSuns} />
        )}
        {step === 4 && <LayoutStep plan={plan} picks={picks} onPick={() => go(3)} />}
        {step === 5 && <ComingNext step={step} bedsFit={fit?.beds.length ?? 0} />}

        {step === 6 && (
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
            <p className="muted small">Saved in this browser for now. Free accounts that sync between your phone and computer come in a later update.</p>
          </>
        )}

        <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try { onOpen(await readSiteFile(f)); } catch (err) { setToast(String((err as Error).message)); }
          e.target.value = "";
        }} />

        <div className="stepnav">
          {step > 0 ? <button className="btn ghost" onClick={() => go(step - 1)}>Back</button> : <span />}
          {step < STEPS.length - 1 && (
            <button className="btn primary pill" onClick={() => go(step + 1)} disabled={!nextOk}>
              Next: {STEPS[step + 1]} →
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

// ---------- small pieces ----------

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

function DrawHelp({ count, draftRef, onCancel, what = "the corners" }: { count: number; draftRef: React.MutableRefObject<{ undo: () => void; finish: () => void } | null>; onCancel: () => void; what?: string }) {
  return (
    <div className="draw-help">
      <p>Tap {what} on the map ({count} so far). Tap the first point again, or press Finish, to close it.</p>
      <div className="row">
        <button className="btn primary" disabled={count < 3} onClick={() => draftRef.current?.finish()}>Finish</button>
        <button className="btn" disabled={count < 1} onClick={() => draftRef.current?.undo()}>Undo point</button>
        <button className="btn ghost" onClick={onCancel}>Cancel</button>
      </div>
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

const COMING: Record<number, { title: string; body: string; bullets: string[] }> = {
  2: {
    title: "Fit your raised beds",
    body: "Next, the app lays out 4 × 8 ft beds inside your outline, with paths wide enough for a wheelbarrow, and shows the sun hours for each bed.",
    bullets: ["Beds run north to south so they shade each other less", "Each bed gets its own sun number", "Turn any column into a walkway"],
  },
  3: {
    title: "Choose what to grow",
    body: "A catalog of common vegetables, herbs and fruit, each checked against your sun, your frost dates and your season length.",
    bullets: ["Tags like Fits, Needs more sun, Season too short", "Filter by what your family eats", "Every claim links to its Extension source"],
  },
  4: {
    title: "Lay out each bed",
    body: "Plants are placed bed by bed, with the sun lovers in your sunniest beds. Pairings are only called helpful when trials back them.",
    bullets: ["Spacing from Extension guides", "Tall crops on the north side", "A seed-to-harvest timeline for your dates"],
  },
  5: {
    title: "Preview the build",
    body: "See what it takes to build: lumber, soil, a critter fence and drip watering, each in good, better and best options with rough costs.",
    bullets: ["Cut list and shopping list", "Fence matched to the animals you have", "The full build plan comes with the paid plan"],
  },
};

function ComingNext({ step, bedsFit }: { step: number; bedsFit: number }) {
  const c = COMING[step];
  return (
    <>
      <h1 className="title">{c.title}</h1>
      <p className="badge">Coming in the next update</p>
      <p className="lede">{c.body}</p>
      {step === 2 && bedsFit > 0 && (
        <div className="stats">
          <Stat label="Beds that should fit, with paths" value={`About ${bedsFit}`} />
        </div>
      )}
      <ul className="bullets">
        {c.bullets.map((b) => <li key={b}>{b}</li>)}
      </ul>
      <p className="muted small">You can skip ahead and save your yard now. Your outline and sun study will carry over.</p>
    </>
  );
}

// ---------- step 3: beds ----------

function BedsStep({ fit, cols, opts, setOpts, suns, season, sunBusy }: {
  fit: ReturnType<typeof fitBeds>; cols: number; opts: BedOptions; setOpts: (o: BedOptions) => void;
  suns: (number | null)[] | null; season: string; sunBusy: boolean;
}) {
  const n = fit.beds.length;
  const full = suns ? suns.filter((h) => h != null && h >= 6).length : null;
  const toggleWalk = (c: number) => setOpts({ ...opts, walkways: opts.walkways.includes(c) ? opts.walkways.filter((x) => x !== c) : [...opts.walkways, c] });
  return (
    <>
      <h1 className="title">Fit your raised beds</h1>
      <p className="lede">4 × 8 ft beds, long side running north to south so they shade each other less, with paths between them.</p>
      {n === 0 ? (
        <p className="warn">No 4 × 8 ft bed fits inside this outline with {opts.pathFt} ft paths. Try narrower paths or redraw a larger area.</p>
      ) : (
        <div className="stats">
          <Stat label="Beds" value={`${n}`} />
          <Stat label="Growing area" value={`${n * opts.widthFt * opts.lengthFt} sq ft`} />
          <Stat label={`Full sun, ${season.toLowerCase()}`} value={full == null ? "…" : `${full} of ${n}`} />
        </div>
      )}
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
          <p className="muted small">Turn a column of beds into a wide front-to-back path. Columns are counted from the west.</p>
          <div className="chips">
            {Array.from({ length: cols }, (_, c) => (
              <button key={c} className={opts.walkways.includes(c) ? "chip on" : "chip"} aria-pressed={opts.walkways.includes(c)} onClick={() => toggleWalk(c)}>
                Column {String.fromCharCode(65 + c)}
              </button>
            ))}
          </div>
        </>
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

// ---------- step 4: plants ----------

const FIT_LABEL: Record<FitTag, string> = { fits: "Fits", "needs-sun": "Needs more sun", "season-short": "Season too short", fall: "Plant in fall", perennial: "Comes back yearly" };

function PlantsStep({ picks, setPicks, bestSun, frost, kind, setKind, bedSuns }: {
  picks: string[]; setPicks: (p: string[]) => void; bestSun: number | null; frost: SiteData["frost"] | null;
  kind: Kind | "all"; setKind: (k: Kind | "all") => void; bedSuns: (number | null)[] | null;
}) {
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
              {open === c.id && <CropFacts c={c} bedsOk={bedsOk} beds={bedSuns?.length ?? 0} frost={frost} />}
            </li>
          );
        })}
      </ul>
      <p className="muted small">{picks.length ? `${picks.length} crop${picks.length > 1 ? "s" : ""} picked.` : "Pick a few crops, then see them laid out in your beds."}</p>
    </>
  );
}

function CropFacts({ c, bedsOk, beds, frost }: { c: Crop; bedsOk: number | null; beds: number; frost: SiteData["frost"] | null }) {
  const pair = PAIRINGS.find((p) => p.a === c.id || p.b === c.id);
  const partner = pair && CROPS.find((x) => x.id === (pair.a === c.id ? pair.b : pair.a));
  return (
    <div className="facts">
      <p><b>Sun:</b> {c.sun === 6 ? "6+ hours" : c.sun === 4 ? "about 4+ hours (part shade is OK)" : "3 to 4 hours is enough"}
        {bedsOk != null && beds > 0 && <> · fits {bedsOk} of your {beds} beds</>}
        {SUN_PRACTICAL.has(c.id) ? <span className="label-pc">practical choice</span> : <> <Why href={SOURCES.isu.href} /></>}</p>
      <p><b>Spacing:</b> {c.spacing[0]} in{c.spacing[1] !== c.spacing[0] ? ` × ${c.spacing[1]} in` : " apart"} · about {plantsPerSquare(c)} per 4 × 4 ft square
        {c.spacingSource === "csu" ? <> <Why href={SOURCES.csu.href} /></> : <span className="label-pc">practical choice</span>}</p>
      <p><b>Harvest:</b> {c.perennial ? "the year after planting" : c.start === "fall" ? "next summer" : `about ${c.days} days ${c.start === "transplant" ? "after planting out" : "after sowing"}`}<span className="label-pc">packet guidance</span></p>
      <p><b>Goes in:</b> {c.warm ? `after your last frost${frost ? ` (${frost.lastSpring})` : ""}; it can't take frost` : c.start === "fall" ? "in fall" : "early, as a cool-season crop"}{c.start === "transplant" ? ", as plants" : c.start === "sets" ? ", from sets" : c.start === "seed" ? ", sown as seed" : ""}.</p>
      {c.note && <p>{c.note}</p>}
      {pair && partner && <p className="pair"><b>Pairs with {partner.name.toLowerCase()}:</b> {pair.claim} <a className="why" href={pair.source.href} target="_blank" rel="noreferrer">Why?</a></p>}
    </div>
  );
}

// ---------- step 5: layout ----------

function LayoutStep({ plan, picks, onPick }: { plan: ReturnType<typeof planBeds>; picks: string[]; onPick: () => void }) {
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
      <p className="lede">Each bed is split into a north and a south 4 × 4 ft square. Tall crops sit on the north end so they don&apos;t shade the rest.</p>
      <div className="bedgrid">
        {plan.beds.map((b) => (
          <figure key={b.n} className="bedcard">
            <figcaption><b>Bed {b.n}</b><span>{b.sun == null ? "" : `${fmt(b.sun, 1)} hrs sun`}</span></figcaption>
            <BedSvg north={b.north} south={b.south} />
            <dl className="bedkey">
              {([["N", b.north], ["S", b.south]] as const).map(([k, sq]) => (
                <div key={k} className={sq.lowSun ? "low" : ""}>
                  <dt>{k}</dt>
                  <dd>{sq.crop ? <><i style={{ background: dotColor(sq.crop.id) }} />{sq.crop.name.split(" /")[0].replace(" (flower)", "")} ×{sq.plants}</> : <span className="muted">open</span>}</dd>
                </div>
              ))}
            </dl>
          </figure>
        ))}
      </div>
      <p className="muted small">N is up. Dots show plant positions at Extension spacing.</p>
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

function BedSvg({ north, south }: { north: Square; south: Square }) {
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
    <svg viewBox="-1 -1 50 98" width="100%" role="img" aria-label={`North: ${north.crop?.name ?? "open"}. South: ${south.crop?.name ?? "open"}.`}>
      <rect x="0" y="0" width="48" height="96" rx="2" fill="#F4EFE6" stroke="#0B3530" strokeWidth="1" />
      <line x1="0" y1="48" x2="48" y2="48" stroke="#0B3530" strokeWidth="0.5" strokeDasharray="2 1.5" />
      {half(north, 0)}
      {half(south, 48)}
    </svg>
  );
}

// ---------- address search ----------

function AddressSearch({ onPick, initial = "" }: { onPick: (p: Place) => void; initial?: string }) {
  const [q, setQ] = useState(initial);
  const [items, setItems] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onChange = (v: string) => {
    setQ(v);
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
    setQ(p.label);
    setOpen(false);
    setItems([]);
    onPick(p);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    try {
      const d = await getJson<{ places: Place[] }>(`/api/geocode?q=${encodeURIComponent(q)}`);
      if (d.places[0]) pick(d.places[0]);
      else setMsg("No match. Try the full street address with city and state.");
    } catch {
      setMsg("Search isn't responding. Please try again.");
    } finally {
      setBusy(false);
    }
  };

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
      {msg && <p className="warn small">{msg}</p>}
    </form>
  );
}

