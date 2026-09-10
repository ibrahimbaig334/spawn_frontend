"use client";

import Link from "next/link";
import { DEMO_DISCLOSURE } from "@/content/product-copy";
import {
  selectTokenSummary,
  selectWatchlistedLaunches,
} from "@/domain/selectors";
import { formatBasisPoints, formatEth } from "@/lib/format";
import { useDemo } from "@/state/use-demo";
import {
  BOOKMARK,
  DISCLOSURE,
  EMPTY,
  EYEBROW,
  HERO,
  LOADING,
  PAGE,
  SECTION,
  SECTION_HEADER,
} from "./portfolio-styles";

export function PortfolioWatchlist() {
  const { state, dispatch } = useDemo();
  if (state.runtime.hydration === "pending")
    return (
      <section className={LOADING}>
        <p>Loading browser-local data</p>
        <h1>Preparing watchlist.</h1>
      </section>
    );
  const launches = selectWatchlistedLaunches(state);
  return (
    <article className={PAGE}>
      <header className={HERO}>
        <div>
          <p className={EYEBROW}>Browser-local watchlist</p>
          <h1>Terms worth revisiting.</h1>
        </div>
        <p>
          Bookmarks stay in this browser and do not represent ownership,
          endorsement, notifications, or a live market subscription.
        </p>
      </header>
      <p className={DISCLOSURE}>{DEMO_DISCLOSURE}</p>
      <section className={SECTION} aria-labelledby="watchlist-title">
        <header className={SECTION_HEADER}>
          <h2 id="watchlist-title">Watched demo tokens</h2>
          <span>{launches.length}</span>
        </header>
        {launches.length ? (
          <div>
            {launches.map((launch) => {
              const summary = selectTokenSummary(state, launch);
              return (
                <article
                  className="grid grid-cols-[minmax(12rem,.7fr)_minmax(22rem,1fr)_auto] items-center gap-x-8 gap-y-6 border-b border-rule py-5 break-inside-avoid max-[62rem]:grid-cols-1"
                  key={launch.id}
                >
                  <div>
                    <p className="m-0 text-xs text-ink-muted">
                      ${launch.symbol}
                    </p>
                    <h3 className="my-1 text-xl">
                      <Link href={`/tokens/${launch.slug}`}>{launch.name}</Link>
                    </h3>
                    <p className="m-0 text-xs text-ink-muted">
                      {launch.description}
                    </p>
                  </div>
                  <dl className="m-0 grid grid-cols-3 max-[42rem]:grid-cols-2 max-[28rem]:grid-cols-1 [&>div]:px-3 [&>div]:py-2 [&>div+div]:border-l [&>div+div]:border-rule max-[42rem]:[&>div:nth-child(3)]:border-t max-[42rem]:[&>div:nth-child(3)]:border-l-0 max-[28rem]:[&>div]:border-t max-[28rem]:[&>div]:border-l-0 [&_dt]:text-xs [&_dt]:text-ink-muted [&_dd]:mt-1 [&_dd]:mb-0 [&_dd]:font-mono [&_dd]:text-xs [&_dd]:font-bold">
                    <div>
                      <dt>Demo valuation</dt>
                      <dd>{formatEth(launch.valuationEth, 2)}</dd>
                    </div>
                    <div>
                      <dt>Milestones</dt>
                      <dd>
                        {launch.completedMilestones +
                          launch.additionalMilestones}
                      </dd>
                    </div>
                    <div>
                      <dt>Current fee</dt>
                      <dd>{formatBasisPoints(summary?.feeBps ?? 0)}</dd>
                    </div>
                  </dl>
                  <div className="grid gap-2 max-[62rem]:grid-cols-2 max-[28rem]:grid-cols-1 print:hidden">
                    <button
                      className="inline-flex min-h-target cursor-pointer items-center justify-center gap-2 border border-rule bg-transparent px-3 py-2 font-bold"
                      type="button"
                      onClick={() =>
                        dispatch({ type: "toggle-watch", id: launch.id })
                      }
                    >
                      <span className={BOOKMARK} aria-hidden="true" />
                      Remove
                    </button>
                    <Link
                      className="inline-flex min-h-target items-center justify-center border border-ink bg-ink px-3 py-2 font-bold text-inverse no-underline"
                      href={`/tokens/${launch.slug}`}
                    >
                      Inspect token
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className={EMPTY}>
            <h3>No watched demo tokens.</h3>
            <p>Add bookmarks from the directory or a token detail page.</p>
            <Link href="/tokens">Browse demo tokens</Link>
          </div>
        )}
      </section>
    </article>
  );
}
