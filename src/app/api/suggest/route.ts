import { NextRequest, NextResponse } from "next/server";
import { suggest } from "@/lib/server/sources";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) return NextResponse.json({ places: [] });
  try {
    return NextResponse.json({ places: await suggest(q) }, { headers: { "Cache-Control": "public, s-maxage=86400" } });
  } catch (e) {
    return NextResponse.json({ places: [], error: String(e) });
  }
}
