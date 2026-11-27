import type { LngLat } from "./types";

/**
 * Quantities for building the beds, fence and drip. Quantities follow from geometry; prices are
 * rough defaults the person can change, never presented as quotes.
 */

export type Tier = "good" | "better" | "best" | "excellent";
export type Line = { item: string; qty: number; unit: string; price: number; note?: string };

// ---------- beds ----------

export const BED_TIERS: Record<Exclude<Tier, "excellent">, { name: string; courses: number; cap: boolean; liner: boolean; summary: string }> = {
  good: { name: "Good", courses: 1, cap: false, liner: false, summary: "One 2×10 course (about 9 in tall), screwed to 4×4 corner posts." },
  better: { name: "Better", courses: 2, cap: false, liner: true, summary: "Two courses (about 19 in tall), easier on your back, with a liner on the soil side." },
  best: { name: "Best", courses: 2, cap: true, liner: true, summary: "Two courses plus a 2×6 cap you can sit on, liner inside and stain outside only." },
};

/** One 4 × 8 ft bed: per course, two 8 ft sides and two 45 in ends cut from one more 8 ft board. */
export function bedLines(n: number, tier: keyof typeof BED_TIERS): Line[] {
  const t = BED_TIERS[tier];
  const heightIn = t.courses * 9.25;
  const soilCuFt = 4 * 8 * (heightIn / 12) * n;
  const lines: Line[] = [
    { item: "Cedar 2×10, 8 ft", qty: 3 * t.courses * n, unit: "boards", price: 42, note: "Per course: two sides, plus one board cut into the two 45 in ends." },
    { item: "Cedar 4×4, 8 ft (corner posts)", qty: Math.ceil((4 * n * (heightIn + 2)) / 96), unit: "posts", price: 30, note: `Cut into four ${Math.floor(heightIn + 2)} in posts per bed.` },
    { item: "Exterior screws, 3 in", qty: Math.ceil((n * t.courses * 16) / 75), unit: "boxes of 75", price: 12 },
  ];
  if (t.cap) lines.push({ item: "Cedar 2×6, 8 ft (cap)", qty: 3 * n, unit: "boards", price: 24 });
  if (t.liner) lines.push({ item: "6 mil poly liner, 10 × 25 ft", qty: Math.ceil((n * 24 * (heightIn / 12)) / 250), unit: "rolls", price: 25, note: "Soil side of the boards only, not the bottom, so beds still drain." });
  if (tier === "best") lines.push({ item: "Semi-transparent exterior stain, 1 gal", qty: Math.ceil(n / 4), unit: "gal", price: 45, note: "Outside faces only." });
  lines.push({ item: "Raised-bed soil mix", qty: Math.ceil((soilCuFt / 27) * 10) / 10, unit: "cu yd", price: 60, note: `${Math.round(soilCuFt)} cu ft in all.` });
  return lines;
}

// ---------- fence ----------

export const FENCE_TIERS: Record<Tier, { name: string; keeps: string; heightIn: number; maxBayFt: number; summary: string; src: "uga" | "practical" }> = {
  good: { name: "Good", keeps: "Rabbits", heightIn: 24, maxBayFt: 8, summary: "2 ft of 1 in mesh on steel T-posts, with a 12 in apron along the ground outside.", src: "uga" },
  better: { name: "Better", keeps: "Rabbits, raccoons, groundhogs", heightIn: 48, maxBayFt: 8, summary: "4 ft welded wire with an 18 in floppy top and a 24 in buried or pinned apron.", src: "uga" },
  best: { name: "Best", keeps: "Deer, plus the above", heightIn: 96, maxBayFt: 8, summary: "8 ft deer fence on wood posts, with 1 in mesh along the bottom 2 ft and an apron.", src: "uga" },
  excellent: { name: "Excellent", keeps: "Deer, plus the above", heightIn: 96, maxBayFt: 6, summary: "Cedar-framed cattle-panel bays with a kickboard, deer wires to 8 ft, a pergola beam along the top and a cedar gate.", src: "practical" },
};

export type FenceLayout = { sides: { ft: number; bays: number; bayFt: number; gate: boolean }[]; posts: number; perimeterFt: number; gateSide: number };

/** Splits each side into equal bays no longer than the max, with a 4 ft gate on the south-most side. */
export function fenceLayout(ring: LngLat[], sideFt: number[], maxBayFt: number, gateFt = 4): FenceLayout {
  const midLat = ring.map((p, i) => (p[1] + ring[(i + 1) % ring.length][1]) / 2);
  const gateSide = midLat.indexOf(Math.min(...midLat));
  const sides = sideFt.map((ft, i) => {
    const run = i === gateSide ? Math.max(ft - gateFt, 0) : ft;
    const bays = Math.max(1, Math.ceil(run / maxBayFt));
    return { ft, bays, bayFt: run / bays, gate: i === gateSide };
  });
  // One post per bay end; corners are shared. The gate adds one more post.
  const posts = sides.reduce((n, s) => n + s.bays, 0) + 1;
  return { sides, posts, perimeterFt: sideFt.reduce((a, b) => a + b, 0), gateSide };
}

