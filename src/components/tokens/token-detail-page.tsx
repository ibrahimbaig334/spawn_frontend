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
  useDepth,
  useMilestones,
  usePrice,
  useToken,
  useTrades,
  useRevenueEvents,
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
import type { RevenueKind, TradeItem } from "@/lib/api/dto";
import { ApiError } from "@/lib/api/client";
import { resolveImageUrl } from "@/services/ipfs-client";
import {
  formatCompactEth,
  formatLevel,
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

const REVENUE_KINDS: { value: RevenueKind; label: string }[] = [
  { value: "creatorAccruals", label: "Creator" },
  { value: "protocolAccruals", label: "Protocol" },
  { value: "creatorPathAccruals", label: "Creator path" },
  { value: "claims", label: "Claims" },
  { value: "payoutTips", label: "Tips" },
  { value: "pluginPayouts", label: "Plugins" },
  { value: "potFundings", label: "Pot funding" },
  { value: "potRedemptions", label: "Pot redeem" },
  { value: "feeCollections", label: "Fees" },
  { value: "feeRoutings", label: "Fee routing" },
  { value: "tokenBurns", label: "Burns" },
  { value: "graduates", label: "Graduates" },
];

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
      const [creator, creatorPath, pot, carry] = await Promise.all([
        client.readContract({ address: hook!, abi: milestoneHookAbi, functionName: "creatorClaimable", args: [id] }),
        client.readContract({ address: hook!, abi: milestoneHookAbi, functionName: "creatorPathClaimable", args: [id] }),
        client.readContract({ address: hook!, abi: milestoneHookAbi, functionName: "payoutPot", args: [id] }),
        client.readContract({ address: hook!, abi: milestoneHookAbi, functionName: "carryBitmap", args: [id] }),
      ]);
      return {
        creator: creator as bigint,
        creatorPath: creatorPath as bigint,
        pot: pot as bigint,
        carry: carry as bigint,
      };
    },
    refetchInterval: 20_000,
  });
}

function TradeTapeRow({ trade }: { trade: TradeItem }) {
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
          {trade.side === "BUY"
            ? `${truncateDecimals(formatEther(wei(trade.ethAmount)))} ETH → ${formatCompactEth(trade.tokenAmount, 0)} tk`
            : `${formatCompactEth(trade.tokenAmount, 0)} tk → ${truncateDecimals(formatEther(wei(trade.ethAmount)))} ETH`}
        </strong>
        <span className="block text-ink-muted">
          {truncateAddress(trade.sender)} · lvl {formatLevel(trade.level)} ·{" "}
          <a className="underline" href={explorerTx(trade.transactionHash)} rel="noreferrer" target="_blank">
            tx
          </a>
        </span>
      </span>
      <time className="font-mono text-[0.68rem] text-ink-muted" dateTime={trade.timestamp}>
        {relativeTime(trade.timestamp)}
      </time>
    </li>
  );
}

function LiveStreamTicks({ stream }: { stream: PoolStream }) {
  if (stream.ticks.length === 0) return null;
  return (
    <ul className="m-0 mb-2 list-none p-0">
      {stream.ticks.slice(0, 6).map((tick, index) => (
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
              {truncateDecimals(formatEther(wei(tick.eth)))} ETH · {formatCompactEth(tick.tokens, 0)} tk
            </strong>
            <span className="block text-ink-muted">
              {tick.priceEth ? `${formatSubscriptPrice(tick.priceEth)} ETH` : "—"}
            </span>
          </span>
          <span className="font-mono text-[0.68rem] font-bold text-accent-strong">LIVE</span>
        </li>
      ))}
    </ul>
  );
}

