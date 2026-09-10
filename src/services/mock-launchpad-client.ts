import { PROTOCOL_TERMS } from "@/data/protocol-terms";
import { demoTimestamp } from "@/domain/demo-time";
import { formatDecimal, parseDecimal } from "@/domain/economics";
import type { LaunchDraft } from "@/domain/launch-validation";
import { validateLaunchDraft } from "@/domain/launch-validation";
import { previewTrade, simulateTrade } from "@/domain/trade-simulator";
import type { CreateLaunchResult, Launch } from "@/types/launch";
import { DEMO_CAPABILITIES, type LaunchpadClient } from "./launchpad-client";

function slugFor(name: string, sequence: number): string {
  const base =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "launch";
  return `${base}-${sequence}`;
}

function normalizedSupply(value: string): string {
  const parsed = parseDecimal(value);
  if (parsed === null || parsed <= 0n)
    throw new Error("Supply must be a positive decimal string.");
  return formatDecimal(parsed, 18, 18);
}

export function createMockLaunch(
  draft: LaunchDraft,
  sequence: number,
): CreateLaunchResult {
  if (!Number.isSafeInteger(sequence) || sequence < 0) {
    throw new Error("Launch sequence must be a non-negative safe integer.");
  }
  const firstError = Object.values(validateLaunchDraft(draft, true))[0];
  if (firstError) throw new Error(firstError);

  const slug = slugFor(draft.name, sequence);
  const id = `launch-local-${sequence}`;
  const createdAt = demoTimestamp(sequence);
  const launch: Launch = {
    id,
    slug,
    creatorProfileId: "profile-local",
    name: draft.name.trim(),
    symbol: draft.symbol.trim().toUpperCase(),
    description: draft.description.trim(),
    stage: "launch",
    supply: normalizedSupply(draft.supply),
    valuationEth: PROTOCOL_TERMS.openingValuationEth,
    progressBps: 0,
    completedMilestones: 0,
    additionalMilestones: 0,
    proceedsSplit: { ...draft.split },
    creatorPurchase: {
      enabled: draft.creatorPurchaseEnabled,
      shareBps: draft.creatorPurchaseEnabled ? draft.creatorPurchaseBps : 0,
      lockupMonths: draft.creatorPurchaseEnabled ? draft.lockupMonths : 0,
    },
    liquidityEth: "0",
    removedTokens: "0",
    creatorClaimableEth: "0",
    createdSequence: sequence,
    createdAt,
    source: "local-simulation",
    visualSeed: sequence,
  };

  return {
    launch,
    activity: {
      id: `activity-${id}-created-${sequence}`,
      launchId: id,
      profileId: "profile-local",
      kind: "created",
      sequence,
      occurredAt: createdAt,
      source: "local-simulation",
    },
    historyPoint: {
      id: `history-${id}-${sequence}`,
      launchId: id,
      valuationEth: launch.valuationEth,
      sequence,
      recordedAt: createdAt,
      source: "local-simulation",
    },
    nextSequence: sequence + 1,
  };
}

export class MockLaunchpadClient implements LaunchpadClient {
  readonly capabilities = DEMO_CAPABILITIES;

  async previewTrade(...args: Parameters<LaunchpadClient["previewTrade"]>) {
    return previewTrade(...args);
  }

  async executeTrade(...args: Parameters<LaunchpadClient["executeTrade"]>) {
    return simulateTrade(...args);
  }

  async createLaunch(...args: Parameters<LaunchpadClient["createLaunch"]>) {
    return createMockLaunch(...args);
  }
}

export const mockLaunchpadClient: LaunchpadClient = new MockLaunchpadClient();
