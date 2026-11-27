/**
 * Crop catalog. Every number carries where it came from:
 *  - sun: Iowa State Extension "Which vegetables will grow in partial shade?" (updated 2025-06-04):
 *    most vegetables need 6+ hrs of direct sun; leafy greens manage with 3–4; radish, kohlrabi,
 *    beets, cauliflower and broccoli are listed as partial-shade possibilities (no hour figure,
 *    so we use 4 hrs and label it a practical choice).
 *  - spacing: Colorado State Extension GardenNotes #713, block-style raised beds
 *    (published 2014-10, reviewed 2023-04). Crops it doesn't cover are marked "practical".
 *  - spacing "mu": University of Missouri Extension G6201, Table 1 (distance between plants in the
 *    row × between hand-cultivated rows).
 *  - fruit: UConn Home & Garden Education Center fact sheets (blueberries; brambles).
 *  - days: typical seed-packet days to harvest (from transplant for crops set out as plants).
 *    Varieties differ, so these are labeled packet guidance.
 */

export type SunNeed = 6 | 4 | 3;
export type Kind = "fruiting" | "leafy" | "root" | "brassica" | "allium" | "herb" | "fruit" | "flower";

export type Crop = {
  id: string;
  name: string;
  kind: Kind;
  sun: SunNeed;
  sunSource: "isu" | "isu-partial" | "isu-leafy" | "ref" | "practical";
  warm: boolean; // frost-tender: planted after the last frost
  days: number; // packet guidance
  start: "transplant" | "seed" | "sets" | "fall"; // how it usually goes in the ground
  spacing: [number, number]; // inches: in-row × between-row
  spacingSource: "csu" | "mu" | "ref" | "practical";
  /** A crop-specific source, used where sunSource or spacingSource is "ref". */
  ref?: keyof typeof SOURCES;
  /** When a perennial first gives a real harvest, if the source says. */
  firstHarvest?: string;
  tall?: boolean; // goes on the north end so it doesn't shade others
  perennial?: boolean;
  note?: string;
};

const C = (c: Crop) => c;

