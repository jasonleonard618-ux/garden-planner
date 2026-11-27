/**
 * How much garden a household needs, from University of Missouri Extension G6201, Table 1
 * ("Approximate amount to plant, feet of row per person", fresh use and processing).
 *
 * The table is written for row gardens. We turn it into raised-bed area with our block-style
 * spacing (CSU GardenNotes #713, see crops.ts): a foot of row holds 12 ÷ in-row spacing plants,
 * and each plant takes in-row × between-row spacing of bed.
 * Where the table gives hills, a hill is one planting spot; for cucumber and pole beans a hill is
 * a few plants on a trellis (practical choice, noted below).
 */
import { CROPS } from "@/data/crops";

export type HarvestUse = "fresh" | "preserve";
type Range = [number, number];
type Row = { unit: "ft" | "plants" | "hills"; fresh: Range; preserve?: Range; perHill?: number };

/** G6201 Table 1, by our crop id. */
export const PER_PERSON: Record<string, Row> = {
  tomato: { unit: "plants", fresh: [3, 5], preserve: [5, 10] },
  pepper: { unit: "plants", fresh: [2, 3] },
  eggplant: { unit: "plants", fresh: [2, 3], preserve: [2, 3] },
  cucumber: { unit: "hills", fresh: [2, 3], preserve: [3, 5], perHill: 3 },
  zucchini: { unit: "hills", fresh: [2, 3] },
  "winter-squash": { unit: "hills", fresh: [3, 5] },
  "bush-bean": { unit: "ft", fresh: [10, 15], preserve: [20, 30] },
  "pole-bean": { unit: "hills", fresh: [3, 5], preserve: [3, 5], perHill: 4 },
  pea: { unit: "ft", fresh: [10, 15], preserve: [25, 30] },
  corn: { unit: "ft", fresh: [15, 25], preserve: [30, 50] },
  "lettuce-leaf": { unit: "ft", fresh: [5, 10] },
  "lettuce-head": { unit: "ft", fresh: [5, 10] },
  spinach: { unit: "ft", fresh: [5, 10], preserve: [10, 15] },
  kale: { unit: "ft", fresh: [5, 10], preserve: [10, 15] },
  chard: { unit: "ft", fresh: [5, 10], preserve: [10, 15] },
  collards: { unit: "ft", fresh: [5, 10] },
  broccoli: { unit: "plants", fresh: [5, 10], preserve: [5, 10] },
  cabbage: { unit: "plants", fresh: [3, 5], preserve: [3, 5] },
  cauliflower: { unit: "plants", fresh: [3, 5], preserve: [5, 10] },
  kohlrabi: { unit: "ft", fresh: [3, 5] },
  carrot: { unit: "ft", fresh: [5, 10], preserve: [10, 15] },
  beet: { unit: "ft", fresh: [5, 10], preserve: [10, 20] },
  radish: { unit: "ft", fresh: [5, 10] },
  turnip: { unit: "ft", fresh: [10, 15] },
  potato: { unit: "ft", fresh: [50, 100] },
  onion: { unit: "ft", fresh: [25, 50] },
  okra: { unit: "ft", fresh: [3, 5], preserve: [5, 10] },
  "sweet-potato": { unit: "plants", fresh: [5, 10] },
  cantaloupe: { unit: "hills", fresh: [3, 5], preserve: [3, 5] },
  asparagus: { unit: "plants", fresh: [10, 15], preserve: [10, 15] },
  rhubarb: { unit: "plants", fresh: [2, 3], preserve: [2, 3] },
};
/** Crops the table doesn't list get a quarter of a 4 × 8 ft bed for the household (practical choice). */
export const UNLISTED_SQFT = 8;
export const BED_SQFT = 32;

export type CropSize = { id: string; name: string; plants: Range; sqft: Range; listed: boolean; amount: string };
export type GardenSize = { crops: CropSize[]; sqft: Range; beds: Range; recommended: number };

const r1 = (n: number) => Math.round(n * 10) / 10;

export function sizeCrop(id: string, people: number, use: HarvestUse): CropSize | null {
  const c = CROPS.find((x) => x.id === id);
  if (!c) return null;
  const row = PER_PERSON[id];
  const each = (c.spacing[0] * c.spacing[1]) / 144; // sq ft per plant in a block-style bed
  if (!row) return { id, name: c.name, plants: [0, 0], sqft: [UNLISTED_SQFT, UNLISTED_SQFT], listed: false, amount: "not in the table" };
  const per = use === "preserve" && row.preserve ? row.preserve : row.fresh;
  const toPlants = (n: number) => row.unit === "plants" ? n : row.unit === "hills" ? n * (row.perHill ?? 1) : (n * 12) / c.spacing[0];
  const plants: Range = [Math.ceil(toPlants(per[0] * people)), Math.ceil(toPlants(per[1] * people))];
  const unit = row.unit === "ft" ? "ft of row" : row.unit;
  return { id, name: c.name, plants, sqft: [r1(plants[0] * each), r1(plants[1] * each)], listed: true, amount: `${per[0]}–${per[1]} ${unit} per person` };
}

export function sizeGarden(ids: string[], people: number, use: HarvestUse): GardenSize {
  const crops = ids.map((id) => sizeCrop(id, people, use)).filter((x): x is CropSize => !!x);
  const lo = crops.reduce((a, c) => a + c.sqft[0], 0), hi = crops.reduce((a, c) => a + c.sqft[1], 0);
  const beds: Range = [Math.max(1, Math.ceil(lo / BED_SQFT)), Math.max(1, Math.ceil(hi / BED_SQFT))];
  return { crops, sqft: [Math.round(lo), Math.round(hi)], beds, recommended: crops.length ? Math.max(1, Math.ceil((lo + hi) / 2 / BED_SQFT)) : 0 };
}
