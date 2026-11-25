"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fmt, measure, ringBbox, ringCenter, slopeAdvice, terrainStats, toMerc, uid } from "@/lib/geo";
import { gridCorners, SEASON_DATES, sunColor } from "@/lib/shade";
import { deleteSite, downloadSite, listSites, readSiteFile, saveSite } from "@/lib/storage";
import type { LngLat, Place, Season, SiteData, SiteObject, SiteProfile, SunStats, SurfaceGrid, Terrain, TerrainStats } from "@/lib/types";
import type { DrawMode } from "./MapView";
import WindRose from "./WindRose";

const MapView = dynamic(() => import("./MapView"), { ssr: false, loading: () => <div className="map map-loading" /> });

type Grid = SurfaceGrid & { fromLidar: boolean };
type Load<T> = { state: "idle" } | { state: "loading" } | { state: "error"; message: string } | { state: "done"; data: T };

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

export default function GardenApp() {
  // ---------- core state ----------
  const [place, setPlace] = useState<Place | null>(null);
  const [flyTo, setFlyTo] = useState<{ center: LngLat; zoom: number; key: number } | null>(null);
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
    choosePlace(p.place, { garden: p.garden, objects: p.objects ?? [] });
  };
  const fileInput = useRef<HTMLInputElement>(null);

  const drawing = mode !== "idle";
  const s = site.state === "done" ? site.data : null;
  const mainSoil = s?.soil?.components.find((c) => c.texture) ?? s?.soil?.components[0];

  return (
    <div className="app">
      <aside className="panel">
        <header className="brand">
          <LeafIcon />
          <div>
            <h1>Garden Planner</h1>
            <p>Step 1 · Map your site</p>
          </div>
        </header>

        <Section n={1} title="Find your property" done={!!place}>
          <AddressSearch onPick={(p) => { setProfileId(uid()); choosePlace(p); }} />
          {place && <p className="muted small">📍 {place.label}</p>}
        </Section>

        <Section n={2} title="Outline your garden" done={!!garden} disabled={!place}>
          {!garden && mode !== "garden" && (
            <>
              <p className="muted">Trace the area you want to plant. Tap each corner on the map.</p>
              <button className="btn primary" onClick={() => setMode("garden")} disabled={!place}>
                Draw garden outline
              </button>
            </>
          )}
          {mode === "garden" && <DrawHelp count={draftCount} draftRef={draftRef} onCancel={() => setMode("idle")} />}
          {garden && measured && mode !== "garden" && (
            <>
              <div className="stats">
                <Stat label="Area" value={`${fmt(measured.areaSqFt)} sq ft`} />
                <Stat label="Edge length" value={`${fmt(measured.perimeterFt)} ft`} />
              </div>
              <p className="muted small">Side lengths are shown on the map. About {fmt(measured.areaSqFt / 32, 0)} raised beds of 4 × 8 ft would fit edge to edge.</p>
              <div className="row">
                <button className="btn" onClick={() => setMode("garden")}>Redraw</button>
                <button className="btn ghost" onClick={() => { setGarden(null); setTerrain({ state: "idle" }); }}>Clear</button>
              </div>
            </>
          )}
        </Section>

        <Section n={3} title="Sun and shade" done={!!sunStats} disabled={!place}>
          <div className="tabs" role="tablist">
            {SEASONS.map((k) => (
              <button key={k} role="tab" aria-selected={season === k} className={season === k ? "tab on" : "tab"} onClick={() => setSeason(k)}>
                {SEASON_SHORT[k]}
              </button>
            ))}
          </div>
          <p className="muted small">{SEASON_DATES[season].label}</p>
          {grid.state === "loading" && <Busy text="Loading tree and building heights…" />}
          {grid.state === "error" && <p className="warn">Couldn&apos;t load height data: {grid.message}</p>}
          {grid.state === "done" && sunBusy && <Busy text="Tracing the sun across your yard…" />}
          {grid.state === "done" && !grid.data.fromLidar && (
            <p className="warn">No lidar survey covers this spot yet, so trees and buildings aren&apos;t included automatically. Add them below and the map will update.</p>
          )}
          {sunStats ? (
            <>
              <div className="stats">
                <Stat label="Average direct sun" value={`${fmt(sunStats.avgHours, 1)} hrs/day`} />
              </div>
              <SunBar stats={sunStats} />
              <p className="muted small">{sunAdvice(sunStats)}</p>
            </>
          ) : (
            grid.state === "done" && !garden && <p className="muted small">The colours on the map show direct sun per spot. Outline your garden to get its numbers.</p>
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
                  <select value={treeForm.leaves} onChange={(e) => setTreeForm({ ...treeForm, leaves: e.target.value as "deciduous" | "evergreen" })}>
                    <option value="deciduous">Loses leaves in winter</option>
                    <option value="evergreen">Evergreen</option>
                  </select>
                  <button className="btn" onClick={() => setMode("tree")} disabled={!place}>Place tree</button>
                </fieldset>
                <fieldset>
                  <legend>Building, shed or fence</legend>
                  <label>Name <input value={structForm.label} onChange={(e) => setStructForm({ ...structForm, label: e.target.value })} /></label>
                  <label>Height <input type="number" min={1} max={80} value={structForm.heightFt} onChange={(e) => setStructForm({ ...structForm, heightFt: +e.target.value })} /> ft</label>
                  <button className="btn" onClick={() => setMode("structure")} disabled={!place}>Draw outline</button>
                </fieldset>
                <button className="btn ghost" onClick={() => setMode("clear")} disabled={!place}>Mark something as removed</button>
              </div>
            )}
            {objects.length > 0 && (
              <ul className="obj-list">
                {objects.map((o) => (
                  <li key={o.id}>
                    <span>
                      {o.type === "tree" ? `🌳 Tree, ${o.heightFt} ft tall, ${o.leaves}` : o.type === "structure" ? `🏠 ${o.label}, ${o.heightFt} ft` : "✂️ Removed area"}
                    </span>
                    <button className="link" onClick={() => setObjects((all) => all.filter((x) => x.id !== o.id))}>Remove</button>
                  </li>
                ))}
              </ul>
            )}
          </details>
          {grid.state === "done" && grid.data.fromLidar && (
            <p className="source">Heights from USGS 3DEP lidar ({grid.data.project.replace(/_/g, " ")}, {grid.data.year || "date unknown"}). Sun path from SunCalc.</p>
          )}
        </Section>

        <Section n={4} title="Slope and elevation" done={!!tStats} disabled={!garden}>
          {!garden && <p className="muted small">Outline your garden first.</p>}
          {terrain.state === "loading" && <Busy text="Checking the ground…" />}
          {terrain.state === "error" && <p className="warn">Couldn&apos;t load elevation: {terrain.message}</p>}
          {tStats && (
            <>
              <div className="stats">
                <Stat label="Average slope" value={`${fmt(tStats.avgSlopePct, 1)}%`} />
                <Stat label="Height change" value={`${fmt(tStats.maxFt - tStats.minFt, 1)} ft`} />
                <Stat label="Faces" value={tStats.facing ? cap(tStats.facing) : "Level"} />
              </div>
              <p className="muted small">{slopeAdvice(tStats.avgSlopePct)}{tStats.facing && ["south", "southeast", "southwest"].includes(tStats.facing) ? " A south-leaning slope warms up early in spring, which is a plus." : ""}</p>
              <p className="source">Bare-earth elevation from USGS 3DEP. Ground about {fmt(tStats.minFt)}–{fmt(tStats.maxFt)} ft above sea level.</p>
            </>
          )}
          {terrain.state === "done" && !tStats && <p className="muted small">The outline is too small to measure slope. Try a larger area.</p>}
        </Section>

        <Section n={5} title="Climate, wind and soil" done={site.state === "done"} disabled={!place}>
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
                    <p>Mostly from the <strong>{s.wind.prevailing}</strong>. Strongest winds from the <strong>{s.wind.strongest}</strong>.</p>
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
                  <p className="source">USDA NRCS soil survey: {s.soil.mapUnit}. Yards are often regraded, so a $20 soil test from your county Extension office is worth doing before planting.</p>
                </>
              ) : (
                <p className="muted small">No soil survey data for this spot.</p>
              )}
            </>
          )}
        </Section>

        <Section n={6} title="Save this site" done={saved.some((p) => p.id === profileId)} disabled={!place}>
          <label className="field">
            Name
            <input value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="Back yard" />
          </label>
          <div className="row">
            <button className="btn primary" onClick={onSave} disabled={!place}>Save</button>
            <button className="btn" onClick={() => { const p = buildProfile(); if (p) downloadSite(p); }} disabled={!place}>Download file</button>
          </div>
          <p className="muted small">Saved on this device for now. Accounts that sync between your phone and computer come later.</p>
        </Section>

        {saved.length > 0 && (
          <section className="card saved">
            <h2>Your saved sites</h2>
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
        <div className="footer-actions">
          <button className="link" onClick={() => fileInput.current?.click()}>Open a downloaded site file</button>
          <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try { onOpen(await readSiteFile(f)); } catch (err) { setToast(String((err as Error).message)); }
            e.target.value = "";
          }} />
        </div>
      </aside>

      <main className="mapwrap">
        <MapView
          flyTo={flyTo}
          imagery={imagery}
          garden={garden}
          objects={objects}
          overlay={overlay}
          overlayVisible={overlayVisible}
          marker={place && !garden ? [place.lon, place.lat] : null}
          mode={mode}
          onRingComplete={onRingComplete}
          onPoint={onPoint}
          draftRef={draftRef}
          onDraftChange={setDraftCount}
        />
        <div className="map-ui top-left">
          <div className="seg">
            <button className={imagery === "usgs" ? "on" : ""} onClick={() => setImagery("usgs")}>USGS aerial</button>
            <button className={imagery === "esri" ? "on" : ""} onClick={() => setImagery("esri")}>Esri satellite</button>
          </div>
        </div>
        {overlay && overlayVisible && (
          <div className="map-ui bottom-left legend">
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
        {!place && (
          <div className="map-ui center welcome">
            <h2>Plan your garden from above</h2>
            <p>Search your address to see your yard, measure a garden spot, and find out how much sun, wind and slope it gets.</p>
          </div>
        )}
        {toast && <div className="toast" role="status">{toast}</div>}
      </main>
    </div>
  );
}

// ---------- small pieces ----------

function Section({ n, title, done, disabled, children }: { n: number; title: string; done?: boolean; disabled?: boolean; children: React.ReactNode }) {
  return (
    <section className={`card${disabled ? " disabled" : ""}`}>
      <h2>
        <span className={done ? "num done" : "num"}>{done ? "✓" : n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
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

function LeafIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden>
      <circle cx="17" cy="17" r="17" fill="#2f4a3a" />
      <path d="M10 23c0-8 6-13 15-13-1 9-6 14-13 14l-2 2" fill="none" stroke="#cfe3b8" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 22c3-4 6-6 9-8" fill="none" stroke="#cfe3b8" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

// ---------- address search ----------

function AddressSearch({ onPick }: { onPick: (p: Place) => void }) {
  const [q, setQ] = useState("");
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

