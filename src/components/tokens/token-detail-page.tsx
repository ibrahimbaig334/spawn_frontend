"use client";

import Link from "next/link";
import { useState } from "react";
import { CommentThread } from "@/components/comments/comment-thread";
import { PriceHistoryChart } from "@/components/charts/price-history-chart";
import { TradeTicket } from "@/components/trade/trade-ticket";
import { MilestoneOverview } from "@/components/visuals/milestone-overview";
import { RoutingCut } from "@/components/visuals/routing-cut";
import { DEMO_DISCLOSURE } from "@/content/product-copy";
import { formatDemoUtc } from "@/domain/demo-time";
import {
  selectHistory,
  selectLaunchActivity,
  selectLaunchBySlug,
  selectNextMilestone,
  selectTokenSummary,
} from "@/domain/selectors";
import {
  formatBasisPoints,
  formatCompactNumber,
  formatEth,
} from "@/lib/format";
import { useDemo } from "@/state/use-demo";
import { MilestoneSchedule } from "./milestone-schedule";

const STAGE_LABELS = {
  launch: "Initial market phase",
  milestones: "Milestone phase",
  "core-complete": "Core schedule complete",
} as const;
const BOOKMARK =
  "h-3.5 w-2.5 border-[1.5px] border-current [clip-path:polygon(0_0,100%_0,100%_100%,50%_72%,0_100%)] forced-colors:[clip-path:none]";
const TRADE_PANEL = "border border-ink bg-raised p-4";
const TRADE_LABEL =
  "m-0 font-mono text-[0.68rem] font-bold tracking-[0.08em] text-accent-strong uppercase";

function activityLabel(
  kind: "buy" | "sell" | "milestone" | "created",
  milestone?: number,
) {
  if (kind === "milestone") return `Milestone ${milestone ?? ""} completed`;
  if (kind === "created") return "Demo token created";
  return `Demo ${kind} recorded`;
}

function Unavailable({ pending }: { pending: boolean }) {
  return (
    <section
      className="min-h-[60vh] px-[max(1rem,calc((100vw-80rem)/2))] py-[clamp(4rem,10vw,8rem)]"
      aria-live={pending ? "polite" : undefined}
    >
      <p className="m-0 font-mono text-xs font-bold text-accent-strong uppercase">
        {pending
          ? "Loading browser-local data"
          : "In-browser route unavailable"}
      </p>
      <h1 className="my-2 max-w-[14ch] text-[clamp(2.5rem,7vw,5.5rem)] leading-[0.95]">
        {pending
          ? "Preparing token details."
          : "This demo token is not available."}
      </h1>
      <p className="max-w-2xl text-ink-muted">
        {pending
          ? "The route is checking fixed fixtures and launches saved in this browser."
          : "It may have been created in another browser, removed by resetting local data, or the URL may be incorrect."}
      </p>
      {!pending ? (
        <div className="mt-6 flex gap-4 max-[34rem]:flex-col [&_a]:inline-flex [&_a]:min-h-target [&_a]:items-center [&_a]:justify-center [&_a]:border [&_a]:border-ink [&_a]:px-4 [&_a]:py-2.5 [&_a]:font-bold">
          <Link href="/tokens">Browse demo tokens</Link>
          <Link href="/create">Create a local launch</Link>
        </div>
      ) : null}
    </section>
  );
}

