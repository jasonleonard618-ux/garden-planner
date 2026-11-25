import { NextRequest, NextResponse } from "next/server";
import { geocodeAddress, suggest } from "@/lib/server/sources";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ places: [] });
  try {
    let places = await geocodeAddress(q).catch(() => []);
    if (!places.length) places = await suggest(q);
    return NextResponse.json({ places }, { headers: { "Cache-Control": "public, s-maxage=86400" } });
  } catch (e) {
    return NextResponse.json({ places: [], error: String(e) });
  }
}
