import { useId, type HTMLAttributes } from "react";

export interface ProgressProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> {
  value: number;
  max?: number;
  label: string;
  valueLabel?: string;
}

function bound(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(0, value));
}

export function Progress({
  value,
  max = 100,
  label,
  valueLabel,
  className,
  ...props
}: ProgressProps) {
  const generatedId = useId();
  const labelId = `${props.id ?? generatedId}-label`;
  const safeMax = Number.isFinite(max) && max > 0 ? max : 100;
  const safeValue = bound(value, safeMax);
  const percent = (safeValue / safeMax) * 100;

  return (
    <div
      className={["grid gap-2 text-ink", className ?? ""]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      <div className="flex items-baseline justify-between gap-4 text-sm font-bold leading-[1.3]">
        <span id={labelId}>{label}</span>
        <span className="tabular-nums whitespace-nowrap">
          {valueLabel ?? `${Math.round(percent)}%`}
        </span>
      </div>
      <div
        aria-labelledby={labelId}
        aria-valuemax={safeMax}
        aria-valuemin={0}
        aria-valuenow={safeValue}
        aria-valuetext={valueLabel}
        className="relative h-3 overflow-hidden rounded-sm border border-ink-muted bg-surface-strong forced-colors:border-[CanvasText] forced-colors:bg-[Canvas] print:border-black print:bg-white"
        role="progressbar"
      >
        <span
          className="block h-full bg-accent transition-[width] duration-200 motion-reduce:transition-none forced-colors:bg-[Highlight] print:bg-black"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
