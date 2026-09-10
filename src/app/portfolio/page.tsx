import type { Metadata } from "next";
import { PortfolioOverview } from "@/components/portfolio/portfolio-overview";

export const metadata: Metadata = {
  title: "Demo portfolio",
  description:
    "Review browser-local holdings, average-cost basis, estimated demo value, and demonstration profit or loss.",
};

export default function PortfolioPage() {
  return (
    <main id="main-content">
      <PortfolioOverview />
    </main>
  );
}
