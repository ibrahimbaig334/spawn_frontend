"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCandles } from "@/lib/queries";
import type { CandleInterval } from "@/lib/api/dto";
import type { PoolStream } from "@/lib/use-pool-stream";

const INTERVALS: CandleInterval[] = ["1m", "5m", "15m", "1h", "4h", "1d"];
const LIMIT = 150;
const HEIGHT = 340;

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

interface Geometry {
  padL: number;
  padR: number;
  padT: number;
  volTop: number;
  volH: number;
  plotW: number;
  priceH: number;
  min: number;
  max: number;
  t0: number;
  t1: number;
  x(t: number): number;
  y(v: number): number;
}

function computeGeometry(points: Point[], width: number): Geometry | null {
  const padL = 8;
  const padR = 68;
  const padT = 8;
  const padB = 24;
  const plotW = width - padL - padR;
  const volH = 52;
  const priceH = HEIGHT - padT - padB - volH - 8;
  if (plotW <= 40 || priceH <= 40) return null;
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
  const volTop = padT + priceH + 8;
  return {
    padL,
    padR,
    padT,
    volTop,
    volH,
    plotW,
    priceH,
    min,
    max,
    t0,
    t1,
    x: (t) => padL + ((t - t0) / (t1 - t0)) * plotW,
    y: (v) => padT + ((max - v) / (max - min)) * priceH,
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
  const [hover, setHover] = useState<number | null>(null);
  const candles = useCandles(tokenRef, interval, LIMIT);
  const wrapRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  // Hover index lives in a ref for the overlay loop; state only feeds the
  // OHLC readout (set only when the index actually changes).
  const hoverRef = useRef<number | null>(null);
  const rafRef = useRef(0);

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

  const pointsRef = useRef<Point[]>(points);
  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const target = el;
    const observer = new ResizeObserver((entries) => {
      const next = Math.max(0, Math.round(entries[0]?.contentRect.width ?? 0));
      setWidth((current) => (current === next ? current : next));
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const latest = points.at(-1) ?? null;
  const shown = hover !== null ? (points[hover] ?? null) : latest;
  const first = points[0] ?? null;
  const rangeChange =
    first && latest && first.open > 0 ? ((latest.close - first.open) / first.open) * 100 : 0;

  // Base layer: candles, volume, grid, axes, last-price tag. Redraws only
  // when data or size changes — never on hover.
  useEffect(() => {
    const canvas = baseRef.current;
    if (!canvas || width <= 0 || points.length === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(HEIGHT * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, HEIGHT);
    const g = computeGeometry(points, width);
    if (!g) return;

    ctx.font = "10px ui-monospace, monospace";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    for (const tick of niceTicks(g.min, g.max, 5)) {
      const yy = Math.round(g.y(tick)) + 0.5;
      ctx.strokeStyle = GRID;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(g.padL, yy);
      ctx.lineTo(g.padL + g.plotW, yy);
      ctx.stroke();
      ctx.fillStyle = AXIS_TEXT;
      ctx.fillText(axisPrice(tick), g.padL + g.plotW + 6, yy);
    }

    const spanMs = g.t1 - g.t0;
    const timeStep = spanMs / 5;
    ctx.fillStyle = AXIS_TEXT;
    ctx.textAlign = "center";
    for (let i = 0; i <= 5; i += 1) {
      const t = g.t0 + timeStep * i;
      ctx.fillText(timeLabel(t, spanMs), g.x(t), HEIGHT - 12);
    }
    ctx.textAlign = "left";

    const maxVol = Math.max(...points.map((p) => p.volume), 0);
    if (maxVol > 0) {
      const bw = Math.max(g.plotW / points.length - 2, 1);
      for (const p of points) {
        const h = Math.max((p.volume / maxVol) * g.volH, p.volume > 0 ? 1.5 : 0);
        ctx.fillStyle = p.close >= p.open ? "rgba(38, 166, 154, 0.45)" : "rgba(239, 83, 80, 0.45)";
        ctx.fillRect(g.x(p.time) - bw / 2, g.volTop + g.volH - h, bw, h);
      }
    }

    const slot = g.plotW / Math.max(points.length, 1);
    const bodyW = Math.min(Math.max(slot * 0.62, 2), 22);
    for (const p of points) {
      const rising = p.close >= p.open;
      const color = rising ? UP : DOWN;
      const cx = g.x(p.time);
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(bodyW * 0.18, 1);
      ctx.beginPath();
      ctx.moveTo(cx, g.y(p.high));
      ctx.lineTo(cx, g.y(p.low));
      ctx.stroke();
      const yo = g.y(p.open);
      const yc = g.y(p.close);
      ctx.fillStyle = color;
      const top = Math.min(yo, yc);
      ctx.fillRect(cx - bodyW / 2, top, bodyW, Math.max(Math.abs(yc - yo), 1.5));
    }

    if (latest) {
      const yy = Math.round(g.y(latest.close)) + 0.5;
      const color = latest.close >= latest.open ? UP : DOWN;
      ctx.strokeStyle = color;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(g.padL, yy);
      ctx.lineTo(g.padL + g.plotW, yy);
      ctx.stroke();
      ctx.setLineDash([]);
      const label = axisPrice(latest.close);
      ctx.fillStyle = color;
      const tagY = Math.min(Math.max(yy - 9, g.padT), g.padT + g.priceH + g.volH + 8 - 18);
      ctx.fillRect(g.padL + g.plotW + 1, tagY, g.padR - 2, 18);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(label, g.padL + g.plotW + 6, tagY + 9);
    }
  }, [points, width, latest]);

  // Overlay layer: crosshair only, drawn on rAF so mousemove never blocks.
  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const drawOverlay = (index: number | null) => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(width * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(HEIGHT * dpr);
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, HEIGHT);
    const current = pointsRef.current;
    if (index === null || !current[index]) return;
    const g = computeGeometry(current, width);
    if (!g) return;
    const p = current[index]!;
    const cx = g.x(p.time);
    const cy = g.y(p.close);
    ctx.strokeStyle = CROSSHAIR;
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, g.padT);
    ctx.lineTo(cx, g.padT + g.priceH + g.volH + 8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(g.padL, cy);
    ctx.lineTo(g.padL + g.plotW + g.padR, cy);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  const scheduleOverlay = (index: number | null) => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => drawOverlay(index));
  };

  const nearestIndex = (clientX: number): number | null => {
    const canvas = overlayRef.current;
    const current = pointsRef.current;
    if (!canvas || current.length === 0 || width <= 0) return null;
    const rect = canvas.getBoundingClientRect();
    const g = computeGeometry(current, width);
    if (!g) return null;
    const t = g.t0 + ((clientX - rect.left - g.padL) / g.plotW) * (g.t1 - g.t0);
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < current.length; i += 1) {
      const dist = Math.abs(current[i]!.time - t);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    return best;
  };

  const onMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const index = nearestIndex(event.clientX);
    // Avoid setState churn: only the readout re-renders, and only on change.
    if (index !== hoverRef.current) {
      hoverRef.current = index;
      setHover(index);
    }
    scheduleOverlay(index);
  };

  const onLeave = () => {
    hoverRef.current = null;
    setHover(null);
    scheduleOverlay(null);
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
                hoverRef.current = null;
                setHover(null);
                setInterval(value);
              }}
            >
              {value}
            </button>
          ))}
        </div>
      </header>

      {points.length > 0 || candles.isPending ? (
        <div ref={wrapRef} className="relative mt-4 w-full" style={{ height: HEIGHT }}>
          <canvas ref={baseRef} className="absolute inset-0 w-full" style={{ width: "100%", height: HEIGHT }} />
          <canvas
            ref={overlayRef}
            className="absolute inset-0 w-full cursor-crosshair"
            style={{ width: "100%", height: HEIGHT }}
            onMouseMove={onMove}
            onMouseLeave={onLeave}
            role="img"
            aria-label={`Candlestick chart, ${points.length} ${interval} candles`}
          />
          {points.length === 0 ? (
            <p className="absolute inset-0 m-0 grid place-items-center font-mono text-xs text-ink-muted">
              {candles.isPending ? "Loading candles…" : "No candles for this interval yet."}
            </p>
          ) : null}
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
