"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { DEMO_DISCLOSURE } from "@/content/product-copy";
import { selectLaunches, selectTokenSummary } from "@/domain/selectors";
import { parseDecimal } from "@/domain/economics";
import { formatBasisPoints, formatEth } from "@/lib/format";
import { useDemo } from "@/state/use-demo";
import type { LaunchStage } from "@/types/launch";

type SortKey = "newest" | "valuation" | "progress";
const STAGES: Array<{ value: "all" | LaunchStage; label: string }> = [
  { value: "all", label: "All stages" },
  { value: "launch", label: "Initial market phase" },
  { value: "milestones", label: "Milestone phase" },
  { value: "core-complete", label: "Core schedule complete" },
];
const STAGE_LABELS = Object.fromEntries(
  STAGES.slice(1).map(({ value, label }) => [value, label]),
) as Record<LaunchStage, string>;
const FIELD =
  "min-h-target w-full min-w-0 border border-rule bg-raised px-3 py-2.5 text-ink";
const CONTROL =
  "inline-flex min-h-target cursor-pointer items-center justify-center gap-2 border border-ink bg-ink px-3 py-2.5 font-bold text-inverse no-underline";
const BOOKMARK =
  "h-3.5 w-2.5 border-[1.5px] border-current [clip-path:polygon(0_0,100%_0,100%_100%,50%_72%,0_100%)] forced-colors:[clip-path:none]";

function validStage(value: string | null): "all" | LaunchStage {
  return STAGES.some((option) => option.value === value)
    ? (value as "all" | LaunchStage)
    : "all";
}
function validSort(value: string | null): SortKey {
  return value === "valuation" || value === "progress" ? value : "newest";
}
function compareDecimal(left: string, right: string): number {
  const leftValue = parseDecimal(left) ?? 0n;
  const rightValue = parseDecimal(right) ?? 0n;
  return leftValue === rightValue ? 0 : leftValue > rightValue ? -1 : 1;
}

