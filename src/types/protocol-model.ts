/**
 * Protocol entity types mirroring the Spawn launchpad contract surface.
 *
 * These types are the frontend's stable model of the on-chain state described
 * in the integration handoff: one hook keyed by PoolId, the phase state
 * machine, band geometry, payout pots and carry, the claim matrix, and the
 * launch configuration with its signed payout plan bitset.
 */

export type PoolId = string;
export type Hex = `0x${string}`;
export type Wei = string;
export type Wad = string;
export type Level = number;
export type UnixSeconds = number;

/** Phase enum (0-indexed) — advances one way, never reverts. */
export type PoolPhase = "none" | "bonding-curve" | "graduated";
export const POOL_PHASE_ORDER: readonly PoolPhase[] = [
  "none",
  "bonding-curve",
  "graduated",
] as const;

/** LaunchConfig struct exactly as the protocol defines it (integration §4.1). */
export interface LaunchConfig {
  creator: Hex;
  name: string;
  symbol: string;
  totalSupply: string;
  /** WAD share of supply, hard cap 0.1e18. */
  devBuyShareWad: string;
  /** Bitset of registry indices — bit i selects registry entry i. */
  payoutPlan: string;
  /** unix seconds, checked against block.timestamp. */
  deadline: UnixSeconds;
}

/** PoolKey for the one ETH-vs-token v4 pool per launch (integration §5.1). */
export interface PoolKey {
  currency0: Hex;
  currency1: Hex;
  fee: number;
  tickSpacing: number;
  hooks: Hex;
}

/** Registry entry terms (immutable after registration). */
export interface PluginEntry {
  index: number;
  plugin: Hex;
  takeWad: string;
  gasLimit: number;
  role: "payout" | "creator-system" | "utility" | "invalid";
  suspended: boolean;
  /** Registered codehash; a live mismatch permanently redirects value. */
  codeHash: Hex;
}

/** Live per-pool view assembled from hook + StateView reads. */
export interface PoolStateView {
  poolId: PoolId;
  phase: PoolPhase;
  /** level = -tick from StateView.getSlot0. */
  level: Level;
  openingLevel: Level;
  farLevel: Level;
  graduationLevel?: Level;
  totalSupplyWei: string;
  /** Cumulative band states; geometry stored verbatim from BandDeployed. */
  bands: BandView[];
  completedMilestones: number;
  /** Payout pot (net milestone proceeds, ERC-6909 claim backed until flush). */
  payoutPotWei: Wei;
  /** Bitmap of plugin indices with non-zero failed-delivery carry. */
  carryBitmap: string;
}

export type BandState = "undeployed" | "deployed" | "completed" | "skipped";

/** One milestone ladder band (geometry never recomputed from stale levels). */
export interface BandView {
  index: number;
  state: BandState;
  levelLower: Level;
  levelUpper: Level;
  tokenInventoryWei?: string;
  deployedAt?: UnixSeconds;
}

/** The claim matrix (integration §7.2). */
export interface ClaimBalances {
  /** Direct creator revenue: graduation 55% + quote-fee share. Raw ETH. */
  directCreatorWei: Wei;
  /** Creator-path entitlement: flush remainder + permanent redirects. */
  creatorPathWei: Wei;
  /** Net pot awaiting a flush (claim-backed). */
  payoutPotWei: Wei;
  /** Per-pool plugin carry from failed deliveries. */
  pluginCarryWei: Record<number, Wei>;
}

/** Where a displayed amount of value came from / goes to. */
export type ValueFlow =
  | "graduation-creator"
  | "graduation-protocol"
  | "graduation-lp"
  | "swap-fee-creator"
  | "swap-fee-protocol"
  | "swap-fee-milestone-fund"
  | "swap-fee-burn"
  | "harvest-service-fee"
  | "harvest-pot"
  | "flush-tip"
  | "plugin-delivery"
  | "creator-path";

