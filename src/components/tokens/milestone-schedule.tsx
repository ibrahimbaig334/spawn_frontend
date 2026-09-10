"use client";

import { useMemo, useState } from "react";
import { formatBasisPoints, formatEth } from "@/lib/format";
import type { Launch, MilestoneView } from "@/types/launch";
import { selectAllMilestones } from "@/domain/selectors";

export function MilestoneSchedule({
  launch,
  onSelect,
}: {
  launch: Launch;
  onSelect?: (milestone: MilestoneView) => void;
}) {
  const milestones = useMemo(() => selectAllMilestones(launch), [launch]);
  const current = Math.min(
    60,
    launch.completedMilestones + launch.additionalMilestones + 1,
  );
  const [selectedNumber, setSelectedNumber] = useState(current);
  const selected =
    milestones.find(({ number }) => number === selectedNumber) ??
    milestones.at(-1);

  function choose(number: number) {
    const next = milestones.find(
      (milestone) => milestone.number === Math.max(1, Math.min(60, number)),
    );
    if (!next) return;
    setSelectedNumber(next.number);
    onSelect?.(next);
  }

  return (
    <section
      className="border-t-2 border-ink py-[clamp(2rem,5vw,4rem)]"
      aria-labelledby={`schedule-${launch.id}`}
    >
      <header className="flex items-end justify-between gap-4 max-[42rem]:items-start max-[42rem]:flex-col">
        <div>
          <p className="m-0 font-mono text-[0.68rem] font-bold tracking-[0.08em] text-accent-strong uppercase">
            Public price targets
          </p>
          <h2
            className="mt-1 mb-0 text-[clamp(1.6rem,4vw,2.6rem)]"
            id={`schedule-${launch.id}`}
          >
            Milestone schedule
          </h2>
        </div>
        <span className="font-mono text-xs font-bold text-ink-muted">
          {launch.completedMilestones + launch.additionalMilestones} / 60
          complete
        </span>
      </header>
      {selected ? (
        <div className="mt-5 grid grid-cols-[minmax(8rem,.4fr)_1fr] border border-ink bg-raised max-[42rem]:grid-cols-1">
          <div className="grid content-center gap-1 border-r border-rule p-4 max-[42rem]:border-r-0 max-[42rem]:border-b">
            <span className="text-xs text-ink-muted">Selected milestone</span>
            <strong className="font-mono text-3xl leading-none">
              M{selected.number}
            </strong>
            <small
              className="mt-1 w-fit font-bold text-accent-strong capitalize"
              data-state={selected.state}
            >
              {selected.state === "completed"
                ? "Completed"
                : selected.state === "next"
                  ? "Next"
                  : "Ahead"}
            </small>
          </div>
          <dl className="m-0 grid grid-cols-3 max-[42rem]:grid-cols-1 [&>div]:p-4 [&>div+div]:border-l [&>div+div]:border-rule max-[42rem]:[&>div+div]:border-t max-[42rem]:[&>div+div]:border-l-0 [&_dt]:text-xs [&_dt]:text-ink-muted [&_dd]:mt-1 [&_dd]:mb-0 [&_dd]:font-mono [&_dd]:text-sm [&_dd]:font-bold">
            <div>
              <dt>Target</dt>
              <dd>{formatEth(selected.targetEth, 2)}</dd>
            </div>
            <div>
              <dt>Allocation</dt>
              <dd>{formatEth(selected.allocationEth, 2)}</dd>
            </div>
            <div>
              <dt>Fee at target</dt>
              <dd>{formatBasisPoints(selected.feeBps)}</dd>
            </div>
          </dl>
        </div>
      ) : null}
      <nav
        className="mt-3 grid grid-cols-3 max-[42rem]:grid-cols-1 print:hidden [&_button]:min-h-target [&_button]:cursor-pointer [&_button]:border [&_button]:border-rule [&_button]:bg-transparent [&_button]:p-2 [&_button]:font-bold [&_button]:disabled:cursor-not-allowed [&_button]:disabled:opacity-40 [&_button+button]:border-l-0 max-[42rem]:[&_button+button]:border-t-0 max-[42rem]:[&_button+button]:border-l"
        aria-label="Select milestone"
      >
        <button
          type="button"
          disabled={!selected || selected.number <= 1}
          onClick={() => choose(selectedNumber - 1)}
        >
          ← Previous
        </button>
        <button type="button" onClick={() => choose(current)}>
          Jump to current
        </button>
        <button
          type="button"
          disabled={!selected || selected.number >= 60}
          onClick={() => choose(selectedNumber + 1)}
        >
          Next →
        </button>
      </nav>
      <div
        className="mt-4 grid grid-cols-[repeat(60,minmax(2px,1fr))] gap-0.5 print:hidden"
        aria-hidden="true"
      >
        {milestones.map((milestone) => (
          <span
            className="h-5 border border-rule bg-raised data-[state=completed]:border-accent data-[state=completed]:bg-accent data-[state=next]:border-2 data-[state=next]:border-accent-strong data-[selected=true]:outline-2 data-[selected=true]:outline-offset-2 data-[selected=true]:outline-ink forced-colors:data-[state=completed]:bg-[Highlight]"
            data-selected={milestone.number === selectedNumber || undefined}
            data-state={milestone.state}
            key={milestone.number}
          />
        ))}
      </div>
      <details className="mt-4 border-t border-rule">
        <summary className="min-h-target cursor-pointer py-3 font-bold">
          View all 60 milestones
        </summary>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse font-mono text-xs">
            <caption className="py-2 text-left">
              Exact public targets, allocations, and fee tiers
            </caption>
            <thead>
              <tr className="bg-surface-strong">
                <th className="border border-rule p-2 text-left" scope="col">
                  Milestone
                </th>
                <th className="border border-rule p-2 text-left" scope="col">
                  State
                </th>
                <th className="border border-rule p-2 text-left" scope="col">
                  Target
                </th>
                <th className="border border-rule p-2 text-left" scope="col">
                  Allocation
                </th>
                <th className="border border-rule p-2 text-left" scope="col">
                  Fee
                </th>
              </tr>
            </thead>
            <tbody>
              {milestones.map((milestone) => (
                <tr
                  className="data-[selected=true]:bg-surface-strong"
                  data-selected={
                    milestone.number === selectedNumber || undefined
                  }
                  key={milestone.number}
                >
                  <th className="border border-rule p-2 text-left" scope="row">
                    <button
                      className="min-h-target min-w-target cursor-pointer border-0 bg-transparent font-mono font-bold text-inherit underline"
                      type="button"
                      onClick={() => choose(milestone.number)}
                    >
                      M{milestone.number}
                    </button>
                  </th>
                  <td className="border border-rule p-2 whitespace-nowrap">
                    {milestone.state === "completed"
                      ? "Completed"
                      : milestone.state === "next"
                        ? "Next"
                        : "Ahead"}
                  </td>
                  <td className="border border-rule p-2 whitespace-nowrap">
                    {formatEth(milestone.targetEth, 2)}
                  </td>
                  <td className="border border-rule p-2 whitespace-nowrap">
                    {formatEth(milestone.allocationEth, 2)}
                  </td>
                  <td className="border border-rule p-2 whitespace-nowrap">
                    {formatBasisPoints(milestone.feeBps)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
