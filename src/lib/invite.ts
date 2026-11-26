/** Invite-only pilot: INVITE_CODES is a comma-separated list. Without it, the site is open (local dev). */
export function inviteCodes(): string[] {
  return (process.env.INVITE_CODES ?? "").split(",").map((c) => c.trim().toLowerCase()).filter(Boolean);
}

export async function codeToken(code: string) {
  const data = new TextEncoder().encode(`light-and-loam:${code.trim().toLowerCase()}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

export const INVITE_COOKIE = "ll_invite";
