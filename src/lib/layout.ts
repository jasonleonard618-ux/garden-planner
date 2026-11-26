import { CROPS, PAIRINGS, plantsPerSquare, type Crop } from "@/data/crops";

export type Square = { bed: number; half: "north" | "south"; sun: number | null; crop: Crop | null; plants: number; lowSun: boolean };
export type Plan = { beds: { n: number; sun: number | null; north: Square; south: Square }[]; unplaced: Crop[]; pairs: typeof PAIRINGS };

/**
 * Splits each 4 × 8 bed into a north and a south 4 × 4 square and gives each picked crop one
 * square (sweet corn gets a whole bed so it pollinates as a block). Sun-hungry crops take the
 * sunniest beds first; tall crops go in the north square so they don't shade the rest; crops
 * with a trial-backed pairing go in the same bed as their partner when there's room.
 */
export function planBeds(beds: { n: number; sun: number | null }[], picks: string[]): Plan {
  const crops = picks.map((id) => CROPS.find((c) => c.id === id)).filter(Boolean) as Crop[];
  const out = beds.map((b) => ({
    n: b.n, sun: b.sun,
    north: { bed: b.n, half: "north" as const, sun: b.sun, crop: null, plants: 0, lowSun: false } as Square,
    south: { bed: b.n, half: "south" as const, sun: b.sun, crop: null, plants: 0, lowSun: false } as Square,
  }));
  const order = [...crops].sort((a, b) => b.sun - a.sun || Number(!!b.tall) - Number(!!a.tall) || a.name.localeCompare(b.name));
  const byCrop = new Map<string, number>(); // crop id -> bed n
  const unplaced: Crop[] = [];
  const sunOf = (s: Square) => s.sun ?? 0;

  for (const c of order) {
    if (c.id === "corn") {
      const bed = [...out].filter((b) => !b.north.crop && !b.south.crop).sort((a, b) => (b.sun ?? 0) - (a.sun ?? 0))[0];
      if (!bed) { unplaced.push(c); continue; }
      for (const sq of [bed.north, bed.south]) Object.assign(sq, { crop: c, plants: plantsPerSquare(c), lowSun: sunOf(sq) < c.sun });
      byCrop.set(c.id, bed.n);
      continue;
    }
    const partner = PAIRINGS.find((p) => p.a === c.id || p.b === c.id);
    const partnerBed = partner ? byCrop.get(partner.a === c.id ? partner.b : partner.a) : undefined;
    const free = out.flatMap((b) => [b.north, b.south]).filter((s) => !s.crop);
    if (!free.length) { unplaced.push(c); continue; }
    const score = (s: Square) =>
      (sunOf(s) >= c.sun ? 1000 : 0) +
      (partnerBed === s.bed ? 500 : 0) +
      ((c.tall ? s.half === "north" : s.half === "south") ? 100 : 0) +
      // Sun lovers take the sunniest squares; shade-tolerant crops leave those for others.
      (c.sun >= 6 ? sunOf(s) : -sunOf(s));
    const sq = free.sort((a, b) => score(b) - score(a))[0];
    Object.assign(sq, { crop: c, plants: plantsPerSquare(c), lowSun: sunOf(sq) < c.sun });
    byCrop.set(c.id, sq.bed);
  }
  const pairs = PAIRINGS.filter((p) => byCrop.has(p.a) && byCrop.get(p.a) === byCrop.get(p.b));
  return { beds: out, unplaced, pairs };
}
