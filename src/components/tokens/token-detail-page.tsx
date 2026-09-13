"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatEther, type Address, type Hex } from "viem";
import { PriceHistoryChart } from "@/components/charts/price-history-chart";
import { TradeTicket } from "@/components/trade/trade-ticket";
import { MilestoneSchedule } from "@/components/tokens/milestone-schedule";
import { CommentThread } from "@/components/comments/comment-thread";
import { SOCIAL_META, socialLinks } from "@/components/launch/social-icons";
import { Button, Progress, StatusMessage, StatusRegion } from "@/components/ui";
import {
  qk,
  useMilestones,
  usePrice,
  useToken,
  useTrades,
} from "@/lib/queries";
import { usePoolStream, type PoolStream } from "@/lib/use-pool-stream";
import { useWallet } from "@/lib/chain/wallet";
import { useProtocol } from "@/lib/chain/protocol-context";
import { milestoneHookAbi } from "@/lib/chain/abi";
import {
  claimCreator,
  claimCreatorPath,
  collectFees,
  flushPool,
  graduatePool,
} from "@/lib/chain/trades";
import type { TradeItem, WsTick } from "@/lib/api/dto";
import { MilestoneOverview } from "@/components/visuals/milestone-overview";
import { useTraderMap } from "@/lib/use-trader";
import { ApiError } from "@/lib/api/client";
import { TokenImage } from "@/components/tokens/token-image";
import {
  formatCompactEth,
  formatUsdApproxFromEthWei,
  phaseLabel,
  relativeTime,
  usdApproxFromEthWei,
  wei,
} from "@/lib/display";
import {
  formatEth,
  formatSubscriptPrice,
  truncateDecimals,
} from "@/lib/format";
import { explorerAddress, explorerTx } from "@/lib/env";
import { truncateAddress } from "@/services/ipfs-client";
import { useWatchlist } from "@/lib/watchlist";

const PAGE_WIDTH =
  "mx-auto w-full max-w-measure px-[max(1rem,calc((100vw-80rem)/2))]";
const PANEL = "border border-ink bg-raised p-4";
const PANEL_LABEL =
  "m-0 font-mono text-[0.68rem] font-bold tracking-[0.08em] text-accent-strong uppercase";
const BOOKMARK =
  "h-3.5 w-2.5 border-[1.5px] border-current [clip-path:polygon(0_0,100%_0,100%_100%,50%_72%,0_100%)] forced-colors:[clip-path:none]";

function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0 border-rule p-4">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="mt-1 mb-0 break-words font-mono text-sm font-bold text-ink">{value}</dd>
      {sub ? <dd className="mt-0.5 mb-0 font-mono text-[0.68rem] text-ink-muted">{sub}</dd> : null}
    </div>
  );
}

