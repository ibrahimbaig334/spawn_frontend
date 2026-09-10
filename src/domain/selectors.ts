import { PROTOCOL_TERMS } from "@/data/protocol-terms";
import type { DemoState } from "@/types/demo";
import type {
  ActivityRecord,
  Comment,
  HoldingLedgerEntry,
  Launch,
  LaunchId,
  MarketHistoryPoint,
  MilestoneView,
  Profile,
  ProfileId,
} from "@/types/launch";
import {
  currentFeeBps,
  formatDecimal,
  parseDecimal,
  targetValuationEth,
} from "./economics";

const SCALE = 10n ** 18n;

export type HistoryRange = "1D" | "7D" | "30D" | "All";

export interface LaunchActivity extends ActivityRecord {
  launchName: string;
  profile?: Profile;
}

export interface TokenSummary {
  launch: Launch;
  creator: Profile;
  priceEth: string;
  feeBps: number;
  latestActivity?: LaunchActivity;
}

export interface PortfolioPosition {
  launch: Launch;
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

export function selectLaunchById(
  state: DemoState,
  id: LaunchId,
): Launch | undefined {
  return state.data.entities.launches[id];
}

export function selectLaunchBySlug(
  state: DemoState,
  slug: string,
): Launch | undefined {
  return selectLaunches(state).find((launch) => launch.slug === slug);
}

export function selectLaunches(state: DemoState): Launch[] {
  return state.data.order.launches.flatMap((id) => {
    const launch = state.data.entities.launches[id];
    return launch ? [launch] : [];
  });
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
): Launch[] {
  return selectLaunches(state).filter(
    (launch) => launch.creatorProfileId === profileId,
  );
}

export function selectWatchlistedLaunches(state: DemoState): Launch[] {
  const watched = new Set(state.data.watchlist);
  return selectLaunches(state).filter((launch) => watched.has(launch.id));
}

export function selectIsWatched(state: DemoState, id: LaunchId): boolean {
  return state.data.watchlist.includes(id);
}

export function selectLaunchActivity(
  state: DemoState,
  launchId: LaunchId,
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
  return state.data.order.activities
    .flatMap((id) => {
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
    })
    .sort(
      (left, right) =>
        right.sequence - left.sequence || left.id.localeCompare(right.id),
    )
    .slice(0, limit);
}

export function selectProfileActivity(
  state: DemoState,
  profileId: ProfileId,
): LaunchActivity[] {
  const launchIds = new Set(
    selectProfileLaunches(state, profileId).map((launch) => launch.id),
  );
  return selectRecentActivity(state, state.data.order.activities.length).filter(
    (activity) =>
      activity.profileId === profileId || launchIds.has(activity.launchId),
  );
}

export function selectComments(
  state: DemoState,
  launchId: LaunchId,
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

export function selectHistory(
  state: DemoState,
  launchId: LaunchId,
): MarketHistoryPoint[] {
  return state.data.order.history
    .flatMap((id) => {
      const point = state.data.entities.history[id];
      return point?.launchId === launchId ? [point] : [];
    })
    .sort(
      (left, right) =>
        left.sequence - right.sequence || left.id.localeCompare(right.id),
    );
}

export function selectHistoryRange(
  state: DemoState,
  launchId: LaunchId,
  range: HistoryRange,
): MarketHistoryPoint[] {
  const points = selectHistory(state, launchId);
  if (range === "All" || points.length < 2) return points;
  const latest = points.at(-1);
  if (!latest) return points;
  const days = range === "1D" ? 1 : range === "7D" ? 7 : 30;
  const cutoff = Date.parse(latest.recordedAt) - days * 86_400_000;
  const firstInside = points.findIndex(
    (point) => Date.parse(point.recordedAt) >= cutoff,
  );
  if (firstInside <= 0) return points;
  return points.slice(firstInside - 1);
}

export function derivePriceEth(launch: Launch): string {
  const valuation = parseDecimal(launch.valuationEth);
  const supply = parseDecimal(launch.supply);
  if (valuation === null || supply === null || supply <= 0n) return "0";
  return formatDecimal((valuation * SCALE) / supply, 18, 12);
}

export function selectTokenSummary(
  state: DemoState,
  launch: Launch,
): TokenSummary | undefined {
  const creator = state.data.entities.profiles[launch.creatorProfileId];
  if (!creator) return undefined;
  return {
    launch,
    creator,
    priceEth: derivePriceEth(launch),
    feeBps: currentFeeBps(
      launch.completedMilestones + launch.additionalMilestones,
    ),
    latestActivity: selectLaunchActivity(state, launch.id)[0],
  };
}

function allocationEth(number: number): string {
  const target = parseDecimal(targetValuationEth(number));
  const previous = parseDecimal(targetValuationEth(number - 1));
  if (target === null || previous === null) return "0";
  const value =
    ((target - previous) * BigInt(PROTOCOL_TERMS.milestoneShareBps)) / 10_000n;
  return formatDecimal(value, 18, 2);
}

export function selectMilestones(launch: Launch, count = 6): MilestoneView[] {
  if (!Number.isInteger(count) || count <= 0) return [];
  const completed = launch.completedMilestones + launch.additionalMilestones;
  const maximum =
    PROTOCOL_TERMS.coreMilestones + PROTOCOL_TERMS.maxAdditionalMilestones;
  const start = Math.max(
    1,
    Math.min(completed - 1, Math.max(1, maximum - count + 1)),
  );
  const end = Math.min(maximum, start + count - 1);
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => {
    const number = start + index;
    return {
      number,
      state:
        number <= completed
          ? "completed"
          : number === completed + 1
            ? "next"
            : "ahead",
      targetEth: targetValuationEth(number),
      allocationEth: allocationEth(number),
      feeBps: currentFeeBps(number),
    };
  });
}

export function selectAllMilestones(launch: Launch): MilestoneView[] {
  return selectMilestones(
    launch,
    PROTOCOL_TERMS.coreMilestones + PROTOCOL_TERMS.maxAdditionalMilestones,
  );
}

export function selectNextMilestone(launch: Launch): MilestoneView | null {
  const completed = launch.completedMilestones + launch.additionalMilestones;
  const maximum =
    PROTOCOL_TERMS.coreMilestones + PROTOCOL_TERMS.maxAdditionalMilestones;
  if (completed >= maximum) return null;
  const number = completed + 1;
  return {
    number,
    state: "next",
    targetEth: targetValuationEth(number),
    allocationEth: allocationEth(number),
    feeBps: currentFeeBps(number),
  };
}

export function selectCompletionBps(launch: Launch): number {
  const maximum =
    PROTOCOL_TERMS.coreMilestones + PROTOCOL_TERMS.maxAdditionalMilestones;
  return Math.round(
    ((launch.completedMilestones + launch.additionalMilestones) * 10_000) /
      maximum,
  );
}

export function selectLedger(
  state: DemoState,
  launchId?: LaunchId,
): HoldingLedgerEntry[] {
  return state.data.order.ledger
    .flatMap((id) => {
      const entry = state.data.entities.ledger[id];
      return entry && (!launchId || entry.launchId === launchId) ? [entry] : [];
    })
    .sort(
      (left, right) =>
        left.sequence - right.sequence || left.id.localeCompare(right.id),
    );
}

function decimal(value: string): bigint {
  return parseDecimal(value) ?? 0n;
}

function buildPosition(
  launch: Launch,
  entries: HoldingLedgerEntry[],
): PortfolioPosition | null {
  let quantity = 0n;
  let costBasis = 0n;
  let realized = 0n;
  for (const entry of entries) {
    const tokenAmount = decimal(entry.tokenAmount);
    if (entry.side === "buy") {
      quantity += tokenAmount;
      costBasis += decimal(entry.grossEth);
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
    realized += decimal(entry.netEth) - disposed;
  }
  if (quantity <= 0n && realized === 0n) return null;
  const valuation = decimal(launch.valuationEth);
  const supply = decimal(launch.supply);
  const currentValue = supply > 0n ? (quantity * valuation) / supply : 0n;
  const unrealized = currentValue - costBasis;
  const averageCost = quantity > 0n ? (costBasis * SCALE) / quantity : 0n;
  return {
    launch,
    tokenQuantity: formatDecimal(quantity, 18, 8),
    averageCostEth: formatDecimal(averageCost, 18, 12),
    remainingCostBasisEth: formatDecimal(costBasis, 18, 8),
    estimatedValueEth: formatDecimal(currentValue, 18, 8),
    realizedPnlEth: formatDecimal(realized, 18, 8),
    unrealizedPnlEth: formatDecimal(unrealized, 18, 8),
    totalPnlEth: formatDecimal(realized + unrealized, 18, 8),
  };
}

export function selectPortfolioPositions(
  state: DemoState,
): PortfolioPosition[] {
  return selectLaunches(state).flatMap((launch) => {
    const position = buildPosition(launch, selectLedger(state, launch.id));
    return position ? [position] : [];
  });
}

export function selectTokenBalance(
  state: DemoState,
  launchId: LaunchId,
): string {
  let quantity = 0n;
  for (const entry of selectLedger(state, launchId)) {
    const amount = decimal(entry.tokenAmount);
    quantity += entry.side === "buy" ? amount : -amount;
  }
  return formatDecimal(quantity > 0n ? quantity : 0n, 18, 18);
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
    positions.reduce((total, position) => total + decimal(position[key]), 0n);
  return {
    ethBalance: state.data.portfolio.ethBalance,
    costBasisEth: formatDecimal(sum("remainingCostBasisEth"), 18, 8),
    estimatedValueEth: formatDecimal(sum("estimatedValueEth"), 18, 8),
    realizedPnlEth: formatDecimal(sum("realizedPnlEth"), 18, 8),
    unrealizedPnlEth: formatDecimal(sum("unrealizedPnlEth"), 18, 8),
    totalPnlEth: formatDecimal(sum("totalPnlEth"), 18, 8),
    positions,
  };
}

export const selectLaunch = selectLaunchById;
export const selectWatchlist = selectWatchlistedLaunches;
