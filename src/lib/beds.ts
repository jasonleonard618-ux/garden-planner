import type { LngLat } from "./types";
import { toMerc } from "./geo";

const FT = 0.3048;

export type Bed = {
  id: string;
  n: number; // 1-based label, numbered north to south, west to east
  col: number;
  row: number;
  ring: LngLat[]; // 4 corners, counter-clockwise
  center: LngLat;
};

export type BedOptions = { widthFt: number; lengthFt: number; pathFt: number; walkways: number[] };
export const DEFAULT_BEDS: BedOptions = { widthFt: 4, lengthFt: 8, pathFt: 3, walkways: [] };

function pointInPoly(x: number, y: number, poly: [number, number][]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Lay out raised beds inside the garden outline: long side running north-south
 * (beds shade each other least that way), in a grid with paths between them.
 * Tries a range of grid offsets and keeps the one that fits the most beds.
 * Walkway columns are left empty for a wide front-to-back path.
 */
export function fitBeds(ring: LngLat[], o: BedOptions = DEFAULT_BEDS): { beds: Bed[]; cols: number; rows: number } {
  const lat0 = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  const lon0 = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const mx = 111320 * Math.cos((lat0 * Math.PI) / 180), my = 110574;
  const local = ring.map(([lon, lat]) => [(lon - lon0) * mx, (lat - lat0) * my] as [number, number]);
  const back = (x: number, y: number): LngLat => [lon0 + x / mx, lat0 + y / my];
  const xs = local.map((p) => p[0]), ys = local.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const w = o.widthFt * FT, l = o.lengthFt * FT, gap = o.pathFt * FT;
  const sx = w + gap, sy = l + gap;
  const inside = (bx: number, by: number) => {
    const m = 0.05; // 5 cm tolerance so beds can sit right on the outline
    return [[bx + m, by + m], [bx + w - m, by + m], [bx + w - m, by + l - m], [bx + m, by + l - m]].every(([x, y]) => pointInPoly(x, y, local));
  };

  let best: { cells: { c: number; r: number; x: number; y: number }[]; cols: number; rows: number } = { cells: [], cols: 0, rows: 0 };
  const steps = 8;
  for (let i = 0; i < steps; i++) for (let j = 0; j < steps; j++) {
    const ox = x0 + (i / steps) * sx, oy = y0 + (j / steps) * sy;
    const cols = Math.floor((x1 - ox + gap) / sx), rows = Math.floor((y1 - oy + gap) / sy);
    const cells = [];
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
      const x = ox + c * sx, y = oy + r * sy;
      if (inside(x, y)) cells.push({ c, r, x, y });
    }
    if (cells.length > best.cells.length) best = { cells, cols, rows };
  }
  const used = best.cells.filter((k) => !o.walkways.includes(k.c));
  used.sort((a, b) => b.y - a.y || a.x - b.x);
  const beds = used.map((k, i) => ({
    id: `${k.c}-${k.r}`,
    n: i + 1,
    col: k.c,
    row: k.r,
    ring: [back(k.x, k.y), back(k.x + w, k.y), back(k.x + w, k.y + l), back(k.x, k.y + l)],
    center: back(k.x + w / 2, k.y + l / 2),
  }));
  return { beds, cols: best.cols, rows: best.rows };
}

/** Average direct-sun hours inside one bed, sampled from the shade grid (web mercator). */
export function bedSun(bed: Bed, hours: Float32Array, g: { cols: number; rows: number; bounds: [number, number, number, number] }) {
  const poly = bed.ring.map(toMerc);
  const step = (g.bounds[2] - g.bounds[0]) / g.cols;
  const bx = poly.map((p) => p[0]), by = poly.map((p) => p[1]);
  const c0 = Math.max(0, Math.floor((Math.min(...bx) - g.bounds[0]) / step));
  const c1 = Math.min(g.cols - 1, Math.ceil((Math.max(...bx) - g.bounds[0]) / step));
  const r0 = Math.max(0, Math.floor((g.bounds[3] - Math.max(...by)) / step));
  const r1 = Math.min(g.rows - 1, Math.ceil((g.bounds[3] - Math.min(...by)) / step));
  let n = 0, sum = 0;
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    if (!pointInPoly(g.bounds[0] + (c + 0.5) * step, g.bounds[3] - (r + 0.5) * step, poly)) continue;
    n++; sum += hours[r * g.cols + c];
  }
  if (!n) {
    // Bed smaller than one cell: use the cell under its centre.
    const [x, y] = toMerc(bed.center);
    const c = Math.floor((x - g.bounds[0]) / step), r = Math.floor((g.bounds[3] - y) / step);
    return c >= 0 && r >= 0 && c < g.cols && r < g.rows ? hours[r * g.cols + c] : null;
  }
  return sum / n;
}
