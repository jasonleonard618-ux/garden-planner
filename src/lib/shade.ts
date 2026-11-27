// Direct-sun hours per 1 m cell, by tracing a line toward the sun from each
// spot and checking whether a tree, roof or fence blocks it. Runs in a web
// worker so the page stays responsive.
import * as SunCalc from "suncalc";
import type { LngLat, Season, SiteObject, SurfaceGrid } from "./types";
import { fromMerc, toMerc } from "./geo";

export const SEASON_DATES: Record<Season, { label: string; month: number; day: number; leafOff: boolean }> = {
  spring: { label: "Early spring (Apr 15), leaves off", month: 3, day: 15, leafOff: true },
  summer: { label: "Midsummer (Jun 21), full leaf", month: 5, day: 21, leafOff: false },
  fall: { label: "Late summer (Sep 1), full leaf", month: 8, day: 1, leafOff: false },
};

export type ShadeInput = {
  grid: Pick<SurfaceGrid, "cols" | "rows" | "bounds" | "cell" | "surface" | "ground" | "kind">;
  objects: SiteObject[];
  lat: number;
  lon: number;
  season: Season;
  year: number;
};

const FT = 0.3048;
const OBSERVER_M = 0.3; // plant height we check sunlight at

function pointInPoly(x: number, y: number, poly: [number, number][]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Apply the person's own trees, structures and cleared areas to the height grid. */
export function applyObjects(input: ShadeInput) {
  const { grid, objects } = input;
  const { cols, rows, bounds } = grid;
  const step = (bounds[2] - bounds[0]) / cols; // mercator metres per cell
  const k = step / grid.cell;
  const ground = grid.ground.map((g, i) => (g == null ? (grid.surface[i] ?? 0) : g));
  const surface = grid.surface.map((s, i) => (s == null ? ground[i] : s));
  const kind = grid.kind.slice(); // 0 unknown, 1 solid, 2 leafy tree, 3 evergreen
  const cellCenter = (c: number, r: number): [number, number] => [bounds[0] + (c + 0.5) * step, bounds[3] - (r + 0.5) * step];

  for (const o of objects) {
    if (o.type === "tree") {
      const [mx, my] = toMerc(o.at);
      const radius = ((o.widthFt * FT) / 2) * k;
      const c0 = Math.floor((mx - bounds[0]) / step), r0 = Math.floor((bounds[3] - my) / step);
      const span = Math.ceil(radius / step) + 1;
      for (let r = r0 - span; r <= r0 + span; r++) for (let c = c0 - span; c <= c0 + span; c++) {
        if (r < 0 || c < 0 || r >= rows || c >= cols) continue;
        const [x, y] = cellCenter(c, r);
        const d = Math.hypot(x - mx, y - my);
        if (d > radius) continue;
        const i = r * cols + c;
        // Rounded crown: full height in the middle, lower toward the edge.
        const h = o.heightFt * FT * (0.6 + 0.4 * Math.sqrt(1 - (d / radius) ** 2));
        if (ground[i] + h > surface[i]) {
          surface[i] = ground[i] + h;
          kind[i] = o.leaves === "evergreen" ? 3 : 2;
        }
      }
    } else {
      const poly = o.ring.map((p) => toMerc(p));
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const [x, y] = cellCenter(c, r);
        if (!pointInPoly(x, y, poly)) continue;
        const i = r * cols + c;
        if (o.type === "clear") {
          surface[i] = ground[i];
          kind[i] = 0;
        } else {
          surface[i] = ground[i] + o.heightFt * FT;
          kind[i] = 1;
        }
      }
    }
  }
  return { surface, ground, kind };
}

/** Hours of direct sun for every cell on the season's date. */
export function sunHours(input: ShadeInput): Float32Array {
  const { grid, lat, lon, season, year } = input;
  const { cols, rows, cell } = grid;
  const { surface, ground, kind } = applyObjects(input);
  const leafOff = SEASON_DATES[season].leafOff;
  let maxZ = -Infinity;
  for (const s of surface) if (s > maxZ) maxZ = s;

  const { month, day } = SEASON_DATES[season];
  const noon = new Date(Date.UTC(year, month, day, 12 - Math.round(lon / 15)));
  const times = SunCalc.getTimes(noon, lat, lon);
  const stepMin = 15;
  const out = new Float32Array(cols * rows);

  if (!times.sunrise || !times.sunset) return out;
  for (let t = times.sunrise.getTime(); t < times.sunset.getTime(); t += stepMin * 60000) {
    const pos = SunCalc.getPosition(new Date(t + (stepMin / 2) * 60000), lat, lon);
    if (pos.altitude < 0.035) continue; // sun under ~2 degrees: ignore
    const bearing = pos.azimuth + Math.PI; // SunCalc azimuth is from south, clockwise
    const dc = Math.sin(bearing);
    const dr = -Math.cos(bearing);
    const rise = Math.tan(pos.altitude) * cell; // metres the ray climbs per cell
    const weight = stepMin / 60;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const z0 = ground[i] + OBSERVER_M;
        let light = 1;
        for (let s = 1; ; s++) {
          const need = z0 + s * rise;
          if (need > maxZ) break;
          const cc = Math.round(c + dc * s), rr = Math.round(r + dr * s);
          if (cc < 0 || rr < 0 || cc >= cols || rr >= rows) break;
          const j = rr * cols + cc;
          if (surface[j] > need) {
            if (leafOff && kind[j] === 2) {
              light *= 0.8; // bare branches let most light through
              if (light < 0.1) { light = 0; break; }
            } else {
              light = 0;
              break;
            }
          }
        }
        out[i] += light * weight;
      }
    }
  }
  return out;
}

