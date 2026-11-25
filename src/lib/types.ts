export type LngLat = [number, number];

export type Place = { label: string; lat: number; lon: number; zip?: string; state?: string };

export type SurfaceGrid = {
  available: true;
  project: string;
  year: number;
  cell: number;
  cols: number;
  rows: number;
  bounds: [number, number, number, number]; // web mercator
  k: number;
  surface: (number | null)[];
  ground: (number | null)[];
  kind: number[]; // 0 unknown, 1 building, 2 vegetation
  classified: boolean;
};

export type Terrain = { cols: number; rows: number; bounds: [number, number, number, number]; elevation: (number | null)[] };

export type SiteData = {
  zip?: string;
  state?: string;
  county?: string;
  zone: { zone: string; tempRangeF: string } | null;
  soil: {
    mapUnit: string;
    components: {
      name: string;
      percent: number;
      drainage: string | null;
      hydrologicGroup: string | null;
      texture: string | null;
      ph: number | null;
      organicMatter: number | null;
    }[];
  } | null;
  wind: {
    station: string;
    stationName: string;
    distanceMiles: number;
    period: string;
    calmPercent: number;
    sectors: { dir: string; percent: number; strongPercent: number }[];
    prevailing: string;
    strongest: string;
  } | null;
};

/** Things the person adds that the lidar missed, or that are new. */
export type SiteObject =
  | { id: string; type: "tree"; at: LngLat; heightFt: number; widthFt: number; leaves: "deciduous" | "evergreen" }
  | { id: string; type: "structure"; ring: LngLat[]; heightFt: number; label: string }
  | { id: string; type: "clear"; ring: LngLat[] };

export type Season = "spring" | "summer" | "fall";

export type SunStats = { avgHours: number; full: number; part: number; shade: number };

export type TerrainStats = {
  minFt: number;
  maxFt: number;
  avgSlopePct: number;
  maxSlopePct: number;
  facing: string | null;
};

export type SiteProfile = {
  id: string;
  name: string;
  savedAt: string;
  place: Place;
  garden: LngLat[] | null;
  objects: SiteObject[];
  imagery: "usgs" | "esri";
  summary: {
    areaSqFt?: number;
    perimeterFt?: number;
    terrain?: TerrainStats | null;
    sun?: Partial<Record<Season, SunStats>>;
    site?: SiteData | null;
  };
};
