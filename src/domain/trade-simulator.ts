import { PROTOCOL_TERMS } from "@/data/protocol-terms";
import type {
  ActivityRecord,
  HoldingLedgerEntry,
  Launch,
  MarketHistoryPoint,
  TradeContext,
  TradePreview,
  TradeRequest,
  TradeResult,
  TradeSide,
} from "@/types/launch";
import { demoTimestamp } from "./demo-time";
import {
  currentFeeBps,
  formatDecimal,
  parseDecimal,
  splitAmount,
  targetValuationEth,
} from "./economics";

const BPS = 10_000n;
const DECIMALS = 18;

export class TradeSimulationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TradeSimulationError";
  }
}

function requirePositive(value: string, unit: "ETH" | "token"): bigint {
  const parsed = parseDecimal(value, DECIMALS);
  if (parsed === null || parsed <= 0n) {
    throw new TradeSimulationError(
      `Enter a positive ${unit} amount with no more than 18 decimal places.`,
    );
  }
  return parsed;
}

function requireDecimal(
  value: string,
  message = "The launch contains an invalid decimal value.",
): bigint {
  const parsed = parseDecimal(value, DECIMALS);
  if (parsed === null) throw new TradeSimulationError(message);
  return parsed;
}

function completed(launch: Launch): number {
  return launch.completedMilestones + launch.additionalMilestones;
}

function progressImpact(amountEth: bigint, valuationEth: bigint): bigint {
  const impact = (amountEth * BPS) / (valuationEth > 0n ? valuationEth : 1n);
  return impact > 0n ? impact : 1n;
}

function buyProgress(launch: Launch, impact: bigint) {
  const remaining =
    PROTOCOL_TERMS.coreMilestones +
    PROTOCOL_TERMS.maxAdditionalMilestones -
    completed(launch);
  if (remaining <= 0)
    return { progressBps: launch.progressBps, newlyCompleted: 0 };
  const maximum = Math.min(PROTOCOL_TERMS.maxCompletionsPerTrade, remaining);
  const accumulated = BigInt(launch.progressBps) + impact;
  const newlyCompleted = Number(
    accumulated / BPS < BigInt(maximum) ? accumulated / BPS : BigInt(maximum),
  );
  const remainder = accumulated - BigInt(newlyCompleted) * BPS;
  return {
    progressBps: Number(remainder < 9_999n ? remainder : 9_999n),
    newlyCompleted,
  };
}

function tradeAmounts(launch: Launch, request: TradeRequest, feeBps: number) {
  const supply = requireDecimal(launch.supply);
  const valuation = requireDecimal(launch.valuationEth);
  if (supply <= 0n || valuation <= 0n)
    throw new TradeSimulationError(
      "This demo market cannot calculate a trade.",
    );

  if (request.side === "buy") {
    const grossEth = requirePositive(request.amount, "ETH");
    const feeEth = (grossEth * BigInt(feeBps)) / BPS;
    const netEth = grossEth - feeEth;
    return {
      grossEth,
      feeEth,
      netEth,
      tokenAmount: (netEth * supply) / valuation,
    };
  }

  const tokenAmount = requirePositive(request.amount, "token");
  const grossEth = (tokenAmount * valuation) / supply;
  const feeEth = (grossEth * BigInt(feeBps)) / BPS;
  return { grossEth, feeEth, netEth: grossEth - feeEth, tokenAmount };
}

function validateBalance(
  request: TradeRequest,
  context: TradeContext,
  grossEth: bigint,
  tokenAmount: bigint,
) {
  const ethBalance = requireDecimal(
    context.ethBalance,
    "The demo ETH balance is invalid.",
  );
  const tokenBalance = requireDecimal(
    context.tokenBalance,
    "The demo token balance is invalid.",
  );
  if (request.side === "buy" && grossEth > ethBalance) {
    throw new TradeSimulationError(
      "This buy exceeds the available demo ETH balance.",
    );
  }
  if (request.side === "sell" && tokenAmount > tokenBalance) {
    throw new TradeSimulationError(
      "This sell exceeds the available demo token balance.",
    );
  }
}

