"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCandles } from "@/lib/queries";
import type { CandleInterval } from "@/lib/api/dto";
import type { PoolStream } from "@/lib/use-pool-stream";

const INTERVALS: CandleInterval[] = ["1m", "5m", "15m", "1h", "4h", "1d"];

const UP = "#26a69a";
const DOWN = "#ef5350";
const GRID = "rgba(140, 145, 155, 0.18)";
const AXIS_TEXT = "#8a8f98";
const CROSSHAIR = "rgba(140, 145, 155, 0.55)";

interface Point {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function toPoint(c: {
  time: string;
  openEth: string | null;
  highEth: string | null;
  lowEth: string | null;
  closeEth: string | null;
  buyVolumeEth: string;
  sellVolumeEth: string;
}): Point | null {
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
    volume: Number(c.buyVolumeEth ?? 0) + Number(c.sellVolumeEth ?? 0),
  };
}

/** Compact axis price: plain decimals down to cents, exponential below. */
export function axisPrice(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "0";
  const abs = Math.abs(value);
  if (abs >= 1000) return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (abs >= 1) return value.toFixed(2);
  if (abs >= 0.01) return value.toFixed(4);
  return value.toExponential(2).replace("e-0", "e-").replace("e-", "e−");
}

function niceTicks(min: number, max: number, count: number): number[] {
  const span = max - min || Math.abs(max) || 1;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const norm = step0 / mag;
  const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 0.5; v += step) {
    ticks.push(Number(v.toPrecision(12)));
  }
  return ticks.length > 1 ? ticks : [min, max];
}

