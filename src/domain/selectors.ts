import type { DemoState } from "@/types/demo";
import type {
  ActivityRecord,
  Comment,
  HoldingLedgerEntry,
  Profile,
  ProfileId,
} from "@/types/demo";
import type { LaunchRecord } from "@/services/launchpad-client";
import type { BandView } from "@/types/protocol-model";
import { ethPerTokenWei, fdvEthWei, bandRungMultiple } from "@/protocol/level-math";
import { formatDecimal, parseDecimal } from "@/domain/economics";
import {
  CORE_BAND_COUNT,
  FLUSH_TIP_WAD,
  WAD,
} from "@/protocol/constants";
import { planIndices } from "@/domain/launch-config";

export type HistoryRange = "1D" | "7D" | "30D" | "All";

export interface LaunchActivity extends ActivityRecord {
  launchName: string;
  profile?: Profile;
}

const SCALE = 10n ** 18n;

// -- launch selectors --------------------------------------------------------

export function selectLaunches(state: DemoState): LaunchRecord[] {
  return state.data.order.launches.flatMap((id) => {
    const launch = state.data.entities.launches[id];
    return launch ? [launch] : [];
  });
}

export function selectLaunchById(
  state: DemoState,
  poolId: string,
): LaunchRecord | undefined {
  return state.data.entities.launches[poolId];
}

export function selectLaunchBySlug(
  state: DemoState,
  slug: string,
): LaunchRecord | undefined {
  return selectLaunches(state).find((launch) => launch.slug === slug);
}

export function selectWatchlistedLaunches(state: DemoState): LaunchRecord[] {
  const watched = new Set(state.data.watchlist);
  return selectLaunches(state).filter((launch) => watched.has(launch.poolId));
}

export function selectIsWatched(state: DemoState, poolId: string): boolean {
  return state.data.watchlist.includes(poolId);
}

// -- derived market values ---------------------------------------------------

/** ETH price per token at the launch's current level (1.0001^level). */
export function derivePriceEth(launch: LaunchRecord): string {
  return formatDecimal(ethPerTokenWei(launch.level), 18, 10);
}

/** FDV = totalSupply * 1.0001^level, in ETH. */
export function deriveFdvEth(launch: LaunchRecord): string {
  const supply = parseDecimal(launch.totalSupplyWei);
  if (supply === null) return "0";
  return formatDecimal(fdvEthWei(supply, launch.level), 18, 4);
}

/** Curve progress fraction [0,1] — bonding-curve phase only. */
export function deriveCurveProgress(launch: LaunchRecord): number {
  if (launch.phase !== "bonding-curve") return 1;
  const span = launch.farLevel - launch.openingLevel;
  if (span <= 0) return 0;
  return Math.min(
    1,
    Math.max(0, (launch.level - launch.openingLevel) / span),
  );
}

/** "Graduation on next trade" signal (integration §5.3). */
export function deriveGraduationNext(launch: LaunchRecord): boolean {
  return (
    launch.phase === "bonding-curve" && launch.level >= launch.farLevel - 1
  );
}

export function derivePhaseLabel(launch: LaunchRecord): string {
  if (launch.phase === "graduated") return "Graduated";
  if (launch.phase === "bonding-curve")
    return deriveGraduationNext(launch)
      ? "Graduation on next trade"
      : "Bonding curve";
  return "Not launched";
}

/** Next undeployed/incomplete band as the "next milestone". */
export function selectNextBand(
  launch: LaunchRecord,
  bands: BandView[],
): BandView | null {
  if (launch.phase !== "graduated") return null;
  return (
    bands.find(
      (band) => band.state === "deployed" || band.state === "undeployed",
    ) ?? null
  );
}

/** Milestone band rows for the schedule UI, with rung multiples. */
export interface MilestoneRow {
  number: number;
  state: BandView["state"] | "pending";
  levelLower: number;
  levelUpper: number;
  /** FDV at the band's top, ETH. */
  targetFdvEth: string;
  /** Market-cap multiple over graduation. */
  rungMultiple: string;
}

