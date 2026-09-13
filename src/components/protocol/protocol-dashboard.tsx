"use client";

import Link from "next/link";
import { useState } from "react";
import {
  useEconomics,
  usePayoutPlugins,
  useProtocolAddresses,
  useProtocolRevenue,
  useProtocolStats,
  useRevenueHistory,
  useWatermark,
} from "@/lib/queries";
import { formatCompactEth, formatUsdApproxFromEthWei, relativeTime, wei } from "@/lib/display";
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

/** Friendly plugin name; on-chain identity stays out of the UI. */
function pluginName(plugin: string, buyback: string | null | undefined): string {
  if (buyback && plugin.toLowerCase() === buyback.toLowerCase()) return "Buyback & burn";
  return "Payout plugin";
}

export function ProtocolDashboard() {
  const economics = useEconomics();
  const plugins = usePayoutPlugins();
  const revenue = useProtocolRevenue();
  const stats = useProtocolStats();
  const watermark = useWatermark();
  // Only the buyback address is read (to name the plugin); nothing on-chain
  // is displayed.
  const addresses = useProtocolAddresses();
  const buyback = addresses.data?.buybackAndBurnPlugin ?? null;

  return (
    <main className={`${PAGE} py-12 pb-24`} id="main-content">
      <header className="mb-8 border-b-2 border-ink pb-6">
        <p className="m-0 font-mono text-[0.68rem] font-bold uppercase tracking-[0.08em] text-accent-strong">
          How Spawn works
        </p>
        <h1 className="my-2 text-[clamp(2rem,5vw,3.25rem)] font-black tracking-[-0.04em]">
          Protocol
        </h1>
        <p className="m-0 max-w-2xl text-ink-muted">
          Every token launches on the same terms: a fixed supply, a 1% trading fee, and
          milestone payouts that split between plugins and the creator.
        </p>
      </header>

      <StatusRegion className="mb-6">
        {watermark.error instanceof ApiError && watermark.error.code === "WATERMARK_NOT_FOUND" ? (
          <StatusMessage tone="warning" title="Still syncing">
            Market data is still loading for the first time — check back in a minute.
          </StatusMessage>
        ) : null}
      </StatusRegion>

      <div className="grid grid-cols-2 gap-5 max-[60rem]:grid-cols-1">
        <Card title="Fee split">
          {economics.data ? (
            <ul className="m-0 grid list-none gap-1 p-0 font-mono text-xs">
              <li className="flex justify-between"><span className="text-ink-muted">trading fee</span><strong>1%</strong></li>
              <li className="flex justify-between"><span className="text-ink-muted">milestone service fee</span><strong>{wadPercent(economics.data.current.harvestServiceFeeWad)}</strong></li>
              <li className="flex justify-between"><span className="text-ink-muted">trade revenue → creator</span><strong>{wadPercent(economics.data.current.quoteCreatorShareWad)}</strong></li>
              <li className="flex justify-between"><span className="text-ink-muted">token revenue → milestones</span><strong>{wadPercent(economics.data.current.tokenMilestoneFundShareWad)}</strong></li>
            </ul>
          ) : (
            <p className="m-0 text-sm text-ink-muted">Loading…</p>
          )}
        </Card>

        <Card title="Protocol earnings">
          {revenue.data?.totals ? (
            <ul className="m-0 grid list-none gap-1 p-0 font-mono text-xs">
              <li className="flex justify-between"><span className="text-ink-muted">earned</span><strong>{formatUsdApproxFromEthWei(revenue.data.totals.accrued)}</strong></li>
              <li className="flex justify-between"><span className="text-ink-muted">claimed</span><strong>{formatUsdApproxFromEthWei(revenue.data.totals.claimed)}</strong></li>
            </ul>
          ) : (
            <p className="m-0 text-sm text-ink-muted">No protocol earnings yet.</p>
          )}
        </Card>

        <Card title={`Payout plugins (${plugins.data?.length ?? 0})`}>
          {plugins.data && plugins.data.length > 0 ? (
            <ul className="m-0 list-none p-0 font-mono text-xs">
              {plugins.data
                .filter((entry) => entry.role === "PAYOUT" && !entry.suspended)
                .map((entry) => (
                  <li key={entry.registryIndex} className="flex items-center justify-between gap-2 border-b border-rule py-1.5">
                    <span className="font-bold">{pluginName(entry.plugin, buyback)}</span>
                    <span className="text-ink-muted">takes {wadPercent(entry.takeWad)} of each payout</span>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="m-0 text-sm text-ink-muted">The plugin list is still loading.</p>
          )}
          <p className="m-0 text-xs text-ink-muted">
            Creators pick plugins at launch; whatever is left always goes to the creator.
          </p>
        </Card>

        <Card title="Data status">
          {watermark.data ? (
            <ul className="m-0 grid list-none gap-1 p-0 font-mono text-xs">
              <li className="flex justify-between"><span className="text-ink-muted">status</span><strong className="text-accent-strong">up to date</strong></li>
              <li className="flex justify-between"><span className="text-ink-muted">last update</span><strong>{relativeTime(watermark.data.blockTime)}</strong></li>
            </ul>
          ) : (
            <p className="m-0 text-sm text-ink-muted">Loading…</p>
          )}
          <div className="flex gap-3 text-xs font-bold">
            <Link className="underline" href="/tokens">Browse markets →</Link>
          </div>
        </Card>

        <Card title="Recent payouts">
          <RevenueHistoryCard />
        </Card>

        <Card title="Recent activity">
          {stats.data && stats.data.daily.length > 0 ? (
            <ul className="m-0 list-none p-0 font-mono text-xs">
              <li className="grid grid-cols-[4.5rem_1fr_1fr_4rem] gap-2 border-b-2 border-ink py-1 font-bold">
                <span>day</span><span>bought</span><span>sold</span><span>trades</span>
              </li>
              {stats.data.daily.slice(0, 14).map((day) => (
                <li key={day.day} className="grid grid-cols-[4.5rem_1fr_1fr_4rem] gap-2 border-b border-rule py-1">
                  <span>{day.day.slice(0, 10)}</span>
                  <span>{formatCompactEth(day.buyVolumeEth, 1)} ETH</span>
                  <span>{formatCompactEth(day.sellVolumeEth, 1)} ETH</span>
                  <span>{day.swapCount}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-sm text-ink-muted">No trading activity yet.</p>
          )}
        </Card>
      </div>
    </main>
  );
}

const HISTORY_OPTIONS = [
  { value: "pluginPayouts", label: "Payouts" },
  { value: "claims", label: "Claims" },
  { value: "creator", label: "Creator earnings" },
  { value: "protocol", label: "Protocol earnings" },
] as const;

function RevenueHistoryCard() {
  const [kind, setKind] = useState<(typeof HISTORY_OPTIONS)[number]["value"]>("pluginPayouts");
  const history = useRevenueHistory(kind);
  const rows = history.data?.data ?? [];
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-1" role="group" aria-label="Payout kind">
        {HISTORY_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={kind === option.value}
            className={[
              "min-h-8 cursor-pointer rounded-sm border px-2 py-1 text-xs font-bold",
              kind === option.value ? "border-ink bg-ink text-inverse" : "border-rule text-ink-muted",
            ].join(" ")}
            onClick={() => setKind(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {rows.length > 0 ? (
        <ul className="m-0 list-none p-0 font-mono text-xs">
          {rows.slice(0, 8).map((row, index) => (
            <li key={index} className="flex flex-wrap justify-between gap-2 border-b border-rule py-1.5">
              <span className="truncate">
                {row.pool_id ? (
                  <Link className="underline" href={`/tokens/${String(row.pool_id)}`}>
                    View token
                  </Link>
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
        <p className="m-0 text-sm text-ink-muted">Nothing here yet.</p>
      )}
    </div>
  );
}
