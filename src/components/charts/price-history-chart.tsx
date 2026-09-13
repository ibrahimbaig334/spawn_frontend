"use client";

import { useEffect, useMemo, useState, type PointerEvent } from "react";
import { useCandles } from "@/lib/queries";
import type { CandleInterval } from "@/lib/api/dto";
import type { PoolStream } from "@/lib/use-pool-stream";
import { formatSubscriptPrice } from "@/lib/format";
import { formatUtc } from "@/lib/display";

const INTERVALS: CandleInterval[] = ["1m", "5m", "15m", "1h", "4h", "1d"];

interface PlotPoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  buyVolume: string;
  sellVolume: string;
  trades: string;
}

function candleToPoint(c: {
  time: string;
  openEth: string | null;
  highEth: string | null;
  lowEth: string | null;
  closeEth: string | null;
  buyVolumeEth: string;
  sellVolumeEth: string;
  swapCount: string;
}): PlotPoint | null {
  const open = Number(c.openEth ?? 0);
  const close = Number(c.closeEth ?? 0);
  const high = Number(c.highEth ?? Math.max(open, close));
  const low = Number(c.lowEth ?? Math.min(open, close));
  const time = Date.parse(c.time);
  if (!Number.isFinite(time) || (open === 0 && close === 0)) return null;
  return {
    time,
    open,
    high: Math.max(high, open, close),
    low: low > 0 ? Math.min(low, open, close) : Math.min(open, close),
    close,
    buyVolume: c.buyVolumeEth,
    sellVolume: c.sellVolumeEth,
    trades: c.swapCount,
  };
}

