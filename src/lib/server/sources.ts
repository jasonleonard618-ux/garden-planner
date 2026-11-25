// Thin wrappers around the free public data sources the app uses.
// Each one is isolated here so a source can be swapped later without
// touching the rest of the app.
import { fromArrayBuffer } from "geotiff";

const UA = { "User-Agent": "garden-planner/0.1" };

async function fetchJson<T>(url: string, init?: RequestInit, timeoutMs = 20000): Promise<T> {
  const r = await fetch(url, { ...init, headers: { ...UA, ...(init?.headers ?? {}) }, signal: AbortSignal.timeout(timeoutMs) });
  if (!r.ok) throw new Error(`${r.status} from ${new URL(url).host}`);
  return (await r.json()) as T;
}

// ---------- Address search ----------

export type Place = { label: string; lat: number; lon: number; zip?: string; state?: string };

/** Type-ahead suggestions (Photon / OpenStreetMap), limited to the US. */
export async function suggest(q: string): Promise<Place[]> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=8&lang=en&lat=39.8&lon=-98.6&location_bias_scale=0.1`;
  const d = await fetchJson<{ features: { properties: Record<string, string>; geometry: { coordinates: [number, number] } }[] }>(url);
  return d.features
    .filter((f) => f.properties.countrycode === "US")
    .slice(0, 6)
    .map((f) => {
      const p = f.properties;
      const street = [p.housenumber, p.street].filter(Boolean).join(" ");
      const first = street || p.name;
      const label = [first, p.city ?? p.county, [p.state, p.postcode].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(", ");
      return { label, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], zip: p.postcode, state: p.state };
    });
}

/** Exact street-address match from the US Census Bureau geocoder. */
export async function geocodeAddress(q: string): Promise<Place[]> {
  const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(q)}&benchmark=Public_AR_Current&format=json`;
  const d = await fetchJson<{
    result: { addressMatches: { matchedAddress: string; coordinates: { x: number; y: number }; addressComponents: { zip: string; state: string } }[] };
  }>(url);
  return d.result.addressMatches.map((m) => ({
    label: m.matchedAddress,
    lat: m.coordinates.y,
    lon: m.coordinates.x,
    zip: m.addressComponents.zip,
    state: m.addressComponents.state,
  }));
}

/** ZIP code and state for a point (Census). */
export async function reverseLookup(lat: number, lon: number): Promise<{ zip?: string; state?: string; county?: string }> {
  const layers = encodeURIComponent("2020 Census ZIP Code Tabulation Areas,States,Counties");
  const url = `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lon}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&layers=${layers}&format=json`;
  const d = await fetchJson<{ result: { geographies: Record<string, Record<string, string>[]> } }>(url);
  const g = d.result.geographies;
  return {
    zip: g["2020 Census ZIP Code Tabulation Areas"]?.[0]?.BASENAME,
    state: g["States"]?.[0]?.STUSAB,
    county: g["Counties"]?.[0]?.NAME,
  };
}

// ---------- Hardiness zone ----------

export type Zone = { zone: string; tempRangeF: string };

export async function hardinessZone(zip: string): Promise<Zone | null> {
  try {
    const d = await fetchJson<{ zone: string; temperature_range: string }>(`https://phzmapi.org/${zip}.json`);
    return { zone: d.zone, tempRangeF: d.temperature_range };
  } catch {
    return null;
  }
}

// ---------- Soil ----------

export type Soil = {
  mapUnit: string;
  components: {
    name: string;
    percent: number;
    drainage: string | null;
    hydrologicGroup: string | null;
    texture: string | null;
    ph: number | null;
    organicMatter: number | null;
    sand: number | null;
    clay: number | null;
  }[];
};

export async function soilAt(lat: number, lon: number): Promise<Soil | null> {
  const query = `SELECT mu.muname, c.compname, c.comppct_r, c.drainagecl, c.hydgrp,
      ch.ph1to1h2o_r, ch.om_r, ch.sandtotal_r, ch.claytotal_r
    FROM mapunit mu
    INNER JOIN component c ON c.mukey = mu.mukey AND c.majcompflag = 'Yes'
    LEFT JOIN chorizon ch ON ch.cokey = c.cokey AND ch.hzdept_r = 0
    WHERE mu.mukey IN (SELECT * FROM SDA_Get_Mukey_from_intersection_with_WktWgs84('point(${lon.toFixed(6)} ${lat.toFixed(6)})'))
    ORDER BY c.comppct_r DESC`;
  const d = await fetchJson<{ Table?: (string | null)[][] }>(
    "https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ format: "JSON+COLUMNNAME", query }) },
    30000,
  );
  const rows = d.Table?.slice(1) ?? [];
  if (!rows.length) return null;
  const num = (v: string | null) => (v == null ? null : Number(v));
  return {
    mapUnit: rows[0][0] ?? "",
    components: rows.map((r) => {
      const sand = num(r[7]);
      const clay = num(r[8]);
      return {
        name: r[1] ?? "",
        percent: Number(r[2] ?? 0),
        drainage: r[3],
        hydrologicGroup: r[4],
        ph: num(r[5]),
        organicMatter: num(r[6]),
        sand,
        clay,
        texture: sand != null && clay != null ? textureClass(sand, clay) : null,
      };
    }),
  };
}

