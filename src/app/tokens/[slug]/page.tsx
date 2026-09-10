import type { Metadata } from "next";
import { TokenDetailPage } from "@/components/tokens/token-detail-page";
import { SEED_LAUNCHES } from "@/data/mock-seed";

interface TokenPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return Object.values(SEED_LAUNCHES).map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: TokenPageProps): Promise<Metadata> {
  const { slug } = await params;
  const launch = Object.values(SEED_LAUNCHES).find(
    (candidate) => candidate.slug === slug,
  );
  if (!launch)
    return {
      title: "Demo token",
      description:
        "Inspect a fixed or browser-local Spawn demonstration token.",
    };
  return {
    title: `${launch.name} (${launch.symbol})`,
    description: `Inspect ${launch.name}'s demonstration price history, public milestones, proceeds allocation, comments, activity, and trade simulation.`,
  };
}

export default async function TokenPage({ params }: TokenPageProps) {
  const { slug } = await params;
  return (
    <main id="main-content">
      <TokenDetailPage slug={slug} />
    </main>
  );
}