function timeLabel(time: number, spanMs: number): string {
  const d = new Date(time);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  if (spanMs > 3 * 86_400_000) return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
  return `${hh}:${mm}`;
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
  const [hover, setHover] = useState<number | null>(null);
  const candles = useCandles(tokenRef, interval, interval === "1m" ? 300 : 500);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);

  const [live, setLive] = useState<{ interval: CandleInterval; point: Point } | null>(null);
  const livePoint = live?.interval === interval ? live.point : null;
  useEffect(() => {
    if (!stream || interval !== "1m") return;
    return stream.subscribeMessage((message) => {
      if (message.type === "bar" || message.type === "bar_close") {
        const open = Number(message.open ?? 0);
        const close = Number(message.close ?? 0);
        if (!open || !close) return;
        const high = Number(message.high ?? Math.max(open, close));
        const low = Number(message.low ?? Math.min(open, close));
        setLive({
          interval: "1m",
          point: {
            time: message.start * 1000,
            open,
            high: Math.max(high, open, close),
            low: Math.min(low, open, close),
            close,
            volume: Number(message.volEth ?? 0),
          },
        });
      }
    });
  }, [stream, interval]);

  const points = useMemo<Point[]>(() => {
    const seen = new Map<number, Point>();
    for (const raw of candles.data?.candles ?? []) {
      const point = toPoint(raw);
      if (point) seen.set(point.time, point);
    }
    const base = [...seen.values()].sort((a, b) => a.time - b.time);
    if (interval === "1m" && livePoint) {
      const last = base.at(-1);
      if (last && last.time === livePoint.time) return [...base.slice(0, -1), livePoint];
      if (!last || livePoint.time >= last.time) return [...base, livePoint];
    }
    return base;
  }, [candles.data, interval, livePoint]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      setWidth(Math.max(0, entries[0]?.contentRect.width ?? 0));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const active = hover !== null ? (points[hover] ?? null) : null;
  const latest = points.at(-1) ?? null;
  const shown = active ?? latest;
  const first = points[0] ?? null;
  const rangeChange =
    first && latest && first.open > 0 ? ((latest.close - first.open) / first.open) * 100 : 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0 || points.length === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssH = 340;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.height = `${cssH}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, cssH);

    const padL = 8;
    const padR = 68;
    const padT = 8;
    const padB = 24;
    const plotW = width - padL - padR;
    const volH = 52;
    const priceH = cssH - padT - padB - volH - 8;
    if (plotW <= 40 || priceH <= 40) return;

    const values = points.flatMap((p) => [p.high, p.low]);
    let max = Math.max(...values);
    let min = Math.min(...values);
    if (max === min) {
      max *= 1.001;
      min *= 0.999;
    }
    const pad = (max - min) * 0.08;
    max += pad;
    min = Math.max(0, min - pad);
    const firstTime = points[0]!.time;
    const lastTime = points.at(-1)!.time;
    const timePad = Math.max((lastTime - firstTime) * 0.03, 60_000);
    const t0 = firstTime - timePad * 0.4;
    const t1 = lastTime + timePad;

    const x = (t: number) => padL + ((t - t0) / (t1 - t0)) * plotW;
    const y = (v: number) => padT + ((max - v) / (max - min)) * priceH;

    // Grid + price labels.
    ctx.font = "10px ui-monospace, monospace";
    ctx.textBaseline = "middle";
    for (const tick of niceTicks(min, max, 5)) {
      const yy = Math.round(y(tick)) + 0.5;
      ctx.strokeStyle = GRID;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padL, yy);
      ctx.lineTo(padL + plotW, yy);
      ctx.stroke();
      ctx.fillStyle = AXIS_TEXT;
      ctx.fillText(axisPrice(tick), padL + plotW + 6, yy);
    }

    // Time labels.
    const spanMs = t1 - t0;
    const timeStep = spanMs / 5;
    ctx.fillStyle = AXIS_TEXT;
    ctx.textAlign = "center";
    for (let i = 0; i <= 5; i += 1) {
      const t = t0 + timeStep * i;
      ctx.fillText(timeLabel(t, spanMs), x(t), cssH - 12);
    }
    ctx.textAlign = "left";

    // Volume bars.
    const maxVol = Math.max(...points.map((p) => p.volume), 0);
    const volTop = padT + priceH + 8;
    if (maxVol > 0) {
      for (const p of points) {
        const h = Math.max((p.volume / maxVol) * volH, p.volume > 0 ? 1.5 : 0);
        const rising = p.close >= p.open;
        ctx.fillStyle = rising ? "rgba(38, 166, 154, 0.45)" : "rgba(239, 83, 80, 0.45)";
        const bw = Math.max(plotW / points.length - 2, 1);
        ctx.fillRect(x(p.time) - bw / 2, volTop + volH - h, bw, h);
      }
    }

    // Candles.
    const slot = plotW / Math.max(points.length, 1);
    const bodyW = Math.min(Math.max(slot * 0.62, 2), 22);
    points.forEach((p, i) => {
      const rising = p.close >= p.open;
      const color = rising ? UP : DOWN;
      const cx = x(p.time);
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(bodyW * 0.18, 1);
      ctx.beginPath();
      ctx.moveTo(cx, y(p.high));
      ctx.lineTo(cx, y(p.low));
      ctx.stroke();
      const yo = y(p.open);
      const yc = y(p.close);
      ctx.fillStyle = color;
      const top = Math.min(yo, yc);
      ctx.fillRect(cx - bodyW / 2, top, bodyW, Math.max(Math.abs(yc - yo), 1.5));
      if (hover === i) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        ctx.strokeRect(cx - bodyW / 2 - 2.5, top - 2.5, bodyW + 5, Math.max(Math.abs(yc - yo), 1.5) + 5);
      }
    });

    // Last-price line + tag.
    if (latest) {
      const yy = Math.round(y(latest.close)) + 0.5;
      ctx.strokeStyle = latest.close >= latest.open ? UP : DOWN;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(padL, yy);
      ctx.lineTo(padL + plotW, yy);
      ctx.stroke();
      ctx.setLineDash([]);
      const label = axisPrice(latest.close);
      const tagW = ctx.measureText(label).width + 10;
      ctx.fillStyle = latest.close >= latest.open ? UP : DOWN;
      const tagY = Math.min(Math.max(yy - 9, padT), padT + priceH + volH + 8 - 18);
      ctx.fillRect(padL + plotW + 1, tagY, padR - 2, 18);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(label, padL + plotW + 6, tagY + 9);
    }

    // Crosshair.
    if (hover !== null && points[hover]) {
      const p = points[hover]!;
      const cx = x(p.time);
      const cy = y(p.close);
      ctx.strokeStyle = CROSSHAIR;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(cx, padT);
      ctx.lineTo(cx, padT + priceH + volH + 8);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(padL, cy);
      ctx.lineTo(padL + plotW + padR, cy);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [points, hover, width, latest]);

  const onMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (points.length === 0 || width <= 0) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const padL = 8;
    const padR = 68;
    const plotW = width - padL - padR;
    const firstTime = points[0]!.time;
    const lastTime = points.at(-1)!.time;
    const timePad = Math.max((lastTime - firstTime) * 0.03, 60_000);
    const t0 = firstTime - timePad * 0.4;
    const t1 = lastTime + timePad;
    const t = t0 + ((event.clientX - rect.left - padL) / plotW) * (t1 - t0);
    let best = 0;
    let bestDist = Infinity;
    points.forEach((p, i) => {
      const dist = Math.abs(p.time - t);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    setHover(best);
  };

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
            {shown ? (
              <>
                <span style={{ color: shown.close >= shown.open ? UP : DOWN, fontWeight: 800 }}>
                  O {axisPrice(shown.open)} H {axisPrice(shown.high)} L {axisPrice(shown.low)} C{" "}
                  {axisPrice(shown.close)}
                </span>{" "}
                ·{" "}
                <span style={{ color: rangeChange >= 0 ? UP : DOWN }}>
                  {rangeChange > 0 ? "+" : ""}
                  {rangeChange.toFixed(2)}%
                </span>{" "}
                · live{stream?.connected ? "" : " (reconnecting…)"}
              </>
            ) : (
              "No trades yet"
            )}
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
                setHover(null);
              }}
            >
              {value}
            </button>
          ))}
        </div>
      </header>

      {points.length > 0 ? (
        <div ref={wrapRef} className="mt-4 w-full">
          <canvas
            ref={canvasRef}
            className="w-full cursor-crosshair"
            style={{ width: "100%", height: 340 }}
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
            role="img"
            aria-label={`Candlestick chart, ${points.length} ${interval} candles`}
          />
        </div>
      ) : (
        <p className="mt-4 border border-rule bg-raised p-6 text-center text-sm text-ink-muted">
          No candles for this interval yet — the chart fills in as trades settle.
        </p>
      )}
      {candles.isError ? (
        <p className="mt-2 text-xs font-semibold text-error" role="status">
          Candles unavailable: {(candles.error as Error).message}
        </p>
      ) : null}
    </section>
  );
}
