"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PriceHistoryChart } from "@/components/charts/price-history-chart";
import { TradeTicket } from "@/components/trade/trade-ticket";
import { MilestoneOverview } from "@/components/visuals/milestone-overview";
import { DEMO_DISCLOSURE } from "@/content/product-copy";
import { formatDemoUtc } from "@/domain/demo-time";
import {
  deriveCurveProgress,
  deriveFdvEth,
  derivePhaseLabel,
  derivePriceEth,
  selectLaunchActivity,
  selectLaunchBySlug,
  selectLedger,
  selectMilestoneSchedule,
  selectPlanPluginCount,
} from "@/domain/selectors";
import {
  formatCompactNumber,
  formatEth,
  formatSubscriptPrice,
} from "@/lib/format";
import { useDemo } from "@/state/use-demo";
import { PLAN_COPY } from "@/components/launch/plan-labels";
import { SOCIAL_META, socialLinks } from "@/components/launch/social-icons";
import type { BandView, ClaimBalances } from "@/types/protocol-model";

const BOOKMARK =
  "h-3.5 w-2.5 border-[1.5px] border-current [clip-path:polygon(0_0,100%_0,100%_100%,50%_72%,0_100%)] forced-colors:[clip-path:none]";
const TRADE_PANEL = "border border-ink bg-raised p-4";
const TRADE_LABEL =
  "m-0 font-mono text-[0.68rem] font-bold tracking-[0.08em] text-accent-strong uppercase";

function activityLabel(kind: string, milestone?: number): string {
  if (kind === "milestone") return `Milestone ${milestone ?? ""} harvested`;
  if (kind === "created") return "Launch created";
  if (kind === "graduated") return "Pool graduated";
  if (kind === "flush") return "Payout pot flushed";
  if (kind === "claim") return "Claim executed";
  return kind === "buy" ? "Buy recorded" : "Sell recorded";
}

function Unavailable({ pending }: { pending: boolean }) {
  return (
    <section
      className="min-h-[60vh] px-[max(1rem,calc((100vw-80rem)/2))] py-[clamp(4rem,10vw,8rem)]"
      aria-live={pending ? "polite" : undefined}
    >
      <p className="m-0 font-mono text-xs font-bold text-accent-strong uppercase">
        {pending ? "Loading browser-local data" : "In-browser route unavailable"}
      </p>
      <h1 className="my-2 max-w-[14ch] text-[clamp(2.5rem,7vw,5.5rem)] leading-[0.95]">
        {pending ? "Preparing token details." : "This token is not available."}
      </h1>
      <p className="max-w-2xl text-ink-muted">
        {pending
          ? "The route is checking simulated pools saved in this browser."
          : "It may have been created in another browser, removed by resetting local data, or the URL may be incorrect."}
      </p>
      {!pending ? (
        <div className="mt-6 flex gap-4 max-[34rem]:flex-col [&_a]:inline-flex [&_a]:min-h-target [&_a]:items-center [&_a]:justify-center [&_a]:border [&_a]:border-ink [&_a]:px-4 [&_a]:py-2.5 [&_a]:font-bold">
          <Link href="/tokens">Browse tokens</Link>
          <Link href="/create">Create a launch</Link>
        </div>
      ) : null}
    </section>
  );
}

