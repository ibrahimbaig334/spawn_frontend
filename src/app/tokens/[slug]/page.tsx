import type { Metadata } from "next";
import { TokenDetailPage } from "@/components/tokens/token-detail-page";
import { SEED_LAUNCH_SLUGS } from "@/data/mock-seed";

interface TokenPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return SEED_LAUNCH_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: TokenPageProps): Promise<Metadata> {
  const { slug } = await params;
  const name = slug.split("-").slice(0, -1).join(" ") || "Token";
  if (!SEED_LAUNCH_SLUGS.includes(slug))
    return {
      title: "Token",
      description: "Inspect a simulated Spawn launch.",
    };
  return {
    title: name,
    description: `Inspect ${name}'s level, milestone ladder, payout pot, claims, and trade simulation.`,
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
