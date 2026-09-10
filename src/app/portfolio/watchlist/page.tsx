import type { Metadata } from "next";
import { PortfolioWatchlist } from "@/components/portfolio/portfolio-watchlist";

export const metadata: Metadata = {
  title: "Demo watchlist",
  description: "Review demonstration tokens bookmarked in this browser.",
};

export default function PortfolioWatchlistPage() {
  return (
    <main id="main-content">
      <PortfolioWatchlist />
    </main>
  );
}
