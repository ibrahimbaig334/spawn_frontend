import type { Metadata } from "next";
import { ClosingCta } from "@/components/home/closing-cta";
import { Economics } from "@/components/home/economics";
import { FeaturedTokens } from "@/components/home/featured-tokens";
import { HowItWorks } from "@/components/home/how-it-works";
import { LandingHero } from "@/components/home/landing-hero";
import { RiskFaq } from "@/components/home/risk-faq";

export const metadata: Metadata = {
  title: "Milestone-based token launchpad on Base",
  description:
    "Launch and trade milestone-backed tokens: a Uniswap v4 bonding curve that graduates into a protocol-owned sell ladder paying creators, plugins, and the protocol on fixed terms.",
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
