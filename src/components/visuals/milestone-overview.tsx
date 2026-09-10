import { PROTOCOL_TERMS } from "@/data/protocol-terms";

export interface MilestoneOverviewProps {
  completedMilestones: number;
  progressBps?: number;
  title?: string;
  className?: string;
}

const MILESTONES = Array.from(
  { length: PROTOCOL_TERMS.coreMilestones },
  (_, index) => index + 1,
);
const LANDMARKS = [1, 8, 16, 24, PROTOCOL_TERMS.coreMilestones] as const;

function clamp(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}

export function MilestoneOverview({
  completedMilestones,
  progressBps = 0,
  title = "Core milestone overview",
  className,
}: MilestoneOverviewProps) {
  const completed = Math.floor(
    clamp(completedMilestones, 0, PROTOCOL_TERMS.coreMilestones),
  );
  const partial =
    completed === PROTOCOL_TERMS.coreMilestones
      ? 0
      : clamp(progressBps, 0, 10_000) / 10_000;
  const next = Math.min(completed + 1, PROTOCOL_TERMS.coreMilestones);
  const progressValue = completed + partial;
  const summary =
    completed === PROTOCOL_TERMS.coreMilestones
      ? `All ${PROTOCOL_TERMS.coreMilestones} core milestones completed`
      : `${completed} of ${PROTOCOL_TERMS.coreMilestones} core milestones completed. Milestone ${next} is next.`;

  return (
    <figure
      className={["m-0 text-ink print:break-inside-avoid", className ?? ""]
        .filter(Boolean)
        .join(" ")}
    >
      <figcaption className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1">
        <span className="text-xs font-extrabold tracking-[0.08em] uppercase">
          {title}
        </span>
        <strong className="tabular-nums text-lg">
          {completed} / {PROTOCOL_TERMS.coreMilestones}
        </strong>
        <span className="col-span-full text-sm leading-[1.4] text-ink-muted">
          {summary}
        </span>
      </figcaption>

      <progress
        aria-label={title}
        className="absolute -left-[10000px] size-px overflow-hidden"
        max={PROTOCOL_TERMS.coreMilestones}
        value={progressValue}
      >
        {summary}
      </progress>

      <div
        className="grid h-9 grid-cols-[repeat(30,minmax(3px,1fr))] gap-[3px] max-[34rem]:h-7 max-[34rem]:gap-0.5"
        aria-hidden="true"
      >
        {MILESTONES.map((number) => {
          const state =
            number <= completed
              ? "completed"
              : number === completed + 1
                ? "next"
                : "ahead";
          const stateClass =
            state === "completed"
              ? "bg-ink forced-colors:bg-[CanvasText] print:bg-black"
              : state === "next"
                ? "border-2 border-accent bg-accent forced-colors:border-[Highlight] forced-colors:bg-[Highlight] print:border-[3px] print:border-double print:border-black print:bg-white"
                : "bg-surface-strong forced-colors:border forced-colors:border-[CanvasText] forced-colors:bg-[Canvas] print:border print:border-black print:bg-white";
          return (
            <span
              className={["block min-w-0 rounded-[1px]", stateClass].join(" ")}
              data-state={state}
              key={number}
            />
          );
        })}
      </div>

      <ol
        className="mt-2.5 flex list-none justify-between p-0 text-[0.6875rem] [&_li]:grid [&_li]:gap-0.5 [&_li:not(:first-child):not(:last-child)]:text-center [&_li:last-child]:text-right max-[34rem]:[&_li:nth-child(2)]:hidden max-[34rem]:[&_li:nth-child(4)]:hidden"
        aria-label="Milestone landmarks"
      >
        {LANDMARKS.map((number) => {
          const feeTier = PROTOCOL_TERMS.feeTiers.find(
            (tier) => tier.completedMilestones === number,
          );
          return (
            <li key={number}>
              <span className="font-bold">Milestone {number}</span>
              {feeTier ? (
                <small className="text-inherit text-ink-muted">
                  {feeTier.label} fee
                </small>
              ) : null}
            </li>
          );
        })}
      </ol>
    </figure>
  );
}
