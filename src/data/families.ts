/**
 * Plant families for crop rotation. Iowa State Extension advises not planting vegetables from the
 * same family in the same spot for 3 to 4 years, and says a few raised beds make rotation
 * straightforward. Family groups follow its table "Plant Families of Vegetables Often Grown in Iowa";
 * herbs, flowers and perennials it doesn't list are left out of rotation (practical choice).
 * Source: Iowa State Yard and Garden, "Crop Rotation in the Vegetable Garden" (Aaron Steil, reviewed April 2025).
 */
export type Family = "nightshade" | "gourd" | "pea" | "mustard" | "amaranth" | "carrot" | "onion" | "grass" | "sunflower" | "morning-glory" | "mallow";

export const FAMILY_LABEL: Record<Family, string> = {
  nightshade: "Tomato family", gourd: "Squash family", pea: "Bean family", mustard: "Cabbage family", amaranth: "Beet family",
  carrot: "Carrot family", onion: "Onion family", grass: "Corn", sunflower: "Lettuce family", "morning-glory": "Sweet potato", mallow: "Okra",
};

export const FAMILY_COLOR: Record<Family, string> = {
  nightshade: "#FF6F47", gourd: "#6FB08A", pea: "#F2B544", mustard: "#4F7CAC", amaranth: "#C2557A",
  carrot: "#C98A2B", onion: "#7A9E3B", grass: "#B8A13A", sunflower: "#8C6BC8", "morning-glory": "#B8401F", mallow: "#145049",
};

const BY_CROP: Record<string, Family> = {
  tomato: "nightshade", pepper: "nightshade", eggplant: "nightshade", potato: "nightshade",
  cucumber: "gourd", zucchini: "gourd", "winter-squash": "gourd", pumpkin: "gourd", cantaloupe: "gourd", watermelon: "gourd",
  "bush-bean": "pea", "pole-bean": "pea", pea: "pea",
  kale: "mustard", collards: "mustard", arugula: "mustard", broccoli: "mustard", cabbage: "mustard", cauliflower: "mustard", kohlrabi: "mustard", radish: "mustard", turnip: "mustard",
  spinach: "amaranth", chard: "amaranth", beet: "amaranth",
  carrot: "carrot", parsley: "carrot",
  onion: "onion", garlic: "onion", leek: "onion",
  corn: "grass",
  "lettuce-leaf": "sunflower", "lettuce-head": "sunflower",
  "sweet-potato": "morning-glory", okra: "mallow",
};

export const familyOf = (cropId: string): Family | null => BY_CROP[cropId] ?? null;

/** Years a family stays out of a bed. Iowa State says 3 to 4; we use 3 so small gardens can keep up. */
export const ROTATION_YEARS = 3;
