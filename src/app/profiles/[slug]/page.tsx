import type { Metadata } from "next";
import { ProfilePage } from "@/components/profiles/profile-page";
import { SEED_PROFILES } from "@/data/mock-seed";

interface ProfileRouteProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return Object.values(SEED_PROFILES)
    .filter(({ kind }) => kind === "fictional-demo")
    .map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: ProfileRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const profile = Object.values(SEED_PROFILES).find(
    (candidate) => candidate.slug === slug,
  );
  if (!profile)
    return {
      title: "Demo creator profile",
      description:
        "Inspect fictional or browser-local creator attribution in the Spawn demonstration.",
    };
  return {
    title: profile.displayName,
    description: `Inspect the fictional Spawn demonstration profile for ${profile.displayName}, including attributed launches and activity.`,
  };
}

export default async function CreatorProfilePage({
  params,
}: ProfileRouteProps) {
  const { slug } = await params;
  return (
    <main id="main-content">
      <ProfilePage slug={slug} />
    </main>
  );
}