export const CROPS: Crop[] = [
  C({ id: "tomato", name: "Tomato", kind: "fruiting", sun: 6, sunSource: "isu", warm: true, days: 70, start: "transplant", spacing: [24, 48], spacingSource: "csu", tall: true, note: "Trellised in a single row, 24 in apart." }),
  C({ id: "pepper", name: "Pepper", kind: "fruiting", sun: 6, sunSource: "isu", warm: true, days: 70, start: "transplant", spacing: [15, 15], spacingSource: "csu" }),
  C({ id: "eggplant", name: "Eggplant", kind: "fruiting", sun: 6, sunSource: "isu", warm: true, days: 75, start: "transplant", spacing: [18, 24], spacingSource: "csu" }),
  C({ id: "cucumber", name: "Cucumber", kind: "fruiting", sun: 6, sunSource: "isu", warm: true, days: 55, start: "seed", spacing: [9, 12], spacingSource: "csu", tall: true, note: "Grown up a trellis." }),
  C({ id: "zucchini", name: "Zucchini / summer squash", kind: "fruiting", sun: 6, sunSource: "isu", warm: true, days: 50, start: "seed", spacing: [36, 36], spacingSource: "practical", note: "Big plants: one per 3 × 3 ft." }),
  C({ id: "winter-squash", name: "Winter squash", kind: "fruiting", sun: 6, sunSource: "isu", warm: true, days: 95, start: "seed", spacing: [48, 48], spacingSource: "practical", note: "Vines sprawl; one plant per 4 × 4 ft, or train up a sturdy trellis." }),
  C({ id: "bush-bean", name: "Bush beans", kind: "fruiting", sun: 6, sunSource: "isu", warm: true, days: 55, start: "seed", spacing: [4, 12], spacingSource: "csu" }),
  C({ id: "pole-bean", name: "Pole beans", kind: "fruiting", sun: 6, sunSource: "isu", warm: true, days: 65, start: "seed", spacing: [4, 12], spacingSource: "csu", tall: true }),
  C({ id: "pea", name: "Peas", kind: "fruiting", sun: 6, sunSource: "isu", warm: false, days: 60, start: "seed", spacing: [2, 12], spacingSource: "practical", tall: true, note: "A cool-season crop: sow in early spring." }),
  C({ id: "corn", name: "Sweet corn", kind: "fruiting", sun: 6, sunSource: "isu", warm: true, days: 80, start: "seed", spacing: [12, 24], spacingSource: "csu", tall: true, note: "Plant in a block, not a single row, so it pollinates." }),
  C({ id: "lettuce-leaf", name: "Leaf lettuce", kind: "leafy", sun: 3, sunSource: "isu-leafy", warm: false, days: 45, start: "seed", spacing: [8, 8], spacingSource: "csu" }),
  C({ id: "lettuce-head", name: "Head lettuce", kind: "leafy", sun: 3, sunSource: "isu-leafy", warm: false, days: 70, start: "transplant", spacing: [11, 11], spacingSource: "csu" }),
  C({ id: "spinach", name: "Spinach", kind: "leafy", sun: 3, sunSource: "isu-leafy", warm: false, days: 40, start: "seed", spacing: [5, 5], spacingSource: "csu" }),
  C({ id: "kale", name: "Kale", kind: "leafy", sun: 3, sunSource: "isu-leafy", warm: false, days: 55, start: "transplant", spacing: [18, 18], spacingSource: "practical" }),
  C({ id: "chard", name: "Swiss chard", kind: "leafy", sun: 3, sunSource: "isu-leafy", warm: false, days: 55, start: "seed", spacing: [8, 8], spacingSource: "csu" }),
  C({ id: "collards", name: "Collards", kind: "leafy", sun: 3, sunSource: "isu-leafy", warm: false, days: 60, start: "transplant", spacing: [18, 18], spacingSource: "practical" }),
  C({ id: "arugula", name: "Arugula", kind: "leafy", sun: 4, sunSource: "isu-partial", warm: false, days: 35, start: "seed", spacing: [4, 4], spacingSource: "practical" }),
  C({ id: "broccoli", name: "Broccoli", kind: "brassica", sun: 4, sunSource: "isu-partial", warm: false, days: 65, start: "transplant", spacing: [18, 18], spacingSource: "csu" }),
  C({ id: "cabbage", name: "Cabbage", kind: "brassica", sun: 6, sunSource: "isu", warm: false, days: 70, start: "transplant", spacing: [18, 18], spacingSource: "csu" }),
  C({ id: "cauliflower", name: "Cauliflower", kind: "brassica", sun: 4, sunSource: "isu-partial", warm: false, days: 65, start: "transplant", spacing: [18, 18], spacingSource: "csu" }),
  C({ id: "kohlrabi", name: "Kohlrabi", kind: "brassica", sun: 4, sunSource: "isu-partial", warm: false, days: 50, start: "seed", spacing: [8, 8], spacingSource: "csu" }),
  C({ id: "carrot", name: "Carrot", kind: "root", sun: 6, sunSource: "isu", warm: false, days: 70, start: "seed", spacing: [3, 3], spacingSource: "csu" }),
  C({ id: "beet", name: "Beet", kind: "root", sun: 4, sunSource: "isu-partial", warm: false, days: 55, start: "seed", spacing: [5, 5], spacingSource: "csu" }),
  C({ id: "radish", name: "Radish", kind: "root", sun: 4, sunSource: "isu-partial", warm: false, days: 25, start: "seed", spacing: [3, 3], spacingSource: "csu" }),
  C({ id: "turnip", name: "Turnip", kind: "root", sun: 6, sunSource: "isu", warm: false, days: 45, start: "seed", spacing: [5, 5], spacingSource: "csu" }),
  C({ id: "potato", name: "Potato", kind: "root", sun: 6, sunSource: "isu", warm: false, days: 90, start: "seed", spacing: [12, 15], spacingSource: "csu", note: "Planted from seed potatoes in early spring." }),
  C({ id: "onion", name: "Onion", kind: "allium", sun: 6, sunSource: "isu", warm: false, days: 100, start: "sets", spacing: [5, 5], spacingSource: "csu" }),
  C({ id: "garlic", name: "Garlic", kind: "allium", sun: 6, sunSource: "isu", warm: false, days: 240, start: "fall", spacing: [5, 5], spacingSource: "csu", note: "Planted in fall, harvested the next summer." }),
  C({ id: "leek", name: "Leek", kind: "allium", sun: 6, sunSource: "isu", warm: false, days: 110, start: "transplant", spacing: [5, 5], spacingSource: "csu" }),
  C({ id: "basil", name: "Basil", kind: "herb", sun: 6, sunSource: "isu", warm: true, days: 30, start: "transplant", spacing: [12, 12], spacingSource: "practical" }),
  C({ id: "parsley", name: "Parsley", kind: "herb", sun: 4, sunSource: "isu", warm: false, days: 70, start: "transplant", spacing: [8, 8], spacingSource: "practical" }),
  C({ id: "cilantro", name: "Cilantro", kind: "herb", sun: 4, sunSource: "isu", warm: false, days: 45, start: "seed", spacing: [6, 6], spacingSource: "practical" }),
  C({ id: "strawberry", name: "Strawberry", kind: "fruit", sun: 6, sunSource: "isu", warm: false, days: 365, start: "transplant", spacing: [12, 12], spacingSource: "practical", perennial: true, note: "Comes back every year; first real crop the year after planting." }),
  C({ id: "alyssum", name: "Sweet alyssum (flower)", kind: "flower", sun: 4, sunSource: "isu", warm: false, days: 45, start: "transplant", spacing: [6, 6], spacingSource: "practical", note: "Small flowers that draw hoverflies, whose larvae eat aphids." }),
  // Added 2026-11-27: the rest of the storyboard catalog, plus small fruit.
  C({ id: "okra", name: "Okra", kind: "fruiting", sun: 6, sunSource: "isu", warm: true, days: 60, start: "seed", spacing: [12, 30], spacingSource: "mu", tall: true }),
  C({ id: "sweet-potato", name: "Sweet potato", kind: "root", sun: 6, sunSource: "isu", warm: true, days: 110, start: "transplant", spacing: [12, 30], spacingSource: "mu", note: "Planted from slips (rooted sprouts) after the soil warms." }),
  C({ id: "pumpkin", name: "Pumpkin", kind: "fruiting", sun: 6, sunSource: "isu", warm: true, days: 105, start: "seed", spacing: [60, 48], spacingSource: "mu", note: "Vines run far; give it a bed end and let it spill onto the path." }),
  C({ id: "cantaloupe", name: "Cantaloupe (muskmelon)", kind: "fruit", sun: 6, sunSource: "isu", warm: true, days: 85, start: "seed", spacing: [60, 48], spacingSource: "mu" }),
  C({ id: "watermelon", name: "Watermelon", kind: "fruit", sun: 6, sunSource: "isu", warm: true, days: 85, start: "seed", spacing: [60, 60], spacingSource: "practical", note: "Pick a short-season variety where summers are short." }),
  C({ id: "blueberry", name: "Blueberry (highbush)", kind: "fruit", sun: 6, sunSource: "ref", warm: false, days: 365, start: "transplant", spacing: [30, 30], spacingSource: "ref", ref: "uconnBlue", perennial: true, firstHarvest: "a 3-year-old bush gives about 2–3 pints, rising to 7–10 pints by year 10", note: "Needs acid soil, pH 4.0–4.8; most garden soil needs sulfur worked in the fall before planting. Plant two or more varieties for a longer harvest." }),
  C({ id: "raspberry", name: "Raspberry", kind: "fruit", sun: 6, sunSource: "practical", warm: false, days: 365, start: "transplant", spacing: [24, 48], spacingSource: "ref", ref: "uconnBramble", perennial: true, tall: true, note: "Grown as a hedgerow kept 15–18 in wide, canes thinned to 6–10 in apart each spring. Fall-bearing kinds ripen from late August until frost." }),
  C({ id: "blackberry", name: "Blackberry", kind: "fruit", sun: 6, sunSource: "practical", warm: false, days: 365, start: "transplant", spacing: [24, 48], spacingSource: "ref", ref: "uconnBramble", perennial: true, tall: true, note: "Grown as a hedgerow kept 15–18 in wide, on a trellis or wires." }),
  C({ id: "asparagus", name: "Asparagus", kind: "leafy", sun: 6, sunSource: "isu", warm: false, days: 365, start: "transplant", spacing: [18, 48], spacingSource: "mu", perennial: true, firstHarvest: "the third year after planting crowns", note: "Comes back for many years, so give it a bed of its own." }),
  C({ id: "rhubarb", name: "Rhubarb", kind: "leafy", sun: 6, sunSource: "isu", warm: false, days: 365, start: "transplant", spacing: [36, 48], spacingSource: "mu", perennial: true, firstHarvest: "the second year after planting crowns", note: "Eat the stalks only; the leaves are poisonous." }),
  C({ id: "chives", name: "Chives", kind: "herb", sun: 4, sunSource: "practical", warm: false, days: 365, start: "transplant", spacing: [8, 8], spacingSource: "practical", perennial: true }),
  C({ id: "thyme", name: "Thyme", kind: "herb", sun: 6, sunSource: "practical", warm: false, days: 365, start: "transplant", spacing: [12, 12], spacingSource: "practical", perennial: true }),
  C({ id: "mint", name: "Mint", kind: "herb", sun: 4, sunSource: "practical", warm: false, days: 365, start: "transplant", spacing: [18, 18], spacingSource: "practical", perennial: true, note: "Spreads by runners, so it is usually kept in a pot (practical choice)." }),
  C({ id: "dill", name: "Dill", kind: "herb", sun: 6, sunSource: "practical", warm: false, days: 45, start: "seed", spacing: [9, 9], spacingSource: "practical", tall: true }),
  C({ id: "marigold", name: "Marigold (flower)", kind: "flower", sun: 6, sunSource: "practical", warm: true, days: 50, start: "transplant", spacing: [9, 9], spacingSource: "practical" }),
];

