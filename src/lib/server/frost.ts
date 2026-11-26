import stations from "@/data/frost-stations.json";

/**
 * Frost dates from NOAA's 1991–2020 U.S. Climate Normals: the date of the last spring and first fall
 * freeze (32 °F) with a 50% chance, at the nearest normals station. The table is built offline by
 * scripts/build-frost-stations.py so the app doesn't depend on NOAA being up.
 */
type Row = [id: string, lat: number, lon: number, name: string, state: string, last: string, first: string];

export type Frost = {
  lastSpring: string; // "MM/DD"
  firstFall: string;
  frostFreeDays: number;
  station: string;
  stationName: string;
  distanceMiles: number;
  source: string;
};

const doy = (md: string) => {
  const [m, d] = md.split("/").map(Number);
  return Math.round((Date.UTC(2021, m - 1, d) - Date.UTC(2021, 0, 1)) / 864e5) + 1;
};

export function frostAt(lat: number, lon: number, maxMiles = 60): Frost | null {
  let best: Row | null = null, bestD = Infinity;
  const cos = Math.cos((lat * Math.PI) / 180);
  for (const r of stations as Row[]) {
    const dx = (r[2] - lon) * cos, dy = r[1] - lat;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = r; }
  }
  if (!best) return null;
  const miles = Math.sqrt(bestD) * 69.05;
  if (miles > maxMiles) return null;
  const days = doy(best[6]) - doy(best[5]);
  if (days <= 0) return null;
  return {
    lastSpring: best[5], firstFall: best[6], frostFreeDays: days,
    station: best[0], stationName: `${best[3]}, ${best[4]}`, distanceMiles: miles,
    source: "NOAA U.S. Climate Normals 1991–2020, 32 °F freeze dates at 50% probability",
  };
}
