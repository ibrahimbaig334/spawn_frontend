import type { MilestoneState, MilestoneView } from "@/types/launch";

export interface MilestoneWindowProps {
  milestones: readonly MilestoneView[];
  selectedMilestone?: number;
  onSelect: (milestone: MilestoneView) => void;
  title?: string;
  description?: string;
  className?: string;
}

const STATE_COPY: Readonly<
  Record<MilestoneState, { glyph: string; label: string }>
> = {
  completed: { glyph: "✓", label: "Completed" },
  next: { glyph: "→", label: "Next" },
  ahead: { glyph: "+", label: "Ahead" },
};

function formatFee(feeBps: number): string {
  const percent = feeBps / 100;
  return `${Number.isInteger(percent) ? percent : Number(percent.toFixed(2))}% fee`;
}

export function MilestoneWindow({
  milestones,
  selectedMilestone,
  onSelect,
  title = "Nearby milestones",
  description = "Select a milestone to inspect its public target and allocation.",
  className,
}: MilestoneWindowProps) {
  const nearby = milestones.slice(0, 6);

  return (
    <section
      className={["min-w-0 text-ink print:break-inside-avoid", className ?? ""]
        .filter(Boolean)
        .join(" ")}
    >
      <header className="mb-4">
        <h2 className="m-0 text-[clamp(1.25rem,3vw,1.75rem)] leading-[1.1] tracking-[-0.03em]">
          {title}
        </h2>
        <p className="mt-2 mb-0 text-sm leading-6 text-ink-muted">
          {description}
        </p>
      </header>

      <div
        className="grid grid-cols-[minmax(8rem,1.2fr)_minmax(7rem,1fr)_minmax(7rem,1fr)_minmax(5rem,.6fr)] gap-4 px-4 pb-2 text-[0.6875rem] font-extrabold tracking-[0.06em] text-ink-muted uppercase max-[42rem]:hidden [&_span:last-child]:text-right"
        aria-hidden="true"
      >
        <span>Milestone</span>
        <span>Target</span>
        <span>Allocation</span>
        <span>Fee</span>
      </div>

      <ol className="m-0 grid list-none gap-2 p-0">
        {nearby.map((milestone) => {
          const state = STATE_COPY[milestone.state];
          const selected = selectedMilestone === milestone.number;
          const stateClass =
            milestone.state === "completed"
              ? "border-l-accent"
              : milestone.state === "next"
                ? "border-ink border-l-focus"
                : "border-l-ink-muted";
          const glyphClass =
            milestone.state === "completed"
              ? "bg-accent forced-colors:border-double"
              : milestone.state === "next"
                ? "bg-focus forced-colors:bg-[Highlight] forced-colors:text-[HighlightText]"
                : "bg-ink-muted forced-colors:border-dashed";
          return (
            <li key={milestone.number}>
              <button
                aria-label={`Milestone ${milestone.number}, ${state.label}. Target ${milestone.targetEth} ETH; allocation ${milestone.allocationEth} ETH; ${formatFee(milestone.feeBps)}.`}
                aria-pressed={selected}
                className={[
                  "grid min-h-16 w-full cursor-pointer grid-cols-[minmax(8rem,1.2fr)_minmax(7rem,1fr)_minmax(7rem,1fr)_minmax(5rem,.6fr)] items-center gap-4 border-2 border-l-[6px] bg-raised px-4 py-2.5 text-left text-ink hover:border-ink hover:bg-paper aria-pressed:border-focus aria-pressed:bg-surface-strong max-[42rem]:grid-cols-2 max-[26rem]:grid-cols-1 forced-colors:border-[CanvasText] print:break-inside-avoid print:border-black",
                  stateClass,
                ].join(" ")}
                data-selected={selected || undefined}
                data-state={milestone.state}
                onClick={() => onSelect(milestone)}
                type="button"
              >
                <span className="flex min-w-0 items-center gap-3 max-[42rem]:col-span-full max-[26rem]:col-auto">
                  <span
                    className={[
                      "inline-flex size-7 shrink-0 items-center justify-center rounded-[2px] text-xs font-black text-inverse forced-colors:border-2 forced-colors:border-[CanvasText] forced-colors:bg-[Canvas] forced-colors:text-[CanvasText] print:border print:border-black print:bg-white print:text-black",
                      glyphClass,
                    ].join(" ")}
                    aria-hidden="true"
                  >
                    {state.glyph}
                  </span>
                  <span className="grid min-w-0 gap-1">
                    <strong className="text-base">M{milestone.number}</strong>
                    <small className="text-[0.6875rem] leading-tight text-ink-muted">
                      {state.label}
                    </small>
                  </span>
                </span>
                <span className="grid min-w-0 gap-1">
                  <small className="hidden text-[0.6875rem] leading-tight text-ink-muted max-[42rem]:block">
                    Target
                  </small>
                  <strong className="tabular-nums text-sm leading-tight">
                    {milestone.targetEth} ETH
                  </strong>
                </span>
                <span className="grid min-w-0 gap-1">
                  <small className="hidden text-[0.6875rem] leading-tight text-ink-muted max-[42rem]:block">
                    Allocation
                  </small>
                  <strong className="tabular-nums text-sm leading-tight">
                    {milestone.allocationEth} ETH
                  </strong>
                </span>
                <span className="grid min-w-0 gap-1 text-right max-[42rem]:text-left">
                  <small className="hidden text-[0.6875rem] leading-tight text-ink-muted max-[42rem]:block">
                    Fee
                  </small>
                  <strong className="tabular-nums text-sm leading-tight">
                    {formatFee(milestone.feeBps)}
                  </strong>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
