"use client";

import { useMemo, useState } from "react";
import { formatEth } from "@/lib/format";
import type { BandView } from "@/types/protocol-model";
import type { LaunchRecord } from "@/services/launchpad-client";
import {
  selectMilestoneSchedule,
  type MilestoneRow,
} from "@/domain/selectors";

export function MilestoneSchedule({
  launch,
  bands,
  onSelect,
}: {
  launch: LaunchRecord;
  bands: BandView[];
  onSelect?: (milestone: MilestoneRow) => void;
}) {
  const schedule = useMemo(
    () => selectMilestoneSchedule(launch, bands),
    [launch, bands],
  );
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const selected =
    schedule.find((band) => band.number === selectedNumber) ?? null;

  function choose(band: MilestoneRow) {
    setSelectedNumber(band.number);
    onSelect?.(band);
  }

  return (
    <section
      className="border-t-2 border-ink py-[clamp(2rem,5vw,4rem)]"
      aria-labelledby={`schedule-${launch.poolId}`}
    >
      <header className="flex items-end justify-between gap-4 max-[42rem]:items-start max-[42rem]:flex-col">
        <div>
          <p className="m-0 font-mono text-[0.68rem] font-bold tracking-[0.08em] text-accent-strong uppercase">
            Protocol-owned sell bands
          </p>
          <h2
            className="mt-1 mb-0 text-[clamp(1.6rem,4vw,2.6rem)]"
            id={`schedule-${launch.poolId}`}
          >
            Milestone ladder
          </h2>
        </div>
        <span className="font-mono text-xs font-bold text-ink-muted">
          {launch.completedMilestones} / {schedule.length} harvested
        </span>
      </header>
      <p className="mt-2 mb-4 max-w-3xl text-sm text-ink-muted">
        Each rung sits 1.2504x above the graduation valuation and spans 447
        levels. A swap that ends at or above a band&apos;s top harvests it:
        10% service fee to the protocol, 90% funding the payout pot. Up to 8
        bands deploy and 8 harvest per swap; the rest settle later. Bypassed
        bands rolled their inventory forward — a specified outcome, not an
        error.
      </p>
      {selected ? (
        <div className="mb-4 grid grid-cols-[minmax(8rem,.4fr)_1fr] border border-ink bg-raised max-[42rem]:grid-cols-1">
          <div className="grid content-center gap-1 border-r border-rule p-4 max-[42rem]:border-r-0 max-[42rem]:border-b">
            <span className="text-xs text-ink-muted">Selected band</span>
            <strong className="font-mono text-3xl leading-none">
              M{selected.number}
            </strong>
            <small className="mt-1 w-fit font-bold text-accent-strong capitalize">
              {selected.state === "completed"
                ? "Harvested"
                : selected.state === "skipped"
                  ? "Bypassed"
                  : selected.state === "deployed"
                    ? "Live"
                    : "Pending"}
            </small>
          </div>
          <dl className="grid grid-cols-3 content-center gap-2 p-4 text-sm max-[30rem]:grid-cols-1">
            <div className="grid gap-1">
              <dt className="text-xs text-ink-muted">Levels</dt>
              <dd className="m-0 font-mono font-bold">
                {selected.levelLower} → {selected.levelUpper}
              </dd>
            </div>
            <div className="grid gap-1">
              <dt className="text-xs text-ink-muted">Top FDV</dt>
              <dd className="m-0 font-mono font-bold">
                {formatEth(selected.targetFdvEth, 1)}
              </dd>
            </div>
            <div className="grid gap-1">
              <dt className="text-xs text-ink-muted">Rung multiple</dt>
              <dd className="m-0 font-mono font-bold">
                {selected.rungMultiple}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
      {schedule.length ? (
        <ol className="m-0 grid list-none gap-2 border-t border-rule p-0">
          {schedule.map((band) => (
            <li key={band.number}>
              <button
                aria-pressed={selected?.number === band.number}
                className="grid min-h-16 w-full cursor-pointer grid-cols-[minmax(6rem,.5fr)_minmax(8rem,1fr)_minmax(8rem,1fr)_minmax(5rem,.6fr)] items-center gap-4 border-2 bg-raised px-4 py-2.5 text-left text-ink hover:border-ink hover:bg-paper aria-pressed:border-focus aria-pressed:bg-surface-strong max-[42rem]:grid-cols-2 max-[26rem]:grid-cols-1"
                data-state={band.state}
                onClick={() => choose(band)}
                type="button"
              >
                <strong className="font-mono text-base">M{band.number}</strong>
                <span className="font-mono text-sm tabular-nums">
                  {formatEth(band.targetFdvEth, 1)}
                </span>
                <span className="font-mono text-sm text-ink-muted tabular-nums">
                  {band.rungMultiple}
                </span>
                <span
                  className={
                    band.state === "completed"
                      ? "text-right text-sm font-bold text-accent-strong max-[42rem]:text-left"
                      : "text-right text-sm text-ink-muted max-[42rem]:text-left"
                  }
                >
                  {band.state === "completed"
                    ? "Harvested"
                    : band.state === "skipped"
                      ? "Bypassed"
                      : band.state === "deployed"
                        ? "Live"
                        : "Pending"}
                </span>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="border border-rule p-6 text-center text-ink-muted">
          Band geometry loads from the pool state view.
        </p>
      )}
    </section>
  );
}