function Section({ id, title, children, aside }: { id: string; title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="border-t-2 border-ink py-8" aria-labelledby={`${id}-title`}>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="m-0 text-[clamp(1.6rem,4vw,2.6rem)]" id={`${id}-title`}>
          {title}
        </h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

/** Claimable ledgers + pot read directly from the hook (authoritative). */
export function useClaimBalances(poolId: string | null) {
  const wallet = useWallet();
  const { addresses } = useProtocol();
  const hook = addresses?.hook as Address | undefined;
  return useQuery({
    queryKey: ["claims", poolId, hook],
    enabled: Boolean(poolId && hook),
    queryFn: async () => {
      const id = poolId as Hex;
      const client = wallet.publicClient;
      const [creator, creatorPath, pot] = await Promise.all([
        client.readContract({ address: hook!, abi: milestoneHookAbi, functionName: "creatorClaimable", args: [id] }),
        client.readContract({ address: hook!, abi: milestoneHookAbi, functionName: "creatorPathClaimable", args: [id] }),
        client.readContract({ address: hook!, abi: milestoneHookAbi, functionName: "payoutPot", args: [id] }),
      ]);
      return {
        creator: creator as bigint,
        creatorPath: creatorPath as bigint,
        pot: pot as bigint,
      };
    },
    refetchInterval: 20_000,
  });
}

function tradeAmounts(side: "BUY" | "SELL", ethAmount: string, tokenAmount: string, symbol: string): string {
  return side === "BUY"
    ? `${truncateDecimals(formatEther(wei(ethAmount)))} ETH → ${formatCompactEth(tokenAmount, 0)} ${symbol}`
    : `${formatCompactEth(tokenAmount, 0)} ${symbol} → ${truncateDecimals(formatEther(wei(ethAmount)))} ETH`;
}

function TxLink({ txHash, label }: { txHash: string; label?: string }) {
  return (
    <a className="underline" href={explorerTx(txHash)} rel="noreferrer" target="_blank">
      {label ?? "tx"}
    </a>
  );
}

function TradeTapeRow({ trade, trader, symbol }: { trade: TradeItem; trader: string | null; symbol: string }) {
  return (
    <li className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-rule py-2 text-sm">
      <span
        className={[
          "rounded-sm px-1.5 py-0.5 text-center font-mono text-[0.62rem] font-black",
          trade.side === "BUY" ? "bg-accent text-carbon" : "bg-error text-inverse",
        ].join(" ")}
      >
        {trade.side}
      </span>
      <span className="min-w-0 font-mono text-xs">
        <strong>
          {tradeAmounts(trade.side, trade.ethAmount, trade.tokenAmount, symbol)}{" "}
          <span className="font-semibold text-ink-muted">({formatUsdApproxFromEthWei(trade.ethAmount)})</span>
        </strong>
        <span className="block text-ink-muted">
          {truncateAddress(trader ?? trade.sender)} · @ {formatSubscriptPrice(trade.priceEth)} ·{" "}
          <TxLink txHash={trade.transactionHash} />
        </span>
      </span>
      <time className="font-mono text-[0.68rem] text-ink-muted" dateTime={trade.timestamp}>
        {relativeTime(trade.timestamp)}
      </time>
    </li>
  );
}

function LiveStreamTicks({
  ticks,
  traders,
  symbol,
}: {
  ticks: WsTick[];
  traders: Record<string, string>;
  symbol: string;
}) {
  if (ticks.length === 0) return null;
  return (
    <ul className="m-0 mb-2 list-none p-0">
      {ticks.slice(0, 6).map((tick, index) => (
        <li key={`${tick.tx}-${index}`} className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-rule py-2 text-sm">
          <span
            className={[
              "rounded-sm px-1.5 py-0.5 text-center font-mono text-[0.62rem] font-black",
              tick.isBuy ? "bg-accent text-carbon" : "bg-error text-inverse",
            ].join(" ")}
          >
            {tick.isBuy ? "BUY" : "SELL"}
          </span>
          <span className="min-w-0 font-mono text-xs">
            <strong>
              {truncateDecimals(formatEther(wei(tick.eth)))} ETH · {formatCompactEth(tick.tokens, 0)} {symbol}{" "}
              <span className="font-semibold text-ink-muted">({formatUsdApproxFromEthWei(tick.eth)})</span>
            </strong>
            <span className="block text-ink-muted">
              {truncateAddress(traders[tick.tx.toLowerCase()] ?? tick.tx.slice(0, 10))} ·{" "}
              {tick.priceEth ? `${formatSubscriptPrice(tick.priceEth)}` : "—"}
            </span>
          </span>
          <span className="font-mono text-[0.68rem] font-bold text-accent-strong">LIVE</span>
        </li>
      ))}
    </ul>
  );
}

function useHookWrite() {
  const wallet = useWallet();
  const { addresses } = useProtocol();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (label: string, fn: () => Promise<Hex>, poolId: string) => {
    if (!wallet.address || !wallet.walletClient || !addresses) return;
    setBusy(true);
    setError(null);
    setNote("Confirm in your wallet…");
    try {
      const hash = await fn();
      setNote("Waiting for confirmation…");
      const receipt = await wallet.publicClient.waitForTransactionReceipt({
        hash,
        pollingInterval: 1_500,
        timeout: 240_000,
      });
      if (receipt.status === "success") {
        setNote("Done.");
        void queryClient.invalidateQueries({ queryKey: ["claims", poolId] });
        void queryClient.invalidateQueries({ queryKey: ["tokens", poolId] });
        void queryClient.invalidateQueries({ queryKey: qk.price(poolId) });
      } else {
        setError("That didn't go through — nothing was lost. Try again.");
        setNote(null);
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Transaction failed.";
      setError(
        /rejected|denied|cancelled/i.test(message)
          ? "You rejected the transaction in your wallet."
          : message,
      );
      setNote(null);
    } finally {
      setBusy(false);
    }
  };

  return { wallet, addresses, busy, note, error, setNote, setError, run };
}

function ClaimsPanel({
  poolId,
  token,
  graduated,
  isHolder,
}: {
  poolId: string;
  token: Address;
  graduated: boolean;
  isHolder: boolean;
}) {
  const claims = useClaimBalances(poolId);
  const { wallet, addresses, busy, note, error, setNote, setError, run } = useHookWrite();
  const data = claims.data;

  return (
    <>
      <dl className="m-0 mt-4 grid grid-cols-3 gap-3 max-[56rem]:grid-cols-2 max-[34rem]:grid-cols-1 [&>div]:border [&>div]:border-rule [&>div]:bg-raised [&>div]:p-3 [&_dt]:text-xs [&_dt]:text-ink-muted [&_dd]:m-0 [&_dd]:font-mono [&_dd]:font-bold">
        <div>
          <dt>Ready to pay out</dt>
          <dd>{data ? formatEth(formatEther(data.pot), 4) : "—"}</dd>
        </div>
        <div>
          <dt>Creator earnings</dt>
          <dd>{data ? formatEth(formatEther(data.creator), 4) : "—"}</dd>
        </div>
        <div>
          <dt>Creator bonus share</dt>
          <dd>{data ? formatEth(formatEther(data.creatorPath), 4) : "—"}</dd>
        </div>
      </dl>
      <StatusRegion className="mt-4">
        {note ? <StatusMessage tone="neutral">{note}</StatusMessage> : null}
        {error ? (
          <StatusMessage tone="error" onDismiss={() => setError(null)}>
            {error}
          </StatusMessage>
        ) : null}
      </StatusRegion>
      {!wallet.address ? (
        <p className="mt-4 mb-0 text-sm text-ink-muted">
          Connect your wallet to distribute payouts or claim earnings.
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          variant="secondary"
          disabled={!wallet.address || !addresses || busy}
          onClick={() => {
            if (!wallet.address || !addresses) return;
            setNote(null);
            void run(
              "Distribute",
              () =>
                flushPool({
                  hook: addresses.hook as Address,
                  poolId: poolId as Hex,
                  tipTo: wallet.address!,
                  walletClient: wallet.walletClient!,
                  account: wallet.address!,
                }),
              poolId,
            );
          }}
        >
          Distribute payouts
        </Button>
        <Button
          variant="secondary"
          disabled={!wallet.address || !addresses || busy || !isHolder}
          title={isHolder ? undefined : "Only the current earnings-pass holder can claim this"}
          onClick={() => {
            if (!wallet.address || !addresses) return;
            setNote(null);
            void run(
              "Claim",
              () =>
                claimCreator({
                  hook: addresses.hook as Address,
                  poolId: poolId as Hex,
                  walletClient: wallet.walletClient!,
                  account: wallet.address!,
                }),
              poolId,
            );
          }}
        >
          Claim earnings
        </Button>
        <Button
          variant="secondary"
          disabled={!wallet.address || !addresses || busy}
          onClick={() => {
            if (!wallet.address || !addresses) return;
            setNote(null);
            void run(
              "Claim",
              () =>
                claimCreatorPath({
                  hook: addresses.hook as Address,
                  poolId: poolId as Hex,
                  walletClient: wallet.walletClient!,
                  account: wallet.address!,
                }),
              poolId,
            );
          }}
        >
          Claim creator share
        </Button>
        {graduated ? (
          <Button
            variant="quiet"
            disabled={!wallet.address || !addresses || busy}
            title="Collects trading fees earned by this market"
            onClick={() =>
              void run(
                "Collect",
                () =>
                  collectFees({
                    hook: addresses!.hook as Address,
                    token,
                    walletClient: wallet.walletClient!,
                    account: wallet.address!,
                  }),
                poolId,
              )
            }
          >
            Collect trading fees
          </Button>
        ) : null}
      </div>
      <p className="mt-4 mb-0 text-xs text-ink-muted">
        Claiming asks for a small network fee in your wallet. If there is nothing to claim yet,
        nothing happens — try again after the next payout.
      </p>
    </>
  );
}

function GraduateButton({ token, poolId }: { token: Address; poolId: string }) {
  const { wallet, addresses, busy, run } = useHookWrite();
  if (!wallet.address) return null;
  return (
    <Button
      variant="danger"
      disabled={busy || !addresses}
      onClick={() =>
        void run(
          "Graduate",
          () =>
            graduatePool({
              hook: addresses!.hook as Address,
              token,
              walletClient: wallet.walletClient!,
              account: wallet.address!,
            }),
          poolId,
        )
      }
    >
      Graduate now
    </Button>
  );
}

export function TokenDetailPage({ tokenRef }: { tokenRef: string }) {
  const token = useToken(tokenRef, { tradeLimit: 20 });
  const price = usePrice(tokenRef, 8_000);
  const poolId = token.data?.poolId ?? null;
  const stream = usePoolStream(poolId);
  const trades = useTrades(tokenRef, { sort: "newest", limit: 40 }, 10_000);
  const milestones = useMilestones(tokenRef, token.data?.status === "graduated");
  const watchlist = useWatchlist();
  const wallet = useWallet();
  // Stream ticks that already settled into the REST tape are hidden there so
  // no trade ever appears twice.
  const restTrades = trades.data?.data ?? [];
  const restTx = useMemo(
    () => new Set(restTrades.map((trade) => trade.transactionHash.toLowerCase())),
    [trades.data],
  );
  const freshTicks = useMemo(
    () => stream.ticks.filter((tick) => !restTx.has(tick.tx.toLowerCase())),
    [stream.ticks, restTx],
  );
  const tickTxHashes = useMemo(() => {
    const hashes = new Set<string>();
    for (const trade of restTrades) hashes.add(trade.transactionHash);
    for (const tick of freshTicks) hashes.add(tick.tx);
    return [...hashes];
  }, [restTrades, freshTicks]);
  const traders = useTraderMap(wallet.publicClient, tickTxHashes);

  const detail = token.data;
  const graduationNext = Boolean(
    detail?.status === "bonding" && price.data && price.data.level >= detail.farLevel - 1,
  );
  const isNftHolder = Boolean(
    wallet.address && detail?.revenueNftOwner && wallet.address.toLowerCase() === detail.revenueNftOwner.toLowerCase(),
  );
  const socials = useMemo(() => socialLinks(detail?.socials ?? undefined), [detail?.socials]);

  if (token.isLoading) {
    return (
      <main className={`${PAGE_WIDTH} py-24 text-center`} id="main-content">
        <p className="font-mono text-sm text-ink-muted" role="status">
          Loading pool…
        </p>
      </main>
    );
  }

  if (token.isError || !detail) {
    const code = (token.error as ApiError | undefined)?.code;
    return (
      <main className={`${PAGE_WIDTH} py-24`} id="main-content">
        <h1 className="text-4xl font-black text-ink">Pool not found</h1>
        <p className="mt-2 max-w-xl text-ink-muted">
          {code === "TOKEN_NOT_FOUND"
            ? "No token matches this link yet. New launches appear here within a minute of going live."
            : (token.error as Error)?.message ?? "This token is unavailable."}
        </p>
        <div className="mt-6 flex gap-4">
          <Link className="border-2 border-ink bg-ink px-4 py-2 font-bold text-inverse no-underline" href="/tokens">
            Browse tokens
          </Link>
          <Link className="border-2 border-ink px-4 py-2 font-bold text-ink no-underline" href="/create">
            Create a launch
          </Link>
        </div>
      </main>
    );
  }

  const progress = price.data?.progress ?? 0;

  return (
    <main className={`${PAGE_WIDTH} pb-24`} id="main-content">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-8 border-b-2 border-ink py-10 max-[48rem]:grid-cols-1">
        <div className="flex items-start gap-5 max-[34rem]:flex-col">
          <figure
            className="m-0 grid size-[clamp(5rem,10vw,7.5rem)] shrink-0 place-items-center overflow-hidden rounded-lg border-2 border-ink bg-raised p-1.5 shadow-[5px_5px_0_0_var(--color-ink)]"
            aria-hidden="true"
          >
            <span className="grid size-full place-items-center overflow-hidden rounded-md bg-surface-strong font-mono text-[clamp(1rem,2vw,1.5rem)] font-bold text-accent-strong">
              <TokenImage
                imageUri={detail.imageUri}
                symbol={detail.symbol}
                className="size-full object-cover"
                eager
              />
            </span>
          </figure>
          <div className="min-w-0">
            <p className="m-0 font-mono text-xs font-bold tracking-[0.08em] text-accent-strong uppercase">
              {phaseLabel(detail.status)} · ${detail.symbol ?? "—"}
              {detail.stale ? <span className="ml-2 text-protocol">· data delayed</span> : null}
            </p>
            <h1 className="my-2 max-w-[16ch] text-[clamp(2.2rem,6vw,4.5rem)] leading-[0.95] tracking-[-0.05em]">
              {detail.name ?? "Unnamed"}
            </h1>
            {detail.description ? (
              <p className="m-0 max-w-3xl whitespace-pre-wrap text-ink-muted">{detail.description}</p>
            ) : null}
            <p className="m-0 mt-2 font-mono text-xs text-ink-muted">
              Created by{" "}
              <Link className="underline" href={`/profiles/${detail.creator}`}>
                {truncateAddress(detail.creator)}
              </Link>{" "}
              · {relativeTime(detail.launchTime)} · token{" "}
              <a className="underline" href={explorerAddress(detail.token)} rel="noreferrer" target="_blank">
                {truncateAddress(detail.token)}
              </a>
              {detail.revenueNftOwner ? (
                <>
                  {" "}· earnings pass held by{" "}
                  <Link className="underline" href={`/profiles/${detail.revenueNftOwner}`}>
                    {truncateAddress(detail.revenueNftOwner)}
                  </Link>
                </>
              ) : null}
            </p>
            {socials.length ? (
              <ul className="mt-3 flex list-none flex-wrap gap-2 p-0">
                {socials.map((social) => {
                  const Icon = SOCIAL_META[social.key].icon;
                  return (
                    <li key={social.key}>
                      <a
                        className="inline-flex min-h-9 items-center gap-1.5 border border-rule bg-raised px-3 py-1.5 text-xs font-bold no-underline hover:border-ink"
                        href={social.href}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <Icon height={14} width={14} />
                        {SOCIAL_META[social.key].label}
                      </a>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </div>
        <div className="grid min-w-40 gap-2 max-[48rem]:grid-cols-2 max-[34rem]:grid-cols-1">
          <button
            className="inline-flex min-h-target cursor-pointer items-center justify-center gap-2 border border-ink bg-transparent px-3 py-2 font-bold aria-pressed:border-accent-strong aria-pressed:text-accent-strong"
            type="button"
            aria-pressed={watchlist.isWatched(detail.poolId)}
            onClick={() => watchlist.toggle(detail.poolId)}
          >
            <span className={BOOKMARK} aria-hidden="true" />
            {watchlist.isWatched(detail.poolId) ? "Watched" : "Add to watchlist"}
          </button>
          {graduationNext ? <GraduateButton token={detail.token as Address} poolId={detail.poolId} /> : null}
        </div>
      </header>

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)] items-start gap-[clamp(2rem,5vw,4rem)] max-[72rem]:grid-cols-1">
        <div className="min-w-0">
          {graduationNext ? (
            <p className="mt-6 border-2 border-protocol bg-raised px-4 py-3 text-sm font-bold text-ink">
              Almost graduated — the next buy can move this token into its permanent market.
            </p>
          ) : null}
          <dl className="mt-8 grid grid-cols-4 border-y border-rule max-[56rem]:grid-cols-2 max-[34rem]:grid-cols-1 [&>div+div]:border-l [&>div+div]:border-rule max-[56rem]:[&>div:nth-child(3)]:border-l-0 max-[56rem]:[&>div:nth-child(n+3)]:border-t max-[34rem]:[&>div+div]:border-t max-[34rem]:[&>div+div]:border-l-0">
            <Stat
              label="Price"
              value={
                price.data
                  ? `${formatSubscriptPrice(price.data.priceEth)} ETH`
                  : detail.priceEth
                    ? `${formatSubscriptPrice(detail.priceEth)} ETH`
                    : "—"
              }
              sub={price.data ? `≈ $${usdApproxFromEthWei(price.data.priceEth).toPrecision(2)}` : undefined}
            />
            <Stat
              label="MC"
              value={price.data ? formatUsdApproxFromEthWei(price.data.mcapEthWei) : "—"}
              sub={
                price.data
                  ? `ATH ${
                      price.data.athPriceEth ? `${formatSubscriptPrice(price.data.athPriceEth)} ETH` : "—"
                    }`
                  : undefined
              }
            />
            <Stat
              label="Creator earnings"
              value={
                detail.stats
                  ? formatUsdApproxFromEthWei(detail.stats.creatorRevenueTotal)
                  : "—"
              }
              sub="paid to the creator so far"
            />
            <Stat
              label="Volume (all time)"
              value={
                detail.stats
                  ? `${formatCompactEth((wei(detail.stats.buyVolumeEth) + wei(detail.stats.sellVolumeEth)).toString())} ETH`
                  : "—"
              }
              sub={`${detail.stats?.swapCount ?? 0} swaps · ${formatCompactEth(detail.circulatingSupply, 0)} circulating`}
            />
          </dl>

          {detail.status === "bonding" ? (
            <>
              <Progress
                className="mb-8 mt-8"
                label="Progress to graduation"
                value={progress * 100}
                valueLabel={`${(progress * 100).toFixed(2)}%`}
              />
              <div className="mb-8">
                <MilestoneOverview
                  completedMilestones={detail.milestones.completed}
                  progressBps={Math.round(progress * 10_000)}
                  title="Milestones after graduation"
                />
              </div>
            </>
          ) : (
            <p className="mt-8 mb-0 text-xs font-bold text-ink-muted">
              Graduated — trading continues on the permanent market ({detail.milestones.completed} milestones
              paid out, {detail.milestones.live} active).
            </p>
          )}

          <PriceHistoryChart tokenRef={tokenRef} poolId={detail.poolId} stream={stream} />

          <Section
            id="tape"
            title="Trades"
            aside={
              <span className="font-mono text-xs text-ink-muted" role="status">
                {stream.connected ? "live" : "reconnecting…"}
              </span>
            }
          >
            <LiveStreamTicks
              ticks={freshTicks}
              traders={traders}
              symbol={detail.symbol ?? "tokens"}
            />
            {restTrades.length === 0 && freshTicks.length === 0 ? (
              <p className="border border-rule bg-raised p-6 text-center text-sm text-ink-muted">
                No swaps recorded yet.
              </p>
            ) : (
              <ul className="m-0 list-none p-0">
                {restTrades.map((trade) => (
                  <TradeTapeRow
                    key={`${trade.transactionHash}-${trade.logIndex}`}
                    trade={trade}
                    trader={traders[trade.transactionHash.toLowerCase()] ?? null}
                    symbol={detail.symbol ?? "tokens"}
                  />
                ))}
              </ul>
            )}
          </Section>

          {detail.status === "graduated" ? (
            <Section id="ladder" title="Milestones">
              <p className="mt-2 mb-4 text-sm text-ink-muted">
                Milestones pay out as the price climbs. Every payout splits between the chosen
                plugins and the creator.
              </p>
              <MilestoneOverview
                completedMilestones={detail.milestones.completed}
                progressBps={
                  detail.milestones.live > 0
                    ? Math.round(
                        ((detail.milestones.completed + 0.5) / 22) * 10_000,
                      )
                    : Math.round((detail.milestones.completed / 22) * 10_000)
                }
                title="Milestone progress"
                className="mb-6"
              />
              <MilestoneSchedule
                graduationLevel={detail.graduationLevel ?? 0}
                milestones={milestones.data?.data ?? []}
                loading={milestones.isLoading}
              />
            </Section>
          ) : null}

          <Section id="payout" title="Payouts">
            <p className="mt-2 mb-0 text-sm text-ink-muted">
              Milestone money lands here first, then flows to plugins and the creator.
            </p>
            <ClaimsPanel
              poolId={detail.poolId}
              token={detail.token as Address}
              graduated={detail.status === "graduated"}
              isHolder={isNftHolder}
            />
          </Section>

          <Section id="comments" title="Discussion">
            <CommentThread tokenRef={detail.poolId} />
          </Section>
        </div>

        <aside className="sticky top-4 grid min-w-0 gap-4 max-[72rem]:hidden" aria-label="Trading panel">
          <div className={PANEL}>
            <p className={PANEL_LABEL}>Trade</p>
            <div className="mt-3">
              <TradeTicket
                tokenRef={tokenRef}
                token={detail.token as Address}
                symbol={detail.symbol ?? "TOKEN"}
                status={detail.status}
                farLevel={detail.farLevel}
              />
            </div>
          </div>
          <div className="border border-rule bg-raised p-4 font-mono text-xs">
            <p className="m-0 font-mono text-[0.68rem] font-bold uppercase text-ink-muted">Token facts</p>
            <ul className="mt-2 m-0 grid list-none gap-1 p-0">
              <li className="flex justify-between gap-2">
                <span className="text-ink-muted">supply</span>
                <span>{formatCompactEth(detail.totalSupply, 0)}</span>
              </li>
              <li className="flex justify-between gap-2">
                <span className="text-ink-muted">circulating</span>
                <span>{formatCompactEth(detail.circulatingSupply, 0)}</span>
              </li>
              <li className="flex justify-between gap-2">
                <span className="text-ink-muted">creator earnings</span>
                <span>{detail.stats ? formatUsdApproxFromEthWei(detail.stats.creatorRevenueTotal) : "—"}</span>
              </li>
            </ul>
          </div>
        </aside>
      </div>

      <div className="mt-8 hidden max-[72rem]:block">
        <div className={`${PANEL} max-w-[38rem]`}>
          <p className={PANEL_LABEL}>Trade</p>
          <div className="mt-3">
            <TradeTicket
              tokenRef={tokenRef}
              token={detail.token as Address}
              symbol={detail.symbol ?? "TOKEN"}
              status={detail.status}
              farLevel={detail.farLevel}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