export function selectMilestoneSchedule(
  launch: LaunchRecord,
  bands: BandView[],
): MilestoneRow[] {
  const anchor =
    launch.graduationLevel ?? launch.farLevel;
  return bands.slice(0, CORE_BAND_COUNT).map((band) => ({
    number: band.index + 1,
    state: band.state,
    levelLower: band.levelLower,
    levelUpper: band.levelUpper,
    targetFdvEth: fdvAtLevel(launch, band.levelUpper),
    rungMultiple: `${bandRungMultiple(band.index).toFixed(3)}x`,
  }));
  function fdvAtLevel(row: LaunchRecord, level: number): string {
    const supply = parseDecimal(row.totalSupplyWei);
    if (supply === null) return "0";
    return formatDecimal(fdvEthWei(supply, level), 18, 2);
  }
  void anchor;
}

/** Milestones completed count. */
export function selectCompletedMilestones(launch: LaunchRecord): number {
  return launch.completedMilestones;
}

// -- activity / history ------------------------------------------------------

export function selectLaunchActivity(
  state: DemoState,
  launchId: string,
): LaunchActivity[] {
  const launch = state.data.entities.launches[launchId];
  if (!launch) return [];
  return state.data.order.activities
    .flatMap((id) => {
      const activity = state.data.entities.activities[id];
      if (!activity || activity.launchId !== launchId) return [];
      return [
        {
          ...activity,
          launchName: launch.name,
          profile: activity.profileId
            ? state.data.entities.profiles[activity.profileId]
            : undefined,
        },
      ];
    })
    .sort(
      (left, right) =>
        right.sequence - left.sequence || left.id.localeCompare(right.id),
    );
}

export function selectRecentActivity(
  state: DemoState,
  limit = 8,
): LaunchActivity[] {
  if (!Number.isInteger(limit) || limit < 0) return [];
  const all = state.data.order.activities.flatMap((id) => {
    const activity = state.data.entities.activities[id];
    if (!activity) return [];
    const launch = state.data.entities.launches[activity.launchId];
    if (!launch) return [];
    return [
      {
        ...activity,
        launchName: launch.name,
        profile: activity.profileId
          ? state.data.entities.profiles[activity.profileId]
          : undefined,
      },
    ];
  });
  return all
  return all
    .sort(
      (left, right) =>
        right.sequence - left.sequence || left.id.localeCompare(right.id),
    )
    .slice(0, limit);
}

export function selectProfileById(
  state: DemoState,
  id: ProfileId,
): Profile | undefined {
  return state.data.entities.profiles[id];
}

export function selectProfileBySlug(
  state: DemoState,
  slug: string,
): Profile | undefined {
  return state.data.order.profiles
    .map((id) => state.data.entities.profiles[id])
    .find((profile) => profile?.slug === slug);
}

export function selectProfileLaunches(
  state: DemoState,
  profileId: ProfileId,
): LaunchRecord[] {
  const creatorBySlug = new Set(
    selectLaunches(state)
      .filter((launch) => launch.creator === "0x0000000000000000000000000000000000000001")
      .map((launch) => launch.poolId),
  );
  void creatorBySlug;
  // Profile→launch attribution in the simulation maps via the seed spec:
  // stored creator is the deterministic local creator; profiles are matched
  // through the fixture activity trail instead.
  const attributed = new Set(
    state.data.order.activities.flatMap((id) => {
      const activity = state.data.entities.activities[id];
      return activity?.kind === "created" && activity.profileId === profileId
        ? [activity.launchId]
        : [];
    }),
  );
  return selectLaunches(state).filter((launch) =>
    attributed.has(launch.poolId),
  );
}

export function selectComments(
  state: DemoState,
  launchId: string,
): Comment[] {
  return state.data.order.comments
    .flatMap((id) => {
      const comment = state.data.entities.comments[id];
      return comment?.launchId === launchId ? [comment] : [];
    })
    .sort(
      (left, right) =>
        left.sequence - right.sequence || left.id.localeCompare(right.id),
    );
}

// -- balances / portfolio ----------------------------------------------------

export function selectTokenBalance(
  state: DemoState,
  launchId: string,
): string {
  return state.data.portfolio.tokenBalances[launchId] ?? "0";
}

export function selectEthBalance(state: DemoState): string {
  return state.data.portfolio.ethBalance;
}

export function selectLedger(
  state: DemoState,
  launchId?: string,
): HoldingLedgerEntry[] {
  return state.data.order.ledger
    .flatMap((id) => {
      const entry = state.data.entities.ledger[id];
      return entry && (!launchId || entry.launchId === launchId)
        ? [entry]
        : [];
    })
    .sort(
      (left, right) =>
        left.sequence - right.sequence || left.id.localeCompare(right.id),
    );
}

