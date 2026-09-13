import { useEffect, useState } from "react";
import type { PublicClient } from "viem";

/**
 * Resolves swap transaction hashes to the actual trader (tx `from`).
 *
 * Chain events only record the router as the swap sender, so the tape would
 * otherwise credit every trade to the router contract. Results are cached
 * process-wide and concurrent lookups for the same hash share one request.
 */

const traderCache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

function lookup(client: PublicClient, txHash: string): Promise<string | null> {
  const key = txHash.toLowerCase();
  if (traderCache.has(key)) return Promise.resolve(traderCache.get(key) ?? null);
  const pending = inflight.get(key);
  if (pending) return pending;
  const request = client
    .getTransaction({ hash: txHash as `0x${string}` })
    .then((tx) => {
      const from = tx?.from?.toLowerCase() ?? null;
      traderCache.set(key, from);
      return from;
    })
    .catch(() => {
      traderCache.set(key, null);
      return null;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, request);
  return request;
}

/** Maps every given tx hash to its trader address (falls back to null). */
export function useTraderMap(
  client: PublicClient | null,
  txHashes: string[],
): Record<string, string> {
  const key = [...new Set(txHashes.map((h) => h.toLowerCase()))].sort().join(",");
  const [map, setMap] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!client || !key) {
      setMap({});
      return;
    }
    let cancelled = false;
    void Promise.all(
      key.split(",").map(async (hash) => {
        const trader = await lookup(client, hash);
        return [hash, trader] as const;
      }),
    ).then((entries) => {
      if (cancelled) return;
      const next: Record<string, string> = {};
      for (const [hash, trader] of entries) {
        if (trader) next[hash] = trader;
      }
      setMap(next);
    });
    return () => {
      cancelled = true;
    };
  }, [client, key]);
  return map;
}
