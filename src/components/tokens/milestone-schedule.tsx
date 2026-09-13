"use client";

import type { MilestoneItem } from "@/lib/api/dto";
import { FIXED_TOTAL_SUPPLY, WAD } from "@/protocol/constants";
import { fdvEthWei } from "@/protocol/level-math";
import { formatRungMultiple, formatUsdApproxFromEthWei } from "@/lib/display";

const STATE_META: Record<MilestoneItem["state"], { label: string; className: string }> = {
  PENDING: { label: "Pending", className: "text-ink-muted" },
  DEPLOYED: { label: "Live sell band", className: "text-protocol" },
  SKIPPED: { label: "Bypassed", className: "text-ink-muted italic" },
  HARVESTED: { label: "Harvested", className: "text-accent-strong" },
};

export function MilestoneSchedule({
  graduationLevel,
  milestones,
  loading = false,
}: {
  graduationLevel: number;
  milestones: MilestoneItem[];
  loading?: boolean;
}) {
  if (loading) {
    return <p className="border border-rule bg-raised p-6 text-center text-sm text-ink-muted">Loading ladder geometry…</p>;
  }
  if (milestones.length === 0) {
    return (
      <p className="border border-rule bg-raised p-6 text-center text-sm text-ink-muted">
        The ladder begins at graduation — no bands yet.
      </p>
    );
  }
  const gradMcap = fdvEthWei(FIXED_TOTAL_SUPPLY, graduationLevel) || 1n;
  return (
    <ol className="m-0 grid list-none gap-1 border-t border-rule p-0" aria-label="Milestones">
      {milestones.map((band, position) => {
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
              Pays out at {formatUsdApproxFromEthWei(targetMcap.toString())} MC ·{" "}
              {formatRungMultiple(multiple)} graduation
            </span>
            <span className={`font-bold ${state.className}`}>{state.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
