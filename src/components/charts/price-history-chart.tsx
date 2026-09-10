"use client";

import {
  useId,
  useMemo,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { formatDemoUtc } from "@/domain/demo-time";
import { formatDecimal, parseDecimal } from "@/domain/economics";
import type { HistoryRange } from "@/domain/selectors";
import type { Launch, MarketHistoryPoint } from "@/types/launch";

const RANGES: HistoryRange[] = ["1D", "7D", "30D", "All"];
const SCALE = 10n ** 18n;
type ChartPoint = MarketHistoryPoint & {
  price: string;
  scaled: bigint;
  x: number;
  y: number;
};

function priceFor(
  valuation: string,
  supply: string,
): { price: string; scaled: bigint } {
  const value = parseDecimal(valuation) ?? 0n;
  const supplyValue = parseDecimal(supply) ?? 1n;
  const scaled = supplyValue > 0n ? (value * SCALE) / supplyValue : 0n;
  return { price: formatDecimal(scaled, 18, 12), scaled };
}
function withinRange(
  points: MarketHistoryPoint[],
  range: HistoryRange,
): MarketHistoryPoint[] {
  if (range === "All" || points.length < 2) return points;
  const latest = points.at(-1);
  if (!latest) return points;
  const days = range === "1D" ? 1 : range === "7D" ? 7 : 30;
  const cutoff = Date.parse(latest.recordedAt) - days * 86_400_000;
  const index = points.findIndex(
    (point) => Date.parse(point.recordedAt) >= cutoff,
  );
  return index > 0 ? points.slice(index - 1) : points;
}

export function PriceHistoryChart({
  launch,
  points,
}: {
  launch: Launch;
  points: MarketHistoryPoint[];
}) {
  const [range, setRange] = useState<HistoryRange>("30D");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const series = useMemo<ChartPoint[]>(() => {
    const ranged = withinRange(points, range);
    const priced = ranged.map((point) => ({
      ...point,
      ...priceFor(point.valuationEth, launch.supply),
    }));
    const values = priced.map(({ scaled }) => scaled);
    const minimum = values.reduce(
      (result, value) => (value < result ? value : result),
      values[0] ?? 0n,
    );
    const maximum = values.reduce(
      (result, value) => (value > result ? value : result),
      values[0] ?? 0n,
    );
    const span = maximum - minimum;
    return priced.map((point, index) => {
      const x =
        priced.length < 2 ? 410 : 50 + (index * 720) / (priced.length - 1);
      const ratio =
        span === 0n
          ? 5_000
          : Number(((point.scaled - minimum) * 10_000n) / span);
      return { ...point, x, y: 260 - (ratio * 230) / 10_000 };
    });
  }, [launch.supply, points, range]);
  const explicitSelectedIndex = series.findIndex(({ id }) => id === selectedId);
  const selectedIndex =
    explicitSelectedIndex >= 0
      ? explicitSelectedIndex
      : Math.max(0, series.length - 1);
  const selected = series[selectedIndex];
  const first = series[0];
  const last = series.at(-1);
  const direction =
    !first || !last || first.scaled === last.scaled
      ? "flat"
      : last.scaled > first.scaled
        ? "up"
        : "down";
  const minimum = series.reduce<ChartPoint | undefined>(
    (result, point) =>
      !result || point.scaled < result.scaled ? point : result,
    undefined,
  );
  const maximum = series.reduce<ChartPoint | undefined>(
    (result, point) =>
      !result || point.scaled > result.scaled ? point : result,
    undefined,
  );
  const path = series
    .map(
      ({ x, y }, index) =>
        `${index ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`,
    )
    .join(" ");
  const description = `${range} history is ${direction}; ${series.length} points, minimum ${minimum?.price ?? "0"} ETH and maximum ${maximum?.price ?? "0"} ETH per token.`;

  function move(index: number) {
    const point = series[Math.max(0, Math.min(series.length - 1, index))];
    if (point) setSelectedId(point.id);
  }
  function onKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "Home") move(0);
    else if (event.key === "End") move(series.length - 1);
    else move(selectedIndex + (event.key === "ArrowRight" ? 1 : -1));
  }
  function onPointer(event: PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 800;
    move(
      series.reduce(
        (best, point, index) =>
          Math.abs(point.x - x) < Math.abs((series[best]?.x ?? 0) - x)
            ? index
            : best,
        0,
      ),
    );
  }

  return (
    <figure className="m-0 border-y border-rule py-6">
      <figcaption className="flex items-end justify-between gap-4 max-[38rem]:items-start max-[38rem]:flex-col">
        <div>
          <p className="m-0 font-mono text-[0.68rem] font-bold tracking-[0.08em] text-accent-strong uppercase">
            Demo price history
          </p>
          <h2 className="mt-1 mb-0 text-[clamp(1.4rem,3vw,2rem)]">
            Price per {launch.symbol}
          </h2>
        </div>
        {selected ? (
          <p className="m-0 grid justify-items-end max-[38rem]:justify-items-start">
            <strong className="font-mono">{selected.price} ETH</strong>
            <span className="text-xs text-ink-muted">
              {formatDemoUtc(selected.recordedAt)}
            </span>
          </p>
        ) : null}
      </figcaption>
      <div
        className="mt-4 flex print:hidden [&_button]:min-h-target [&_button]:min-w-target [&_button]:cursor-pointer [&_button]:border [&_button]:border-rule [&_button]:bg-raised [&_button]:px-3 [&_button]:py-2 [&_button]:text-ink [&_button+button]:border-l-0 [&_button[aria-pressed=true]]:border-ink [&_button[aria-pressed=true]]:bg-ink [&_button[aria-pressed=true]]:text-inverse"
        aria-label="History range"
      >
        {RANGES.map((item) => (
          <button
            aria-pressed={range === item}
            key={item}
            onClick={() => {
              setRange(item);
              setSelectedId(null);
            }}
            type="button"
          >
            {item}
          </button>
        ))}
      </div>
      {series.length ? (
        <svg
          aria-describedby={descriptionId}
          aria-labelledby={titleId}
          className="mt-3 block min-h-56 w-full touch-pan-y border border-rule bg-raised max-[38rem]:min-h-44 print:max-h-52 forced-colors:[&_line]:stroke-[CanvasText] forced-colors:[&_path]:stroke-[CanvasText]"
          onKeyDown={onKeyDown}
          onPointerDown={onPointer}
          onPointerMove={(event) => {
            if (event.pointerType === "mouse" || event.buttons)
              onPointer(event);
          }}
          role="img"
          tabIndex={0}
          viewBox="0 0 800 300"
        >
          <title id={titleId}>{`${launch.name} demo price history`}</title>
          <desc id={descriptionId}>{description}</desc>
          {[30, 87.5, 145, 202.5, 260].map((y) => (
            <line
              className="stroke-rule stroke-1 [vector-effect:non-scaling-stroke]"
              key={y}
              x1="50"
              x2="770"
              y1={y}
              y2={y}
            />
          ))}
          <path
            className="fill-none stroke-accent-strong stroke-2 [stroke-linecap:square] [stroke-linejoin:round] [vector-effect:non-scaling-stroke]"
            d={path}
          />
          {selected ? (
            <>
              <line
                className="stroke-ink-muted stroke-1 [stroke-dasharray:4_4] [vector-effect:non-scaling-stroke]"
                x1={selected.x}
                x2={selected.x}
                y1="30"
                y2="260"
              />
              <circle
                className="fill-accent-strong stroke-raised stroke-[3] [vector-effect:non-scaling-stroke] forced-colors:fill-[Highlight] forced-colors:stroke-[Canvas]"
                cx={selected.x}
                cy={selected.y}
                r="7"
              />
            </>
          ) : null}
        </svg>
      ) : (
        <p className="border border-rule bg-raised px-4 py-16 text-center">
          No history points are available.
        </p>
      )}
      <p className="mt-2 mb-0 text-xs text-ink-muted">{description}</p>
      <details className="mt-4 border-t border-rule">
        <summary className="min-h-target cursor-pointer py-3 font-bold">
          View exact history data
        </summary>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse font-mono text-xs">
            <caption className="py-2 text-left">
              {launch.name} exact demo prices for {range}
            </caption>
            <thead>
              <tr className="bg-surface-strong">
                <th className="border border-rule p-2 text-left" scope="col">
                  UTC time
                </th>
                <th className="border border-rule p-2 text-left" scope="col">
                  Price
                </th>
                <th className="border border-rule p-2 text-left" scope="col">
                  Total-supply valuation
                </th>
              </tr>
            </thead>
            <tbody>
              {series.map((point) => (
                <tr key={point.id}>
                  <td className="border border-rule p-2 whitespace-nowrap">
                    {formatDemoUtc(point.recordedAt)}
                  </td>
                  <td className="border border-rule p-2 whitespace-nowrap">
                    {point.price} ETH
                  </td>
                  <td className="border border-rule p-2 whitespace-nowrap">
                    {point.valuationEth} ETH
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
