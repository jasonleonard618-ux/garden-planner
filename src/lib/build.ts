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
    { item: "Cedar 4×4, 8 ft (corner posts)", qty: Math.ceil((4 * n * (heightIn + 2)) / 96), unit: "posts", price: 30, note: `Cut into four ${Math.round(heightIn + 2)} in posts per bed.` },
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
  excellent: { name: "Excellent", keeps: "Deer, plus the above", heightIn: 96, maxBayFt: 6, summary: "Cedar-framed cattle-panel bays with a kickboard, deer wires to 8 ft and an arbor gate.", src: "practical" },
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
        { item: "Cedar 4×4, 10 ft", qty: f.posts, unit: "posts", price: 45 },
        { item: "Cattle panel, 16 ft × 50 in", qty: Math.ceil(P / 16), unit: "panels", price: 40 },
        { item: "Cedar 2×4, 8 ft (frames, top rail)", qty: Math.ceil((P * 2) / 8), unit: "boards", price: 14 },
        { item: "Cedar 2×8, 8 ft (kickboard)", qty: Math.ceil(P / 8), unit: "boards", price: 30 },
        { item: "High-tensile wire for deer strands to 8 ft", qty: 1, unit: "roll", price: 60 },
        { item: "Concrete for posts, 50 lb", qty: f.posts * 2, unit: "bags", price: 6 },
        { item: "Arbor gate, built from cedar", qty: 1, unit: "gate", price: 350 },
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

export const total = (lines: Line[]) => lines.reduce((s, l) => s + l.qty * l.price, 0);