export function fenceLines(f: FenceLayout, tier: Tier): Line[] {
  const P = Math.ceil(f.perimeterFt);
  switch (tier) {
    case "good":
      return [
        { item: "Steel T-post, 4 ft", qty: f.posts, unit: "posts", price: 6 },
        { item: "1 in hex mesh, 3 ft × 50 ft (2 ft up, 12 in apron)", qty: Math.ceil(P / 50), unit: "rolls", price: 35 },
        { item: "Landscape staples", qty: Math.ceil(P / 2 / 25), unit: "packs of 25", price: 8 },
        { item: "4 ft garden gate kit", qty: 1, unit: "kit", price: 60 },
      ];
    case "better":
      return [
        { item: "Steel T-post, 6 ft", qty: f.posts, unit: "posts", price: 8 },
        { item: "Welded wire, 4 ft × 50 ft", qty: Math.ceil(P / 50), unit: "rolls", price: 70 },
        { item: "1 in hex mesh, 4 ft × 50 ft (floppy top and apron)", qty: Math.ceil((P * 2) / 50), unit: "rolls", price: 45, note: "Cut lengthwise: 18 in floppy top, 24 in apron." },
        { item: "Landscape staples", qty: Math.ceil(P / 2 / 25), unit: "packs of 25", price: 8 },
        { item: "4 ft gate kit", qty: 1, unit: "kit", price: 90 },
      ];
    case "best":
      return [
        { item: "Pressure-treated 4×4, 10 ft (ground contact)", qty: f.posts, unit: "posts", price: 22 },
        { item: "Deer fence, 8 ft × 100 ft", qty: Math.ceil(P / 100), unit: "rolls", price: 110 },
        { item: "1 in hex mesh, 3 ft × 50 ft (bottom and apron)", qty: Math.ceil(P / 50), unit: "rolls", price: 35 },
        { item: "Concrete or gravel for posts, 50 lb", qty: f.posts * 2, unit: "bags", price: 6 },
        { item: "8 ft gate", qty: 1, unit: "gate", price: 220 },
      ];
    case "excellent":
      return [
        { item: "Cedar 4×4, 12 ft (9 ft up, 3 ft down)", qty: f.posts, unit: "posts", price: 60, note: "Buy 14 ft posts if your frost depth is deeper than 36 in." },
        { item: "Cattle panel, 16 ft × 50 in", qty: Math.ceil(P / 16), unit: "panels", price: 40 },
        { item: "Cedar 2×4, 8 ft (frames, top rail)", qty: Math.ceil((P * 2) / 8), unit: "boards", price: 14 },
        { item: "Cedar 2×8, 8 ft (kickboard)", qty: Math.ceil(P / 8), unit: "boards", price: 30 },
        { item: "High-tensile wire for deer strands to 8 ft", qty: 1, unit: "roll", price: 60 },
        { item: "Cedar 2×8, 12 ft (pergola beam, one each side of the posts)", qty: Math.ceil((P * 2) / 12), unit: "boards", price: 45 },
        { item: "Cedar 2×4, 8 ft (rafter tails, 24 in long at 16 in apart)", qty: Math.ceil((P * 0.75) / 4), unit: "boards", price: 14 },
        { item: "½ in × 8 in galvanized through-bolt, washers and nut", qty: f.posts * 2, unit: "sets", price: 4 },
        { item: "Exterior screws for rafter tails, 3 in", qty: 1, unit: "box", price: 25 },
        { item: "Concrete for posts, 50 lb", qty: f.posts * 2, unit: "bags", price: 6 },
        { item: "Cedar gate with header, hinges and latch (sheet F-501)", qty: 1, unit: "gate", price: 350 },
      ];
  }
}

// ---------- drip ----------

export function dripLines(beds: number, mainFt: number): Line[] {
  return [
    { item: "Backflow preventer (hose thread)", qty: 1, unit: "", price: 12 },
    { item: "Battery hose timer", qty: 1, unit: "", price: 40 },
    { item: "Pressure regulator, 25 psi", qty: 1, unit: "", price: 12 },
    { item: "Inline filter, 150 mesh", qty: 1, unit: "", price: 10 },
    { item: "½ in mainline tubing", qty: Math.ceil(mainFt / 50), unit: "rolls of 50 ft", price: 18 },
    { item: "Tee and ½ in riser per bed", qty: beds, unit: "sets", price: 4 },
    { item: "Emitter tubing, 12 in spacing", qty: Math.ceil((beds * 3 * 8) / 50), unit: "rolls of 50 ft", price: 22, note: "Three 8 ft lines per bed." },
    { item: "Fittings, end caps and stakes", qty: beds, unit: "bed kits", price: 6 },
  ];
}

