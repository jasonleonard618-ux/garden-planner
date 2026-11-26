import { NextResponse, type NextRequest } from "next/server";
import { codeToken, INVITE_COOKIE, inviteCodes } from "@/lib/invite";

/**
 * Invite-only gate for the pilot. A visitor enters a code once; the browser keeps a cookie holding
 * a hash of it. Removing a code from INVITE_CODES locks out everyone who used it.
 */
export async function middleware(req: NextRequest) {
  const codes = inviteCodes();
  if (!codes.length) return NextResponse.next();
  const token = req.cookies.get(INVITE_COOKIE)?.value;
  if (token) {
    const valid = await Promise.all(codes.map(codeToken));
    if (valid.includes(token)) return NextResponse.next();
  }
  if (req.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({ error: "invite required" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/invite";
  url.search = `?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except the invite page itself, its API, Next's own files, and static assets.
  matcher: ["/((?!invite|api/invite|_next/|maplibre/|home/|favicon|.*\\.(?:png|jpg|svg|ico|webp|mjs)$).*)"],
};
