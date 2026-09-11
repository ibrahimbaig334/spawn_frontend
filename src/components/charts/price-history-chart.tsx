"use client";

import {
  useId,
  useMemo,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { formatDemoUtc } from "@/domain/demo-time";
import { formatDecimal } from "@/domain/economics";
import { formatSubscriptPrice } from "@/lib/format";
import { ethPerTokenWei } from "@/protocol/level-math";
import type { LaunchRecord } from "@/services/launchpad-client";
import type { HoldingLedgerEntry } from "@/types/demo";

export type HistoryRange = "1D" | "7D" | "30D" | "All";
const RANGES: HistoryRange[] = ["1D", "7D", "30D", "All"];

type ChartPoint = HoldingLedgerEntry & {
  price: string;
  scaled: bigint;
  x: number;
  y: number;
};

function withinRange(
  points: HoldingLedgerEntry[],
  range: HistoryRange,
): HoldingLedgerEntry[] {
  if (range === "All" || points.length < 2) return points;
  const latest = points.at(-1);
  if (!latest) return points;
  const days = range === "1D" ? 1 : range === "7D" ? 7 : 30;
  const cutoff = Date.parse(latest.occurredAt) - days * 86_400_000;
  const index = points.findIndex(
    (point) => Date.parse(point.occurredAt) >= cutoff,
  );
  return index > 0 ? points.slice(index - 1) : points;
}

export function PriceHistoryChart({
  launch,
  points,
}: {
  launch: LaunchRecord;
  points: HoldingLedgerEntry[];
}) {
  const [range, setRange] = useState<HistoryRange>("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const series = useMemo<ChartPoint[]>(() => {
    const ranged = withinRange(points, range);
    const priced = ranged.map((point) => {
      const scaled = ethPerTokenWei(point.levelAfter);
      return {
        ...point,
        price: formatDecimal(scaled, 18, 12),
        scaled,
        x: 0,
        y: 0,
      };
    });
    const prices = priced.map((point) => point.scaled);
    const max = prices.length ? prices.reduce((a, b) => (a > b ? a : b)) : 1n;
    const min = prices.length ? prices.reduce((a, b) => (a < b ? a : b)) : 0n;
    const span = max > min ? max - min : 1n;
    return priced.map((point, index) => ({
      ...point,
      x: priced.length > 1 ? index / (priced.length - 1) : 0,
      y: Number(((max - point.scaled) * 100n) / span) / 100,
    }));
  }, [points, range]);

  const selected = series.find((point) => point.id === selectedId) ?? null;
  const latest = series.at(-1) ?? null;
  const first = series.at(0) ?? null;
  const change =
    first && latest && first.scaled > 0n
      ? Number(((latest.scaled - first.scaled) * 10_000n) / first.scaled) / 100
      : 0;

  function handleKeyDown(
    event: KeyboardEvent<SVGCircleElement>,
    index: number,
  ): void {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const next = series[index + (event.key === "ArrowRight" ? 1 : -1)];
      if (next) setSelectedId(next.id);
    }
  }

  return (
    <section
      className="border-t-2 border-ink py-[clamp(2rem,5vw,4rem)] print:break-inside-avoid"
      aria-labelledby={titleId}
    >
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="m-0 font-mono text-[0.68rem] font-bold tracking-[0.08em] text-accent-strong uppercase">
            Level-derived price
          </p>
          <h2 className="mt-1 mb-0 text-[clamp(1.6rem,4vw,2.6rem)]" id={titleId}>
            Price history
          </h2>
          <p className="mt-1 mb-0 font-mono text-xs text-ink-muted">
            {latest
              ? `1.0001^${launch.level} = ${formatSubscriptPrice(latest.price)} ETH`
              : "—"}
            {series.length > 1 ? ` · ${change > 0 ? "+" : ""}${change}% over range` : ""}
          </p>
        </div>
        <div
          className="flex gap-1 [&_button]:min-h-10 [&_button]:cursor-pointer [&_button]:border [&_button]:border-rule [&_button]:px-3 [&_button]:py-1 [&_button]:text-xs [&_button]:font-bold [&_button[aria-pressed=true]]:border-ink [&_button[aria-pressed=true]]:bg-ink [&_button[aria-pressed=true]]:text-inverse"
          role="group"
          aria-label="Chart range"
        >
          {RANGES.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={range === value}
              onClick={() => setRange(value)}
            >
              {value}
            </button>
          ))}
        </div>
      </header>
      <p id={descriptionId} className="sr-only">
        Line chart of the token price derived from each recorded level. Use
        arrow keys on a point for detail.
      </p>
      {series.length ? (
        <svg
          className="mt-4 h-64 w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          role="img"
          aria-labelledby={`${titleId} ${descriptionId}`}
        >
          <polyline
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.6"
            points={series
              .map((point) => `${point.x},${point.y}`)
              .join(" ")}
          />
          {series.map((point, index) => (
            <circle
              key={point.id}
              cx={point.x}
              cy={point.y}
              r={selectedId === point.id ? 1.1 : 0.55}
              fill={selectedId === point.id ? "var(--color-accent)" : "currentColor"}
              stroke="none"
              tabIndex={0}
              role="button"
              aria-label={`Level ${point.levelAfter}, price ${point.price} ETH, ${formatDemoUtc(point.occurredAt)}`}
              onKeyDown={(event) => handleKeyDown(event, index)}
              onPointerDown={(event: PointerEvent<SVGCircleElement>) => {
                event.preventDefault();
                setSelectedId(point.id);
              }}
              onFocus={() => setSelectedId(point.id)}
            />
          ))}
        </svg>
      ) : (
        <p className="mt-4 border border-rule bg-raised p-6 text-center text-sm text-ink-muted">
          No recorded trades yet — the chart plots one point per simulated
          trade.
        </p>
      )}
      {selected ? (
        <dl className="mt-3 grid grid-cols-3 gap-2 border border-rule bg-raised p-3 text-sm max-[34rem]:grid-cols-1">
          <div>
            <dt className="text-xs text-ink-muted">Level</dt>
            <dd className="m-0 font-mono font-bold">{selected.levelAfter}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">Price</dt>
            <dd className="m-0 font-mono font-bold">
              {formatSubscriptPrice(selected.price)} ETH
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">Recorded</dt>
            <dd className="m-0 font-mono font-bold">
              {formatDemoUtc(selected.occurredAt)}
            </dd>
          </div>
        </dl>
      ) : null}
    </section>
  );
}
