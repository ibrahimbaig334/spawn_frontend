"use client";

import { useState } from "react";
import type { MilestoneItem } from "@/lib/api/dto";
import { FIXED_TOTAL_SUPPLY, WAD, CORE_BAND_COUNT } from "@/protocol/constants";
import { fdvEthWei } from "@/protocol/level-math";
import { formatRungMultiple, formatUsdApproxFromEthWei } from "@/lib/display";

const STATE_META: Record<MilestoneItem["state"], { label: string; className: string }> = {
  PENDING: { label: "Upcoming", className: "text-ink-muted" },
  DEPLOYED: { label: "Active", className: "text-protocol" },
  SKIPPED: { label: "Skipped", className: "text-ink-muted italic" },
  HARVESTED: { label: "Paid out", className: "text-accent-strong" },
};

/** Collapsed rows: enough to see what's next without scrolling a wall. */
const PREVIEW_COUNT = 5;

export function MilestoneSchedule({
  graduationLevel,
  milestones,
  loading = false,
}: {
  graduationLevel: number;
  milestones: MilestoneItem[];
  loading?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  if (loading) {
    return <p className="border border-rule bg-raised p-6 text-center text-sm text-ink-muted">Loading milestones…</p>;
  }
  // Only the 22 funded milestones are ever listed; fee-funded extensions are
  // announced as a count, never as rows.
  const core = milestones.filter((band) => band.index < CORE_BAND_COUNT).slice(0, CORE_BAND_COUNT);
  const extensions = Math.max(0, milestones.length - core.length);
  if (core.length === 0) {
    return (
      <p className="border border-rule bg-raised p-6 text-center text-sm text-ink-muted">
        Milestones begin at graduation — nothing scheduled yet.
      </p>
    );
  }
  const gradMcap = fdvEthWei(FIXED_TOTAL_SUPPLY, graduationLevel) || 1n;
  const paid = core.filter((band) => band.state === "HARVESTED").length;
  const nextPosition = core.findIndex((band) => band.state !== "HARVESTED");
  const upcoming = nextPosition === -1 ? [] : core.slice(nextPosition, nextPosition + PREVIEW_COUNT);
  const visible = expanded ? core : upcoming;
  return (
    <div>
      <p className="mt-0 mb-3 text-sm text-ink-muted">
        <strong className="text-ink">{paid} of {core.length} paid out</strong>
        {nextPosition !== -1
          ? <> · next pays at {formatUsdApproxFromEthWei((fdvEthWei(FIXED_TOTAL_SUPPLY, core[nextPosition]!.levelUpper) || 0n).toString())}</>
          : " · all done"}
        {extensions > 0 ? <>{` · +${extensions} more unlock later`}</> : null}
      </p>
      <ol className="m-0 grid list-none gap-1 border-t border-rule p-0" aria-label="Milestones">
        {visible.map((band) => {
          const position = core.indexOf(band);
          const targetMcap = fdvEthWei(FIXED_TOTAL_SUPPLY, band.levelUpper);
          const multiple = Number((targetMcap * WAD) / gradMcap) / 1e18;
          const state = STATE_META[band.state];
          return (
            <li
              key={band.index}
              className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-4 border-b border-rule py-2 text-sm max-[48rem]:grid-cols-[4rem_minmax(0,1fr)_auto]"
              data-state={band.state}
            >
              <strong className="font-mono">#{position + 1}</strong>
              <span className="min-w-0 text-ink-muted">
                Pays out at {formatUsdApproxFromEthWei(targetMcap.toString())} ·{" "}
                {formatRungMultiple(multiple)} graduation
              </span>
              <span className={`font-bold ${state.className}`}>{state.label}</span>
            </li>
          );
        })}
      </ol>
      {core.length > PREVIEW_COUNT ? (
        <button
          type="button"
          className="mt-3 min-h-10 cursor-pointer rounded-sm border border-rule bg-transparent px-4 py-2 text-sm font-bold text-ink hover:border-ink"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
        >
          {expanded ? "Show fewer" : `Show all ${core.length}`}
        </button>
      ) : null}
    </div>
  );
}
