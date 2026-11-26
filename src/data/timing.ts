import type { SrcKey } from "./sources";

/**
 * How each crop is started. Weeks indoors and germination temperatures are from Rutgers FS787
 * (Table 3). Crops Rutgers doesn't list use typical seed-packet guidance and say so.
 */
export type Start = {
  method: "indoors" | "direct" | "buy";
  weeks?: [number, number]; // weeks indoors before setting out
  germF?: number; // best soil temperature for germination
  tip: string;
  src: SrcKey | "packet" | "practical";
};

export const TIMING: Record<string, Start> = {
  tomato: { method: "indoors", weeks: [6, 8], germF: 85, tip: "Harden off by watering less, not by chilling; cold can scar the fruit (catfacing).", src: "rutgers" },
  pepper: { method: "indoors", weeks: [8, 10], germF: 85, tip: "Warm soil matters most; a heat mat helps.", src: "rutgers" },
  eggplant: { method: "indoors", weeks: [8, 10], germF: 85, tip: "Needs warm soil and warm nights; don't rush it outside.", src: "rutgers" },
  cucumber: { method: "direct", germF: 90, tip: "Sow in the bed once the soil is warm. If you start it inside, use a fiber pot, 2–3 weeks ahead.", src: "rutgers" },
  zucchini: { method: "direct", germF: 90, tip: "Sow in the bed once the soil is warm. If you start it inside, 2–3 weeks ahead in a fiber pot.", src: "rutgers" },
  "winter-squash": { method: "direct", germF: 90, tip: "Sow in the bed once the soil is warm.", src: "rutgers" },
  "bush-bean": { method: "direct", germF: 80, tip: "Beans transplant poorly, so sow them in the bed.", src: "rutgers" },
  "pole-bean": { method: "direct", germF: 80, tip: "Put the trellis up before you sow.", src: "rutgers" },
  pea: { method: "direct", tip: "Always sow peas in the bed, early in spring.", src: "rutgers" },
  corn: { method: "direct", germF: 90, tip: "Sow in a block of short rows so the wind pollinates it.", src: "rutgers" },
  "lettuce-leaf": { method: "direct", germF: 75, tip: "Sow in the bed, or start inside 5–6 weeks ahead. Sow again every few weeks.", src: "rutgers" },
  "lettuce-head": { method: "indoors", weeks: [5, 6], germF: 75, tip: "Handles light frost once hardened off.", src: "rutgers" },
  spinach: { method: "direct", tip: "Sow early; it bolts once days get long and hot.", src: "packet" },
  kale: { method: "indoors", weeks: [4, 6], germF: 80, tip: "A cool-season crop: plant out before the last frost.", src: "rutgers" },
  chard: { method: "direct", tip: "Sow in the bed; pick outer leaves all season.", src: "packet" },
  collards: { method: "indoors", weeks: [5, 7], germF: 80, tip: "A cool-season crop: plant out before the last frost.", src: "rutgers" },
  arugula: { method: "direct", tip: "Quick to harvest. Sow again every few weeks.", src: "packet" },
  broccoli: { method: "indoors", weeks: [6, 7], germF: 80, tip: "A cool-season crop: plant out before the last frost.", src: "rutgers" },
  cabbage: { method: "indoors", weeks: [6, 7], germF: 80, tip: "A cool-season crop: plant out before the last frost.", src: "rutgers" },
  cauliflower: { method: "indoors", weeks: [6, 7], germF: 80, tip: "A cool-season crop: plant out before the last frost.", src: "rutgers" },
  kohlrabi: { method: "indoors", weeks: [6, 7], germF: 80, tip: "Or sow right in the bed in early spring.", src: "rutgers" },
  carrot: { method: "direct", tip: "Always sow carrots in the bed; they don't transplant.", src: "rutgers" },
  beet: { method: "direct", tip: "Always sow beets in the bed.", src: "rutgers" },
  radish: { method: "direct", tip: "Ready in about a month; sow a short row every week or two.", src: "packet" },
  turnip: { method: "direct", tip: "Sow in the bed in early spring.", src: "packet" },
  potato: { method: "direct", tip: "Plant seed potatoes in early spring.", src: "practical" },
  onion: { method: "buy", tip: "Easiest from sets or plants. From seed, start 10–12 weeks ahead.", src: "rutgers" },
  garlic: { method: "direct", tip: "Plant cloves in fall; harvest next summer when the lower leaves brown.", src: "practical" },
  leek: { method: "indoors", weeks: [10, 12], germF: 75, tip: "A long-season crop; start early.", src: "rutgers" },
  basil: { method: "indoors", weeks: [4, 6], tip: "Frost-tender, so it goes out with the tomatoes.", src: "packet" },
  parsley: { method: "indoors", weeks: [8, 10], tip: "Slow to sprout; soak seed overnight.", src: "packet" },
  cilantro: { method: "direct", tip: "Sow in the bed; it bolts in heat, so sow again in late summer.", src: "packet" },
  strawberry: { method: "buy", tip: "Buy plants; set the crown at soil level.", src: "practical" },
  alyssum: { method: "buy", tip: "Buy small plants and tuck them among the lettuce.", src: "practical" },
};