export function PriceHistoryChart({
  tokenRef,
  stream,
}: {
  tokenRef: string;
  poolId: string;
  stream: PoolStream | null;
}) {
  const [interval, setInterval] = useState<CandleInterval>("1m");
  const [selectedTime, setSelectedTime] = useState<number | null>(null);
  const candles = useCandles(tokenRef, interval, interval === "1m" ? 300 : 500);

  // Live 1m splice (guide §11): bar updates merge into the last candle. The
  // state is keyed by interval so switching needs no synchronous reset.
  const [live, setLive] = useState<{ interval: CandleInterval; point: PlotPoint } | null>(null);
  const livePoint = live?.interval === interval ? live.point : null;
  useEffect(() => {
    if (!stream || interval !== "1m") return;
    return stream.subscribeMessage((message) => {
      if (message.type === "bar" || message.type === "bar_close") {
        const open = Number(message.open ?? 0);
        const close = Number(message.close ?? 0);
        if (!open || !close) return;
        setLive({
          interval: "1m",
          point: {
            time: message.start * 1000,
            open,
            high: Number(message.high ?? Math.max(open, close)),
            low: Number(message.low ?? Math.min(open, close)),
            close,
            buyVolume: message.volEth,
            sellVolume: "0",
            trades: String(message.trades),
          },
        });
      }
    });
  }, [stream, interval]);

  const points = useMemo<PlotPoint[]>(() => {
    const base = (candles.data?.candles ?? [])
      .map(candleToPoint)
      .filter((p): p is PlotPoint => p !== null);
    if (interval === "1m" && livePoint) {
      const last = base.at(-1);
      if (last && last.time === livePoint.time) {
        return [...base.slice(0, -1), livePoint];
      }
      if (!last || livePoint.time >= last.time) return [...base, livePoint];
    }
    return base;
  }, [candles.data, interval, livePoint]);

  const scaled = useMemo(() => {
    const values = points.flatMap((p) => [p.high, p.low]);
    const max = values.length ? Math.max(...values) : 1;
    const min = values.length ? Math.min(...values) : 0;
    const span = max - min || max || 1;
    const firstTime = points[0]?.time ?? 0;
    const lastTime = points.at(-1)?.time ?? firstTime;
    const timeSpan = lastTime - firstTime || 1;
    return points.map((p) => ({
      ...p,
      x: (p.time - firstTime) / timeSpan,
      y: (max - p.high) / span,
      height: Math.max((p.high - p.low) / span, 0.004),
      bodyTop: (max - Math.max(p.open, p.close)) / span,
      bodyHeight: Math.max((Math.abs(p.close - p.open) / span), 0.004),
      rising: p.close >= p.open,
    }));
  }, [points]);

  const selected = scaled.find((p) => p.time === selectedTime) ?? null;
  const latest = scaled.at(-1) ?? null;
  const first = scaled[0] ?? null;
  const change =
    first && latest && first.open > 0
      ? ((latest.close - first.open) / first.open) * 100
      : 0;

  return (
    <section
      className="border-t-2 border-ink py-[clamp(1.5rem,4vw,3rem)] print:break-inside-avoid"
      aria-label="Price history"
    >
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="m-0 font-mono text-[0.68rem] font-bold tracking-[0.08em] text-accent-strong uppercase">
            Market candles
          </p>
          <h2 className="mt-1 mb-0 text-[clamp(1.4rem,3.4vw,2rem)]">Price history</h2>
          <p className="mt-1 mb-0 font-mono text-xs text-ink-muted">
            {latest
              ? `${formatSubscriptPrice(latest.close.toFixed(18))} ETH · live via stream${
                  stream?.connected ? " ✓" : " (reconnecting…)"
                }`
              : "No trades yet"}
            {scaled.length > 1
              ? ` · ${change > 0 ? "+" : ""}${change.toFixed(2)}% over range`
              : ""}
          </p>
        </div>
        <div
          className="flex gap-1 [&_button]:min-h-10 [&_button]:cursor-pointer [&_button]:border [&_button]:border-rule [&_button]:px-3 [&_button]:py-1 [&_button]:text-xs [&_button]:font-bold [&_button[aria-pressed=true]]:border-ink [&_button[aria-pressed=true]]:bg-ink [&_button[aria-pressed=true]]:text-inverse"
          role="group"
          aria-label="Candle interval"
        >
          {INTERVALS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={interval === value}
              onClick={() => {
                setInterval(value);
                setSelectedTime(null);
              }}
            >
              {value}
            </button>
          ))}
        </div>
      </header>

      {scaled.length > 0 ? (
        <svg
          className="mt-4 h-64 w-full text-ink"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          role="img"
          aria-label={`Candlestick chart, ${scaled.length} ${interval} candles`}
        >
          {scaled.map((point) => {
            const width = Math.max(60 / scaled.length, 0.35);
            return (
              <g key={point.time}>
                <line
                  x1={point.x * 100}
                  x2={point.x * 100}
                  y1={point.y * 100}
                  y2={(point.y + point.height) * 100}
                  stroke={point.rising ? "#3ecf6f" : "#e5484d"}
                  strokeWidth="0.25"
                />
                <rect
                  x={point.x * 100 - width / 2}
                  y={point.bodyTop * 100}
                  width={width}
                  height={point.bodyHeight * 100}
                  fill={selectedTime === point.time ? "var(--color-focus)" : point.rising ? "#3ecf6f" : "#e5484d"}
                  onPointerDown={(event: PointerEvent<SVGRectElement>) => {
                    event.preventDefault();
                    setSelectedTime(point.time);
                  }}
                  style={{ cursor: "pointer" }}
                />
              </g>
            );
          })}
        </svg>
      ) : (
        <p className="mt-4 border border-rule bg-raised p-6 text-center text-sm text-ink-muted">
          No candles for this interval yet — the chart fills in as trades settle.
        </p>
      )}

      {selected ? (
        <dl className="mt-3 grid grid-cols-4 gap-2 border border-rule bg-raised p-3 text-sm max-[48rem]:grid-cols-2">
          <div>
            <dt className="text-xs text-ink-muted">Time</dt>
            <dd className="m-0 font-mono font-bold">{formatUtc(new Date(selected.time).toISOString())}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">Open → Close</dt>
            <dd className="m-0 font-mono font-bold">
              {formatSubscriptPrice(selected.open.toFixed(18))} → {formatSubscriptPrice(selected.close.toFixed(18))} ETH
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">High / Low</dt>
            <dd className="m-0 font-mono font-bold">
              {formatSubscriptPrice(selected.high.toFixed(18))} / {formatSubscriptPrice(selected.low.toFixed(18))}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">Swaps</dt>
            <dd className="m-0 font-mono font-bold">{selected.trades}</dd>
          </div>
        </dl>
      ) : null}
      {candles.isError ? (
        <p className="mt-2 text-xs font-semibold text-error" role="status">
          Candles unavailable: {(candles.error as Error).message}
        </p>
      ) : null}
    </section>
  );
}