export function TokenDetailPage({ slug }: { slug: string }) {
  const { state, dispatch, client } = useDemo();
  const [flushStatus, setFlushStatus] = useState("");
  const launch = selectLaunchBySlug(state, slug);
  const [poolState, setPoolState] = useState<{
    bands: BandView[];
    potWei: string;
    claim: ClaimBalances;
  } | null>(null);
  const [flushBusy, setFlushBusy] = useState(false);

  useEffect(() => {
    if (!launch) return;
    let cancelled = false;
    void Promise.all([
      client.getPoolState(launch),
      client.getClaimBalances(launch),
    ])
      .then(([pool, claim]) => {
        if (cancelled) return;
        setPoolState({
          bands: pool.bands,
          potWei: pool.payoutPotWei,
          claim,
        });
      })
      .catch(() => {
        if (!cancelled) setPoolState(null);
      });
    return () => {
      cancelled = true;
    };
  }, [client, launch?.poolId, launch]);

  if (!launch)
    return <Unavailable pending={state.runtime.hydration === "pending"} />;

  const record = launch;
  const activity = selectLaunchActivity(state, record.poolId);
  const ledger = selectLedger(state, record.poolId);
  const socials = socialLinks(record.metadata?.socials);
  const price = derivePriceEth(launch);
  const fdv = deriveFdvEth(launch);
  const progress = deriveCurveProgress(launch);
  const phaseLabel = derivePhaseLabel(launch);
  const watched = state.data.watchlist.includes(launch.poolId);
  const planCount = selectPlanPluginCount(launch);

  const schedule = selectMilestoneSchedule(
    launch,
    poolState?.bands ?? [],
  );
  const potWei = poolState?.potWei ?? launch.payoutPotWei;
  const claim = poolState?.claim;

  async function flushPot() {
    if (flushBusy) return;
    setFlushBusy(true);
    setFlushStatus("");
    try {
      const outcome = await client.flushPool(record, state.data.sequence + 1);
      const refreshed = await client.getPoolState(record);
      const refreshedClaim = await client.getClaimBalances(record);
      setPoolState({
        bands: refreshed.bands,
        potWei: refreshed.payoutPotWei,
        claim: refreshedClaim,
      });
      dispatch({
        type: "apply-launch-update",
        launch: {
          ...record,
          payoutPotWei: refreshed.payoutPotWei,
        },
        events: [],
        activity: {
          id: `activity-${record.poolId}-flush-${state.data.sequence + 1}`,
          launchId: record.poolId,
          kind: "flush",
          amountEth: outcome.redeemedWei,
          sequence: state.data.sequence + 1,
          occurredAt: new Date().toISOString(),
          source: "local-simulation",
        },
        ethBalance: state.data.portfolio.ethBalance,
      });
      setFlushStatus(
        Number(outcome.redeemedWei) > 0
          ? `Flushed ${Number(outcome.redeemedWei).toFixed(2)} ETH. Tip ${Number(outcome.tipWei).toFixed(2)} ETH paid to the flusher.`
          : "Empty pot and no carry — a no-op success.",
      );
    } catch (reason) {
      setFlushStatus(
        reason instanceof Error ? reason.message : "The flush failed.",
      );
    } finally {
      setFlushBusy(false);
    }
  }

  async function claimPath(kind: "direct" | "creator-path") {
    if (flushBusy) return;
    setFlushBusy(true);
    setFlushStatus("");
    try {
      const outcome =
        kind === "direct"
          ? await client.claimDirect(record, state.data.sequence + 1)
          : await client.claimCreatorPath(record, state.data.sequence + 1);
      const refreshed = await client.getClaimBalances(record);
      setPoolState((current) =>
        current ? { ...current, claim: refreshed } : null,
      );
      setFlushStatus(
        outcome.success && Number(outcome.attemptedWei) > 0
          ? `Claimed ${Number(outcome.attemptedWei).toFixed(2)} ETH via the ${kind === "direct" ? "direct" : "creator-path"} ledger.`
          : "Zero-balance claim — a successful no-op.",
      );
    } catch (reason) {
      setFlushStatus(
        reason instanceof Error ? reason.message : "The claim failed.",
      );
    } finally {
      setFlushBusy(false);
    }
  }

  return (
    <article className="px-[max(1rem,calc((100vw-80rem)/2))] pt-[clamp(2.5rem,6vw,5rem)] pb-[clamp(5rem,9vw,8rem)] print:px-0">
      <p className="mt-0 mb-6 border-l-[3px] border-accent bg-raised px-4 py-3 text-sm text-ink-muted">
        {DEMO_DISCLOSURE}
      </p>
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-8 border-b-2 border-ink pb-[clamp(2rem,5vw,4rem)] max-[48rem]:grid-cols-1">
        <div className="flex items-start gap-5 max-[34rem]:flex-col">
          <span
            className="grid size-[clamp(4rem,8vw,6rem)] shrink-0 place-items-center overflow-hidden border border-ink font-mono text-[clamp(1rem,2vw,1.5rem)] font-bold text-accent-strong"
            aria-hidden="true"
          >
            {launch.metadata?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={launch.metadata.logoUrl}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              launch.symbol.slice(0, 2)
            )}
          </span>
          <div>
            <p className="m-0 font-mono text-xs font-bold tracking-[0.08em] text-accent-strong uppercase">
              {phaseLabel} · ${launch.symbol}
            </p>
            <h1 className="my-2 max-w-[16ch] text-[clamp(2.7rem,7vw,6rem)] leading-[0.94] tracking-[-0.05em]">
              {launch.name}
            </h1>
            {launch.metadata?.description ? (
              <p className="m-0 max-w-3xl text-ink-muted">
                {launch.metadata.description}
              </p>
            ) : null}
            <p className="m-0 max-w-3xl text-ink-muted">
              Pool {launch.poolId} · token {launch.token}
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
        <div className="grid min-w-40 gap-2 max-[48rem]:grid-cols-2 max-[34rem]:grid-cols-1 print:hidden">
          <button
            className="inline-flex min-h-target cursor-pointer items-center justify-center gap-2 border border-ink bg-transparent px-3 py-2 font-bold aria-pressed:border-accent-strong aria-pressed:text-accent-strong"
            type="button"
            aria-pressed={watched}
            onClick={() => dispatch({ type: "toggle-watch", id: launch.poolId })}
          >
            <span className={BOOKMARK} aria-hidden="true" />
            {watched ? "Watched" : "Add to watchlist"}
          </button>
        </div>
      </header>
      <div className="mt-8 grid grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] items-start gap-[clamp(2rem,5vw,5rem)] max-[64rem]:grid-cols-1 print:block">
        <div className="min-w-0">
          <dl className="mb-8 grid grid-cols-4 border-y border-rule max-[48rem]:grid-cols-2 max-[34rem]:grid-cols-1 [&>div]:min-w-0 [&>div]:p-4 [&>div+div]:border-l [&>div+div]:border-rule max-[48rem]:[&>div:nth-child(3)]:border-l-0 max-[48rem]:[&>div:nth-child(n+3)]:border-t max-[34rem]:[&>div+div]:border-t max-[34rem]:[&>div+div]:border-l-0 [&_dt]:text-xs [&_dt]:text-ink-muted [&_dd]:mt-1 [&_dd]:mb-0 [&_dd]:overflow-wrap-anywhere [&_dd]:font-mono [&_dd]:text-sm [&_dd]:font-bold">
            <div>
              <dt>Price</dt>
              <dd>{formatSubscriptPrice(price)} ETH</dd>
            </div>
            <div>
              <dt>FDV</dt>
              <dd>{formatEth(fdv, 2)}</dd>
            </div>
            <div>
              <dt>Level (−tick)</dt>
              <dd>{launch.level}</dd>
            </div>
            <div>
              <dt>Total supply</dt>
              <dd>
                {formatCompactNumber(launch.totalSupplyWei)} {launch.symbol}
              </dd>
            </div>
          </dl>
          {launch.phase === "bonding-curve" && (
            <div className="mb-8">
              <div className="flex justify-between gap-4 text-xs font-bold">
                <span>
                  Curve progress toward graduation (2x opening valuation)
                </span>
                <span>{(progress * 100).toFixed(2)}%</span>
              </div>
              <div
                className="mt-2 h-2 border border-rule bg-raised"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress * 100)}
                aria-label="Bonding curve progress toward graduation"
              >
                <span
                  className="block h-full bg-accent forced-colors:bg-[Highlight]"
                  style={{ width: `${(progress * 100).toFixed(2)}%` }}
                />
              </div>
            </div>
          )}
          <PriceHistoryChart launch={launch} points={ledger} />
          <div
            className={`${TRADE_PANEL} my-8 hidden max-w-[38rem] max-[64rem]:block print:hidden`}
          >
            <p className={TRADE_LABEL}>Local simulation</p>
            <h2 className="m-0 text-2xl">Trade {launch.symbol}</h2>
            <TradeTicket launch={launch} />
          </div>
          {launch.phase === "graduated" && (
            <section
              className="border-t-2 border-ink py-8"
              aria-labelledby="ladder-title"
            >
              <header className="flex items-end justify-between gap-4">
                <h2 className="m-0 text-[clamp(1.6rem,4vw,2.6rem)]" id="ladder-title">
                  Milestone ladder
                </h2>
                <span className="font-mono text-xs text-ink-muted">
                  {launch.completedMilestones} / 30 harvested
                </span>
              </header>
              <p className="mt-2 mb-4 text-sm text-ink-muted">
                Protocol-owned sell bands at ascending market caps (each rung
                1.2504x). A swap crossing a band top harvests it — 10% service
                fee, 90% to the payout pot. Bands are deployed just-in-time; a
                band whose moment passed before deploying is bypassed, not
                failed.
              </p>
              {schedule.length ? (
                <ol className="m-0 grid list-none gap-2 border-t border-rule p-0">
                  {schedule.map((band) => (
                    <li
                      key={band.number}
                      className="grid grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-4 border-b border-rule py-2 text-sm"
                      data-state={band.state}
                    >
                      <strong className="font-mono">M{band.number}</strong>
                      <span className="text-ink-muted">
                        Top at FDV {formatEth(band.targetFdvEth, 1)} ·{" "}
                        {band.rungMultiple} graduation
                      </span>
                      <span
                        className={
                          band.state === "completed"
                            ? "font-bold text-accent-strong"
                            : "text-ink-muted"
                        }
                      >
                        {band.state === "completed"
                          ? "Harvested"
                          : band.state === "skipped"
                            ? "Bypassed"
                            : band.state === "deployed"
                              ? "Live"
                              : "Pending"}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="border border-rule p-6 text-center text-ink-muted">
                  Band geometry loads from the pool state view.
                </p>
              )}
            </section>
          )}
          <section
            className="mt-8 border-t-2 border-ink py-8"
            aria-labelledby="payout-title"
          >
            <h2 className="m-0 text-[clamp(1.6rem,4vw,2.6rem)]" id="payout-title">
              Payout pot and claims
            </h2>
            <p className="mt-2 mb-4 text-sm text-ink-muted">
              Harvests fund the pot; a flush delivers it — 1% tip to the
              flusher, plugin shares in registry order, remainder to the creator
              path. Claims are pull-based and never blocked by plugin failures.
            </p>
            <dl className="m-0 grid grid-cols-3 gap-3 max-[40rem]:grid-cols-1 [&>div]:border [&>div]:border-rule [&>div]:bg-raised [&>div]:p-3 [&_dt]:text-xs [&_dt]:text-ink-muted [&_dd]:m-0 [&_dd]:font-mono [&_dd]:font-bold">
              <div>
                <dt>Payout pot (unflushed)</dt>
                <dd>{formatEth(potWei, 4)}</dd>
              </div>
              <div>
                <dt>Direct creator revenue</dt>
                <dd>{formatEth(claim?.directCreatorWei ?? "0", 4)}</dd>
              </div>
              <div>
                <dt>Creator-path entitlement</dt>
                <dd>{formatEth(claim?.creatorPathWei ?? "0", 4)}</dd>
              </div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-3 print:hidden [&_button]:min-h-target [&_button]:cursor-pointer [&_button]:border [&_button]:border-ink [&_button]:bg-transparent [&_button]:px-3 [&_button]:py-2 [&_button]:font-bold [&_button]:disabled:opacity-50">
              <button
                type="button"
                disabled={flushBusy}
                onClick={() => void flushPot()}
              >
                Flush pot (earn 1% tip)
              </button>
              <button
                type="button"
                disabled={flushBusy}
                onClick={() => void claimPath("direct")}
              >
                Claim direct revenue
              </button>
              <button
                type="button"
                disabled={flushBusy}
                onClick={() => void claimPath("creator-path")}
              >
                Claim creator path (flushes first)
              </button>
            </div>
            {flushStatus && (
              <p
                className="mt-3 mb-0 border-l-[3px] border-accent bg-raised px-4 py-3 text-sm"
                role="status"
              >
                {flushStatus}
              </p>
            )}
            <p className="mt-4 mb-0 text-xs text-ink-muted">
              {PLAN_COPY(planCount)} A zero-amount claim is a successful no-op —
              batch tools rely on that.
            </p>
          </section>
          <section
            className="mt-8 border-t-2 border-ink py-8"
            aria-labelledby="activity-title"
          >
            <h2 className="m-0 text-[clamp(1.6rem,4vw,2.6rem)]" id="activity-title">
              Activity
            </h2>
            {activity.length ? (
              <ol className="mt-4 mb-0 list-none border-t border-rule p-0">
                {activity.map((record) => (
                  <li
                    className="grid grid-cols-[6rem_1fr_auto] gap-4 border-b border-rule py-3 text-sm max-[34rem]:grid-cols-1 max-[34rem]:gap-1"
                    key={record.id}
                  >
                    <span className="font-mono text-xs font-bold text-accent-strong uppercase">
                      {record.kind}
                    </span>
                    <strong>{activityLabel(record.kind, record.milestoneNumber)}</strong>
                    <time
                      className="font-mono text-xs text-ink-muted"
                      dateTime={record.occurredAt}
                    >
                      {formatDemoUtc(record.occurredAt)}
                    </time>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="border border-rule p-8 text-center text-ink-muted">
                No activity has been recorded for this pool.
              </p>
            )}
          </section>
        </div>
        <aside
          className="sticky top-4 min-w-0 max-[64rem]:hidden print:hidden"
          aria-label="Trade simulation"
        >
          <div className={TRADE_PANEL}>
            <p className={TRADE_LABEL}>Local simulation</p>
            <h2 className="m-0 text-2xl">Trade {launch.symbol}</h2>
            <TradeTicket launch={launch} />
          </div>
          <div className="mt-4 border border-rule bg-raised p-4">
            <MilestoneOverview
              completedMilestones={launch.completedMilestones}
              progressBps={Math.round(deriveCurveProgress(launch) * 10_000)}
              title="Milestone progress"
            />
          </div>
        </aside>
      </div>
    </article>
  );
}
