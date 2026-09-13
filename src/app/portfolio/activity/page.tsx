import type { Metadata } from "next";
import { PortfolioActivity } from "@/components/portfolio/portfolio-activity";

export const metadata: Metadata = {
  title: "Activity",
  description:
    "Your swaps across watched and created pools, plus every launch you submitted.",
};

export default function PortfolioActivityPage() {
  return (
    <main id="main-content">
      <PortfolioActivity />
    </main>
  );
}