function DepthPanel({ tokenRef }: { tokenRef: string }) {
  const depth = useDepth(tokenRef);
  const data = depth.data;
  if (!data) return null;
  return (
    <div className="mt-4 grid gap-3">
      {data.status === "bonding" ? (
        <div className="border border-rule bg-raised p-3">
          <p className="m-0 font-mono text-[0.68rem] font-bold uppercase text-ink-muted">
            Curve inventory ahead — positions JIT-deploy as buys approach them
          </p>
          <ul className="mt-2 m-0 grid list-none gap-1 p-0 font-mono text-xs">
            {(data.curvePositions ?? []).slice(0, 8).map((position) => (
              <li key={position.position} className="flex justify-between border-b border-rule py-1">
                <span>pos {position.position}</span>
                <span>
                  lvl {formatLevel(position.startLevel)} → {formatLevel(position.endLevel)}
                </span>
                <strong>{formatCompactEth(position.liquidity, 0)} L</strong>
              </li>
            ))}
            {(data.curvePositions ?? []).length === 0 ? (
              <li className="py-1 text-ink-muted">Curve fully deployed — the next qualifying trade graduates.</li>
            ) : null}
          </ul>
        </div>
      ) : (
        <div className="grid gap-3">
          <div className="border border-rule bg-raised p-3">
            <p className="m-0 font-mono text-[0.68rem] font-bold uppercase text-ink-muted">
              Live one-sided sell bands above spot
            </p>
            <ul className="mt-2 m-0 grid list-none gap-1 p-0 font-mono text-xs">
              {(data.bands ?? []).slice(0, 8).map((band) => (
                <li key={band.index} className="flex justify-between border-b border-rule py-1">
                  <span>band {band.index}</span>
                  <span>
                    lvl {formatLevel(band.levelLower)}–{formatLevel(band.levelUpper)}
                  </span>
                  <strong>{formatCompactEth(band.tokenInventory, 0)} tk</strong>
                </li>
              ))}
              {(data.bands ?? []).length === 0 ? <li className="py-1 text-ink-muted">No live bands ahead of spot right now.</li> : null}
            </ul>
          </div>
          <div className="border border-rule bg-raised p-3 font-mono text-xs">
            <p className="m-0 font-mono text-[0.68rem] font-bold uppercase text-ink-muted">
              Code-locked graduation positions
            </p>
            <p className="mt-2 mb-0">
              Full-range {data.fullRange?.liquidity ? `${formatCompactEth(data.fullRange.liquidity, 0)} L` : "—"} · ticks{" "}
              {data.fullRange?.tickLower.toLocaleString()}–{data.fullRange?.tickUpper.toLocaleString()}
              <span className="block text-ink-muted">
                ETH-limited ≈$5,100 → ≈$150B MC band; $5,100 is the hard price floor.
              </span>
            </p>
            <p className="mt-2 mb-0">
              Wall {data.wall?.liquidity ? `${formatCompactEth(data.wall.liquidity, 0)} L` : "—"} · levels{" "}
              {formatLevel(data.wall?.levelLower)}–{formatLevel(data.wall?.levelUpper)}
              <span className="block text-ink-muted">
                Token-only deep backing: a thin layer sells per price move — permanent buy-side support.
              </span>
            </p>
          </div>
        </div>
      )}
    </div>
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
    setNote(`${label}: confirm in your wallet…`);
    try {
      const hash = await fn();
      setNote(`${label}: pending on chain…`);
      const receipt = await wallet.publicClient.waitForTransactionReceipt({
        hash,
        pollingInterval: 1_500,
        timeout: 240_000,
      });
      if (receipt.status === "success") {
        setNote(`${label} confirmed.`);
        void queryClient.invalidateQueries({ queryKey: ["claims", poolId] });
        void queryClient.invalidateQueries({ queryKey: ["tokens", poolId] });
        void queryClient.invalidateQueries({ queryKey: qk.price(poolId) });
      } else {
        setError(
          `${label} reverted. Transient settlement locks (launch/graduation/flush races) are safe to retry — nothing is lost.`,
        );
        setNote(null);
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Transaction failed.";
      setError(
        /rejected|denied|cancelled/i.test(message)
          ? `${label}: rejected in your wallet.`
          : `${label}: ${message}`,
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
      <dl className="m-0 mt-4 grid grid-cols-4 gap-3 max-[56rem]:grid-cols-2 max-[34rem]:grid-cols-1 [&>div]:border [&>div]:border-rule [&>div]:bg-raised [&>div]:p-3 [&_dt]:text-xs [&_dt]:text-ink-muted [&_dd]:m-0 [&_dd]:font-mono [&_dd]:font-bold">
        <div>
          <dt>Payout pot (unflushed)</dt>
          <dd>{data ? formatEth(data.pot.toString(), 4) : "—"}</dd>
        </div>
        <div>
          <dt>Direct creator revenue</dt>
          <dd>{data ? formatEth(data.creator.toString(), 4) : "—"}</dd>
        </div>
        <div>
          <dt>Creator-path entitlement</dt>
          <dd>{data ? formatEth(data.creatorPath.toString(), 4) : "—"}</dd>
        </div>
        <div>
          <dt>Plugin carry</dt>
          <dd>{data ? (data.carry > 0n ? `bitmap 0x${data.carry.toString(16)}` : "none") : "—"}</dd>
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
      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          variant="secondary"
          disabled={!wallet.address || !addresses || busy}
          onClick={() => {
            if (!wallet.address || !addresses) return;
            setNote(null);
            void run(
              "Flush",
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
          Flush pot (keeps 1% tip)
        </Button>
        <Button
          variant="secondary"
          disabled={!wallet.address || !addresses || busy || !isHolder}
          title={isHolder ? undefined : "Only the current RevenueNFT holder can claim direct revenue"}
          onClick={() => {
            if (!wallet.address || !addresses) return;
            setNote(null);
            void run(
              "Direct claim",
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
          Claim direct revenue
        </Button>
        <Button
          variant="secondary"
          disabled={!wallet.address || !addresses || busy}
          onClick={() => {
            if (!wallet.address || !addresses) return;
            setNote(null);
            void run(
              "Creator-path claim",
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
          Claim creator path (self-flushes)
        </Button>
        {graduated ? (
          <Button
            variant="quiet"
            disabled={!wallet.address || !addresses || busy}
            title="Permissionless; collects accrued full-range swap fees. A zero-accrual call is a silent no-op."
            onClick={() =>
              void run(
                "Collect fees",
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
            Collect accrued swap fees
          </Button>
        ) : null}
      </div>
      <p className="mt-4 mb-0 text-xs text-ink-muted">
        Zero-amount claims and empty flushes are successful no-ops. If the recipient rejected the ETH
        transfer, the entitlement was <em>restored</em>, not lost — fix the recipient and claim again.
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
  const [revenueKind, setRevenueKind] = useState<RevenueKind>("creatorAccruals");
  const revenue = useRevenueEvents(tokenRef, revenueKind);
  const watchlist = useWatchlist();
  const wallet = useWallet();

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
            ? "No launch matches this reference yet. It may still be settling — launches appear as soon as the indexer binds the Launched event."
            : (token.error as Error)?.message ?? "This pool is unavailable."}
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
          <span
            className="grid size-[clamp(4rem,8vw,6rem)] shrink-0 place-items-center overflow-hidden border border-ink font-mono text-[clamp(1rem,2vw,1.5rem)] font-bold text-accent-strong"
            aria-hidden="true"
          >
            {detail.imageUri ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resolveImageUrl(detail.imageUri)} alt="" className="size-full object-cover" />
            ) : (
              (detail.symbol ?? "?").slice(0, 2)
            )}
          </span>
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
                  {" "}· revenue NFT held by{" "}
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
              Curve full at level {formatLevel(price.data?.level)} — the next qualifying trade graduates the pool.
              A deliberate graduation is quoted above the button.
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
              label="Level (−tick)"
              value={formatLevel(price.data?.level ?? detail.openingLevel)}
              sub={
                detail.status === "bonding"
                  ? `graduation at ${formatLevel(detail.farLevel)} · source ${price.data?.source ?? "—"}`
                  : `graduated at ${formatLevel(detail.graduationLevel)}`
              }
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
            <Progress
              className="mb-8 mt-8"
              label={`Curve progress — lvl ${formatLevel(detail.openingLevel)} → ${formatLevel(detail.farLevel)}`}
              value={progress * 100}
              valueLabel={`${(progress * 100).toFixed(2)}%`}
            />
          ) : (
            <p className="mt-8 mb-0 text-xs font-bold text-ink-muted">
              Graduated at level {formatLevel(detail.graduationLevel)} — permanent market with the
              milestone ladder live ({detail.milestones.completed} harvested, {detail.milestones.live} bands
              standing).
            </p>
          )}

          <PriceHistoryChart tokenRef={tokenRef} poolId={detail.poolId} stream={stream} />

          <Section
            id="tape"
            title="Trade tape"
            aside={
              <span className="font-mono text-xs text-ink-muted" role="status">
                {stream.connected ? "live stream connected" : "stream reconnecting — REST tape below"}
              </span>
            }
          >
            <LiveStreamTicks stream={stream} />
            {(trades.data?.data ?? []).length === 0 && stream.ticks.length === 0 ? (
              <p className="border border-rule bg-raised p-6 text-center text-sm text-ink-muted">
                No swaps recorded yet.
              </p>
            ) : (
              <ul className="m-0 list-none p-0">
                {(trades.data?.data ?? []).map((trade) => (
                  <TradeTapeRow key={`${trade.transactionHash}-${trade.logIndex}`} trade={trade} />
                ))}
              </ul>
            )}
          </Section>

          <Section id="market" title="Market structure">
            <p className="mt-2 mb-0 text-sm text-ink-muted">
              The hook prices every swap through JIT-deployed protocol liquidity — nobody else can
              provide liquidity while bonding, and after graduation the protocol positions stay
              code-locked. The 1% fee is static and protocol-owned.
            </p>
            <DepthPanel tokenRef={tokenRef} />
          </Section>

          {detail.status === "graduated" ? (
            <Section
              id="ladder"
              title="Milestone ladder"
              aside={
                <span className="font-mono text-xs text-ink-muted">
                  {milestones.data?.meta.total ?? 0} bands computed
                </span>
              }
            >
              <p className="mt-2 mb-4 text-sm text-ink-muted">
                22 core bands on the decaying schedule (2× first step → 1.2504× floor at 447-level
                widths), plus up to 30 fee-funded extensions. A crossed band is harvested — 10%
                service fee, 90% to the payout pot. Bypassed bands are a normal outcome.
              </p>
              <MilestoneSchedule
                graduationLevel={detail.graduationLevel ?? 0}
                milestones={milestones.data?.data ?? []}
                loading={milestones.isLoading}
              />
            </Section>
          ) : null}

          <Section id="payout" title="Payout pot and claims">
            <p className="mt-2 mb-0 text-sm text-ink-muted">
              Indexed pot: {formatEth(detail.pot.balance, 4)} ETH ({formatEth(detail.pot.fundedTotal, 4)} funded
              lifetime, {formatEth(detail.pot.serviceFeeTotal, 4)} service fees). Claimable ledgers are read live
              from the hook:
            </p>
            <ClaimsPanel
              poolId={detail.poolId}
              token={detail.token as Address}
              graduated={detail.status === "graduated"}
              isHolder={isNftHolder}
            />
            {detail.launchRecord ? (
              <p className="mt-4 mb-0 font-mono text-[0.68rem] text-ink-muted">
                Launch record: {detail.launchRecord.state}
                {detail.launchRecord.transactionHash ? (
                  <>
                    {" · "}
                    <a className="underline" href={explorerTx(detail.launchRecord.transactionHash)} rel="noreferrer" target="_blank">
                      launch tx
                    </a>
                  </>
                ) : null}
              </p>
            ) : null}
          </Section>

          <Section
            id="revenue"
            title="Revenue events"
            aside={
              <div className="flex flex-wrap gap-1" role="group" aria-label="Revenue event kind">
                {REVENUE_KINDS.map((kind) => (
                  <button
                    key={kind.value}
                    type="button"
                    aria-pressed={revenueKind === kind.value}
                    className={[
                      "min-h-8 cursor-pointer rounded-sm border px-2 py-1 text-xs font-bold",
                      revenueKind === kind.value
                        ? "border-ink bg-ink text-inverse"
                        : "border-rule text-ink-muted",
                    ].join(" ")}
                    onClick={() => setRevenueKind(kind.value)}
                  >
                    {kind.label}
                  </button>
                ))}
              </div>
            }
          >
            {revenue.data && revenue.data.data.length > 0 ? (
              <ul className="m-0 list-none border-t border-rule p-0">
                {revenue.data.data.map((event, index) => (
                  <li
                    key={`${event.transactionHash}-${event.logIndex}-${index}`}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-rule py-2 text-sm"
                  >
                    <span className="min-w-0 font-mono text-xs text-ink">
                      {Object.entries(event)
                        .filter(
                          ([key]) =>
                            ![
                              "transactionHash",
                              "logIndex",
                              "blockNumber",
                              "timestamp",
                              "ordinalKey",
                              "chainId",
                              "poolId",
                              "id",
                            ].includes(key),
                        )
                        .map(([key, value]) =>
                          typeof value === "string" || typeof value === "number" || typeof value === "boolean"
                            ? `${key}=${String(value)}`
                            : null,
                        )
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    <span className="flex items-center gap-3 font-mono text-[0.68rem] text-ink-muted">
                      <a className="underline" href={explorerTx(event.transactionHash)} rel="noreferrer" target="_blank">
                        {event.transactionHash.slice(0, 10)}…
                      </a>
                      {relativeTime(event.timestamp)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="border border-rule bg-raised p-6 text-center text-sm text-ink-muted">
                No {revenueKind} events for this pool yet.
              </p>
            )}
          </Section>

          <Section id="comments" title="Discussion">
            <CommentThread tokenRef={detail.poolId} />
          </Section>
        </div>

        <aside className="sticky top-4 grid min-w-0 gap-4 max-[72rem]:hidden" aria-label="Trading panel">
          <div className={PANEL}>
            <p className={PANEL_LABEL}>Uniswap v4 · direct on-chain execution</p>
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
            <p className="m-0 font-mono text-[0.68rem] font-bold uppercase text-ink-muted">Pool facts</p>
            <ul className="mt-2 m-0 grid list-none gap-1 p-0">
              <li className="flex justify-between gap-2">
                <span className="text-ink-muted">poolId</span>
                <span className="truncate">{detail.poolId.slice(0, 18)}…</span>
              </li>
              <li className="flex justify-between gap-2">
                <span className="text-ink-muted">configHash</span>
                <span className="truncate">{detail.configHash?.slice(0, 18) ?? "—"}…</span>
              </li>
              <li className="flex justify-between gap-2">
                <span className="text-ink-muted">total supply</span>
                <span>{formatCompactEth(detail.totalSupply, 0)}</span>
              </li>
              <li className="flex justify-between gap-2">
                <span className="text-ink-muted">burned</span>
                <span>
                  {detail.stats ? formatCompactEth(detail.stats.burnedTotal, 0) : "0"}
                </span>
              </li>
              <li className="flex justify-between gap-2">
                <span className="text-ink-muted">dev buy share</span>
                <span>{(Number(wei(detail.devBuyShareWad)) / 1e16).toFixed(2)}%</span>
              </li>
              <li className="flex justify-between gap-2">
                <span className="text-ink-muted">payout plan</span>
                <span title={detail.payoutPlan}>bits {planBits(detail.payoutPlan)}</span>
              </li>
              <li className="flex justify-between gap-2">
                <span className="text-ink-muted">creator revenue</span>
                <span>{detail.stats ? formatCompactEth(detail.stats.creatorRevenueTotal) : "—"} ETH</span>
              </li>
            </ul>
          </div>
        </aside>
      </div>

      <div className="mt-8 hidden max-[72rem]:block">
        <div className={`${PANEL} max-w-[38rem]`}>
          <p className={PANEL_LABEL}>Uniswap v4 · direct on-chain execution</p>
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

function planBits(payoutPlan: string): string {
  let value = 0n;
  try {
    value = BigInt(payoutPlan);
  } catch {
    return "—";
  }
  const bits: number[] = [];
  for (let i = 0; i < 64 && value >> BigInt(i) > 0n; i += 1) {
    if ((value >> BigInt(i)) & 1n) bits.push(i);
  }
  return bits.length ? bits.join(",") : "none";
}