// parsley/cilantro/alyssum aren't in the Iowa State list; 4 hrs is our practical choice for them.
export const SUN_PRACTICAL = new Set(["parsley", "cilantro", "alyssum"]);

export const KIND_LABEL: Record<Kind, string> = {
  fruiting: "Fruiting", leafy: "Leafy greens", root: "Roots", brassica: "Cabbage family", allium: "Onion family", herb: "Herbs", fruit: "Fruit", flower: "Helpful flowers",
};

export const SOURCES = {
  isu: { label: "Iowa State Extension, vegetables in partial shade (2025)", href: "https://yardandgarden.extension.iastate.edu/faq/which-vegetables-will-grow-partial-shade" },
  csu: { label: "Colorado State Extension GardenNotes #713, block-style raised beds (reviewed 2023)", href: "https://extension.colostate.edu/resource/block-style-layout-in-raised-bed-vegetable-gardens/" },
  mu: { label: "University of Missouri Extension G6201, Table 1 (reviewed 2016)", href: "https://extension.missouri.edu/publications/g6201" },
  uconnBlue: { label: "UConn Home & Garden Education Center: Blueberries", href: "https://homegarden.cahnr.uconn.edu/factsheets/blueberries" },
  uconnBramble: { label: "UConn Home & Garden Education Center: Brambles, pruning and training", href: "https://homegarden.cahnr.uconn.edu/factsheets/brambles-pruning-training-growth-characteristics/" },
};

