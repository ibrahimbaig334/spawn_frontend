"use client";

import Link from "next/link";
import { DEMO_DISCLOSURE } from "@/content/product-copy";
import { formatDemoUtc } from "@/domain/demo-time";
import { selectLedger } from "@/domain/selectors";
import { formatEth, formatTokenAmount } from "@/lib/format";
import { useDemo } from "@/state/use-demo";
import {
  DISCLOSURE,
  EYEBROW,
  EMPTY,
  HERO,
  LOADING,
  PAGE,
  SECTION,
  SECTION_HEADER,
} from "./portfolio-styles";

export function PortfolioActivity() {
  const { state } = useDemo();
  if (state.runtime.hydration === "pending")
    return (
      <section className={LOADING}>
        <p>Loading browser-local data</p>
        <h1>Preparing account activity.</h1>
      </section>
    );
  const entries = [...selectLedger(state)].reverse();
  return (
    <article className={PAGE}>
      <header className={HERO}>
        <div>
          <p className={EYEBROW}>Browser-local demo account</p>
          <h1>Account activity.</h1>
        </div>
        <p>
          Only fixture and browser-local ledger entries for this demonstration
          account appear here. This is not global market activity.
        </p>
      </header>
      <p className={DISCLOSURE}>{DEMO_DISCLOSURE}</p>
      <section className={SECTION} aria-labelledby="ledger-title">
        <header className={SECTION_HEADER}>
          <h2 id="ledger-title">Deterministic ledger</h2>
          <span>
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </span>
        </header>
        {entries.length ? (
          <ol className="m-0 list-none p-0">
            {entries.map((entry) => {
              const launch = state.data.entities.launches[entry.launchId];
              if (!launch) return null;
              return (
                <li
                  className="grid grid-cols-[minmax(10rem,.55fr)_minmax(30rem,1.5fr)_minmax(11rem,auto)] items-center gap-x-8 gap-y-6 border-b border-rule py-5 break-inside-avoid max-[62rem]:grid-cols-1"
                  key={entry.id}
                >
                  <div>
                    <span className={EYEBROW}>{entry.side}</span>
                    <h3 className="my-1 text-xl">
                      <Link href={`/tokens/${launch.slug}`}>{launch.name}</Link>
                    </h3>
                    <p className="m-0 text-xs text-ink-muted">
                      {entry.origin === "fixture"
                        ? "Fixed fixture"
                        : "Browser-local simulation"}
                    </p>
                  </div>
                  <dl className="m-0 grid grid-cols-4 max-[42rem]:grid-cols-2 max-[28rem]:grid-cols-1 [&>div]:px-3 max-[28rem]:[&>div]:border-t max-[28rem]:[&>div]:py-2 [&>div+div]:border-l [&>div+div]:border-rule max-[42rem]:[&>div:nth-child(odd)]:border-l-0 max-[42rem]:[&>div:nth-child(n+3)]:border-t max-[28rem]:[&>div]:border-l-0 [&_dt]:text-xs [&_dt]:text-ink-muted [&_dd]:mt-1 [&_dd]:mb-0 [&_dd]:overflow-wrap-anywhere [&_dd]:font-mono [&_dd]:text-xs [&_dd]:font-bold">
                    <div>
                      <dt>Token quantity</dt>
                      <dd>
                        {formatTokenAmount(entry.tokenAmount, launch.symbol, 6)}
                      </dd>
                    </div>
                    <div>
                      <dt>
                        {entry.side === "buy"
                          ? "Gross input"
                          : "Gross proceeds"}
                      </dt>
                      <dd>{formatEth(entry.grossInput, 6)}</dd>
                    </div>
                    <div>
                      <dt>Fee (1%)</dt>
                      <dd>{formatEth(entry.feeAmount, 6)}</dd>
                    </div>
                    <div>
                      <dt>
                        {entry.side === "buy" ? "Account cost" : "Net proceeds"}
                      </dt>
                      <dd>
                        {formatEth(
                          entry.side === "buy"
                            ? entry.grossInput
                            : entry.netOutput,
                          6,
                        )}
                      </dd>
                    </div>
                  </dl>
                  <div className="grid justify-items-end gap-1 font-mono text-[0.65rem] text-ink-muted max-[62rem]:justify-items-start">
                    <time dateTime={entry.occurredAt}>
                      {formatDemoUtc(entry.occurredAt)}
                    </time>
                    <code className="max-w-60 overflow-wrap-anywhere text-ink">
                      {entry.receiptId}
                    </code>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className={EMPTY}>
            <h3>No account activity.</h3>
            <p>
              Trade simulations recorded from token details will appear in this
              ledger.
            </p>
            <Link href="/tokens">Browse demo tokens</Link>
          </div>
        )}
      </section>
    </article>
  );
}
