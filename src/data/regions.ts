/**
 * Local guidance from each state's land-grant Extension and experiment station.
 * Frost dates stay on NOAA (station nearest the yard); soil and sun stay on national data.
 * A state without an entry falls back to the national guides already cited in crops/timing.
 *
 * Every line names its source. Variety names are suggestions from the source, not endorsements.
 */

export type RegionSource = { label: string; href: string };

export type PestNote = { text: string; src: string };

export type RegionGuide = {
  state: string; // two-letter code
  name: string;
  extension: string; // shown in "Local guidance from ..."
  sources: Record<string, RegionSource>;
  /** Varieties suggested for the state, by crop id. Letters in brackets are disease resistance codes. */
  varieties: Record<string, { names: string[]; src: string }>;
  /** Pests and diseases to watch, by crop id. */
  pests: Record<string, { list: string; src: string }>;
  /** When pests show up, by crop id. */
  pestTiming: Record<string, PestNote[]>;
  /** State-specific planting rule, by crop id. */
  planting: Record<string, PestNote>;
  /** Weeks to start seeds indoors, where the state source differs from the national one. */
  weeks: Record<string, { weeks: [number, number]; src: string; note?: string }>;
  /** Short notes shown once on the timeline. */
  general: PestNote[];
  /** Resistance codes used in the variety names. */
  codes?: string;
};

// ---------- Connecticut: UConn Extension and the Connecticut Agricultural Experiment Station ----------

const CT_SRC = {
  uconnBasics: { label: "UConn Home & Garden Education Center: Vegetable garden basics and plant selections (2020)", href: "https://homegarden.cahnr.uconn.edu/vegetable-garden-basics-and-plant-selections" },
  caesPlanting: { label: "CT Agricultural Experiment Station: Planting your garden", href: "https://portal.ct.gov/-/media/caes/documents/publications/fact_sheets/forestry_and_horticulture/plantingyourgardenpdf.pdf" },
  uconnSuccession: { label: "UConn Home & Garden Education Center: Succession planting", href: "https://homegarden.cahnr.uconn.edu/factsheets/succession-planting" },
  uconnColeWorms: { label: "UConn Extension Vegetable IPM: Cole crop caterpillar pests", href: "https://ipm.cahnr.uconn.edu/cole-crop-worms-caterpillar-pests/" },
  uconnCpb: { label: "UConn Extension Vegetable IPM: Colorado potato beetle (2026)", href: "https://ipm.cahnr.uconn.edu/tomato-colorado-potato-beetle/" },
  caesCpb: { label: "CT Agricultural Experiment Station: Colorado potato beetle", href: "https://portal.ct.gov/caes/fact-sheets/entomology/colorado-potato-beetle-leptinotarsa-decemlineata" },
  uconnBasilDm: { label: "UConn Extension Vegetable IPM: Basil downy mildew (2025)", href: "https://ipm.cahnr.uconn.edu/basil-downy-mildew/" },
};

const V = (...names: string[]) => ({ names, src: "uconnBasics" });
const P = (list: string) => ({ list, src: "uconnBasics" });

const BRASSICA_PESTS = "cabbage worms, flea beetles, root maggots, aphids; disease: clubroot";
const BRASSICA_TIMING: PestNote[] = [
  { text: "The imported cabbageworm (the white butterfly) is usually the first caterpillar each year and has 3 to 5 generations from April to October. Cabbage loopers rarely build up before mid- to late summer.", src: "uconnColeWorms" },
  { text: "Cover spring plantings with floating row cover right after planting, edges sealed with soil, to keep out cabbage maggot flies, flea beetles and caterpillars. Skip covers on summer plantings; they get too hot.", src: "uconnColeWorms" },
];
const CPB_TIMING: PestNote[] = [
  { text: "Colorado potato beetle adults find plants in May; activity peaks in mid-June, so time plantings to miss the peak where you can.", src: "uconnCpb" },
];
const COOL_SOW: PestNote = { text: "Sow as soon as the soil can be worked without clodding, late March to early April in Connecticut.", src: "caesPlanting" };
const WARM_SOW: PestNote = { text: "Sow once the soil is above 60°F and frost danger is past, about mid-May in Connecticut.", src: "caesPlanting" };
const BRASSICA_WEEKS = { weeks: [5, 7] as [number, number], src: "caesPlanting" };
const NIGHTSHADE_WEEKS = { weeks: [8, 10] as [number, number], src: "caesPlanting", note: "8 or more weeks per CAES; 10 is a practical upper limit" };

