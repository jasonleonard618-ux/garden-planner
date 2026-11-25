import { NextRequest, NextResponse } from "next/server";
import { buildSurfaceGrid } from "@/lib/server/lidar";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lon = Number(req.nextUrl.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: "lat and lon required" }, { status: 400 });
  }
  try {
    const grid = await buildSurfaceGrid(lon, lat);
    if (!grid) return NextResponse.json({ available: false });
    return NextResponse.json(
      { available: true, ...grid },
      { headers: { "Cache-Control": "public, s-maxage=2592000, stale-while-revalidate=86400" } },
    );
  } catch (e) {
    return NextResponse.json({ available: false, error: String(e) }, { status: 200 });
  }
}
