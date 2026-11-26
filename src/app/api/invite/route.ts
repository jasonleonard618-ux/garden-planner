import { NextRequest, NextResponse } from "next/server";
import { codeToken, INVITE_COOKIE, inviteCodes } from "@/lib/invite";

export async function POST(req: NextRequest) {
  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  const codes = inviteCodes();
  if (!code || !codes.includes(code.trim().toLowerCase())) {
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(INVITE_COOKIE, await codeToken(code), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 180,
  });
  return res;
}
