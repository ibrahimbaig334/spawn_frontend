"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { DEMO_DISCLOSURE } from "@/content/product-copy";
import {
  deriveCurveProgress,
  deriveFdvEth,
  derivePhaseLabel,
  derivePriceEth,
  selectComments,
  selectLaunches,
  selectLaunchActivity,
  selectLedger,
} from "@/domain/selectors";
import { parseDecimal } from "@/domain/economics";
import { formatEth } from "@/lib/format";
import { useDemo } from "@/state/use-demo";
import type { LaunchRecord } from "@/services/launchpad-client";
import type { PoolPhase } from "@/types/protocol-model";
import { TokenCard, type TokenCardData } from "@/components/launch/token-card";

type SortKey = "newest" | "fdv" | "progress";
type ViewKey = "list" | "cards";
const PHASES: Array<{ value: "all" | PoolPhase; label: string }> = [
  { value: "all", label: "All phases" },
  { value: "bonding-curve", label: "Bonding curve" },
  { value: "graduated", label: "Graduated" },
];
const FIELD =
  "min-h-target w-full min-w-0 border border-rule bg-raised px-3 py-2.5 text-ink";
const CONTROL =
  "inline-flex min-h-target cursor-pointer items-center justify-center gap-2 border border-ink bg-ink px-3 py-2.5 font-bold text-inverse no-underline";
const BOOKMARK =
  "h-3.5 w-2.5 border-[1.5px] border-current [clip-path:polygon(0_0,100%_0,100%_100%,50%_72%,0_100%)] forced-colors:[clip-path:none]";

function validPhase(value: string | null): "all" | PoolPhase {
  return PHASES.some((option) => option.value === value)
    ? (value as "all" | PoolPhase)
    : "all";
}
function validSort(value: string | null): SortKey {
  return value === "fdv" || value === "progress" ? value : "newest";
}
function validView(value: string | null): ViewKey {
  return value === "cards" ? "cards" : "list";
}
function compareDecimal(left: string, right: string): number {
  const leftValue = parseDecimal(left) ?? 0n;
  const rightValue = parseDecimal(right) ?? 0n;
  return leftValue === rightValue ? 0 : leftValue > rightValue ? -1 : 1;
}

