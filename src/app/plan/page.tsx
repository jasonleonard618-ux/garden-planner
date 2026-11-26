import GardenApp from "@/components/GardenApp";

export const metadata = { title: "Plan your garden · Light & Loam" };

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return <GardenApp key={q ?? ""} initialQuery={q} />;
}