export function TokenDirectory() {
  const { state, dispatch } = useDemo();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const parameterString = searchParams.toString();
  const query = searchParams.get("q") ?? "";
  const stage = validStage(searchParams.get("stage"));
  const sort = validSort(searchParams.get("sort"));
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
      .flatMap((launch) => {
        const summary = selectTokenSummary(state, launch);
        return summary ? [summary] : [];
      })
      .filter(
        ({ launch, creator }) =>
          !normalized ||
          `${launch.name} ${launch.symbol} ${launch.description} ${creator.displayName}`
            .toLowerCase()
            .includes(normalized),
      )
      .filter(({ launch }) => stage === "all" || launch.stage === stage)
      .filter(
        ({ launch }) =>
          !watchedOnly || state.data.watchlist.includes(launch.id),
      )
      .sort((left, right) =>
        sort === "valuation"
          ? compareDecimal(left.launch.valuationEth, right.launch.valuationEth)
          : sort === "progress"
            ? right.launch.progressBps - left.launch.progressBps
            : right.launch.createdSequence - left.launch.createdSequence,
      );
  }, [query, sort, stage, state, watchedOnly]);

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
            Markets with terms attached.
          </h1>
        </div>
        <p className="m-0 text-lg text-ink-muted">
          Search fixed fixtures and launches created in this browser. Compare
          intended mechanics without mistaking demonstration values for a live
          market.
        </p>
      </header>
      <p className="mt-[clamp(2rem,5vw,4rem)] mb-0 border-l-[3px] border-accent bg-raised px-4 py-3 text-sm text-ink-muted">
        {DEMO_DISCLOSURE}
      </p>
      <div
        className="mt-6 grid grid-cols-[minmax(13rem,2fr)_repeat(2,minmax(9rem,1fr))_minmax(10rem,auto)] gap-3 border-y border-rule py-4 max-[68rem]:grid-cols-2 max-[42rem]:grid-cols-1 [&>label]:grid [&>label]:min-w-0 [&>label]:gap-1.5 [&>label>span]:text-xs [&>label>span]:font-bold"
        aria-label="Filter demo tokens"
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
              placeholder="Name, symbol, creator"
            />
          </label>
          <button className={CONTROL} type="submit">
            Apply search
          </button>
        </form>
        <label>
          <span>Stage</span>
          <select
            className={FIELD}
            value={stage}
            onChange={(event) =>
              updateUrl({
                stage: event.target.value === "all" ? null : event.target.value,
              })
            }
          >
            {STAGES.map((option) => (
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
                sort:
                  event.target.value === "newest" ? null : event.target.value,
              })
            }
          >
            <option value="newest">Newest</option>
            <option value="valuation">Demo valuation</option>
            <option value="progress">Next-target progress</option>
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
      </div>
      <div className="flex justify-between gap-4 py-4 pb-2 font-mono text-xs font-semibold text-ink-muted uppercase">
        <p className="m-0" aria-live="polite">
          {rows.length} demo {rows.length === 1 ? "token" : "tokens"}
        </p>
        <span className="max-[42rem]:hidden">Valuation · milestones · fee</span>
      </div>
      <div className="border-t-2 border-ink">
        {rows.map(({ launch, creator, feeBps, latestActivity }) => {
          const watched = state.data.watchlist.includes(launch.id);
          return (
            <article
              className="grid grid-cols-[minmax(15rem,.75fr)_minmax(14rem,.7fr)_minmax(24rem,1.2fr)_auto] items-center gap-x-8 gap-y-3 border-b border-rule py-5 break-inside-avoid max-[68rem]:grid-cols-[1fr_1fr_auto] max-[42rem]:grid-cols-1"
              key={launch.id}
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
                    {STAGE_LABELS[launch.stage]}
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
                    ${launch.symbol} ·{" "}
                    <Link href={`/profiles/${creator.slug}`}>
                      {creator.displayName}
                    </Link>
                  </p>
                </div>
              </div>
              <p className="m-0 text-sm leading-snug text-ink-muted max-[68rem]:col-start-1 max-[68rem]:row-start-2 max-[42rem]:col-auto max-[42rem]:row-auto">
                {launch.description}
              </p>
              <dl className="m-0 grid grid-cols-4 max-[68rem]:col-start-2 max-[68rem]:row-span-2 max-[68rem]:row-start-1 max-[68rem]:grid-cols-2 max-[42rem]:col-auto max-[42rem]:row-auto [&>div]:min-w-0 [&>div]:px-3 [&>div]:py-1 max-[68rem]:[&>div]:py-2 [&>div+div]:border-l [&>div+div]:border-rule max-[68rem]:[&>div:nth-child(3)]:border-l-0 [&_dt]:text-[0.65rem] [&_dt]:text-ink-muted [&_dd]:mt-1 [&_dd]:mb-0 [&_dd]:overflow-wrap-anywhere [&_dd]:font-mono [&_dd]:text-xs [&_dd]:font-semibold">
                <div>
                  <dt>Demo valuation</dt>
                  <dd>{formatEth(launch.valuationEth, 2)}</dd>
                </div>
                <div>
                  <dt>Milestones</dt>
                  <dd>
                    {launch.completedMilestones + launch.additionalMilestones}{" "}
                    complete
                  </dd>
                </div>
                <div>
                  <dt>Next target</dt>
                  <dd>{formatBasisPoints(launch.progressBps)}</dd>
                </div>
                <div>
                  <dt>Current fee</dt>
                  <dd>{formatBasisPoints(feeBps)}</dd>
                </div>
              </dl>
              <p className="col-start-2 col-end-4 m-0 text-xs text-ink-muted max-[68rem]:col-start-1 max-[68rem]:col-end-3 max-[68rem]:row-start-3 max-[42rem]:col-auto max-[42rem]:row-auto">
                {latestActivity
                  ? `Latest: ${latestActivity.kind === "milestone" ? `milestone ${latestActivity.milestoneNumber} completed` : `${latestActivity.kind} recorded`}`
                  : "No activity yet"}
              </p>
              <div className="col-start-4 row-span-2 row-start-1 grid min-w-36 gap-2 max-[68rem]:col-start-3 max-[68rem]:row-span-3 max-[42rem]:col-auto max-[42rem]:row-auto max-[42rem]:grid-cols-2 print:hidden">
                <button
                  className="inline-flex min-h-target cursor-pointer items-center justify-center gap-2 border border-rule bg-transparent px-3 py-2 font-bold aria-pressed:border-accent-strong aria-pressed:text-accent-strong"
                  type="button"
                  aria-label={`${watched ? "Remove" : "Add"} ${launch.name} ${watched ? "from" : "to"} watchlist`}
                  aria-pressed={watched}
                  onClick={() =>
                    dispatch({ type: "toggle-watch", id: launch.id })
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
              No demo tokens match.
            </h2>
            <p className="text-ink-muted">
              Clear a filter or search for a different name, symbol, or creator.
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
    </section>
  );
}
