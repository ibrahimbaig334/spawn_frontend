"use client";

import Link from "next/link";
import { useWatermark } from "@/lib/queries";
import { useProtocol } from "@/lib/chain/protocol-context";

/**
 * Live protocol status banner. Shows: contracts not deployed yet (manifest
 * missing), indexer staleness (>30s behind), and relay-disabled
 * (trustedOperator zero). Replaces the old demo banner.
 */
export function ProtocolBanner() {
  const { undeployed } = useProtocol();
  const watermark = useWatermark();

  if (undeployed) {
    return (
      <div className="bg-protocol px-4 py-2 text-center text-sm font-bold text-carbon">
        The Spawn protocol is not deployed on this chain yet — market data and
        launches will appear as soon as the deployment manifest syncs.{" "}
        <Link className="underline" href="/protocol">
          Protocol status
        </Link>
      </div>
    );
  }

  const data = watermark.data;
  if (!data) {
    if (watermark.error && (watermark.error as { code?: string }).code === "WATERMARK_NOT_FOUND") {
      return (
        <div className="bg-protocol px-4 py-2 text-center text-sm font-bold text-carbon">
          Indexer is starting up — no blocks committed yet.
        </div>
      );
    }
    return null;
  }

  // Freshness measured at the moment this snapshot was fetched (no Date.now in render).
  const staleSeconds = Math.max(0, (watermark.dataUpdatedAt - new Date(data.blockTime).getTime()) / 1000);
  const relayDisabled = Boolean(data.trustedOperator && /^0x0+$/.test(data.trustedOperator));

  if (relayDisabled) {
    return (
      <div className="bg-error px-4 py-2 text-center text-sm font-bold text-inverse">
        Relayed launches are disabled: the on-chain trusted operator is unset. Direct
        creator launches still work.
      </div>
    );
  }

  if (staleSeconds > 60) {
    return (
      <div className="bg-protocol px-4 py-2 text-center text-sm font-bold text-carbon">
        Data may be delayed — the indexer is ~{Math.round(staleSeconds)}s behind chain.
      </div>
    );
  }

  return null;
}
