import type { Metadata } from "next";
import { Suspense } from "react";
import { StatusPage } from "@/components/ui/status-page";
import { TokenDirectory } from "@/components/tokens/token-directory";

export const metadata: Metadata = {
  title: "Demo tokens",
  description:
    "Search and compare fixed and browser-local demonstration tokens by stage, valuation, milestone progress, and watchlist status.",
};

export default function TokensPage() {
  return (
    <main id="main-content">
      <Suspense
        fallback={
          <StatusPage
            label="Loading directory"
            title="Preparing demo tokens."
            loading
          />
        }
      >
        <TokenDirectory />
      </Suspense>
    </main>
  );
}