/** Relative created label for the card footer ("just now", "2d ago"...). */
function createdLabel(createdAt: string): string {
  const elapsed = Date.now() - Date.parse(createdAt);
  if (!Number.isFinite(elapsed) || elapsed < 60_000) return "just now";
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Browse-mode card data assembled from a launch record + app state. */
function cardDataFor(
  launch: LaunchRecord,
  state: ReturnType<typeof useDemo>["state"],
): TokenCardData {
  const volume = selectLedger(state, launch.poolId).reduce(
    (sum, entry) => sum + (parseDecimal(entry.grossInput) ?? 0n),
    0n,
  );
  return {
    name: launch.name,
    symbol: launch.symbol,
    description: launch.metadata?.description ?? "",
    logoUrl: launch.metadata?.logoUrl,
    contractAddress: launch.token,
    createdLabel: createdLabel(launch.createdAt),
    stats: {
      price: String(Number(parseDecimal(derivePriceEth(launch)) ?? 0n) / 1e18),
      marketCapUsd: deriveFdvEth(launch),
      changePercent: 0,
      volumeUsd: String(Number(volume) / 1e18),
      bondingPercent: Math.round(deriveCurveProgress(launch) * 100),
      comments: selectComments(state, launch.poolId).length,
    },
  };
}

export function TokenDirectory() {
  const { state, dispatch } = useDemo();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const parameterString = searchParams.toString();
  const query = searchParams.get("q") ?? "";
  const phase = validPhase(searchParams.get("phase"));
  const sort = validSort(searchParams.get("sort"));
  const view = validView(searchParams.get("view"));
  const watchedOnly = searchParams.get("watchlist") === "1";

  function updateUrl(
    changes: Record<string, string | null>,
    mode: "push" | "replace" = "push",
  ) {
    const next = new URLSearchParams(parameterString);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const href = `${pathname}${next.size ? `?${next}` : ""}`;
    if (mode === "replace") router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  }

  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return selectLaunches(state)
      .filter(
        (launch) =>
          !normalized ||
          `${launch.name} ${launch.symbol} ${launch.token}`
            .toLowerCase()
            .includes(normalized),
      )
      .filter((launch) => phase === "all" || launch.phase === phase)
      .filter(
        (launch) => !watchedOnly || state.data.watchlist.includes(launch.poolId),
      )
      .sort((left: LaunchRecord, right: LaunchRecord) =>
        sort === "fdv"
          ? compareDecimal(
              deriveFdvEth(left),
              deriveFdvEth(right),
            )
          : sort === "progress"
            ? deriveCurveProgress(right) - deriveCurveProgress(left)
            : right.createdAt.localeCompare(right.createdAt, undefined, {
                numeric: true,
              }) * -1,
      );
  }, [phase, query, sort, state, watchedOnly]);

  return (
    <section
      className="px-[max(1rem,calc((100vw-80rem)/2))] pt-[clamp(3rem,7vw,6rem)] pb-[clamp(5rem,9vw,8rem)] print:px-0"
      aria-labelledby="directory-title"
    >
      <header className="grid grid-cols-[minmax(20rem,1.1fr)_minmax(17rem,.55fr)] items-end gap-x-[clamp(3rem,8vw,8rem)] gap-y-8 max-[42rem]:grid-cols-1">
        <div>
          <p className="m-0 font-mono text-xs font-bold tracking-[0.08em] text-accent-strong uppercase">
            Token directory
          </p>
          <h1
            className="mt-2 mb-0 max-w-[11ch] text-[clamp(3rem,7vw,6.5rem)] leading-[0.92] tracking-[-0.055em]"
            id="directory-title"
          >
            Pools with terms attached.
          </h1>
        </div>
        <p className="m-0 text-lg text-ink-muted">
          Search simulated pools and launches created in this browser. Compare
          protocol mechanics without mistaking simulation values for a live
          market.
        </p>
      </header>
      <p className="mt-[clamp(2rem,5vw,4rem)] mb-0 border-l-[3px] border-accent bg-raised px-4 py-3 text-sm text-ink-muted">
        {DEMO_DISCLOSURE}
      </p>
      <div
        className="mt-6 grid grid-cols-[minmax(13rem,2fr)_repeat(2,minmax(9rem,1fr))_minmax(10rem,auto)] gap-3 border-y border-rule py-4 max-[68rem]:grid-cols-2 max-[42rem]:grid-cols-1 [&>label]:grid [&>label]:min-w-0 [&>label]:gap-1.5 [&>label>span]:text-xs [&>label>span]:font-bold"
        aria-label="Filter tokens"
      >
        <form
          className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-1.5 max-[42rem]:grid-cols-1"
          action={pathname}
        >
          <label className="grid min-w-0 gap-1.5">
            <span className="text-xs font-bold">Search</span>
            <input
              className={FIELD}
              key={query}
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Name, symbol, token address"
            />
          </label>
          <button className={CONTROL} type="submit">
            Apply search
          </button>
        </form>
        <label>
          <span>Phase</span>
          <select
            className={FIELD}
            value={phase}
            onChange={(event) =>
              updateUrl({
                phase: event.target.value === "all" ? null : event.target.value,
              })
            }
          >
            {PHASES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Sort</span>
          <select
            className={FIELD}
            value={sort}
            onChange={(event) =>
              updateUrl({
                sort: event.target.value === "newest" ? null : event.target.value,
              })
            }
          >
            <option value="newest">Newest</option>
            <option value="fdv">FDV</option>
            <option value="progress">Curve progress</option>
          </select>
        </label>
        <label className="flex! min-h-target cursor-pointer flex-row! items-center self-end gap-2! text-sm font-bold">
          <input
            className="size-5 min-h-0! w-5! accent-accent"
            type="checkbox"
            checked={watchedOnly}
            onChange={(event) =>
              updateUrl({ watchlist: event.target.checked ? "1" : null })
            }
          />
          Watchlist only
        </label>
        <div className="flex! min-h-target items-center self-end gap-1.5">
          <span className="sr-only">View</span>
          <div
            className="flex [&_button]:min-h-target [&_button]:cursor-pointer [&_button]:border [&_button]:border-rule [&_button]:bg-raised [&_button]:px-3 [&_button]:py-2.5 [&_button]:text-sm [&_button]:font-bold [&_button[aria-pressed=true]]:border-ink [&_button[aria-pressed=true]]:bg-ink [&_button[aria-pressed=true]]:text-inverse [&_button+button]:border-l-0"
            role="group"
            aria-label="Directory view"
          >
            <button
              aria-pressed={view === "list"}
              type="button"
              onClick={() => updateUrl({ view: null })}
            >
              List
            </button>
            <button
              aria-pressed={view === "cards"}
              type="button"
              onClick={() => updateUrl({ view: "cards" })}
            >
              Cards
            </button>
          </div>
        </div>
      </div>
      <div className="flex justify-between gap-4 py-4 pb-2 font-mono text-xs font-semibold text-ink-muted uppercase">
        <p className="m-0" aria-live="polite">
          {rows.length} {rows.length === 1 ? "token" : "tokens"}
        </p>
        <span className="max-[42rem]:hidden">
          {view === "cards" ? "Flip a card for details" : "FDV · milestones · phase"}
        </span>
      </div>
      {view === "cards" ? (
        <div
          className="grid grid-cols-[repeat(auto-fill,minmax(22rem,1fr))] justify-items-center gap-x-6 gap-y-10 border-t-2 border-ink pt-8 max-[42rem]:grid-cols-1"
          data-testid="token-card-grid"
        >
          {rows.map((launch) => {
            const watched = state.data.watchlist.includes(launch.poolId);
            return (
              <div className="grid w-full max-w-[22rem] gap-3" key={launch.poolId}>
                <TokenCard data={cardDataFor(launch, state)} />
                <div className="flex items-center justify-between gap-2 print:hidden">
                  <Link
                    className="inline-flex min-h-target items-center gap-2 font-bold underline decoration-[0.1em] underline-offset-4"
                    href={`/tokens/${launch.slug}`}
                    aria-label={`Inspect ${launch.name}`}
                  >
                    Inspect <span aria-hidden="true">→</span>
                  </Link>
                  <button
                    className="inline-flex min-h-target cursor-pointer items-center gap-2 border border-rule bg-transparent px-3 py-2 text-sm font-bold aria-pressed:border-accent-strong aria-pressed:text-accent-strong"
                    type="button"
                    aria-pressed={watched}
                    aria-label={`${watched ? "Remove" : "Add"} ${launch.name} ${watched ? "from" : "to"} watchlist`}
                    onClick={() =>
                      dispatch({ type: "toggle-watch", id: launch.poolId })
                    }
                  >
                    <span className={BOOKMARK} aria-hidden="true" />
                    {watched ? "Watched" : "Watch"}
                  </button>
                </div>
              </div>
            );
          })}
          {!rows.length ? (
            <div className="col-span-full py-16 text-center">
              <h2 className="m-0 text-[clamp(1.8rem,4vw,3rem)]">
                No tokens match.
              </h2>
              <p className="text-ink-muted">
                Clear a filter or search for a different name or symbol.
              </p>
            </div>
          ) : null}
        </div>
      ) : (
      <div className="border-t-2 border-ink">
        {rows.map((launch) => {
          const watched = state.data.watchlist.includes(launch.poolId);
          const latest = selectLaunchActivity(state, launch.poolId)[0];
          return (
            <article
              className="grid grid-cols-[minmax(15rem,.75fr)_minmax(14rem,.7fr)_minmax(24rem,1.2fr)_auto] items-center gap-x-8 gap-y-3 border-b border-rule py-5 break-inside-avoid max-[68rem]:grid-cols-[1fr_1fr_auto] max-[42rem]:grid-cols-1"
              key={launch.poolId}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="grid size-target shrink-0 place-items-center border border-ink font-mono text-xs font-bold text-accent-strong"
                  aria-hidden="true"
                >
                  {launch.symbol.slice(0, 2)}
                </span>
                <div>
                  <p className="m-0 font-mono text-[0.68rem] font-bold tracking-[0.08em] text-accent-strong uppercase">
                    {derivePhaseLabel(launch)}
                  </p>
                  <h2 className="mt-0.5 mb-0 text-xl">
                    <Link
                      className="underline-offset-4"
                      href={`/tokens/${launch.slug}`}
                    >
                      {launch.name}
                    </Link>
                  </h2>
                  <p className="mt-0.5 mb-0 text-xs text-ink-muted">
                    ${launch.symbol} · ${launch.token}
                  </p>
                </div>
              </div>
              <p className="m-0 text-sm leading-snug text-ink-muted max-[68rem]:col-start-1 max-[68rem]:row-start-2 max-[42rem]:col-auto max-[42rem]:row-auto">
                Level {launch.level} of {launch.farLevel} · pot{" "}
                {formatEth(launch.payoutPotWei, 3)}
              </p>
              <dl className="m-0 grid grid-cols-4 max-[68rem]:col-start-2 max-[68rem]:row-span-2 max-[68rem]:row-start-1 max-[68rem]:grid-cols-2 max-[42rem]:col-auto max-[42rem]:row-auto [&>div]:min-w-0 [&>div]:px-3 [&>div]:py-1 max-[68rem]:[&>div]:py-2 [&>div+div]:border-l [&>div+div]:border-rule max-[68rem]:[&>div:nth-child(3)]:border-l-0 [&_dt]:text-[0.65rem] [&_dt]:text-ink-muted [&_dd]:mt-1 [&_dd]:mb-0 [&_dd]:overflow-wrap-anywhere [&_dd]:font-mono [&_dd]:text-xs [&_dd]:font-semibold">
                <div>
                  <dt>FDV</dt>
                  <dd>{formatEth(deriveFdvEth(launch), 2)}</dd>
                </div>
                <div>
                  <dt>Milestones</dt>
                  <dd>{launch.completedMilestones} harvested</dd>
                </div>
                <div>
                  <dt>Curve progress</dt>
                  <dd>{(deriveCurveProgress(launch) * 100).toFixed(1)}%</dd>
                </div>
                <div>
                  <dt>Fee</dt>
                  <dd>1% static</dd>
                </div>
              </dl>
              <p className="col-start-2 col-end-4 m-0 text-xs text-ink-muted max-[68rem]:col-start-1 max-[68rem]:col-end-3 max-[68rem]:row-start-3 max-[42rem]:col-auto max-[42rem]:row-auto">
                {latest
                  ? `Latest: ${latest.kind === "milestone" ? `milestone ${latest.milestoneNumber} harvested` : `${latest.kind} recorded`}`
                  : "No activity yet"}
              </p>
              <div className="col-start-4 row-span-2 row-start-1 grid min-w-36 gap-2 max-[68rem]:col-start-3 max-[68rem]:row-span-3 max-[42rem]:col-auto max-[42rem]:row-auto max-[42rem]:grid-cols-2 print:hidden">
                <button
                  className="inline-flex min-h-target cursor-pointer items-center justify-center gap-2 border border-rule bg-transparent px-3 py-2 font-bold aria-pressed:border-accent-strong aria-pressed:text-accent-strong"
                  type="button"
                  aria-label={`${watched ? "Remove" : "Add"} ${launch.name} ${watched ? "from" : "to"} watchlist`}
                  aria-pressed={watched}
                  onClick={() =>
                    dispatch({ type: "toggle-watch", id: launch.poolId })
                  }
                >
                  <span className={BOOKMARK} aria-hidden="true" />
                  {watched ? "Watched" : "Watch"}
                </button>
                <Link className={CONTROL} href={`/tokens/${launch.slug}`}>
                  Inspect token <span aria-hidden="true">→</span>
                </Link>
              </div>
            </article>
          );
        })}
        {!rows.length ? (
          <div className="py-[clamp(3rem,7vw,6rem)] text-center">
            <h2 className="m-0 text-[clamp(1.8rem,4vw,3rem)]">
              No tokens match.
            </h2>
            <p className="text-ink-muted">
              Clear a filter or search for a different name or symbol.
            </p>
            <button
              className="mt-4 inline-flex min-h-target cursor-pointer items-center justify-center border border-ink bg-transparent px-3 py-2 font-bold"
              type="button"
              onClick={() => router.push(pathname)}
            >
              Clear all filters
            </button>
          </div>
        ) : null}
      </div>
      )}
    </section>
  );
}