/** Colour scale: deep shade (blue) → part sun (green) → full sun (yellow/orange). */
export function sunColor(hours: number): [number, number, number, number] {
  const stops: [number, [number, number, number]][] = [
    [0, [43, 45, 110]],
    [2, [52, 96, 160]],
    [4, [62, 150, 120]],
    [6, [190, 205, 70]],
    [8, [250, 200, 60]],
    [11, [245, 140, 50]],
  ];
  for (let i = 1; i < stops.length; i++) {
    if (hours <= stops[i][0]) {
      const [h0, c0] = stops[i - 1], [h1, c1] = stops[i];
      const f = (hours - h0) / (h1 - h0);
      return [0, 1, 2].map((k) => Math.round(c0[k] + f * (c1[k] - c0[k]))).concat(175) as [number, number, number, number];
    }
  }
  return [...stops[stops.length - 1][1], 175];
}

export function gridCorners(bounds: [number, number, number, number]): [LngLat, LngLat, LngLat, LngLat] {
  const [x0, y0, x1, y1] = bounds;
  return [fromMerc([x0, y1]), fromMerc([x1, y1]), fromMerc([x1, y0]), fromMerc([x0, y0])];
}

// ---------- sun study: where the shadows fall at one moment ----------

export type Prepared = { cols: number; rows: number; cell: number; surface: number[]; ground: number[]; kind: number[]; maxZ: number };

export function prepare(input: Pick<ShadeInput, "grid" | "objects">): Prepared {
  const { surface, ground, kind } = applyObjects(input as ShadeInput);
  let maxZ = -Infinity;
  for (const s of surface) if (s > maxZ) maxZ = s;
  const { cols, rows, cell } = input.grid;
  return { cols, rows, cell, surface, ground, kind: kind as number[], maxZ };
}

/** Light reaching each cell at one instant: 1 in sun, 0 in shadow, between for bare branches. */
export function lightAt(p: Prepared, when: Date, lat: number, lon: number, leafOff: boolean): Float32Array | null {
  const pos = SunCalc.getPosition(when, lat, lon);
  if (pos.altitude < 0.035) return null;
  const { cols, rows, cell, surface, ground, kind, maxZ } = p;
  const bearing = pos.azimuth + Math.PI;
  const dc = Math.sin(bearing), dr = -Math.cos(bearing);
  const rise = Math.tan(pos.altitude) * cell;
  const out = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const z0 = ground[i] + OBSERVER_M;
      let light = 1;
      for (let s = 1; ; s++) {
        const need = z0 + s * rise;
        if (need > maxZ) break;
        const cc = Math.round(c + dc * s), rr = Math.round(r + dr * s);
        if (cc < 0 || rr < 0 || cc >= cols || rr >= rows) break;
        const j = rr * cols + cc;
        if (surface[j] > need) {
          if (leafOff && kind[j] === 2) { light *= 0.8; if (light < 0.1) { light = 0; break; } }
          else { light = 0; break; }
        }
      }
      out[i] = light;
    }
  }
  return out;
}

/** US clock offset from UTC by longitude band, daylight saving on (all three study dates fall in it). */
export function clockOffsetHours(lon: number) {
  const std = lon > -87.5 ? -5 : lon > -101.5 ? -6 : lon > -114.5 ? -7 : lon > -140 ? -8 : -9;
  return std + 1;
}

export function dayWindow(season: Season, year: number, lat: number, lon: number) {
  const { month, day } = SEASON_DATES[season];
  const noon = new Date(Date.UTC(year, month, day, 12 - Math.round(lon / 15)));
  const t = SunCalc.getTimes(noon, lat, lon);
  return { rise: t.sunrise, set: t.sunset };
}
