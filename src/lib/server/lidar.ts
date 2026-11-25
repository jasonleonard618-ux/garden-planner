// Builds a 1 m "surface height" grid (ground, trees, roofs, fences) around a
// point from the free USGS 3DEP lidar point clouds hosted on AWS
// (s3://usgs-lidar-public, Entwine Point Tile format).
import { booleanPointInPolygon, point } from "@turf/turf";
import { Las } from "copc";
import index from "@/data/lidar-index.json";

type IndexEntry = { n: string; y: number; b: [number, number, number, number]; p: number[][][][] };
const LIDAR_INDEX = index as unknown as IndexEntry[];
const BUCKET = "https://s3-us-west-2.amazonaws.com/usgs-lidar-public";

const R = 6378137;
export const toMerc = (lon: number, lat: number): [number, number] => [
  (lon * Math.PI * R) / 180,
  R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)),
];

export type SurfaceGrid = {
  project: string;
  year: number;
  /** Grid cell size in metres on the ground. */
  cell: number;
  cols: number;
  rows: number;
  /** Web-mercator bounds of the grid [minX, minY, maxX, maxY]. */
  bounds: [number, number, number, number];
  /** Mercator scale factor at this latitude (mercator m per ground m). */
  k: number;
  /** Highest return per cell (metres, NAVD88). NaN where no data. Row 0 = north. */
  surface: number[];
  /** Ground height per cell (metres). NaN where no data. */
  ground: number[];
  /** What the highest return in each cell hit: 0 ground/unknown, 1 building, 2 vegetation. */
  kind: number[];
  /** True when the survey separates buildings from trees. */
  classified: boolean;
};

export function findProjects(lon: number, lat: number): IndexEntry[] {
  const pt = point([lon, lat]);
  return LIDAR_INDEX.filter(
    (e) =>
      lon >= e.b[0] && lon <= e.b[2] && lat >= e.b[1] && lat <= e.b[3] &&
      booleanPointInPolygon(pt, { type: "MultiPolygon", coordinates: e.p }),
  ).sort((a, b) => b.y - a.y);
}

type Ept = {
  bounds: number[];
  dataType: string;
  srs?: { horizontal?: string };
  schema: { name: string }[];
};

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`lidar fetch ${r.status} ${url}`);
  return (await r.json()) as T;
}

type Node = { key: string; d: number; x: number; y: number; z: number };

function nodeBounds(root: number[], n: Node) {
  const size = (root[3] - root[0]) / 2 ** n.d;
  return [root[0] + n.x * size, root[1] + n.y * size, root[0] + (n.x + 1) * size, root[1] + (n.y + 1) * size];
}

const overlaps = (a: number[], b: number[]) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

async function collectNodes(base: string, root: number[], box: number[]): Promise<Node[]> {
  const found: Node[] = [];
  const visit = async (startKey: string) => {
    const h = await getJson<Record<string, number>>(`${base}/ept-hierarchy/${startKey}.json`);
    const subtrees: string[] = [];
    for (const [key, count] of Object.entries(h)) {
      const [d, x, y, z] = key.split("-").map(Number);
      const n = { key, d, x, y, z };
      if (!overlaps(nodeBounds(root, n), box)) continue;
      if (count === -1) {
        if (key !== startKey) subtrees.push(key);
      } else if (count > 0) found.push(n);
    }
    await Promise.all(subtrees.map(visit));
  };
  await visit("0-0-0-0");
  return found;
}

/**
 * Surface grid for a square of `halfSize` ground metres around (lon, lat).
 * Returns null when no lidar project covers the point.
 */
export async function buildSurfaceGrid(lon: number, lat: number, halfSize = 80, cell = 1): Promise<SurfaceGrid | null> {
  const projects = findProjects(lon, lat);
  for (const proj of projects.slice(0, 3)) {
    try {
      const grid = await gridFromProject(proj, lon, lat, halfSize, cell);
      if (grid) return grid;
    } catch (e) {
      console.warn("lidar project failed", proj.n, e);
    }
  }
  return null;
}