export interface PortfolioPosition {
  launch: LaunchRecord;
  tokenQuantity: string;
  averageCostEth: string;
  remainingCostBasisEth: string;
  estimatedValueEth: string;
  realizedPnlEth: string;
  unrealizedPnlEth: string;
  totalPnlEth: string;
}

export interface PortfolioTotals {
  ethBalance: string;
  costBasisEth: string;
  estimatedValueEth: string;
  realizedPnlEth: string;
  unrealizedPnlEth: string;
  totalPnlEth: string;
  positions: PortfolioPosition[];
}

function decimalValue(value: string): bigint {
  return parseDecimal(value) ?? 0n;
}

function buildPosition(
  launch: LaunchRecord,
  entries: HoldingLedgerEntry[],
): PortfolioPosition | null {
  let quantity = 0n;
  let costBasis = 0n;
  let realized = 0n;
  for (const entry of entries) {
    const tokenAmount = decimalValue(entry.tokenAmount);
    if (entry.side === "buy") {
      quantity += tokenAmount;
      costBasis += decimalValue(entry.grossInput);
      continue;
    }
    const sold = tokenAmount > quantity ? quantity : tokenAmount;
    const disposed =
      sold === quantity
        ? costBasis
        : quantity > 0n
          ? (costBasis * sold) / quantity
          : 0n;
    quantity -= sold;
    costBasis -= disposed;
    realized += decimalValue(entry.netOutput) - disposed;
  }
  if (quantity <= 0n && realized === 0n) return null;
  const price = ethPerTokenWei(launch.level);
  const currentValue = (quantity * price) / SCALE;
  const unrealized = currentValue - costBasis;
  const averageCost = quantity > 0n ? (costBasis * SCALE) / quantity : 0n;
  return {
    launch,
    tokenQuantity: formatDecimal(quantity, 18, 2),
    averageCostEth: formatDecimal(averageCost, 18, 2),
    remainingCostBasisEth: formatDecimal(costBasis, 18, 2),
    estimatedValueEth: formatDecimal(currentValue, 18, 2),
    realizedPnlEth: formatDecimal(realized, 18, 2),
    unrealizedPnlEth: formatDecimal(unrealized, 18, 2),
    totalPnlEth: formatDecimal(realized + unrealized, 18, 2),
  };
}

export function selectPortfolioPositions(
  state: DemoState,
): PortfolioPosition[] {
  return selectLaunches(state).flatMap((launch) => {
    const position = buildPosition(launch, selectLedger(state, launch.poolId));
    return position ? [position] : [];
  });
}

export function selectPortfolioTotals(state: DemoState): PortfolioTotals {
  const positions = selectPortfolioPositions(state);
  const sum = (
    key: keyof Pick<
      PortfolioPosition,
      | "remainingCostBasisEth"
      | "estimatedValueEth"
      | "realizedPnlEth"
      | "unrealizedPnlEth"
      | "totalPnlEth"
    >,
  ) =>
    positions.reduce(
      (total, position) => total + decimalValue(position[key]),
      0n,
    );
  return {
    ethBalance: state.data.portfolio.ethBalance,
    costBasisEth: formatDecimal(sum("remainingCostBasisEth"), 18, 4),
    estimatedValueEth: formatDecimal(sum("estimatedValueEth"), 18, 4),
    realizedPnlEth: formatDecimal(sum("realizedPnlEth"), 18, 4),
    unrealizedPnlEth: formatDecimal(sum("unrealizedPnlEth"), 18, 4),
    totalPnlEth: formatDecimal(sum("totalPnlEth"), 18, 4),
    positions,
  };
}

// -- payout plan display -------------------------------------------------------

/** Selected plugin count for a launch's stored plan bitset. */
export function selectPlanPluginCount(launch: LaunchRecord): number {
  return planIndices(BigInt(launch.payoutPlan)).length;
}

/** Flush tip preview for a pot: floor(1% of new pot). */
export function deriveFlushTipWei(potWei: string): string {
  const pot = decimalValue(potWei);
  if (pot <= 0n) return "0";
  return formatDecimal((pot * FLUSH_TIP_WAD) / WAD / WAD, 18, 6);
}

export const selectLaunch = selectLaunchById;
export const selectWatchlist = selectWatchlistedLaunches;
