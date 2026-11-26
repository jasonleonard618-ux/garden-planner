import { CROPS } from "@/data/crops";
import { TIMING } from "@/data/timing";

export type Span = { from: Date; to: Date };
export type CropPlan = {
  id: string;
  name: string;
  indoors?: Span; // window to sow seeds indoors
  growInside?: Span;
  harden?: Span;
  sow?: Span; // sown straight in the bed
  plantOut?: Date;
  buy?: Date;
  harvest?: Span;
  notes: string[];
};

const DAY = 864e5;
const add = (d: Date, days: number) => new Date(d.getTime() + days * DAY);
export const mdToDate = (md: string, year: number) => {
  const [m, d] = md.split("/").map(Number);
  return new Date(year, m - 1, d, 12);
};

/**
 * Dates for one crop from the local frost dates.
 *  - Warm crops go out 3 weeks after the last-frost date (practical margin: half of years still
 *    see a frost after that date). Cool-season transplants go out a week before it, and cool
 *    crops sown in the bed go in 3 weeks before to the frost date.
 *  - Indoor start = plant-out date minus the Rutgers weeks (or the state guide's, when it gives
 *    its own); harden off the week before.
 *  - Harvest begins after the packet days; warm crops run to the first frost, quick cool crops
 *    about a month.
 */
export function cropPlan(id: string, lastSpring: string, firstFall: string, year: number, weeksOverride?: [number, number]): CropPlan | null {
  const c = CROPS.find((x) => x.id === id);
  const t = TIMING[id];
  if (!c || !t) return null;
  const last = mdToDate(lastSpring, year), first = mdToDate(firstFall, year);
  const out = c.warm ? add(last, 21) : add(last, -7);
  const p: CropPlan = { id, name: c.name, notes: [] };
  if (c.start === "fall") {
    p.sow = { from: add(first, -14), to: add(first, 7) };
    p.notes.push("Planted this fall, harvested next summer.");
    return p;
  }
  let start: Date;
  if (t.method === "indoors") {
    const [w0, w1] = weeksOverride ?? t.weeks ?? [6, 8];
    p.indoors = { from: add(out, -w1 * 7), to: add(out, -w0 * 7) };
    p.growInside = { from: add(out, -w0 * 7), to: add(out, -7) };
    p.harden = { from: add(out, -7), to: out };
    p.plantOut = out;
    start = out;
  } else if (t.method === "buy") {
    p.buy = out;
    p.plantOut = out;
    start = out;
  } else {
    p.sow = c.warm ? { from: out, to: add(out, 14) } : { from: add(last, -21), to: last };
    start = p.sow.from;
  }
  if (c.perennial) {
    p.notes.push("First real harvest the year after planting.");
    return p;
  }
  const h0 = add(start, c.days);
  const h1 = c.warm ? first : c.days < 60 ? add(h0, 30) : add(h0, 21);
  if (h0 < first) p.harvest = { from: h0, to: h1 > first && !c.warm ? first : h1 };
  else p.notes.push("Not enough season left to harvest before the first frost.");
  return p;
}