async function gridFromProject(proj: IndexEntry, lon: number, lat: number, halfSize: number, cell: number) {
  const base = `${BUCKET}/${proj.n}`;
  const ept = await getJson<Ept>(`${base}/ept.json`);
  if (ept.dataType !== "laszip") return null;
  const horiz = ept.srs?.horizontal;
  if (horiz && horiz !== "3857") return null;

  const k = 1 / Math.cos((lat * Math.PI) / 180);
  const [cx, cy] = toMerc(lon, lat);
  const half = halfSize * k;
  const box = [cx - half, cy - half, cx + half, cy + half];
  const cols = Math.round((2 * halfSize) / cell);
  const rows = cols;
  const step = (2 * half) / cols;

  const nodes = await collectNodes(base, ept.bounds, box);
  if (!nodes.length) return null;
  if (nodes.length > 400) throw new Error(`too many lidar tiles (${nodes.length})`);

  const surface = new Float64Array(cols * rows).fill(-Infinity);
  const groundSum = new Float64Array(cols * rows);
  const groundN = new Uint32Array(cols * rows);
  const topClass = new Uint8Array(cols * rows);
  let sawBuilding = false;

  const queue = [...nodes];
  const worker = async () => {
    for (let n = queue.shift(); n; n = queue.shift()) {
      const r = await fetch(`${base}/ept-data/${n.key}.laz`);
      if (!r.ok) continue;
      const file = new Uint8Array(await r.arrayBuffer());
      const header = Las.Header.parse(file);
      const data = await Las.PointData.decompressFile(file);
      const view = Las.View.create(data, header);
      const gx = view.getter("X"), gy = view.getter("Y"), gz = view.getter("Z");
      const gc = view.getter("Classification");
      for (let i = 0; i < view.pointCount; i++) {
        const x = gx(i), y = gy(i);
        if (x < box[0] || x >= box[2] || y < box[1] || y >= box[3]) continue;
        const cls = gc(i);
        if (cls === 7 || cls === 18) continue; // noise
        const c = Math.floor((x - box[0]) / step);
        const rr = Math.floor((box[3] - y) / step);
        const idx = rr * cols + c;
        const z = gz(i);
        if (z > surface[idx]) { surface[idx] = z; topClass[idx] = cls; }
        if (cls === 6) sawBuilding = true;
        if (cls === 2) { groundSum[idx] += z; groundN[idx]++; }
      }
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));

  const surf: number[] = new Array(cols * rows);
  const ground: number[] = new Array(cols * rows);
  let filled = 0;
  for (let i = 0; i < surf.length; i++) {
    surf[i] = Number.isFinite(surface[i]) ? +surface[i].toFixed(2) : NaN;
    ground[i] = groundN[i] ? +(groundSum[i] / groundN[i]).toFixed(2) : NaN;
    if (Number.isFinite(surface[i])) filled++;
  }
  if (filled < surf.length * 0.3) return null;
  fillGaps(surf, cols, rows);
  fillGaps(ground, cols, rows, 30);
  const kind = Array.from(topClass, (c) => (c === 6 ? 1 : c >= 3 && c <= 5 ? 2 : 0));
  closeCanopy(surf, ground, kind, cols, rows);
  return {
    project: proj.n, year: proj.y, cell, cols, rows, k,
    bounds: box as [number, number, number, number],
    surface: surf, ground, kind, classified: sawBuilding,
  } satisfies SurfaceGrid;
}

/** Fill empty cells with the average of filled neighbours, repeating a few passes. */
function fillGaps(a: number[], cols: number, rows: number, passes = 6) {
  for (let p = 0; p < passes; p++) {
    let changed = 0;
    const copy = a.slice();
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (!Number.isNaN(copy[i])) continue;
      let s = 0, n = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
        const v = copy[rr * cols + cc];
        if (!Number.isNaN(v)) { s += v; n++; }
      }
      if (n) { a[i] = +(s / n).toFixed(2); changed++; }
    }
    if (!changed) break;
  }
}

/**
 * USGS surveys are usually flown with leaves off, so tree crowns come back
 * full of holes. A small "closing" (grow then shrink) of the height above
 * ground fills those holes so summer shade isn't underestimated.
 */
function closeCanopy(surf: number[], ground: number[], kind: number[], cols: number, rows: number) {
  const h = surf.map((s, i) => Math.max(0, s - ground[i]));
  const pass = (src: number[], fn: (a: number, b: number) => number) => {
    const out = src.slice();
    for (let r = 1; r < rows - 1; r++) for (let c = 1; c < cols - 1; c++) {
      const i = r * cols + c;
      if (kind[i] === 1) continue;
      let v = src[i];
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const j = (r + dr) * cols + c + dc;
        if (kind[j] !== 1) v = fn(v, src[j]);
      }
      out[i] = v;
    }
    return out;
  };
  const closed = pass(pass(h, Math.max), Math.min);
  for (let i = 0; i < surf.length; i++) {
    if (closed[i] > h[i] + 0.5 && closed[i] > 2) {
      surf[i] = +(ground[i] + closed[i]).toFixed(2);
      if (kind[i] === 0) kind[i] = 2;
    }
  }
}
