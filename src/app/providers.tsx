"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WalletProvider } from "@/lib/chain/wallet";
import { ProtocolProvider } from "@/lib/chain/protocol-context";
import { WatchlistProvider } from "@/lib/watchlist";

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        <ProtocolProvider>
          <WatchlistProvider>{children}</WatchlistProvider>
        </ProtocolProvider>
      </WalletProvider>
    </QueryClientProvider>
  );
}
