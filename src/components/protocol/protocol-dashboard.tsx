"use client";

import Link from "next/link";
import { useState } from "react";
import {
  useEconomics,
  useGovernance,
  useKeeperJobs,
  usePayoutPlugins,
  useProtocolAddresses,
  useProtocolRevenue,
  useProtocolStats,
  useRevenueHistory,
  useWatermark,
} from "@/lib/queries";
import { formatCompactEth, formatUtc, wei } from "@/lib/display";
import { truncateDecimals } from "@/lib/format";
import { StatusMessage, StatusRegion } from "@/components/ui";
import { ApiError } from "@/lib/api/client";

const PAGE =
  "mx-auto w-full max-w-measure px-[max(1rem,calc((100vw-80rem)/2))]";

const WAD_PERCENT_DIVISOR = 10n ** 16n;

function wadPercent(value: string | undefined | null): string {
  if (!value) return "—";
  return `${truncateDecimals(Number(wei(value) / WAD_PERCENT_DIVISOR))}%`;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3 rounded-lg border-2 border-ink bg-paper p-5">
      <h2 className="m-0 text-lg font-black tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

export function ProtocolDashboard() {
  const addresses = useProtocolAddresses();
  const economics = useEconomics();
  const plugins = usePayoutPlugins();
  const governance = useGovernance();
  const revenue = useProtocolRevenue();
  const stats = useProtocolStats();
  const watermark = useWatermark();
  const jobs = useKeeperJobs({ limit: 25 });

  return (
    <main className={`${PAGE} py-12 pb-24`} id="main-content">
      <header className="mb-8 border-b-2 border-ink pb-6">
        <p className="m-0 font-mono text-[0.68rem] font-bold uppercase tracking-[0.08em] text-accent-strong">
          Chain state
        </p>
        <h1 className="my-2 text-[clamp(2rem,5vw,3.25rem)] font-black tracking-[-0.04em]">
          Protocol
        </h1>
        <p className="m-0 max-w-2xl text-ink-muted">
          The single source of truth this frontend consumes: deployment addresses, live economics,
          the plugin registry, governance, and the indexer watermark. Nothing here is hardcoded.
        </p>
      </header>

      <StatusRegion className="mb-6">
        {addresses.error instanceof ApiError && addresses.error.code === "MANIFEST_NOT_SYNCED" ? (
          <StatusMessage tone="warning" title="No deployment manifest">
            Contracts are not deployed/synced for this chain — launch endpoints will return
            <code> PROTOCOL_NOT_DEPLOYED</code>. Browsing and read-only data keep working.
          </StatusMessage>
        ) : null}
      </StatusRegion>

      <div className="grid grid-cols-2 gap-5 max-[60rem]:grid-cols-1">
        <Card title="Deployment addresses">
          {addresses.data ? (
            <ul className="m-0 grid list-none gap-1 p-0 font-mono text-xs">
              {Object.entries({ ...addresses.data, chainId: undefined }).map(([key, value]) =>
                typeof value === "string" ? (
                  <li key={key} className="flex justify-between gap-3 border-b border-rule py-1">
                    <span className="text-ink-muted">{key}</span>
                    <a className="truncate underline" href={`https://basescan.org/address/${value}`} target="_blank" rel="noreferrer">
                      {value}
                    </a>
                  </li>
                ) : null,
              )}
            </ul>
          ) : (
            <p className="m-0 text-sm text-ink-muted">Loading…</p>
          )}
        </Card>

        <Card title="Indexer watermark">
          {watermark.data ? (
            <ul className="m-0 grid list-none gap-1 p-0 font-mono text-xs">
              <li className="flex justify-between"><span className="text-ink-muted">committed block</span><strong>{Number(watermark.data.blockNumber).toLocaleString()}</strong></li>
              <li className="flex justify-between"><span className="text-ink-muted">block time</span><strong>{formatUtc(watermark.data.blockTime)}</strong></li>
              <li className="flex justify-between"><span className="text-ink-muted">last indexed</span><strong>{watermark.data.lastIndexedBlock ? Number(watermark.data.lastIndexedBlock).toLocaleString() : "—"}</strong></li>
              <li className="flex justify-between"><span className="text-ink-muted">economics v</span><strong>{watermark.data.committedVersion}</strong></li>
              <li className="flex justify-between"><span className="text-ink-muted">trusted operator</span><strong>{watermark.data.trustedOperator ? `${watermark.data.trustedOperator.slice(0, 12)}…` : "—"}</strong></li>
            </ul>
          ) : (
            <p className="m-0 text-sm text-ink-muted">
              {watermark.error instanceof ApiError && watermark.error.code === "WATERMARK_NOT_FOUND"
                ? "The indexer has not committed its first block yet."
                : "Loading…"}
            </p>
          )}
          <div className="flex gap-3 text-xs font-bold">
            <Link className="underline" href="/tokens">Markets →</Link>
          </div>
        </Card>

        <Card title="Economics (live tuple)">
          {economics.data ? (
            <ul className="m-0 grid list-none gap-1 p-0 font-mono text-xs">
              <li className="flex justify-between"><span className="text-ink-muted">version</span><strong>{economics.data.current.version}</strong></li>
              <li className="flex justify-between"><span className="text-ink-muted">harvest service fee</span><strong>{wadPercent(economics.data.current.harvestServiceFeeWad)} / cap {wadPercent(economics.data.caps.harvestServiceFeeWad.max)}</strong></li>
              <li className="flex justify-between"><span className="text-ink-muted">quote → creator</span><strong>{wadPercent(economics.data.current.quoteCreatorShareWad)} / cap {wadPercent(economics.data.caps.quoteCreatorShareWad.max)}</strong></li>
              <li className="flex justify-between"><span className="text-ink-muted">token fees → ladder</span><strong>{wadPercent(economics.data.current.tokenMilestoneFundShareWad)} / cap {wadPercent(economics.data.caps.tokenMilestoneFundShareWad.max)}</strong></li>
              <li className="flex justify-between"><span className="text-ink-muted">source</span><strong>{economics.data.source}</strong></li>
            </ul>
          ) : (
            <p className="m-0 text-sm text-ink-muted">
              {economics.error instanceof ApiError && economics.error.code === "ECONOMICS_NOT_AVAILABLE"
                ? "No economic config recorded yet."
                : "Loading…"}
            </p>
          )}
        </Card>

        <Card title="Protocol revenue">
          {revenue.data?.totals ? (
            <ul className="m-0 grid list-none gap-1 p-0 font-mono text-xs">
              <li className="flex justify-between"><span className="text-ink-muted">accrued</span><strong>{formatCompactEth(revenue.data.totals.accrued)} ETH</strong></li>
              <li className="flex justify-between"><span className="text-ink-muted">curve / fees / harvest</span><strong>{formatCompactEth(revenue.data.totals.curve, 0)} / {formatCompactEth(revenue.data.totals.swapFees, 0)} / {formatCompactEth(revenue.data.totals.harvestFees, 0)}</strong></li>
              <li className="flex justify-between"><span className="text-ink-muted">claimed</span><strong>{formatCompactEth(revenue.data.totals.claimed)} ETH</strong></li>
              {revenue.data.live ? (
                <li className="flex justify-between"><span className="text-ink-muted">claimable (live)</span><strong>{formatCompactEth(revenue.data.live.protocolClaimable)} ETH</strong></li>
              ) : null}
            </ul>
          ) : (
            <p className="m-0 text-sm text-ink-muted">No protocol revenue accrued yet.</p>
          )}
        </Card>

        <Card title={`Payout plugin registry (${plugins.data?.length ?? 0})`}>
          {plugins.data && plugins.data.length > 0 ? (
            <ul className="m-0 list-none p-0 font-mono text-xs">
              <li className="grid grid-cols-[2.5rem_minmax(0,1fr)_4rem_3rem_4.5rem] gap-2 border-b-2 border-ink py-1 font-bold">
                <span>#</span><span>plugin</span><span>take</span><span>role</span><span>state</span>
              </li>
              {plugins.data.map((entry) => (
                <li key={entry.registryIndex} className="grid grid-cols-[2.5rem_minmax(0,1fr)_4rem_3rem_4.5rem] items-center gap-2 border-b border-rule py-1">
                  <span>{entry.registryIndex}</span>
                  <span className="truncate">{entry.plugin}</span>
                  <span>{truncateDecimals(Number(wei(entry.takeWad)) / 1e16)}</span>
                  <span>{entry.role}</span>
                  <span className={entry.suspended ? "text-error" : "text-accent-strong"}>
                    {entry.suspended ? "suspended" : "active"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-sm text-ink-muted">Registry mirror is empty until the indexer syncs.</p>
          )}
        </Card>

        <Card title="Governance">
          {governance.data?.state ? (
            <ul className="m-0 grid list-none gap-1 p-0 font-mono text-xs">
              <li className="flex justify-between"><span className="text-ink-muted">economic version</span><strong>{governance.data.state.economicVersion}</strong></li>
              <li className="flex justify-between"><span className="text-ink-muted">protocol recipient</span><strong>{governance.data.state.protocolRecipient.slice(0, 12)}…</strong></li>
              <li className="flex justify-between"><span className="text-ink-muted">trusted operator</span><strong>{governance.data.state.trustedOperator.slice(0, 12)}…</strong></li>
              <li className="flex justify-between"><span className="text-ink-muted">administrator</span><strong>{governance.data.state.administrator.slice(0, 12)}…</strong></li>
              <li className="flex justify-between"><span className="text-ink-muted">delay</span><strong>{governance.data.state.governanceDelaySeconds ? `${Number(governance.data.state.governanceDelaySeconds) / 3600}h` : "—"}</strong></li>
            </ul>
          ) : (
            <p className="m-0 text-sm text-ink-muted">No governance state indexed yet.</p>
          )}
          {governance.data && governance.data.operations.length > 0 ? (
            <ul className="m-0 mt-2 grid list-none gap-1 border-t border-rule p-0 pt-2 font-mono text-[0.68rem]">
              {governance.data.operations.slice(0, 5).map((operation) => (
                <li key={operation.operationId} className="flex justify-between gap-2">
                  <span className="truncate">{operation.action} · {operation.status}</span>
                  <span className="text-ink-muted">{relativeDay(operation.readyAt)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>

        <Card title="Keeper jobs (backend-computed)">
          {jobs.data && jobs.data.jobs.length > 0 ? (
            <ul className="m-0 list-none p-0 font-mono text-xs">
              {jobs.data.jobs.slice(0, 10).map((job, index) => (
                <li key={`${job.kind}-${job.poolId}-${index}`} className="flex flex-wrap items-center justify-between gap-2 border-b border-rule py-1.5">
                  <span className="font-bold uppercase">{job.kind}</span>
                  <Link className="truncate underline" href={`/tokens/${job.poolId}`}>{job.poolId.slice(0, 16)}…</Link>
                  {job.incentiveWei ? <span className="text-accent-strong">tip {formatCompactEth(job.incentiveWei, 4)} ETH</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-sm text-ink-muted">No keeper signals pending — pots empty, no graduations due.</p>
          )}
          <p className="m-0 text-xs text-ink-muted">
            flushTo / graduate / collectFees are permissionless; zero-work calls are no-op successes.
          </p>
        </Card>

        <Card title="Global revenue history">
          <RevenueHistoryCard />
        </Card>

        <Card title="60-day activity">
          {stats.data && stats.data.daily.length > 0 ? (
            <ul className="m-0 list-none p-0 font-mono text-xs">
              <li className="grid grid-cols-[4.5rem_1fr_1fr_4rem_5rem_5rem] gap-2 border-b-2 border-ink py-1 font-bold">
                <span>day</span><span>buy</span><span>sell</span><span>swaps</span><span>creator</span><span>grad</span>
              </li>
              {stats.data.daily.slice(0, 14).map((day) => (
                <li key={day.day} className="grid grid-cols-[4.5rem_1fr_1fr_4rem_5rem_5rem] gap-2 border-b border-rule py-1">
                  <span>{day.day.slice(0, 10)}</span>
                  <span>{formatCompactEth(day.buyVolumeEth, 1)}</span>
                  <span>{formatCompactEth(day.sellVolumeEth, 1)}</span>
                  <span>{day.swapCount}</span>
                  <span>{formatCompactEth(day.creatorRevenueEth, 1)}</span>
                  <span>{day.graduationCount}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-sm text-ink-muted">No daily aggregates yet.</p>
          )}
        </Card>
      </div>
    </main>
  );
}

function relativeDay(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

const HISTORY_KINDS = ["creator", "protocol", "claims", "tips", "pluginPayouts", "pots"] as const;

function RevenueHistoryCard() {
  const [kind, setKind] = useState<(typeof HISTORY_KINDS)[number]>("protocol");
  const history = useRevenueHistory(kind);
  const rows = history.data?.data ?? [];
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-1" role="group" aria-label="History kind">
        {HISTORY_KINDS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={kind === option}
            className={[
              "min-h-8 cursor-pointer rounded-sm border px-2 py-1 text-xs font-bold",
              kind === option ? "border-ink bg-ink text-inverse" : "border-rule text-ink-muted",
            ].join(" ")}
            onClick={() => setKind(option)}
          >
            {option}
          </button>
        ))}
      </div>
      <p className="m-0 text-xs text-ink-muted">
        Audit feed (insert-only fact rows). Revenue sums must use accruals + claims only — graduates,
        feeRoutings and potFundings carry amounts as audit detail, never add them with accruals.
      </p>
      {rows.length > 0 ? (
        <ul className="m-0 list-none p-0 font-mono text-xs">
          {rows.slice(0, 8).map((row, index) => (
            <li key={index} className="flex flex-wrap justify-between gap-2 border-b border-rule py-1.5">
              <span className="truncate">
                {row.pool_id ? (
                  <Link className="underline" href={`/tokens/${String(row.pool_id)}`}>
                    {String(row.pool_id).slice(0, 14)}…
                  </Link>
                ) : row.recipient ? (
                  String(row.recipient)
                ) : (
                  "—"
                )}
              </span>
              <strong>
                {formatCompactEth(
                  String(row.amount ?? row.amount_wei ?? row.current_share ?? "0"),
                  4,
                )}{" "}
                ETH
              </strong>
              <span className="text-ink-muted">{String(row.timestamp ?? "").slice(0, 16)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-sm text-ink-muted">No {kind} rows yet.</p>
      )}
    </div>
  );
}
