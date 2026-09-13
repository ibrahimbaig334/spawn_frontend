"use client";

import Link from "next/link";
import { useFeaturedTokens, useTokenList } from "@/lib/queries";
import { formatCompactEth, relativeTime } from "@/lib/display";
import { formatSubscriptPrice } from "@/lib/format";
import { ApiError } from "@/lib/api/client";

function formatSubscript(value: string): string {
  return formatSubscriptPrice(value);
}

export function FeaturedTokens() {
  const featured = useFeaturedTokens();
  const newest = useTokenList({ sort: "newest", limit: 6, phase: "bonding" });

  const rows = (featured.data ?? []).map((f) => ({
    poolId: f.pool_id,
    name: f.name ?? "Unnamed",
    symbol: f.symbol ?? "—",
    status: f.status,
    volume: f.daily_volume_eth,
    total: f.total_volume_eth,
  }));

  return (
    <section className={`${PAGE} border-b border-rule py-[clamp(3rem,7vw,6rem)]`} aria-labelledby="featured-title">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={EYEBROW}>Live markets</p>
          <h2 className="m-0 text-[clamp(1.8rem,4vw,3rem)]" id="featured-title">
            Trending on Spawn
          </h2>
        </div>
        <Link className="font-bold text-ink underline-offset-4 hover:underline" href="/tokens">
          Browse all pools →
        </Link>
      </header>

      {featured.isError ? (
        <p className="mt-6 text-sm text-ink-muted" role="status">
          {featured.error instanceof ApiError && featured.error.code === "MANIFEST_NOT_SYNCED"
            ? "No pools yet — the protocol is waiting for its deployment manifest."
            : "Featured data unavailable right now."}
        </p>
      ) : rows.length > 0 ? (
        <ol className="mt-6 grid list-none gap-4 p-0 md:grid-cols-3">
          {rows.map((row, index) => (
            <li key={row.poolId}>
              <Link
                href={`/tokens/${row.poolId}`}
                className="grid gap-3 rounded-lg border-2 border-ink bg-carbon p-5 text-[#e9e7e0] no-underline transition-transform hover:-translate-y-1"
              >
                <span className="flex items-center justify-between">
                  <span className="font-mono text-[0.68rem] font-black uppercase text-[#f5c518]">
                    #{index + 1} · {row.status}
                  </span>
                  <span className="font-mono text-[0.68rem] text-[#e9e7e0]/60">
                    {row.volume ? formatCompactEth(row.volume) : "0"} ETH / 24h
                  </span>
                </span>
                <span className="text-lg font-black">{row.name}</span>
                <span className="font-mono text-sm text-[#e9e7e0]/70">${row.symbol}</span>
                <span className="font-mono text-xs text-[#e9e7e0]/60">
                  lifetime volume {row.total ? formatCompactEth(row.total) : "0"} ETH
                </span>
              </Link>
            </li>
          ))}
        </ol>
      ) : null}

      {!featured.isError && rows.length === 0 && newest.data && newest.data.data.length > 0 ? (
        <ol className="mt-6 grid list-none gap-4 p-0 md:grid-cols-3">
          {newest.data.data.slice(0, 3).map((item) => (
            <li key={item.poolId}>
              <Link
                href={`/tokens/${item.poolId}`}
                className="grid gap-3 rounded-lg border-2 border-ink bg-carbon p-5 text-[#e9e7e0] no-underline transition-transform hover:-translate-y-1"
              >
                <span className="flex items-center justify-between">
                  <span className="font-mono text-[0.68rem] font-black uppercase text-[#f5c518]">
                    new · {item.status}
                  </span>
                  <span className="font-mono text-[0.68rem] text-[#e9e7e0]/60">{relativeTime(item.launchTime)}</span>
                </span>
                <span className="text-lg font-black">{item.name ?? "Unnamed"}</span>
                <span className="font-mono text-xs text-[#e9e7e0]/70">
                  {item.priceEth ? `${formatSubscript(item.priceEth)} ETH` : "—"} · FDV{" "}
                  {item.fdvEthWei ? `${formatCompactEth(item.fdvEthWei)} ETH` : "—"}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      ) : null}

      {!featured.isError && rows.length === 0 && !newest.isPending && (newest.data?.data.length ?? 0) === 0 ? (
        <div className="mt-6 rounded-lg border-2 border-dashed border-rule p-10 text-center">
          <p className="m-0 font-bold text-ink">No launches yet.</p>
          <p className="mt-1 text-sm text-ink-muted">
            The first token on the protocol will appear here the moment it confirms.{" "}
            <Link className="underline" href="/create">
              Be the first
            </Link>
            .
          </p>
        </div>
      ) : null}
    </section>
  );
}

const PAGE =
  "mx-auto w-full max-w-measure px-[max(1rem,calc((100vw-80rem)/2))]";
const EYEBROW =
  "m-0 font-mono text-[0.68rem] font-bold uppercase tracking-[0.08em] text-accent-strong";
