import { NextRequest, NextResponse } from "next/server";
import { frostAt } from "@/lib/server/frost";
import { hardinessZone, reverseLookup, soilAt, windAt } from "@/lib/server/sources";

export const maxDuration = 60;

const settle = async <T,>(p: Promise<T>): Promise<T | null> => {
  try {
    return await p;
  } catch (e) {
    console.warn("site source failed", e);
    return null;
  }
};

/** Climate zone, soil and wind for a point. */
export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lon = Number(req.nextUrl.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: "lat and lon required" }, { status: 400 });
  }
  const where = (await settle(reverseLookup(lat, lon))) ?? {};
  const [zone, soil, wind] = await Promise.all([
    where.zip ? settle(hardinessZone(where.zip)) : null,
    settle(soilAt(lat, lon)),
    where.state ? settle(windAt(lat, lon, where.state)) : null,
  ]);
  return NextResponse.json({ ...where, zone, soil, wind, frost: frostAt(lat, lon) }, { headers: { "Cache-Control": "public, s-maxage=2592000" } });
}
