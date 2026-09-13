import type { Metadata } from "next";
import { Suspense } from "react";
import { StatusPage } from "@/components/ui/status-page";
import { TokenDirectory } from "@/components/tokens/token-directory";

export const metadata: Metadata = {
  title: "Tokens",
  description:
    "All Spawn launches: search live bonding-curve pools and graduated markets by phase, valuation, and volume.",
};

export default function TokensPage() {
  return (
    <main id="main-content">
      <Suspense
        fallback={
          <StatusPage label="Loading directory" title="Preparing token data." loading />
        }
      >
        <TokenDirectory />
      </Suspense>
    </main>
  );
}