function valuationFor(
  launch: Launch,
  totalCompleted: number,
  progressBps: number,
  side: TradeSide,
): string {
  const current = requireDecimal(launch.valuationEth);
  if (side === "sell") {
    if (launch.progressBps <= 0) return launch.valuationEth;
    const floor = requireDecimal(targetValuationEth(totalCompleted));
    const spread = current > floor ? current - floor : 0n;
    const decrease =
      (spread * BigInt(launch.progressBps - progressBps)) /
      BigInt(launch.progressBps);
    return formatDecimal(current - decrease, DECIMALS, 8);
  }
  const lower = requireDecimal(targetValuationEth(totalCompleted));
  const upper = requireDecimal(targetValuationEth(totalCompleted + 1));
  return formatDecimal(
    lower + ((upper - lower) * BigInt(progressBps)) / BPS,
    DECIMALS,
    8,
  );
}

export function previewTrade(
  launch: Launch,
  request: TradeRequest,
  context: TradeContext,
): TradePreview {
  const feeBps = currentFeeBps(completed(launch));
  const amounts = tradeAmounts(launch, request, feeBps);
  validateBalance(request, context, amounts.grossEth, amounts.tokenAmount);
  const impact = progressImpact(
    amounts.grossEth,
    requireDecimal(launch.valuationEth),
  );
  const progress =
    request.side === "buy"
      ? buyProgress(launch, impact)
      : {
          progressBps: Number(
            impact >= BigInt(launch.progressBps)
              ? 0n
              : BigInt(launch.progressBps) - impact,
          ),
          newlyCompleted: 0,
        };

  return {
    side: request.side,
    inputAmount: formatDecimal(
      request.side === "buy" ? amounts.grossEth : amounts.tokenAmount,
      DECIMALS,
      DECIMALS,
    ),
    inputUnit: request.side === "buy" ? "ETH" : "token",
    estimatedOutput: formatDecimal(
      request.side === "buy" ? amounts.tokenAmount : amounts.netEth,
      DECIMALS,
      12,
    ),
    outputUnit: request.side === "buy" ? "token" : "ETH",
    grossEth: formatDecimal(amounts.grossEth, DECIMALS, DECIMALS),
    feeEth: formatDecimal(amounts.feeEth, DECIMALS, DECIMALS),
    tokenAmount: formatDecimal(amounts.tokenAmount, DECIMALS, DECIMALS),
    beforeProgressBps: launch.progressBps,
    afterProgressBps: progress.progressBps,
    newlyCompleted: progress.newlyCompleted,
    feeBps,
  };
}

function buildActivities(
  launch: Launch,
  preview: TradePreview,
  sequence: number,
  receiptId: string,
): ActivityRecord[] {
  const occurredAt = demoTimestamp(sequence);
  const trade: ActivityRecord = {
    id: `activity-${launch.id}-${preview.side}-${sequence}`,
    launchId: launch.id,
    profileId: "profile-local",
    kind: preview.side,
    amountEth: preview.grossEth,
    tokenAmount: preview.tokenAmount,
    receiptId,
    sequence,
    occurredAt,
    source: "local-simulation",
  };
  const firstMilestone = completed(launch) + 1;
  const milestones = Array.from(
    { length: preview.newlyCompleted },
    (_, index): ActivityRecord => {
      const milestoneSequence = sequence + index + 1;
      return {
        id: `activity-${launch.id}-milestone-${firstMilestone + index}-${milestoneSequence}`,
        launchId: launch.id,
        kind: "milestone",
        amountEth: preview.grossEth,
        milestoneNumber: firstMilestone + index,
        receiptId,
        sequence: milestoneSequence,
        occurredAt: demoTimestamp(milestoneSequence),
        source: "local-simulation",
      };
    },
  );
  return [trade, ...milestones];
}