export const CT: RegionGuide = {
  state: "CT",
  name: "Connecticut",
  extension: "UConn Extension and the Connecticut Agricultural Experiment Station",
  sources: CT_SRC,
  codes: "AL early blight, DM downy mildew, F fusarium wilt, M mosaic virus, N nematodes, PM powdery mildew, V verticillium wilt",
  varieties: {
    tomato: V("Early Girl", "Jet Star (F,V)", "Celebrity (F,M,V)", "Mountain Magic (AL)", "Roma (F,V) for sauce", "Sun Gold cherry"),
    pepper: V("New Ace", "Red Knight", "King of the North", "Giant Marconi"),
    eggplant: V("Beatrice", "Black Bell", "Falcon"),
    cucumber: V("Sweet Marketmore", "Fanfare", "County Fair", "Dasher II"),
    zucchini: V("Ambassador (PM)", "Raven", "Eight Ball", "Sunray yellow (PM)"),
    "winter-squash": V("Waltham Butternut", "Table Queen", "Bon Bon", "New England Blue Hubbard"),
    "bush-bean": V("Provider (M,PM)", "Derby (M,PM)", "Strike (M)", "Rocdor yellow (M)"),
    "pole-bean": V("Blue Lake", "Seychelles", "Kentucky Wonder"),
    pea: V("Sugar Snap", "Sugar Ann", "Cascadia", "Lincoln", "Oregon Giant snow pea"),
    corn: V("Honey Select", "Delectable", "Precious Gem"),
    "lettuce-leaf": V("Red Salad Bowl", "Oak Leaf", "Ruby"),
    "lettuce-head": V("Little Gem", "Tom Thumb", "Pensacola"),
    spinach: V("Bloomsdale", "Tyee", "Olympus for fall"),
    kale: V("Red Russian", "Toscano", "Winterbor"),
    chard: V("Bright Lights", "Fordhook Giant"),
    collards: V("Champion", "Flash", "Top Bunch"),
    arugula: V("Roquette", "Runway"),
    broccoli: V("Gypsy (DM)", "Marathon (DM)"),
    cabbage: V("Quick Start", "Gonzales", "Savoy Express", "Ruby Perfection red"),
    cauliflower: V("Freemont", "Snow Crown", "Graffiti purple"),
    kohlrabi: V("Grand Duke", "Konan"),
    carrot: V("Danvers", "Nantes", "Tendersweet"),
    beet: V("Forono", "Detroit Dark", "Boldor golden"),
    radish: V("Cherriette", "Easter Egg", "Everest"),
    turnip: V("Purple Top White Globe", "Tokyo Cross"),
    potato: V("Chieftain", "Kennebec", "Adirondack Red"),
    onion: V("Copra", "Walla Walla", "Candy", "Red Candy"),
    garlic: V("German Extra Hardy", "Russian Red"),
    leek: V("Lancelot", "King Richard"),
  },
  pests: {
    tomato: P("hornworms, aphids, whiteflies, cutworms, flea beetles, Colorado potato beetle; diseases: Septoria leaf spot, late blight, blossom end rot"),
    pepper: P("aphids, borers, tarnished plant bugs; blossom end rot"),
    eggplant: P("aphids, flea beetles, cutworms, Colorado potato beetle"),
    cucumber: P("cucumber beetles, squash vine borer, aphids; diseases: bacterial wilt, downy mildew"),
    zucchini: P("squash bug, squash vine borer, striped cucumber beetle; diseases: powdery mildew, bacterial wilt"),
    "winter-squash": P("squash bug, squash vine borer, striped cucumber beetle; diseases: powdery mildew, bacterial wilt"),
    "bush-bean": P("bean beetles, aphids, leafhoppers"),
    "pole-bean": P("bean beetles, aphids, leafhoppers"),
    pea: P("few pests; aphids"),
    corn: P("European corn borer, corn earworm"),
    "lettuce-leaf": P("aphids, slugs, leafminers, cutworms"),
    "lettuce-head": P("aphids, slugs, leafminers, cutworms"),
    spinach: P("spinach leafminer"),
    kale: P(BRASSICA_PESTS),
    collards: P(BRASSICA_PESTS),
    broccoli: P(BRASSICA_PESTS),
    cabbage: P(BRASSICA_PESTS),
    cauliflower: P(BRASSICA_PESTS),
    kohlrabi: P(BRASSICA_PESTS),
    chard: P("aphids, leafminers"),
    arugula: P("flea beetle"),
    carrot: P("carrot rust fly, carrot weevil"),
    beet: P("leafminer"),
    radish: P("cabbage root maggot"),
    turnip: P("flea beetles, cutworms, slugs"),
    potato: P("Colorado potato beetle, aphids, flea beetles, leafhoppers; early and late blight"),
    onion: P("onion maggot"),
    leek: P("onion maggot, thrips"),
    garlic: P("leek moth"),
  },
  pestTiming: {
    kale: BRASSICA_TIMING, collards: BRASSICA_TIMING, broccoli: BRASSICA_TIMING, cabbage: BRASSICA_TIMING, cauliflower: BRASSICA_TIMING, kohlrabi: BRASSICA_TIMING,
    potato: CPB_TIMING, eggplant: CPB_TIMING, tomato: CPB_TIMING,
    cucumber: [{ text: "Sow another hill about every 3 weeks and keep the seedlings under row cover until they flower, to dodge the cucumber beetles that spread bacterial wilt.", src: "uconnSuccession" }],
    basil: [{ text: "Basil downy mildew has been found in Connecticut fields by the end of July in recent years. It doesn't overwinter here; spores blow in each summer.", src: "uconnBasilDm" }],
  },
  planting: {
    beet: COOL_SOW, pea: COOL_SOW, radish: COOL_SOW, spinach: COOL_SOW, carrot: COOL_SOW, "lettuce-leaf": COOL_SOW,
    "bush-bean": WARM_SOW, "pole-bean": WARM_SOW, corn: WARM_SOW, cucumber: WARM_SOW, zucchini: WARM_SOW, "winter-squash": WARM_SOW,
  },
  weeks: {
    broccoli: BRASSICA_WEEKS, cabbage: BRASSICA_WEEKS, cauliflower: BRASSICA_WEEKS,
    tomato: NIGHTSHADE_WEEKS, pepper: NIGHTSHADE_WEEKS, eggplant: NIGHTSHADE_WEEKS,
  },
  general: [
    { text: "Southern and northern Connecticut can differ by two weeks or more, which is why your dates come from the weather station nearest your yard.", src: "uconnSuccession" },
    { text: "Harden transplants off outside for 1 to 2 weeks before planting, bringing them in only on frosty nights.", src: "caesPlanting" },
  ],
};

const GUIDES: Record<string, RegionGuide> = { CT };

/** The local guide for a two-letter state code, or null to use the national guides. */
export function guideFor(state?: string | null): RegionGuide | null {
  return state ? GUIDES[state.toUpperCase()] ?? null : null;
}
