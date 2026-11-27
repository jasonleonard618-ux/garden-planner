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

export type Orient = "auto" | "ns" | "outline" | "ew";
export type BedOptions = { widthFt: number; lengthFt: number; pathFt: number; walkways: number[]; edgeFt?: number; orient?: Orient };
export type BedFit = {
  beds: Bed[]; cols: number; rows: number;
  /** The direction actually used, and how many beds each direction fits (outline is null when it matches N–S or E–W). */
  orient: Exclude<Orient, "auto">; counts: { ns: number; outline: number | null; ew: number };
  /** Bearing of the beds' long side, degrees clockwise from north, in (-90, 90]. */
  angle: number;
  /** Names for the two 4 × 4 halves and for where columns are counted from. */
  ends: ["north", "south"] | ["west", "east"]; colsFrom: "west" | "north";
};
// edgeFt keeps beds off the outline so there is room to walk and for a fence apron (practical choice).
export const DEFAULT_BEDS: BedOptions = { widthFt: 4, lengthFt: 8, pathFt: 3, walkways: [], edgeFt: 1.5, orient: "auto" };

function pointInPoly(x: number, y: number, poly: [number, number][]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const norm = (deg: number) => { let a = ((deg % 180) + 180) % 180; if (a > 90) a -= 180; return a === -90 ? 90 : a; };

/** Bearing of the outline's longest side, in (-90, 90]. */
function outlineAngle(local: [number, number][]) {
  let best = 0, len = -1;
  for (let i = 0; i < local.length; i++) {
    const [ax, ay] = local[i], [bx, by] = local[(i + 1) % local.length];
    const d = Math.hypot(bx - ax, by - ay);
    if (d > len) { len = d; best = (Math.atan2(bx - ax, by - ay) * 180) / Math.PI; }
  }
  return norm(best);
}

/**
 * Lay out raised beds inside the garden outline, in a grid with paths between them. The beds' long
 * side can run north–south (they shade each other least that way), along the outline's longest side,
 * or east–west; "auto" tries all three and keeps the one that fits the most beds, preferring
 * north–south on a tie. Each direction tries a range of grid offsets. Walkway columns stay empty.
 */
export function fitBeds(ring: LngLat[], o: BedOptions = DEFAULT_BEDS): BedFit {
  const lat0 = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  const lon0 = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const mx = 111320 * Math.cos((lat0 * Math.PI) / 180), my = 110574;
  const local = ring.map(([lon, lat]) => [(lon - lon0) * mx, (lat - lat0) * my] as [number, number]);
  const oa = outlineAngle(local);
  const outlineDistinct = Math.abs(oa) > 5 && Math.abs(oa) < 85;
  const angles = { ns: 0, outline: oa, ew: 90 } as const;
  const runs = {
    ns: fitAt(local, o, 0),
    ew: fitAt(local, o, 90),
    outline: outlineDistinct ? fitAt(local, o, oa) : null,
  };
  const counts = { ns: runs.ns.count, ew: runs.ew.count, outline: runs.outline?.count ?? null };
  let orient: Exclude<Orient, "auto"> = o.orient && o.orient !== "auto" ? o.orient : "ns";
  if (orient === "outline" && !runs.outline) orient = "ns";
  if (!o.orient || o.orient === "auto") {
    if (counts.ew > counts.ns) orient = "ew";
    if ((counts.outline ?? -1) > Math.max(counts.ns, counts.ew)) orient = "outline";
  }
  const run = runs[orient]!;
  const angle = angles[orient];
  const back = (x: number, y: number): LngLat => [lon0 + x / mx, lat0 + y / my];
  const ew = Math.abs(angle) > 45;
  return {
    beds: run.cells(back), cols: run.cols, rows: run.rows, orient, counts, angle,
    ends: ew ? ["west", "east"] : ["north", "south"], colsFrom: ew ? "north" : "west",
  };
}

function fitAt(localIn: [number, number][], o: BedOptions, angleDeg: number) {
  // Rotate the outline clockwise by the bed angle so the beds' long side points straight "up".
  const t = (angleDeg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
  const local = localIn.map(([x, y]) => [x * c - y * s, x * s + y * c] as [number, number]);
  const unrot = (x: number, y: number): [number, number] => [x * c + y * s, -x * s + y * c];
  const xs = local.map((p) => p[0]), ys = local.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const w = o.widthFt * FT, l = o.lengthFt * FT, gap = o.pathFt * FT;
  const sx = w + gap, sy = l + gap;
  const e = (o.edgeFt ?? 1.5) * FT;
  const inside = (bx: number, by: number) =>
    [[bx - e, by - e], [bx + w + e, by - e], [bx + w + e, by + l + e], [bx - e, by + l + e], [bx + w / 2, by - e], [bx + w / 2, by + l + e], [bx - e, by + l / 2], [bx + w + e, by + l / 2]]
      .every(([x, y]) => pointInPoly(x, y, local));

  let best: { cells: { c: number; r: number; x: number; y: number }[]; cols: number; rows: number } = { cells: [], cols: 0, rows: 0 };
  const steps = 8;
  for (let i = 0; i < steps; i++) for (let j = 0; j < steps; j++) {
    const ox = x0 + (i / steps) * sx, oy = y0 + (j / steps) * sy;
    const cols = Math.floor((x1 - ox + gap) / sx), rows = Math.floor((y1 - oy + gap) / sy);
    const cells = [];
    for (let cc = 0; cc < cols; cc++) for (let r = 0; r < rows; r++) {
      const x = ox + cc * sx, y = oy + r * sy;
      if (inside(x, y)) cells.push({ c: cc, r, x, y });
    }
    if (cells.length > best.cells.length) best = { cells, cols, rows };
  }
  const usedAll = best.cells.filter((k) => !o.walkways.includes(k.c));
  // Number beds row by row from the top of the grid (north), left to right (west).
  usedAll.sort((a, b) => b.y - a.y || a.x - b.x);
  return {
    count: best.cells.length, cols: best.cols, rows: best.rows,
    cells: (back: (x: number, y: number) => LngLat): Bed[] => usedAll.map((k, i) => {
      const pt = (x: number, y: number) => back(...unrot(x, y));
      return {
        id: `${k.c}-${k.r}`, n: i + 1, col: k.c, row: k.r,
        // corners: SW-ish, SE, NE, NW in the bed's own frame; the "north" end is y + l
        ring: [pt(k.x, k.y), pt(k.x + w, k.y), pt(k.x + w, k.y + l), pt(k.x, k.y + l)],
        center: pt(k.x + w / 2, k.y + l / 2),
      };
    }),
  };
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

/**
 * The working garden around a set of beds: a rectangle lined up with the beds, marginFt outside their
 * outer edges (the same walking edge the beds keep from a drawn outline). Fence and drip follow this
 * when only some of the beds that fit are being built.
 */
export function bedsArea(beds: Bed[], angleDeg: number, marginFt: number): LngLat[] {
  const pts = beds.flatMap((b) => b.ring);
  const lat0 = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  const lon0 = pts.reduce((a, p) => a + p[0], 0) / pts.length;
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180) * 3.28084, ky = 110574 * 3.28084;
  const a = (angleDeg * Math.PI) / 180;
  const u: [number, number] = [Math.sin(a), Math.cos(a)], v: [number, number] = [Math.cos(a), -Math.sin(a)];
  const loc = pts.map((p) => [(p[0] - lon0) * kx, (p[1] - lat0) * ky]);
  const us = loc.map((p) => p[0] * u[0] + p[1] * u[1]), vs = loc.map((p) => p[0] * v[0] + p[1] * v[1]);
  const [u0, u1, v0, v1] = [Math.min(...us) - marginFt, Math.max(...us) + marginFt, Math.min(...vs) - marginFt, Math.max(...vs) + marginFt];
  const back = (pu: number, pv: number): LngLat => {
    const x = pu * u[0] + pv * v[0], y = pu * u[1] + pv * v[1];
    return [lon0 + x / kx, lat0 + y / ky];
  };
  return [back(u0, v0), back(u1, v0), back(u1, v1), back(u0, v1)];
}
