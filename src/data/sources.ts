/** Every source the app cites, with a link people can check. */
export const SRC = {
  muSize: { label: "University of Missouri Extension G6201: Vegetable planting calendar, Table 1 (reviewed 2016)", href: "https://extension.missouri.edu/publications/g6201" },
  isu: { label: "Iowa State Extension: vegetables in partial shade", href: "https://yardandgarden.extension.iastate.edu/faq/which-vegetables-will-grow-partial-shade" },
  isuCover: { label: "Iowa State Extension: cover crops for home gardens", href: "https://yardandgarden.extension.iastate.edu/how-to/types-cover-crops-use-home-vegetable-gardens" },
  isuCoverEnd: { label: "Iowa State Extension: ending cover crops", href: "https://yardandgarden.extension.iastate.edu/how-to/how-terminate-cover-crops-vegetable-garden" },
  csu: { label: "Colorado State Extension GardenNotes #713", href: "https://extension.colostate.edu/resource/block-style-layout-in-raised-bed-vegetable-gardens/" },
  rutgers: { label: "Rutgers FS787: Starting vegetable seeds indoors", href: "https://extension.rutgers.edu/fs787" },
  umnSeeds: { label: "UMN Extension: Starting seeds indoors", href: "https://extension.umn.edu/planting-and-growing-guides/starting-seeds-indoors" },
  umnPlant: { label: "UMN Extension: Planting the vegetable garden", href: "https://extension.umn.edu/planting-and-growing-guides/planting-vegetable-garden" },
  uga: { label: "UGA Extension C1089: Georgia homegrown tomatoes", href: "https://fieldreport.caes.uga.edu/publications/C1089/" },
  msu: { label: "Mississippi State P2975: Tomato troubles", href: "https://extension.msstate.edu/publications/tomato-troubles-common-problems-tomatoes" },
  clemsonWater: { label: "Clemson HGIC: Watering the vegetable garden", href: "https://hgic.clemson.edu/factsheet/watering-the-vegetable-garden/" },
  clemsonDrip: { label: "Clemson HGIC: Installing drip irrigation", href: "https://hgic.clemson.edu/factsheet/installing-drip-irrigation-in-home-gardens/" },
  umdInsects: { label: "UMD Extension: Vegetable problems caused by insects", href: "https://extension.umd.edu/resources/yard-garden/vegetables/vegetable-problems-caused-insects" },
  umdFall: { label: "UMD Extension: Cleaning up the vegetable garden in fall", href: "https://marylandgrows.umd.edu/2023/11/03/cleaning-up-the-vegetable-garden-in-fall/" },
  oregonTomato: { label: "Oregon State Extension: Tomato diseases", href: "https://extension.oregonstate.edu/news/understanding-tomato-diseases-helps-gardeners-grow-confidence" },
  ugaFence: { label: "UGA Extension C1027-9: Garden fencing", href: "https://fieldreport.caes.uga.edu/publications/C1027-9/garden-fencing/" },
  umdBeds: { label: "UMD Extension: Safety of materials for raised beds (2024)", href: "https://extension.umd.edu/resource/safety-materials-used-building-raised-beds" },
  askBeds: { label: "Ask Extension: Safe ways to protect raised beds", href: "https://ask.extension.org/kb/faq.php?id=302640" },
  hgicGalv: { label: "UMD Home and Garden Information Center via Ask Extension: Galvanized raised beds (2025)", href: "https://ask.extension.org/kb/faq.php?id=919239" },
  tankDrain: { label: "Ask Extension: Stock tanks as garden containers (2024)", href: "https://ask.extension.org/kb/faq.php?id=874870" },
  uwContainers: { label: "UW-Madison Extension XHT1278: Growing vegetables in containers (2021)", href: "https://hort.extension.wisc.edu/articles/growing-vegetables-containers/" },
  fplChar: { label: "USDA Forest Products Lab: Durability of charred wood (2021)", href: "https://www.fpl.fs.usda.gov/documnts/pdf2021/fpl_2021_hasburgh002.pdf" },
  call811: { label: "Call 811 before you dig", href: "https://call811.com/" },
  noaa: { label: "NOAA U.S. Climate Normals 1991–2020", href: "https://www.ncei.noaa.gov/products/land-based-station/us-climate-normals" },
} as const;

export type SrcKey = keyof typeof SRC;
