import Home from "@/components/Home";

export default async function Page({ searchParams }: { searchParams: Promise<{ intro?: string }> }) {
  const { intro } = await searchParams;
  return <Home skipIntro={intro === "0"} />;
}
