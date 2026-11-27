// Bees tab: pollinator garden, wild bee nesting, hive site check, rules, hive kit.
// Every fact here was read from the linked page. Our own choices are marked "practical".

export const BEE_SRC = {
  psu: { label: "Penn State / MAAREC: Beekeeping Basics (AGRS-93)", href: "https://portal.ct.gov/-/media/caes/documents/bee/penn_state_beekeeping_basics_agrs93.pdf" },
  caesSite: { label: "CAES: Hive location, ownership and management of bee colonies in Connecticut (2014)", href: "https://portal.ct.gov/-/media/caes/documents/bee/hivelocationownershipandmanagementofbeecoloniesinconnecticutpdf.pdf" },
  caesReg: { label: "CAES: Apiary registration and inspection", href: "https://portal.ct.gov/caes/bee-information/bee-information/apiary-registration-and-inspection" },
  ctLaw: { label: "Connecticut laws on honey bees (CGS 22-89, 22-90)", href: "https://portal.ct.gov/caes/bee-information/bee-information/laws-pertaining-to-honey-bees-in-connecticut" },
  caes09: { label: "CAES: Honey bees and beekeeping in Connecticut (2009)", href: "https://portal.ct.gov/-/media/caes/documents/bee/honeybeesandbeekeepinginconnecticutpdf.pdf" },
  stoner: { label: "CAES: Sample list of native wildflowers for bees through the season", href: "https://portal.ct.gov/-/media/caes/documents/publications/pollinators/sample-list-of-native-wildflowers-for-bees-through-the-season.pdf" },
  caesGuide: { label: "CAES: A citizen's guide to creating pollinator habitat in Connecticut", href: "https://portal.ct.gov/-/media/caes/documents/publications/pollinators/acitizensguidetocreatingpollinatorhabitatinconnecticutpdf.pdf" },
  uconnBees: { label: "UConn Home & Garden Education Center: Gardening for bees", href: "https://homegarden.cahnr.uconn.edu/factsheets/gardening-for-bees" },
  uconnSquash: { label: "UConn Home & Garden Education Center: Cucumbers and squash", href: "https://homegarden.cahnr.uconn.edu/factsheets/squash" },
  hbhc: { label: "Honey Bee Health Coalition: Tools for varroa management (2018)", href: "https://portal.ct.gov/-/media/caes/documents/bee/hbhc-guide_varroa_interactive_7thedition_june2018.pdf" },
  ncsu: { label: "NC State Extension: How to become a beekeeper in North Carolina (rev. 2025)", href: "https://content.ces.ncsu.edu/how-to-become-a-beekeeper-in-north-carolina" },
  ugaBees: { label: "UGA CAES: A beginner's guide to successful beekeeping (2026)", href: "https://fieldreport.caes.uga.edu/beginners-guide-to-beekeeping/" },
  mu: { label: "MU Extension G7600: Beekeeping tips for beginners", href: "https://extension.missouri.edu/publications/g7600" },
} as const;
export type BeeSrc = keyof typeof BEE_SRC | "practical";

/** Crops in our catalog that need bees or do better with them. */
export const BEE_CROPS: Record<string, { why: string; src: BeeSrc }> = {
  zucchini: { why: "Squash needs cross-pollination, mainly by bees.", src: "uconnSquash" },
  "winter-squash": { why: "Squash needs cross-pollination, mainly by bees.", src: "uconnSquash" },
  pumpkin: { why: "Pumpkins are pollinated mainly by honey bees, or bees help.", src: "caes09" },
  cucumber: { why: "Most kinds need bees. Seedless (parthenocarpic) kinds set fruit without them.", src: "uconnSquash" },
  cantaloupe: { why: "Melons are pollinated mainly by honey bees, or bees help.", src: "caes09" },
  watermelon: { why: "Watermelon is pollinated mainly by honey bees, or bees help.", src: "caes09" },
  strawberry: { why: "Pollinated mainly by honey bees, or bees help.", src: "caes09" },
  raspberry: { why: "Pollinated mainly by honey bees, or bees help.", src: "caes09" },
  blueberry: { why: "Pollinated mainly by honey bees, or bees help.", src: "caes09" },
};

