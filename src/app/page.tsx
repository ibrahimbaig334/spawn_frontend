import type { Metadata } from "next";
import { ClosingCta } from "@/components/home/closing-cta";
import { Economics } from "@/components/home/economics";
import { FeaturedTokens } from "@/components/home/featured-tokens";
import { HowItWorks } from "@/components/home/how-it-works";
import { LandingHero } from "@/components/home/landing-hero";
import { RiskFaq } from "@/components/home/risk-faq";

export const metadata: Metadata = {
  title: "Milestone-based token launch protocol concept",
  description:
    "Explore a professional, deterministic concept for token launches governed by public price targets and declared proceeds allocation.",
};

export default function HomePage() {
  return (
    <main id="main-content">
      <LandingHero />
      <FeaturedTokens />
      <HowItWorks />
      <Economics />
      <RiskFaq />
      <ClosingCta />
    </main>
  );
}