export function simulateTrade(
  launch: Launch,
  request: TradeRequest,
  context: TradeContext,
  sequence: number,
): TradeResult {
  if (!Number.isSafeInteger(sequence) || sequence < 0) {
    throw new TradeSimulationError(
      "A non-negative deterministic sequence is required.",
    );
  }
  const preview = previewTrade(launch, request, context);
  const oldCompleted = completed(launch);
  const coreIncrease = Math.min(
    PROTOCOL_TERMS.coreMilestones - launch.completedMilestones,
    preview.newlyCompleted,
  );
  const completedMilestones =
    launch.completedMilestones + Math.max(0, coreIncrease);
  const additionalMilestones =
    launch.additionalMilestones +
    preview.newlyCompleted -
    Math.max(0, coreIncrease);
  const allocation =
    preview.newlyCompleted > 0
      ? splitAmount(requireDecimal(preview.grossEth), launch.proceedsSplit)
      : null;
  const valuationEth = valuationFor(
    launch,
    oldCompleted + preview.newlyCompleted,
    preview.afterProgressBps,
    preview.side,
  );
  const removed = allocation
    ? (allocation.buyback * requireDecimal(launch.supply)) /
      requireDecimal(launch.valuationEth)
    : 0n;

  const updatedLaunch: Launch = {
    ...launch,
    stage:
      completedMilestones >= PROTOCOL_TERMS.coreMilestones
        ? "core-complete"
        : completedMilestones > 0
          ? "milestones"
          : "launch",
    valuationEth,
    progressBps: preview.afterProgressBps,
    completedMilestones,
    additionalMilestones,
    liquidityEth: allocation
      ? formatDecimal(
          requireDecimal(launch.liquidityEth) + allocation.liquidity,
          DECIMALS,
          12,
        )
      : launch.liquidityEth,
    removedTokens: allocation
      ? formatDecimal(
          requireDecimal(launch.removedTokens) + removed,
          DECIMALS,
          12,
        )
      : launch.removedTokens,
    creatorClaimableEth: allocation
      ? formatDecimal(
          requireDecimal(launch.creatorClaimableEth) + allocation.creator,
          DECIMALS,
          12,
        )
      : launch.creatorClaimableEth,
  };

  const receiptId = `demo_${launch.id}_${sequence}`;
  const activities = buildActivities(launch, preview, sequence, receiptId);
  const finalSequence = sequence + activities.length - 1;
  const historyPoint: MarketHistoryPoint = {
    id: `history-${launch.id}-${finalSequence}`,
    launchId: launch.id,
    valuationEth,
    sequence: finalSequence,
    recordedAt: demoTimestamp(finalSequence),
    source: "local-simulation",
  };
  const ledgerEntry: HoldingLedgerEntry = {
    id: `ledger-${launch.id}-${sequence}`,
    launchId: launch.id,
    side: request.side,
    tokenAmount: preview.tokenAmount,
    grossEth: preview.grossEth,
    feeEth: preview.feeEth,
    netEth:
      request.side === "buy"
        ? formatDecimal(
            requireDecimal(preview.grossEth) - requireDecimal(preview.feeEth),
            DECIMALS,
            DECIMALS,
          )
        : preview.estimatedOutput,
    receiptId,
    sequence,
    occurredAt: demoTimestamp(sequence),
    origin: "simulation",
  };
  const currentEth = requireDecimal(
    context.ethBalance,
    "The demo ETH balance is invalid.",
  );
  const nextEth =
    request.side === "buy"
      ? currentEth - requireDecimal(preview.grossEth)
      : currentEth + requireDecimal(ledgerEntry.netEth);

  return {
    ...preview,
    launch: updatedLaunch,
    ethBalance: formatDecimal(nextEth, DECIMALS, DECIMALS),
    ledgerEntry,
    historyPoint,
    activities,
    receiptId,
    nextSequence: finalSequence + 1,
  };
}

export const executeTrade = simulateTrade;
