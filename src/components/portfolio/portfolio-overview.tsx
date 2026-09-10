"use client";

import Link from "next/link";
import { useRef } from "react";
import { DEMO_DISCLOSURE } from "@/content/product-copy";
import { selectPortfolioTotals, selectProfileById } from "@/domain/selectors";
import { formatEth, formatTokenAmount } from "@/lib/format";
import { useDemo } from "@/state/use-demo";
import {
  DISCLOSURE,
  EMPTY,
  EYEBROW,
  HERO,
  LOADING,
  PAGE,
  SECTION,
  SECTION_HEADER,
} from "./portfolio-styles";

function polarity(value: string) {
  return value.startsWith("-")
    ? "negative"
    : value === "0"
      ? "neutral"
      : "positive";
}

export function PortfolioOverview() {
  const { state, reset } = useDemo();
  const dialogRef = useRef<HTMLDialogElement>(null);
  if (state.runtime.hydration === "pending")
    return (
      <section className={LOADING}>
        <p>Loading browser-local data</p>
        <h1>Preparing demo portfolio.</h1>
      </section>
    );
  const totals = selectPortfolioTotals(state);
  const account = selectProfileById(
    state,
    state.data.portfolio.accountProfileId,
  );
  return (
    <article className={PAGE}>
      <header className={HERO}>
        <div>
          <p className={EYEBROW}>Browser-local demo account</p>
          <h1>Portfolio accounting, without the wallet fiction.</h1>
        </div>
        <p>
          Review deterministic positions, average-cost basis, and estimated demo
          value for {account?.displayName ?? "this local participant"}.
        </p>
      </header>
      <p className={DISCLOSURE}>{DEMO_DISCLOSURE}</p>
      <dl className="mt-6 grid grid-cols-4 border-y-2 border-ink max-[62rem]:grid-cols-2 max-[42rem]:grid-cols-1 [&>div]:min-w-0 [&>div]:p-4 [&>div+div]:border-l [&>div+div]:border-rule max-[62rem]:[&>div:nth-child(3)]:border-l-0 max-[62rem]:[&>div:nth-child(n+3)]:border-t max-[42rem]:[&>div+div]:border-t max-[42rem]:[&>div+div]:border-l-0 [&_dt]:text-xs [&_dt]:text-ink-muted [&_dd]:mt-2 [&_dd]:mb-0 [&_dd]:overflow-wrap-anywhere [&_dd]:font-mono [&_dd]:text-[clamp(1rem,2vw,1.35rem)] [&_dd]:font-bold [&_dd[data-polarity=positive]]:text-accent-strong [&_dd[data-polarity=negative]]:text-error">
        <div>
          <dt>Available demo ETH</dt>
          <dd>{formatEth(totals.ethBalance, 4)}</dd>
        </div>
        <div>
          <dt>Estimated demo value</dt>
          <dd>{formatEth(totals.estimatedValueEth, 4)}</dd>
        </div>
        <div>
          <dt>Average-cost basis</dt>
          <dd>{formatEth(totals.costBasisEth, 4)}</dd>
        </div>
        <div>
          <dt>Total demo P&amp;L</dt>
          <dd data-polarity={polarity(totals.totalPnlEth)}>
            {formatEth(totals.totalPnlEth, 4)}
          </dd>
        </div>
      </dl>
      <section className={SECTION} aria-labelledby="position-title">
        <header className={SECTION_HEADER}>
          <div>
            <p className={EYEBROW}>Derived from the ledger</p>
            <h2 id="position-title">Position accounting</h2>
          </div>
          <Link
            className="font-mono text-xs font-bold text-ink-muted"
            href="/portfolio/activity"
          >
            View account activity
          </Link>
        </header>
        {totals.positions.length ? (
          <div>
            {totals.positions.map((position) => (
              <article
                className="grid grid-cols-[minmax(12rem,.55fr)_minmax(30rem,1.5fr)] items-center gap-x-8 gap-y-6 border-b border-rule py-5 break-inside-avoid max-[62rem]:grid-cols-1"
                key={position.launch.id}
              >
                <div>
                  <p className="m-0 text-xs text-ink-muted">
                    ${position.launch.symbol}
                  </p>
                  <h3 className="my-1 text-xl">
                    <Link href={`/tokens/${position.launch.slug}`}>
                      {position.launch.name}
                    </Link>
                  </h3>
                  <span className="text-xs text-ink-muted">
                    {position.tokenQuantity === "0"
                      ? "Closed position"
                      : "Demo holding"}
                  </span>
                </div>
                <dl className="m-0 grid grid-cols-3 gap-px bg-rule max-[42rem]:grid-cols-2 max-[28rem]:grid-cols-1 [&>div]:min-w-0 [&>div]:bg-raised [&>div]:px-3 [&>div]:py-2 [&_dt]:text-xs [&_dt]:text-ink-muted [&_dd]:mt-1 [&_dd]:mb-0 [&_dd]:overflow-wrap-anywhere [&_dd]:font-mono [&_dd]:text-xs [&_dd]:font-bold [&_dd[data-polarity=positive]]:text-accent-strong [&_dd[data-polarity=negative]]:text-error">
                  <div>
                    <dt>Quantity</dt>
                    <dd>
                      {formatTokenAmount(
                        position.tokenQuantity,
                        position.launch.symbol,
                        4,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Average cost</dt>
                    <dd>{formatEth(position.averageCostEth, 8)}</dd>
                  </div>
                  <div>
                    <dt>Remaining basis</dt>
                    <dd>{formatEth(position.remainingCostBasisEth, 4)}</dd>
                  </div>
                  <div>
                    <dt>Estimated value</dt>
                    <dd>{formatEth(position.estimatedValueEth, 4)}</dd>
                  </div>
                  <div>
                    <dt>Realized P&amp;L</dt>
                    <dd data-polarity={polarity(position.realizedPnlEth)}>
                      {formatEth(position.realizedPnlEth, 4)}
                    </dd>
                  </div>
                  <div>
                    <dt>Unrealized P&amp;L</dt>
                    <dd data-polarity={polarity(position.unrealizedPnlEth)}>
                      {formatEth(position.unrealizedPnlEth, 4)}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        ) : (
          <div className={EMPTY}>
            <h3>No demo positions yet.</h3>
            <p>
              Use a token detail page to record a browser-local buy simulation.
            </p>
            <Link href="/tokens">Browse demo tokens</Link>
          </div>
        )}
      </section>
      <section
        className="mt-[clamp(3rem,8vw,7rem)] flex items-center justify-between gap-8 border-y border-rule py-5 max-[42rem]:items-stretch max-[42rem]:flex-col print:hidden"
        aria-labelledby="demo-settings"
      >
        <div>
          <p className={EYEBROW}>Local settings</p>
          <h2 className="my-1" id="demo-settings">
            Reset this demonstration
          </h2>
          <p className="m-0 text-ink-muted">
            Restore fixed fixtures and remove browser-local launches, comments,
            trades, and watchlist changes.
          </p>
        </div>
        <button
          className="min-h-target cursor-pointer border border-error bg-transparent px-4 py-2.5 font-bold text-error"
          type="button"
          onClick={() => dialogRef.current?.showModal()}
        >
          Reset demo data
        </button>
      </section>
      <dialog
        className="w-[calc(100%_-_2rem)] max-w-[34rem] border-2 border-ink bg-raised p-6 text-ink backdrop:bg-[rgb(23_26_24/70%)] [&_h2]:m-0 [&_h2]:text-2xl [&_p]:text-ink-muted"
        ref={dialogRef}
        aria-labelledby="reset-title"
      >
        <h2 id="reset-title">Reset all browser-local demo data?</h2>
        <p>
          This restores the fixed fixture dataset. Local launches, trades,
          comments, and watchlist changes cannot be recovered.
        </p>
        <div className="flex justify-end gap-2 max-[42rem]:flex-col-reverse [&_button]:min-h-target [&_button]:cursor-pointer [&_button]:border [&_button]:border-ink [&_button]:bg-transparent [&_button]:px-3 [&_button]:py-2 [&_button]:font-bold [&_button:last-child]:border-error [&_button:last-child]:bg-error [&_button:last-child]:text-inverse">
          <button type="button" onClick={() => dialogRef.current?.close()}>
            Keep current data
          </button>
          <button
            type="button"
            onClick={() => {
              reset();
              dialogRef.current?.close();
            }}
          >
            Reset demo data
          </button>
        </div>
      </dialog>
    </article>
  );
}