export function TokenDetailPage({ slug }: { slug: string }) {
  const { state, dispatch } = useDemo();
  const [ownershipView, setOwnershipView] = useState<
    "original" | "illustrated"
  >("original");
  const launch = selectLaunchBySlug(state, slug);
  if (!launch)
    return <Unavailable pending={state.runtime.hydration === "pending"} />;

  const summary = selectTokenSummary(state, launch);
  const creator = summary?.creator;
  const history = selectHistory(state, launch.id);
  const activity = selectLaunchActivity(state, launch.id);
  const next = selectNextMilestone(launch);
  const watched = state.data.watchlist.includes(launch.id);
  const completed = launch.completedMilestones + launch.additionalMilestones;

  return (
    <article className="px-[max(1rem,calc((100vw-80rem)/2))] pt-[clamp(2.5rem,6vw,5rem)] pb-[clamp(5rem,9vw,8rem)] print:px-0">
      <p className="mt-0 mb-6 border-l-[3px] border-accent bg-raised px-4 py-3 text-sm text-ink-muted">
        {DEMO_DISCLOSURE}
      </p>
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-8 border-b-2 border-ink pb-[clamp(2rem,5vw,4rem)] max-[48rem]:grid-cols-1">
        <div className="flex items-start gap-5 max-[34rem]:flex-col">
          <span
            className="grid size-[clamp(4rem,8vw,6rem)] shrink-0 place-items-center border border-ink font-mono text-[clamp(1rem,2vw,1.5rem)] font-bold text-accent-strong"
            aria-hidden="true"
          >
            {launch.symbol.slice(0, 2)}
          </span>
          <div>
            <p className="m-0 font-mono text-xs font-bold tracking-[0.08em] text-accent-strong uppercase">
              {STAGE_LABELS[launch.stage]} · ${launch.symbol}
            </p>
            <h1 className="my-2 max-w-[16ch] text-[clamp(2.7rem,7vw,6rem)] leading-[0.94] tracking-[-0.05em]">
              {launch.name}
            </h1>
            <p className="m-0 max-w-3xl text-ink-muted">{launch.description}</p>
            {creator ? (
              <p className="mt-3 mb-0 text-sm">
                Created by{" "}
                <Link
                  className="font-bold underline-offset-4"
                  href={`/profiles/${creator.slug}`}
                >
                  {creator.displayName}
                </Link>{" "}
                · Fictional demo profile
              </p>
            ) : null}
          </div>
        </div>
        <div className="grid min-w-40 gap-2 max-[48rem]:grid-cols-2 max-[34rem]:grid-cols-1 print:hidden">
          <button
            className="inline-flex min-h-target cursor-pointer items-center justify-center gap-2 border border-ink bg-transparent px-3 py-2 font-bold aria-pressed:border-accent-strong aria-pressed:text-accent-strong"
            type="button"
            aria-pressed={watched}
            onClick={() => dispatch({ type: "toggle-watch", id: launch.id })}
          >
            <span className={BOOKMARK} aria-hidden="true" />
            {watched ? "Watched" : "Add to watchlist"}
          </button>
          {creator ? (
            <Link
              className="inline-flex min-h-target items-center justify-center border border-ink bg-ink px-3 py-2 font-bold text-inverse no-underline"
              href={`/profiles/${creator.slug}`}
            >
              View creator
            </Link>
          ) : null}
        </div>
      </header>
      <div className="mt-8 grid grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] items-start gap-[clamp(2rem,5vw,5rem)] max-[64rem]:grid-cols-1 print:block">
        <div className="min-w-0">
          <dl className="mb-8 grid grid-cols-4 border-y border-rule max-[48rem]:grid-cols-2 max-[34rem]:grid-cols-1 [&>div]:min-w-0 [&>div]:p-4 [&>div+div]:border-l [&>div+div]:border-rule max-[48rem]:[&>div:nth-child(3)]:border-l-0 max-[48rem]:[&>div:nth-child(n+3)]:border-t max-[34rem]:[&>div+div]:border-t max-[34rem]:[&>div+div]:border-l-0 [&_dt]:text-xs [&_dt]:text-ink-muted [&_dd]:mt-1 [&_dd]:mb-0 [&_dd]:overflow-wrap-anywhere [&_dd]:font-mono [&_dd]:text-sm [&_dd]:font-bold">
            <div>
              <dt>Demo token price</dt>
              <dd>{summary?.priceEth ?? "—"} ETH</dd>
            </div>
            <div>
              <dt>Total-supply valuation</dt>
              <dd>{formatEth(launch.valuationEth, 2)}</dd>
            </div>
            <div>
              <dt>Current fee</dt>
              <dd>{formatBasisPoints(summary?.feeBps ?? 0)}</dd>
            </div>
            <div>
              <dt>Total supply</dt>
              <dd>
                {formatCompactNumber(launch.supply)} {launch.symbol}
              </dd>
            </div>
          </dl>
          <div className="mb-8">
            <div className="flex justify-between gap-4 text-xs font-bold">
              <span>
                {next
                  ? `Next: milestone ${next.number} at ${formatEth(next.targetEth, 2)}`
                  : "All available milestones complete"}
              </span>
              <span>{formatBasisPoints(launch.progressBps)}</span>
            </div>
            <div
              className="mt-2 h-2 border border-rule bg-raised"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={10000}
              aria-valuenow={launch.progressBps}
              aria-label={`${formatBasisPoints(launch.progressBps)} toward the next public price target`}
            >
              <span
                className="block h-full bg-accent forced-colors:bg-[Highlight]"
                style={{ width: formatBasisPoints(launch.progressBps) }}
              />
            </div>
          </div>
          <PriceHistoryChart launch={launch} points={history} />
          <div
            className={`${TRADE_PANEL} my-8 hidden max-w-[38rem] max-[64rem]:block print:hidden`}
          >
            <p className={TRADE_LABEL}>Browser-local simulation</p>
            <h2 className="m-0 text-2xl">Trade {launch.symbol}</h2>
            <TradeTicket launch={launch} />
          </div>
          <MilestoneSchedule launch={launch} />
          <section
            className="grid grid-cols-2 gap-4 border-t-2 border-ink py-8 max-[48rem]:grid-cols-1 [&>*]:m-0 [&>*]:min-w-0"
            aria-label="Protocol terms"
          >
            <MilestoneOverview
              completedMilestones={launch.completedMilestones}
              progressBps={launch.progressBps}
              title="Core milestone overview"
            />
            <RoutingCut
              split={launch.proceedsSplit}
              mode={
                launch.progressBps >= 8_500
                  ? "approaching"
                  : completed >= 60
                    ? "completed"
                    : "committed"
              }
              milestoneNumber={next?.number}
              amountEth={next?.allocationEth}
              title="Declared proceeds allocation"
            />
          </section>
          <section
            className="my-8 grid grid-cols-[1fr_minmax(12rem,.35fr)] gap-8 border border-rule bg-raised p-5 max-[48rem]:grid-cols-1"
            aria-labelledby={`right-${launch.id}`}
          >
            <div>
              <p className="m-0 text-ink-muted">Creator earnings right</p>
              <h2
                className="my-1 text-[clamp(1.4rem,3vw,2.2rem)]"
                id={`right-${launch.id}`}
              >
                {formatBasisPoints(launch.proceedsSplit.creator)} of each
                completed allocation
              </h2>
              <p className="m-0 text-ink-muted">
                {ownershipView === "original"
                  ? "The original fictional creator is shown as the illustrative recipient."
                  : "A hypothetical later holder is shown only to explain how the right could be described."}
              </p>
              <p className="mt-3 mb-0 font-bold text-accent-strong">
                Ownership illustration only · no transfer occurs
              </p>
            </div>
            <label className="grid content-start gap-1.5 text-xs font-bold">
              Illustrated recipient
              <select
                className="min-h-target border border-rule bg-paper p-2.5 text-ink"
                value={ownershipView}
                onChange={(event) =>
                  setOwnershipView(
                    event.target.value as "original" | "illustrated",
                  )
                }
              >
                <option value="original">Original creator</option>
                <option value="illustrated">After a demo transfer</option>
              </select>
            </label>
          </section>
          <section
            className="border-t-2 border-ink py-[clamp(2rem,5vw,4rem)]"
            aria-labelledby={`activity-${launch.id}`}
          >
            <header className="flex items-end justify-between gap-4">
              <h2
                className="m-0 text-[clamp(1.6rem,4vw,2.6rem)]"
                id={`activity-${launch.id}`}
              >
                Market activity
              </h2>
              <span className="font-mono text-xs text-ink-muted">
                Structured demonstration records
              </span>
            </header>
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
                    <strong>
                      {activityLabel(record.kind, record.milestoneNumber)}
                    </strong>
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
                No activity has been recorded for this demo token.
              </p>
            )}
          </section>
          <CommentThread launchId={launch.id} />
        </div>
        <aside
          className="sticky top-4 min-w-0 max-[64rem]:hidden print:hidden"
          aria-label="Trade simulation"
        >
          <div className={TRADE_PANEL}>
            <p className={TRADE_LABEL}>Browser-local simulation</p>
            <h2 className="m-0 text-2xl">Trade {launch.symbol}</h2>
            <TradeTicket launch={launch} />
          </div>
        </aside>
      </div>
    </article>
  );
}
