"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { formatEther } from "viem";
import { Button } from "@/components/ui";
import { useWallet } from "@/lib/chain/wallet";
import { useLaunchRecords } from "@/lib/queries";
import { useWatchlist } from "@/lib/watchlist";
import { useProfileTokens } from "@/lib/queries";
import { listTokenTrades } from "@/lib/api/endpoints";
import type { TradeItem } from "@/lib/api/dto";
import { explorerTx } from "@/lib/env";
import { formatCompactEth, relativeTime, wei } from "@/lib/display";
import { truncateDecimals } from "@/lib/format";
import { PAGE, EYEBROW, SECTION, SECTION_HEADER, EMPTY } from "./portfolio-styles";

const STATE_TONE: Record<string, string> = {
  CONFIRMED: "text-accent-strong",
  SUBMITTED: "text-protocol",
  PENDING_RELAY: "text-ink-muted",
  FAILED: "text-error",
  REORGED: "text-error",
};

export function PortfolioActivity() {
  const wallet = useWallet();
  const watchlist = useWatchlist();
  const address = wallet.address;
  const launches = useLaunchRecords({ creator: address ?? undefined, limit: 50 }, Boolean(address));
  const created = useProfileTokens(address);

  const pools = Array.from(
    new Set([
      ...(created.data?.data.map((token) => token.poolId) ?? []),
      ...watchlist.poolIds,
    ]),
  );

  const userTrades = useQuery({
    queryKey: ["portfolio-trades", address, pools.join(",")],
    enabled: Boolean(address) && pools.length > 0,
    queryFn: async () => {
      const pages = await Promise.all(
        pools.slice(0, 20).map((poolId) =>
          listTokenTrades(poolId, { sort: "newest", limit: 100 }).catch(() => ({ data: [] as TradeItem[], meta: undefined as never })),
        ),
      );
      const lower = address!.toLowerCase();
      return pages
        .flatMap((page, index) => (page.data ?? []).map((trade) => ({ trade, poolId: pools[index]! })))
        .filter(({ trade }) => trade.sender.toLowerCase() === lower)
        .sort((a, b) => new Date(b.trade.timestamp).getTime() - new Date(a.trade.timestamp).getTime())
        .slice(0, 60);
    },
    refetchInterval: 30_000,
  });

  if (!address) {
    return (
      <main className={PAGE} id="main-content">
        <p className={EYEBROW}>Portfolio</p>
        <h1 className="mt-2 mb-0 text-[clamp(2.5rem,6vw,5rem)] leading-[0.95]">Activity</h1>
        <div className="mt-10 max-w-lg rounded-lg border-2 border-dashed border-rule p-10 text-center">
          <p className="m-0 text-ink-muted">Connect a wallet to see your launches and swaps.</p>
          <div className="mt-4">
            <Button onClick={() => void wallet.connect().catch(() => undefined)}>Connect wallet</Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={PAGE} id="main-content">
      <p className={EYEBROW}>Portfolio</p>
      <h1 className="mt-2 mb-0 text-[clamp(2.5rem,6vw,5rem)] leading-[0.95]">Activity</h1>

      <section className={SECTION}>
        <header className={SECTION_HEADER}>
          <div>
            <p className={EYEBROW}>Swaps</p>
            <h2>Your trades (watched + created pools)</h2>
          </div>
          <span>{userTrades.data?.length ?? 0} recent</span>
        </header>
        {userTrades.data && userTrades.data.length > 0 ? (
          <ul className="m-0 list-none border-b border-rule p-0">
            {(userTrades.data ?? []).map(({ trade, poolId }) => (
              <li key={`${trade.transactionHash}-${trade.logIndex}`} className="grid grid-cols-[4rem_minmax(0,2fr)_repeat(2,minmax(0,1fr))_auto] items-center gap-4 border-b border-rule py-3 text-sm">
                <span
                  className={[
                    "rounded-sm px-1.5 py-0.5 text-center font-mono text-[0.62rem] font-black",
                    trade.side === "BUY" ? "bg-accent text-carbon" : "bg-error text-inverse",
                  ].join(" ")}
                >
                  {trade.side}
                </span>
                <Link className="truncate font-bold text-ink no-underline hover:underline" href={`/tokens/${poolId}`}>
                  lvl {trade.level.toLocaleString()}
                </Link>
                <span className="font-mono">
                  {trade.side === "BUY"
                    ? `−${truncateDecimals(formatEther(wei(trade.ethAmount)))} ETH`
                    : `+${truncateDecimals(formatEther(wei(trade.ethAmount)))} ETH`}
                </span>
                <span className="font-mono text-ink-muted">{formatCompactEth(trade.tokenAmount, 0)} tk</span>
                <a className="font-mono text-xs underline" href={explorerTx(trade.transactionHash)} rel="noreferrer" target="_blank">
                  tx
                </a>
                <time className="font-mono text-[0.68rem] text-ink-muted" dateTime={trade.timestamp}>
                  {relativeTime(trade.timestamp)}
                </time>
              </li>
            ))}
          </ul>
        ) : (
          <div className={EMPTY}>
            <h3>No swaps found in your pools yet.</h3>
            <p>Your buy/sell transactions against watched and created pools land here.</p>
          </div>
        )}
      </section>

      <section className={SECTION}>
        <header className={SECTION_HEADER}>
          <div>
            <p className={EYEBROW}>Launches</p>
            <h2>Your launch records</h2>
          </div>
          <span>{launches.data?.meta.total ?? 0}</span>
        </header>
        {launches.data && launches.data.data.length > 0 ? (
          <ul className="m-0 list-none border-b border-rule p-0">
            {launches.data.data.map((record) => (
              <li key={record.launchId} className="grid grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))_auto] items-center gap-4 border-b border-rule py-3 text-sm">
                <span className="truncate font-bold text-ink">
                  {record.name}{" "}
                  <span className="font-mono text-xs text-ink-muted">${record.symbol}</span>
                </span>
                <span className={`font-mono text-xs font-black uppercase ${STATE_TONE[record.state] ?? ""}`}>
                  {record.state}
                </span>
                <span className="font-mono text-xs text-ink-muted truncate">
                  {record.onchain ? (
                    <Link className="underline" href={`/tokens/${record.onchain.poolId}`}>
                      {record.onchain.token.slice(0, 14)}…
                    </Link>
                  ) : (
                    record.predictedToken.slice(0, 14) + "…"
                  )}
                </span>
                <time className="font-mono text-[0.68rem] text-ink-muted" dateTime={record.createdAt}>
                  {relativeTime(record.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        ) : (
          <div className={EMPTY}>
            <h3>No launches yet.</h3>
            <p>
              <Link href="/create">Create a token</Link> — prepare validates, then relay or send directly.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
