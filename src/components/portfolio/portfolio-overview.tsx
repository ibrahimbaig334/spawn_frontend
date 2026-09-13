"use client";

import Link from "next/link";
import { erc20Abi, type Address } from "viem";
import { useQuery } from "@tanstack/react-query";
import { Button, StatusMessage } from "@/components/ui";
import { useWallet } from "@/lib/chain/wallet";
import { useProfileTokens, useRevenueStreams, useLaunchRecords, useTokenList } from "@/lib/queries";
import { usePoolCards } from "@/lib/use-pool-cards";
import { useWatchlist } from "@/lib/watchlist";
import { formatCompactEth, wei } from "@/lib/display";
import { truncateDecimals } from "@/lib/format";
import { useClaimAllStreams } from "@/lib/chain/use-claim-all";
import { PAGE, EYEBROW, SECTION, SECTION_HEADER, EMPTY } from "./portfolio-styles";

export function PortfolioOverview() {
  const wallet = useWallet();
  const watchlist = useWatchlist();
  const address = wallet.address;

  const created = useProfileTokens(address);
  const streams = useRevenueStreams(address);
  // Every known pool is balance-checked: holdings are not limited to tokens
  // the wallet created or watchlisted (a plain buy would otherwise vanish).
  const listed = useTokenList({ sort: "newest", limit: 100 }, Boolean(address));

  const poolIds = Array.from(
    new Set([
      ...(created.data?.data.map((t) => t.poolId) ?? []),
      ...(listed.data?.data.map((t) => t.poolId) ?? []),
      ...watchlist.poolIds,
    ]),
  );
  const cards = usePoolCards(poolIds);
  const details = cards
    .map((q, index) => ({ poolId: poolIds[index]!, detail: q.data ?? null }))
    .filter((entry) => entry.detail)
    .map((entry) => entry.detail!);

  const tokenBalances = useQuery({
    queryKey: ["portfolio-balances", address, poolIds.join(",")],
    enabled: Boolean(address) && details.length > 0,
    queryFn: async () => {
      if (!address) return [];
      const results = await Promise.all(
        details.map(async (d) => ({
          poolId: d.poolId,
          balance:
            ((await wallet.publicClient.readContract({
              address: d.token as Address,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [address],
            })) as bigint) ?? 0n,
        })),
      );
      return results;
    },
    refetchInterval: 20_000,
  });

  const holdings = details
    .map((detail) => {
      const balance =
        tokenBalances.data?.find((b) => b.poolId === detail.poolId)?.balance ?? 0n;
      const price = wei(detail.priceEth);
      const valueWei = (balance * price) / 10n ** 18n;
      return { detail, balance, valueWei };
    })
    .filter((entry) => entry.balance > 0n)
    .sort((a, b) => (a.valueWei > b.valueWei ? -1 : 1));

  const totalValue = holdings.reduce((sum, entry) => sum + entry.valueWei, 0n);
  const revenueTotal = (streams.data ?? []).reduce(
    (sum, stream) => sum + wei(stream.creator_revenue_total) + wei(stream.creator_path_revenue_total),
    0n,
  );
  const launches = useLaunchRecords({ creator: address ?? undefined }, Boolean(address));
  const claimAll = useClaimAllStreams((streams.data ?? []).map((stream) => stream.pool_id));

  if (!address) {
    return (
      <main className={PAGE} id="main-content">
        <p className={EYEBROW}>Portfolio</p>
        <h1 className="mt-2 mb-0 text-[clamp(2.5rem,6vw,5rem)] leading-[0.95]">Your positions, streams and launches.</h1>
        <div className="mt-10 max-w-lg rounded-lg border-2 border-dashed border-rule p-10 text-center">
          <p className="m-0 text-ink-muted">Connect a wallet to see balances, revenue streams, launches and your watchlist.</p>
          <div className="mt-4">
            <Button onClick={() => void wallet.connect().catch(() => undefined)}>Connect wallet</Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={PAGE} id="main-content">
      <p className={EYEBROW}>Portfolio · {truncateAddressShort(address)}</p>
      <h1 className="mt-2 mb-0 text-[clamp(2.5rem,6vw,5rem)] leading-[0.95]">
        Your positions, streams and launches.
      </h1>

      <dl className="mt-10 grid grid-cols-4 gap-3 max-[56rem]:grid-cols-2 max-[34rem]:grid-cols-1 [&>div]:border [&>div]:border-rule [&>div]:bg-raised [&>div]:p-4 [&_dt]:text-xs [&_dt]:text-ink-muted [&_dd]:m-0 [&_dd]:font-mono [&_dd]:text-lg [&_dd]:font-black">
        <div>
          <dt>Wallet</dt>
          <dd>{wallet.ethBalance ? `${truncateDecimals(wallet.ethBalance)} ETH` : "—"}</dd>
        </div>
        <div>
          <dt>Position value</dt>
          <dd>{formatCompactEth(totalValue.toString(), 4)} ETH</dd>
        </div>
        <div>
          <dt>Creator revenue (lifetime, held streams)</dt>
          <dd>{formatCompactEth(revenueTotal.toString(), 4)} ETH</dd>
        </div>
        <div>
          <dt>Launches submitted</dt>
          <dd>{launches.data?.meta.total ?? 0}</dd>
        </div>
      </dl>

      <section className={SECTION}>
        <header className={SECTION_HEADER}>
          <div>
            <p className={EYEBROW}>Balances</p>
            <h2>Tokens you hold</h2>
          </div>
          <span>{holdings.length} positions</span>
        </header>
        {holdings.length === 0 ? (
          <div className={EMPTY}>
            <h3>No token positions.</h3>
            <p>
              <Link href="/tokens">Find a market</Link> and trade — balances show here automatically.
            </p>
          </div>
        ) : (
          <ul className="m-0 list-none border-b border-rule p-0">
            {holdings.map(({ detail, balance, valueWei }) => (
              <li key={detail.poolId} className="grid grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))_auto] items-center gap-4 border-b border-rule py-3">
                <Link className="truncate font-bold text-ink no-underline hover:underline" href={`/tokens/${detail.poolId}`}>
                  {detail.name ?? "Unnamed"} <span className="font-mono text-xs text-ink-muted">${detail.symbol}</span>
                </Link>
                <span className="font-mono text-sm">{formatCompactEth(balance.toString(), 0)} {detail.symbol}</span>
                <span className="font-mono text-sm text-ink-muted">{formatCompactEth(valueWei.toString(), 4)} ETH</span>
                <span className="font-mono text-[0.68rem] text-ink-muted">{detail.status}</span>
              </li>
            ))}
          </ul>
        )}
        {wallet.chainId !== wallet.targetChainId ? (
          <StatusMessage tone="warning">Switch your wallet network to read live balances.</StatusMessage>
        ) : null}
      </section>

      <section className={SECTION}>
        <header className={SECTION_HEADER}>
          <div>
            <p className={EYEBROW}>Your earnings passes</p>
            <h2>Earnings passes you hold</h2>
          </div>
          <span>{streams.data?.length ?? 0}</span>
        </header>
        {streams.data && streams.data.length > 0 ? (
          <>
            <div className="my-4 flex flex-wrap items-center gap-3">
              <Button
                variant="secondary"
                disabled={claimAll.busy || wallet.chainId !== wallet.targetChainId}
                onClick={() => void claimAll.claimAll()}
              >
                {claimAll.busy ? "Claiming…" : "Claim everything"}
              </Button>
              <span className="font-mono text-xs text-ink-muted">
                Claims from every token in one go.
              </span>
            </div>
            {claimAll.status ? (
              <StatusMessage
                tone={claimAll.status.tone === "info" ? "neutral" : claimAll.status.tone}
              >
                {claimAll.status.message}
              </StatusMessage>
            ) : null}
            <ul className="m-0 mt-2 list-none border-b border-rule p-0">
            {streams.data.map((stream) => (
              <li key={stream.pool_id} className="grid grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))_auto] items-center gap-4 border-b border-rule py-3">
                <Link className="truncate font-bold text-ink no-underline hover:underline" href={`/tokens/${stream.pool_id}`}>
                  {stream.name ?? "Unnamed"} <span className="font-mono text-xs text-ink-muted">${stream.symbol}</span>
                </Link>
                <span className="font-mono text-sm">{formatCompactEth(stream.creator_revenue_total, 4)} ETH</span>
                <span className="font-mono text-sm text-ink-muted">+ path {formatCompactEth(stream.creator_path_revenue_total, 4)}</span>
                <span className="font-mono text-[0.68rem] text-ink-muted">{stream.status}</span>
              </li>
            ))}
            </ul>
          </>
        ) : (
          <div className={EMPTY}>
            <h3>No earnings passes held.</h3>
            <p>
              Launch a token or receive an earnings pass — claimable earnings live on the token page.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

function truncateAddressShort(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
