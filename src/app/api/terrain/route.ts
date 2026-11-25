import { NextRequest, NextResponse } from "next/server";
import { terrain } from "@/lib/server/sources";

/** Bare-earth elevation grid for ?bbox=west,south,east,north */
export async function GET(req: NextRequest) {
  const bbox = (req.nextUrl.searchParams.get("bbox") ?? "").split(",").map(Number);
  if (bbox.length !== 4 || bbox.some((v) => !Number.isFinite(v))) {
    return NextResponse.json({ error: "bbox required" }, { status: 400 });
  }
  if (bbox[2] - bbox[0] > 0.05 || bbox[3] - bbox[1] > 0.05) {
    return NextResponse.json({ error: "area too large" }, { status: 400 });
  }
  try {
    const size = Math.min(200, Math.max(16, Number(req.nextUrl.searchParams.get("size")) || 64));
    const t = await terrain(bbox as [number, number, number, number], size);
    return NextResponse.json(t, { headers: { "Cache-Control": "public, s-maxage=2592000" } });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
