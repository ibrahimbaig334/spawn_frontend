import type { Metadata } from "next";
import { PortfolioActivity } from "@/components/portfolio/portfolio-activity";

export const metadata: Metadata = {
  title: "Demo account activity",
  description:
    "Inspect deterministic fixture and browser-local ledger entries for the Spawn demonstration account.",
};

export default function PortfolioActivityPage() {
  return (
    <main id="main-content">
      <PortfolioActivity />
    </main>
  );
}