/** Parsed hook event shapes the indexer/API layer will deliver. */
export type ProtocolEvent =
  | {
      kind: "Launched";
      poolId: PoolId;
      creator: Hex;
      token: Hex;
      totalSupply: string;
      openingLevel: Level;
      farLevel: Level;
      configHash: Hex;
    }
  | {
      kind: "LaunchConfigured";
      poolId: PoolId;
      payoutPlan: string;
      devBuyShareWad: string;
    }
  | {
      kind: "DevBuyExecuted";
      poolId: PoolId;
      tokensBought: string;
      ethSpent: string;
    }
  | {
      kind: "DevBuySkipped";
      poolId: PoolId;
      relayer: Hex;
      tokensRequested: string;
    }
  | {
      kind: "Graduated";
      poolId: PoolId;
      graduationLevel: Level;
      quoteProceeds: string;
      lpSeedQuote: string;
      creatorQuote: string;
      protocolQuote: string;
      fullRangeLiquidity: string;
    }
  | {
      kind: "MilestoneHarvested";
      poolId: PoolId;
      index: number;
      quoteProceeds: string;
      tokenResidue: string;
      completedMilestones: number;
    }
  | {
      kind: "PayoutPotFunded";
      poolId: PoolId;
      milestoneIndex: number;
      grossQuote: string;
      serviceFee: string;
      netQuote: string;
      economicVersion: number;
    }
  | {
      kind: "PayoutPotRedeemed";
      poolId: PoolId;
      amount: string;
    }
  | {
      kind: "PayoutTipPaid";
      poolId: PoolId;
      flusher: Hex;
      amount: string;
    }
  | {
      kind: "PluginPayoutDelivered";
      poolId: PoolId;
      pluginIndex: number;
      plugin: Hex;
      currentShare: string;
      previousCarry: string;
      delivered: string;
    }
  | {
      kind: "PluginPayoutCarried";
      poolId: PoolId;
      pluginIndex: number;
      plugin: Hex;
      currentShare: string;
      previousCarry: string;
      carried: string;
    }
  | {
      kind: "PluginPayoutRedirected";
      poolId: PoolId;
      pluginIndex: number;
      currentShare: string;
      previousCarry: string;
      redirected: string;
    }
  | {
      kind: "CreatorPathAccrued";
      poolId: PoolId;
      amount: string;
    }
  | {
      kind: "CreatorClaimed";
      poolId: PoolId;
      holder: Hex;
      amount: string;
    }
  | {
      kind: "CreatorPathClaimed";
      poolId: PoolId;
      holder: Hex;
      amount: string;
    }
  | {
      kind: "CreatorPathClaimFailed";
      poolId: PoolId;
      holder: Hex;
      amount: string;
    }
  | {
      kind: "CreatorAccrued" | "ProtocolAccrued";
      poolId: PoolId;
      amount: string;
      source: "curve-proceeds" | "swap-fees" | "milestone-harvest";
      economicVersion: number;
    }
  | {
      kind: "ProtocolClaimed";
      recipient: Hex;
      amount: string;
    }
  | {
      kind: "FeesCollected";
      poolId: PoolId;
      caller: Hex;
      quoteFees: string;
      tokenFees: string;
    }
  | {
      kind: "FeesRouted";
      poolId: PoolId;
      creatorQuote: string;
      protocolQuote: string;
      divertedToNextBand: string;
      tokensBurned: string;
      economicVersion: number;
    }
  | {
      kind: "BandDeployed";
      poolId: PoolId;
      index: number;
      levelLower: Level;
      levelUpper: Level;
      liquidity: string;
      tokenInventory: string;
    }
  | {
      kind: "BandSkipped";
      poolId: PoolId;
      index: number;
      carriedInventory: string;
    }
  | {
      kind: "CurvePositionsDeployed";
      poolId: PoolId;
      minted: number;
      deployed: number;
      tokenSettled: string;
    }
  | {
      kind: "EconomicConfigSet";
      version: number;
      harvestServiceFeeWad: string;
      quoteCreatorShareWad: string;
      tokenMilestoneFundShareWad: string;
    };
