import InviteForm from "./InviteForm";

export const metadata = { title: "Private pilot · Light & Loam" };

export default async function InvitePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return <InviteForm next={safeNext} />;
}
