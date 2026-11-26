// "Sunnier spots nearby": slide the garden outline around the measured area and find places, clear of
// buildings and trees, where the same shape would get more direct sun. Pure geometry on the sun grid.
import type { LngLat, SiteObject, SurfaceGrid } from "./types";
import { applyObjects } from "./shade";
import { fromMerc, toMerc } from "./geo";

export type Spot = { id: string; ring: LngLat[]; center: LngLat; avg: number; gain: number; metres: number; dir: string };

function pointInPoly(x: number, y: number, poly: [number, number][]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const DIRS = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];

export function sunnierSpots(
  grid: Pick<SurfaceGrid, "cols" | "rows" | "bounds" | "cell" | "surface" | "ground" | "kind">,
  objects: SiteObject[], lat: number, lon: number,
  hours: Float32Array, garden: LngLat[], opts: { radiusM?: number; max?: number; minGain?: number } = {},
): { current: number; spots: Spot[] } | null {
  const { cols, rows, bounds } = grid;
  const step = (bounds[2] - bounds[0]) / cols;
  const k = step / grid.cell; // mercator metres per ground metre
  const poly = garden.map(toMerc);
  // Cells inside the outline, as offsets from the outline's own cells.
  const inside: [number, number][] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (pointInPoly(bounds[0] + (c + 0.5) * step, bounds[3] - (r + 0.5) * step, poly)) inside.push([c, r]);
  }
  if (inside.length < 4) return null;
  const { surface, ground, kind } = applyObjects({ grid, objects, lat, lon, season: "summer", year: 2026 });
  // Blocked: buildings, trees, and anything standing over 1 m (sheds, hedges, fences).
  const blocked = new Uint8Array(cols * rows);
  for (let i = 0; i < blocked.length; i++) blocked[i] = kind[i] === 1 || surface[i] - ground[i] > 1 ? 1 : 0;
  // Edge cells near the grid border have less reliable sun (rays leave the survey early): keep a margin.
  const margin = 4;
  const avgAt = (dc: number, dr: number) => {
    let s = 0;
    for (const [c, r] of inside) {
      const cc = c + dc, rr = r + dr;
      if (cc < margin || rr < margin || cc >= cols - margin || rr >= rows - margin) return null;
      const i = rr * cols + cc;
      if (blocked[i]) return null;
      s += hours[i];
    }
    return s / inside.length;
  };
  let cur = 0;
  for (const [c, r] of inside) cur += hours[r * cols + c];
  cur /= inside.length;

  // Stay close: at most one outline-width away (and never past radiusM), so suggestions are shifts
  // within the same yard rather than jumps to a street or a neighbour's lot.
  const xs0 = inside.map((p) => p[0]), ys0 = inside.map((p) => p[1]);
  const width = Math.max(Math.max(...xs0) - Math.min(...xs0), Math.max(...ys0) - Math.min(...ys0));
  const R = Math.min(Math.round(((opts.radiusM ?? 30) * k) / step), Math.round(width * 1.6));
  const cand: { dc: number; dr: number; avg: number }[] = [];
  for (let dr = -R; dr <= R; dr++) for (let dc = -R; dc <= R; dc++) {
    if (dc * dc + dr * dr > R * R) continue;
    const a = avgAt(dc, dr);
    if (a != null && a - cur >= (opts.minGain ?? 0.5)) cand.push({ dc, dr, avg: a });
  }
  cand.sort((a, b) => b.avg - a.avg);
  // Keep spots that don't overlap each other or the current outline much: centres at least one outline-width apart.
  const xs = inside.map((p) => p[0]), ys = inside.map((p) => p[1]);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * 1.05;
  const picked: typeof cand = [];
  for (const c of cand) {
    if (Math.hypot(c.dc, c.dr) < span) continue; // clear of the current outline
    if (picked.some((p) => Math.hypot(p.dc - c.dc, p.dr - c.dr) < span)) continue;
    picked.push(c);
    if (picked.length >= (opts.max ?? 3)) break;
  }
  const centroid = poly.reduce((a, p) => [a[0] + p[0] / poly.length, a[1] + p[1] / poly.length], [0, 0]);
  return {
    current: cur,
    spots: picked.map((p, i) => {
      const dx = p.dc * step, dy = -p.dr * step;
      const ang = (Math.atan2(dx, dy) * 180) / Math.PI;
      return {
        id: "ABC"[i],
        ring: poly.map(([x, y]) => fromMerc([x + dx, y + dy])),
        center: fromMerc([centroid[0] + dx, centroid[1] + dy]),
        avg: p.avg, gain: p.avg - cur,
        metres: Math.hypot(dx, dy) / k,
        dir: DIRS[Math.round(((ang + 360) % 360) / 45) % 8],
      };
    }),
  };
}
