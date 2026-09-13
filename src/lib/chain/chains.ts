import { http, createPublicClient, type Chain, type PublicClient } from "viem";
import { base, baseSepolia } from "viem/chains";
import { APP_ENV } from "@/lib/env";

const KNOWN_CHAINS: Record<number, Chain> = {
  [base.id]: base,
  [baseSepolia.id]: baseSepolia,
};

export function chainFor(chainId: number): Chain {
  const known = KNOWN_CHAINS[chainId];
  if (known) {
    return { ...known, rpcUrls: { default: { http: [APP_ENV.rpcUrl] } } };
  }
  return {
    id: chainId,
    name: `Chain ${chainId}`,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [APP_ENV.rpcUrl] } },
  };
}

let client: PublicClient | null = null;

/** Shared read client (viem http) for the configured chain. */
export function getPublicClient(): PublicClient {
  if (!client) {
    client = createPublicClient({
      chain: chainFor(APP_ENV.chainId),
      transport: http(APP_ENV.rpcUrl),
      batch: { multicall: true },
    });
  }
  return client;
}