/** Half-month columns: 0 = early March ... 15 = late October. */
export const BLOOM_MONTHS = ["Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"];
export type BloomPlant = { id: string; name: string; latin: string; from: number; to: number; kind: "Tree" | "Shrub" | "Wildflower"; src: BeeSrc; start?: boolean };
export const BLOOM: BloomPlant[] = [
  { id: "willow", name: "Pussy willow", latin: "Salix discolor", from: 0, to: 1, kind: "Shrub", src: "caesGuide" },
  { id: "maple", name: "Red maple", latin: "Acer rubrum", from: 0, to: 1, kind: "Tree", src: "caesGuide" },
  { id: "alder", name: "Speckled alder", latin: "Alnus incana", from: 2, to: 3, kind: "Tree", src: "caesGuide" },
  { id: "zizia", name: "Golden Alexanders", latin: "Zizia aurea", from: 4, to: 6, kind: "Wildflower", src: "stoner", start: true },
  { id: "spiderwort", name: "Ohio spiderwort", latin: "Tradescantia ohiensis", from: 5, to: 8, kind: "Wildflower", src: "stoner" },
  { id: "winterberry", name: "Winterberry", latin: "Ilex verticillata", from: 6, to: 7, kind: "Shrub", src: "caesGuide" },
  { id: "milkweed", name: "Butterfly milkweed", latin: "Asclepias tuberosa", from: 7, to: 10, kind: "Wildflower", src: "stoner", start: true },
  { id: "bergamot", name: "Wild bergamot", latin: "Monarda fistulosa", from: 7, to: 11, kind: "Wildflower", src: "stoner", start: true },
  { id: "mountainmint", name: "Mountain mint", latin: "Pycnanthemum tenuifolium", from: 7, to: 11, kind: "Wildflower", src: "stoner", start: true },
  { id: "culver", name: "Culver's root", latin: "Veronicastrum virginicum", from: 7, to: 10, kind: "Wildflower", src: "stoner" },
  { id: "partridgepea", name: "Partridge pea", latin: "Chamaecrista fasciculata", from: 7, to: 10, kind: "Wildflower", src: "stoner" },
  { id: "clethra", name: "Clethra", latin: "Clethra alnifolia", from: 8, to: 9, kind: "Shrub", src: "caesGuide" },
  { id: "joepye", name: "Spotted Joe Pye weed", latin: "Eutrochium maculatum", from: 8, to: 11, kind: "Wildflower", src: "stoner", start: true },
  { id: "ironweed", name: "New York ironweed", latin: "Vernonia noveboracensis", from: 10, to: 13, kind: "Wildflower", src: "stoner" },
  { id: "sneezeweed", name: "Fall sneezeweed", latin: "Helenium autumnale", from: 10, to: 13, kind: "Wildflower", src: "stoner" },
  { id: "goldenrod", name: "Gray goldenrod", latin: "Solidago nemoralis", from: 11, to: 13, kind: "Wildflower", src: "stoner", start: true },
  { id: "aster", name: "New England aster", latin: "Symphyotrichum novae-angliae", from: 12, to: 14, kind: "Wildflower", src: "stoner", start: true },
  { id: "witchhazel", name: "Witch-hazel", latin: "Hamamelis virginiana", from: 14, to: 15, kind: "Shrub", src: "uconnBees" },
];
/** CAES's rule for farm plantings; using it as the home-garden target is our choice. */
export const BLOOM_TARGET = 3;

export const ALL_BEES: { text: string; src: BeeSrc }[] = [
  { text: "Never spray open flowers. If you must spray, do it at night.", src: "uconnBees" },
  { text: "Plant in groups of three or more of one kind, so bees find them.", src: "uconnBees" },
  { text: "A few early lawn weeds (dandelion, violets, ground ivy) feed bees in spring.", src: "uconnBees" },
  { text: "A shallow dish with pebbles gives bees water without drowning.", src: "uconnBees" },
];

export const NESTS: { title: string; tag: string; items: string[] }[] = [
  { title: "Bare soil", tag: "Ground nesters", items: ["Many native bees nest in the ground.", "Leave a few small patches unmulched, near shrub bases or along an edge.", "Don't mulch right up to shrubs; some bees nest in the soil beneath them."] },
  { title: "Hollow stems", tag: "Stem nesters", items: ["Some bees nest inside pithy or hollow stems.", "Leave those stems standing until spring, when the young bees come out.", "If you must cut, tie the stems in a bundle and hang it from a branch until spring."] },
  { title: "Nest block", tag: "Optional", items: ["A box of bamboo tubes, each closed at one end.", "If you put up more than one, space them far apart so parasites have a harder time finding the young."] },
];

/** Hive site rules the check uses. */
export const SITE = {
  waterMinFt: 25, waterMaxFt: 50, lotLineFt: 20, barrierFt: 6,
  goodFacing: ["S", "SE", "E"],
};

export const CT_RULES: { text: string; src: BeeSrc }[] = [
  { text: "Register with the State Entomologist when you get bees, then every year by October 1. It's free, online through eLicense.", src: "caesReg" },
  { text: "Skipping registration can bring a fine of up to $25.", src: "ctLaw" },
  { text: "Bees shipped in need a health certificate. Used hives and frames must be inspected before they're sold, so ask for the certificate.", src: "ctLaw" },
  { text: "Inspection and registration exist to keep bee diseases and parasites out of the state.", src: "caesReg" },
];
export const CT_HELP: { text: string; src: BeeSrc }[] = [
  { text: "Clubs named by CAES: Connecticut Beekeepers Association, Backyard Beekeepers Association, Eastern Connecticut Beekeepers Association.", src: "caes09" },
  { text: "CAES suggests asking your insurer whether bee stings are covered.", src: "caesSite" },
];
export const TOWN_QUESTIONS = ["Are honey bees allowed in my zone?", "Is there a limit on the number of hives?", "Are there setbacks from lot lines or streets?", "Do I need a permit?", "Does an HOA or deed rule apply?"];