/** USDA soil texture triangle. */
export function textureClass(sand: number, clay: number): string {
  const silt = 100 - sand - clay;
  if (silt + 1.5 * clay < 15) return "sand";
  if (silt + 1.5 * clay >= 15 && silt + 2 * clay < 30) return "loamy sand";
  if ((clay >= 7 && clay < 20 && sand > 52 && silt + 2 * clay >= 30) || (clay < 7 && silt < 50 && silt + 2 * clay >= 30)) return "sandy loam";
  if (clay >= 7 && clay < 27 && silt >= 28 && silt < 50 && sand <= 52) return "loam";
  if ((silt >= 50 && clay >= 12 && clay < 27) || (silt >= 50 && silt < 80 && clay < 12)) return "silt loam";
  if (silt >= 80 && clay < 12) return "silt";
  if (clay >= 20 && clay < 35 && silt < 28 && sand > 45) return "sandy clay loam";
  if (clay >= 27 && clay < 40 && sand > 20 && sand <= 45) return "clay loam";
  if (clay >= 27 && clay < 40 && sand <= 20) return "silty clay loam";
  if (clay >= 35 && sand > 45) return "sandy clay";
  if (clay >= 40 && silt >= 40) return "silty clay";
  return "clay";
}

// ---------- Wind ----------

export type Wind = {
  station: string;
  stationName: string;
  distanceMiles: number;
  period: string;
  calmPercent: number;
  /** 16 compass sectors starting at N, percent of time wind blows FROM each. */
  sectors: { dir: string; percent: number; strongPercent: number }[];
  prevailing: string;
  strongest: string;
};

const DIRS16 = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

function miles(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toR = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * toR) / 2) ** 2 + Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin(((lon2 - lon1) * toR) / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(a));
}

export async function windAt(lat: number, lon: number, state: string): Promise<Wind | null> {
  type Feat = { properties: { sid: string; sname: string; archive_begin: string | null; archive_end: string | null; online: boolean }; geometry: { coordinates: [number, number] } };
  const net = `${state}_ASOS`;
  const d = await fetchJson<{ features: Feat[] }>(`https://mesonet.agron.iastate.edu/geojson/network/${net}.geojson`);
  const thisYear = new Date().getUTCFullYear();
  const candidates = d.features
    .filter((f) => f.properties.online && f.properties.archive_end == null && f.properties.archive_begin && Number(f.properties.archive_begin.slice(0, 4)) <= thisYear - 6)
    .map((f) => ({ f, dist: miles(lat, lon, f.geometry.coordinates[1], f.geometry.coordinates[0]) }))
    .sort((a, b) => a.dist - b.dist);
  const best = candidates[0];
  if (!best) return null;
  const y2 = thisYear - 1;
  const y1 = y2 - 4;
  const url =
    `https://mesonet.agron.iastate.edu/cgi-bin/mywindrose.py?network=${net}&station=${best.f.properties.sid}` +
    `&year1=${y1}&month1=4&day1=1&hour1=0&year2=${y2}&month2=10&day2=31&hour2=23&units=mph&justdata=1&limit_by_doy=1&nsector=16`;
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) });
  if (!r.ok) return null;
  const text = await r.text();
  const lines = text.split("\n").filter((l) => /^\d{3}-\d{3}/.test(l));
  if (lines.length !== 16) return null;
  let calm = 0;
  const sectors = lines.map((l, i) => {
    const cells = l.split(",").map((s) => s.trim());
    if (i === 0 && cells[1]) calm = Number(cells[1]);
    const vals = cells.slice(2).map(Number);
    const total = vals.reduce((a, b) => a + b, 0);
    const strong = vals.slice(3).reduce((a, b) => a + b, 0); // 10 mph and up
    return { dir: DIRS16[i], percent: +total.toFixed(2), strongPercent: +strong.toFixed(2) };
  });
  const prevailing = [...sectors].sort((a, b) => b.percent - a.percent)[0].dir;
  const strongest = [...sectors].sort((a, b) => b.strongPercent - a.strongPercent)[0].dir;
  return {
    station: best.f.properties.sid,
    stationName: best.f.properties.sname,
    distanceMiles: +best.dist.toFixed(1),
    period: `Apr–Oct, ${y1}–${y2}`,
    calmPercent: calm,
    sectors,
    prevailing,
    strongest,
  };
}

// ---------- Bare-earth elevation (USGS 3DEP) ----------

export type Terrain = { cols: number; rows: number; bounds: [number, number, number, number]; elevation: number[] };

/** Bare-earth elevation grid (metres) over a lon/lat box, from the USGS 3DEP elevation service. */
export async function terrain(bbox: [number, number, number, number], size = 64): Promise<Terrain> {
  const url =
    `https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage?` +
    `bbox=${bbox.join(",")}&bboxSR=4326&imageSR=4326&size=${size},${size}&format=tiff&pixelType=F32` +
    `&interpolation=RSP_BilinearInterpolation&f=image`;
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`3DEP ${r.status}`);
  const tiff = await fromArrayBuffer(await r.arrayBuffer());
  const img = await tiff.getImage();
  const [band] = (await img.readRasters()) as unknown as Float32Array[];
  return {
    cols: img.getWidth(),
    rows: img.getHeight(),
    bounds: bbox,
    elevation: Array.from(band, (v) => (v < -1000 || !Number.isFinite(v) ? NaN : +v.toFixed(2))),
  };
}
