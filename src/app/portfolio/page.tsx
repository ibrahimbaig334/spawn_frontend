import type { Metadata } from "next";
import { PortfolioOverview } from "@/components/portfolio/portfolio-overview";

export const metadata: Metadata = {
  title: "Portfolio",
  description:
    "Your Base wallet balances across watched and created pools, RevenueNFT streams, and launches.",
};

export default function PortfolioPage() {
  return (
    <main id="main-content">
      <PortfolioOverview />
    </main>
  );
}
