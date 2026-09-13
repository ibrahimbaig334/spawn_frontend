"use client";

import Link from "next/link";
import { useWatchlist } from "@/lib/watchlist";
import { usePoolCards } from "@/lib/use-pool-cards";
import { Button } from "@/components/ui";
import { relativeTime, usdApproxFromEthWei } from "@/lib/display";
import { formatSubscriptPrice } from "@/lib/format";
import { PAGE, EYEBROW, SECTION, SECTION_HEADER, EMPTY } from "./portfolio-styles";

export function PortfolioWatchlist() {
  const watchlist = useWatchlist();
  const cards = usePoolCards([...watchlist.poolIds]);

  const rows = cards
    .map((query, index) => ({ poolId: watchlist.poolIds[index]!, detail: query.data ?? null }))
    .filter((entry) => entry.detail)
    .map((entry) => entry.detail!);

  return (
    <main className={PAGE} id="main-content">
      <p className={EYEBROW}>Portfolio</p>
      <h1 className="mt-2 mb-0 text-[clamp(2.5rem,6vw,5rem)] leading-[0.95]">Watchlist</h1>
      <section className={SECTION}>
        <header className={SECTION_HEADER}>
          <div>
            <p className={EYEBROW}>Following</p>
            <h2>Your pools</h2>
          </div>
          <span>{rows.length} pools · stored in this browser</span>
        </header>
        {rows.length === 0 ? (
          <div className={EMPTY}>
            <h3>Nothing watched yet.</h3>
            <p>
              <Link href="/tokens">Browse tokens</Link> and press the bookmark on any pool.
            </p>
          </div>
        ) : (
          <ul className="m-0 list-none border-b border-rule p-0">
            {rows.map((detail) => (
              <li key={detail.poolId} className="grid grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto_auto] items-center gap-4 border-b border-rule py-3">
                <Link className="truncate font-bold text-ink no-underline hover:underline" href={`/tokens/${detail.poolId}`}>
                  {detail.name ?? "Unnamed"}{" "}
                  <span className="font-mono text-xs text-ink-muted">${detail.symbol ?? "—"}</span>
                </Link>
                <span className="font-mono text-sm">{detail.status}</span>
                <span className="font-mono text-sm font-bold">
                  {detail.priceEth ? `${formatSubscriptPrice(detail.priceEth)} ETH` : "—"}
                </span>
                <span className="font-mono text-sm">
                  {detail.priceEth ? `≈ $${usdApproxFromEthWei(detail.priceEth).toPrecision(2)}` : "—"}
                </span>
                <span className="font-mono text-xs text-ink-muted">{relativeTime(detail.launchTime)}</span>
                <Button variant="quiet" onClick={() => watchlist.remove(detail.poolId)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
        {rows.length > 0 ? (
          <div className="mt-4">
            <Button variant="secondary" onClick={watchlist.clear}>
              Clear watchlist
            </Button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