// ---------- options: bed material, paths, other watering (rough, practical-choice prices) ----------

export type BedMat = "cedar" | "pine" | "steel" | "ground";
export type PathKind = "chips" | "gravel" | "cardboard" | "grass";
export type Water = "drip" | "soaker" | "hand";

export const MATS: Record<BedMat, { name: string; sub: string; life: string; drawn: boolean }> = {
  cedar: { name: "Cedar", sub: "Rot-resistant heartwood. Looks the best.", life: "10–15 yrs", drawn: true },
  pine: { name: "Pine", sub: "Cheapest wood. Untreated, so it rots sooner.", life: "3–5 yrs", drawn: true },
  steel: { name: "Steel kit", sub: "Galvanized panels that bolt together.", life: "20+ yrs", drawn: false },
  ground: { name: "In the ground", sub: "No frame. Dig, amend and mound the soil.", life: "More weeding", drawn: false },
};
export const PATHS: Record<PathKind, { name: string; sub: string; tag: string }> = {
  chips: { name: "Wood chips", sub: "Often free from tree services. Top up yearly.", tag: "Soft underfoot" },
  gravel: { name: "Pea gravel", sub: "Permanent and tidy, with fabric under it.", tag: "Low upkeep" },
  cardboard: { name: "Cardboard + chips", sub: "Smothers the grass without digging.", tag: "No digging" },
  grass: { name: "Keep the grass", sub: "Mow between the beds.", tag: "Mowing" },
};
export const WATERS: Record<Water, { name: string; sub: string; tag: string }> = {
  drip: { name: "Drip + timer", sub: "Lines under the mulch, on a timer.", tag: "Set and forget" },
  soaker: { name: "Soaker hoses", sub: "Cheaper; you turn them on.", tag: "Low cost" },
  hand: { name: "By hand", sub: "A hose or can, most days in July.", tag: "Daily chore" },
};

/** Material swaps for the cedar bed list. Pine uses the same sizes; steel and in-ground replace the frame. */
export function bedLinesFor(n: number, tier: keyof typeof BED_TIERS, mat: BedMat): Line[] {
  const base = bedLines(n, tier);
  if (mat === "cedar") return base;
  if (mat === "pine") return base.map((l) => l.item.startsWith("Cedar") ? { ...l, item: l.item.replace("Cedar", "Untreated pine"), price: Math.round(l.price * 0.45) } : l);
  const soil = base.filter((l) => l.item.startsWith("Raised-bed soil") || l.item.startsWith("6 mil"));
  if (mat === "steel") return [{ item: `Galvanized steel bed kit, 4 × 8 ft, ${BED_TIERS[tier].courses > 1 ? "17" : "11"} in tall`, qty: n, unit: "kits", price: BED_TIERS[tier].courses > 1 ? 150 : 110, note: "Follow the kit's own assembly sheet." }, ...soil.filter((l) => !l.item.startsWith("6 mil"))];
  return [{ item: "Compost to dig in, 3 in over each bed", qty: Math.ceil(((n * 32 * 0.25) / 27) * 10) / 10, unit: "cu yd", price: 45, note: "Mound beds about 6 in high; no frame." }];
}

export function pathLines(kind: PathKind, sqft: number): Line[] {
  const a = Math.max(0, Math.round(sqft));
  if (kind === "grass" || a === 0) return [];
  const yd = (inches: number) => Math.ceil(((a * inches) / 12 / 27) * 10) / 10;
  if (kind === "gravel") return [
    { item: "Landscape fabric, 3 × 50 ft", qty: Math.ceil(a / 150), unit: "rolls", price: 25 },
    { item: "Pea gravel, 2 in deep", qty: yd(2), unit: "cu yd", price: 55, note: `${a} sq ft of path.` },
  ];
  const chips = { item: "Wood chips, 3 in deep", qty: yd(3), unit: "cu yd", price: 0, note: `${a} sq ft of path. Often free from tree services; about $35/cu yd if you buy them.` };
  if (kind === "cardboard") return [{ item: "Plain brown cardboard, tape removed", qty: Math.ceil(a / 20), unit: "boxes", price: 0, note: "Overlap the edges 6 in." }, chips];
  return [chips];
}

export function soakerLines(beds: number): Line[] {
  return [
    { item: "Soaker hose, 25 ft", qty: beds, unit: "hoses", price: 12, note: "Snake one through each bed." },
    { item: "Garden hose splitter + lead hose", qty: 1, unit: "", price: 30 },
  ];
}

export const total = (lines: Line[]) => lines.reduce((s, l) => s + l.qty * l.price, 0);