export type GearLine = { item: string; note: string; per: "hive" | "shared" | "site"; qtyPerHive?: number; src: BeeSrc };
export const GEAR: GearLine[] = [
  { item: "Bottom board, screened", note: "8-mesh hardware cloth lets fallen mites drop out of the hive.", per: "hive", qtyPerHive: 1, src: "psu" },
  { item: "Full-depth hive body with 10 frames", note: "The brood nest. Over 60 lb when full of honey.", per: "hive", qtyPerHive: 2, src: "psu" },
  { item: "Medium super with 10 frames", note: "For your honey. Lighter to lift than a deep.", per: "hive", qtyPerHive: 2, src: "psu" },
  { item: "Inner cover and telescoping outer cover", note: "The outer cover sheds rain.", per: "hive", qtyPerHive: 1, src: "psu" },
  { item: "Entrance reducer or mouse guard", note: "Fit in early fall; an opening under 1/2 in keeps mice out.", per: "hive", qtyPerHive: 1, src: "psu" },
  { item: "Bees: 3 lb package or a nucleus colony", note: "Order in winter; packages usually arrive in April.", per: "hive", qtyPerHive: 1, src: "psu" },
  { item: "Smoker, 4 × 7 in, with heat shield", note: "The most common size.", per: "shared", src: "psu" },
  { item: "Hive tool", note: "A screwdriver damages frames.", per: "shared", src: "psu" },
  { item: "Veil and hat, or a jacket with veil", note: "Wear a veil every time. White or tan clothing.", per: "shared", src: "psu" },
  { item: "Gloves", note: "Canvas or leather, for beginners.", per: "shared", src: "psu" },
  { item: "Mite test jar", note: "For a sugar shake or alcohol wash of about 300 bees (1/2 cup).", per: "shared", src: "hbhc" },
  { item: "Hive stand", note: "Sheet H-101, 18 in high.", per: "site", src: "mu" },
  { item: "Flyway barrier, if needed", note: "6 ft solid fence, hedge or hay bales.", per: "site", src: "caesSite" },
  { item: "Water source", note: "A pan with stones or floats, 25 to 50 ft from the hives.", per: "site", src: "caesSite" },
];

/** First-year calendar. Months are 0 = Jan; fractions place the bar within a month. */
export type BeeTask = { title: string; detail: string; from: number; to: number; src: BeeSrc; law?: boolean; ctOnly?: boolean };
export const CALENDAR: BeeTask[] = [
  { title: "Order bees; build and paint the stand and boxes", detail: "Order early for April delivery. Assemble and paint before the bees arrive.", from: 0, to: 2, src: "psu" },
  { title: "Next year: heft hives, don't open below 40°F", detail: "In February and early March, check weight by tipping the hive from behind.", from: 1, to: 2.4, src: "psu" },
  { title: "Water source out", detail: "By March 15, 25 to 50 ft from the hive. Keep it filled to October 31.", from: 2.45, to: 10, src: "caesSite" },
  { title: "Register your bees", detail: "When you get them, then every year by October 1. Free.", from: 3, to: 3.6, src: "caesReg", law: true, ctOnly: true },
  { title: "Bees arrive; install", detail: "Packages usually arrive in April.", from: 3.3, to: 4, src: "psu" },
  { title: "Inspect on warm days", detail: "10 am to 2 pm, above 60°F, during the nectar flow.", from: 4, to: 8, src: "caesSite" },
  { title: "Swarm season: give them room", detail: "Have enough boxes ready to add space.", from: 4, to: 6.5, src: "psu" },
  { title: "Mite check", detail: "Sugar shake or alcohol wash. Treat above 2 to 3 mites per 100 bees.", from: 7, to: 8.5, src: "hbhc" },
  { title: "Fewer inspections, smaller entrance", detail: "Bees are more defensive in late summer; a smaller entrance cuts robbing.", from: 7.3, to: 10, src: "caesSite" },
  { title: "Winter stores", detail: "At least 60 lb of honey by late fall; 40 to 45 lb in the top box.", from: 8, to: 10, src: "psu" },
  { title: "Mouse guard and upper entrance", detail: "Mouse guard in early fall. An upper entrance vents moisture and keeps air moving if snow buries the lower one.", from: 8.5, to: 10.5, src: "psu" },
  { title: "Renew registration", detail: "Every year, by October 1.", from: 8.6, to: 9, src: "caesReg", law: true, ctOnly: true },
];
