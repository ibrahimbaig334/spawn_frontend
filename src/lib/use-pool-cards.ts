"use client";

import { useQueries } from "@tanstack/react-query";
import { getToken } from "@/lib/api/endpoints";
import type { TokenDetail } from "@/lib/api/dto";

/** Batch-resolve pool cards (small sets: watchlist, created, holdings). */
export function usePoolCards(poolIds: string[]) {
  return useQueries({
    queries: poolIds.map((poolId) => ({
      queryKey: ["tokens", poolId, "detail", { tradeLimit: 1 }],
      queryFn: () => getToken(poolId, { tradeLimit: 1 }),
      staleTime: 20_000,
      refetchInterval: 30_000,
    })),
  });
}

export type PoolCardResult = {
  poolId: string;
  detail: TokenDetail | null;
  error: unknown;
};