/** Pairings we only suggest because trials back them. */
export const PAIRINGS = [
  {
    a: "tomato", b: "basil",
    claim: "Tomato grown with basil had fewer thrips and whiteflies in a field trial.",
    source: { label: "Mutisya et al., Agronomy 2016 (Kenya field trial)", href: "https://www.mdpi.com/2073-4395/6/3/42" },
  },
  {
    a: "lettuce-leaf", b: "alyssum",
    claim: "Sweet alyssum among lettuce draws hoverflies that keep aphids down.",
    source: { label: "USDA-ARS Salinas, alyssum in organic lettuce (2014)", href: "https://www.ars.usda.gov/news-events/news/research-news/2014/in-the-field-the-right-flower-arrangement-can-improve-organic-pest-control/" },
  },
];

export type FitTag = "fits" | "needs-sun" | "season-short" | "fall" | "perennial";

export function cropFit(c: Crop, bestSun: number | null, frostFreeDays: number | null): FitTag {
  if (bestSun != null && bestSun < c.sun) return "needs-sun";
  if (c.start === "fall") return "fall";
  if (c.perennial) return "perennial";
  // Warm crops go out about 3 weeks after the last frost date (practical margin), so they get
  // the frost-free season minus that, plus no time for the first-frost risk.
  if (c.warm && frostFreeDays != null && c.days > frostFreeDays - 21) return "season-short";
  return "fits";
}

/** Plants that fit in a 4 × 4 ft square at the crop's block spacing. */
export function plantsPerSquare(c: Crop) {
  const [a, b] = c.spacing;
  return Math.max(1, Math.floor(48 / a)) * Math.max(1, Math.floor(48 / b));
}
