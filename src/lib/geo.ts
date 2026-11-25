import { area, booleanPointInPolygon, centroid, distance, length, lineString, point, polygon } from "@turf/turf";
import type { LngLat, Terrain, TerrainStats } from "./types";

export const M_TO_FT = 3.28084;
const R = 6378137;

export const toMerc = ([lon, lat]: LngLat): [number, number] => [
  (lon * Math.PI * R) / 180,
  R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)),
];
export const fromMerc = ([x, y]: [number, number]): LngLat => [
  (x / R) * (180 / Math.PI),
  (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * (180 / Math.PI),
];

export const closeRing = (ring: LngLat[]): LngLat[] => [...ring, ring[0]];
export const toPolygon = (ring: LngLat[]) => polygon([closeRing(ring)]);

export function measure(ring: LngLat[]) {
  const poly = toPolygon(ring);
  const sqm = area(poly);
  const perim = length(lineString(closeRing(ring)), { units: "meters" });
  const sides = ring.map((p, i) => {
    const q = ring[(i + 1) % ring.length];
    return {
      mid: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2] as LngLat,
      ft: distance(point(p), point(q), { units: "meters" }) * M_TO_FT,
    };
  });
  return { areaSqFt: sqm * M_TO_FT * M_TO_FT, perimeterFt: perim * M_TO_FT, sides };
}

export const ringCenter = (ring: LngLat[]): LngLat => centroid(toPolygon(ring)).geometry.coordinates as LngLat;

export const inRing = (p: LngLat, ring: LngLat[]) => booleanPointInPolygon(point(p), toPolygon(ring));

export function ringBbox(ring: LngLat[], padFraction = 0.25): [number, number, number, number] {
  const xs = ring.map((p) => p[0]);
  const ys = ring.map((p) => p[1]);
  let [w, s, e, n] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  const px = Math.max((e - w) * padFraction, 0.0002);
  const py = Math.max((n - s) * padFraction, 0.0002);
  w -= px; e += px; s -= py; n += py;
  return [w, s, e, n];
}

const COMPASS = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];

/** Slope and elevation inside the garden outline, from a bare-earth grid. */
export function terrainStats(t: Terrain, ring: LngLat[]): TerrainStats | null {
  const [w, s, e, n] = t.bounds;
  const lat = (s + n) / 2;
  const cellX = ((e - w) / t.cols) * 111320 * Math.cos((lat * Math.PI) / 180);
  const cellY = ((n - s) / t.rows) * 110574;
  const z = (c: number, r: number) => t.elevation[r * t.cols + c];
  let min = Infinity, max = -Infinity, slopeSum = 0, slopeMax = 0, count = 0, gxSum = 0, gySum = 0;
  for (let r = 1; r < t.rows - 1; r++) {
    for (let c = 1; c < t.cols - 1; c++) {
      const lon = w + ((c + 0.5) / t.cols) * (e - w);
      const la = n - ((r + 0.5) / t.rows) * (n - s);
      if (!inRing([lon, la], ring)) continue;
      const here = z(c, r), east = z(c + 1, r), west = z(c - 1, r), north = z(c, r - 1), south = z(c, r + 1);
      if ([here, east, west, north, south].some((v) => v == null || Number.isNaN(v))) continue;
      const gx = ((east as number) - (west as number)) / (2 * cellX); // rise per metre eastward
      const gy = ((north as number) - (south as number)) / (2 * cellY); // rise per metre northward
      const slope = Math.hypot(gx, gy) * 100;
      min = Math.min(min, here as number);
      max = Math.max(max, here as number);
      slopeSum += slope;
      slopeMax = Math.max(slopeMax, slope);
      gxSum += gx;
      gySum += gy;
      count++;
    }
  }
  if (!count) return null;
  // Ground faces the downhill direction: opposite the uphill gradient.
  const mag = Math.hypot(gxSum, gySum) / count;
  let facing: string | null = null;
  if (mag * 100 >= 0.5) {
    const bearing = (Math.atan2(-gxSum, -gySum) * 180) / Math.PI;
    facing = COMPASS[Math.round(((bearing + 360) % 360) / 45) % 8];
  }
  return {
    minFt: min * M_TO_FT,
    maxFt: max * M_TO_FT,
    avgSlopePct: slopeSum / count,
    maxSlopePct: slopeMax,
    facing,
  };
}

export function slopeAdvice(pct: number): string {
  if (pct < 1) return "Nearly flat. Water may sit after heavy rain, so raised beds or a slight crown help drainage.";
  if (pct < 5) return "Gentle slope. Good for gardening; rain drains off without washing soil away.";
  if (pct < 10) return "Moderate slope. Run beds across the slope (not up and down) to slow runoff.";
  return "Steep. Terraced or stepped beds will hold soil and water best.";
}

export const fmt = (n: number, digits = 0) => n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
export const uid = () => Math.random().toString(36).slice(2, 10);
