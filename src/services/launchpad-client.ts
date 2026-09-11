/**
 * The launchpad client boundary.
 *
 * One interface, two implementations:
 *  - `MockLaunchpadClient` — the deterministic in-browser protocol simulator
 *    (current mode; the contracts are not deployed yet).
 *  - `ChainLaunchpadClient` (future) — wraps viem + the deployment manifest:
 *    V4Quoter quotes, hook transactions, StateView reads. Built once the
 *    backend exists; the UI contract below is already final.
 *
 * Backend note: the REST/indexer backend is still in development. When it
 * ships, its API is consumed by the Chain implementation (or a
 * `ApiLaunchpadClient`); nothing in the UI layer assumes response shapes —
 * every method here returns the protocol model types the UI renders.
 */

import type {
  ClaimBalances,
  Hex,
  LaunchConfig,
  PluginEntry,
  PoolId,
  PoolPhase,
  PoolStateView,
} from "@/types/protocol-model";
import type { ProtocolEvent } from "@/types/protocol-model";

export type ClientMode = "local-simulation" | "chain";

export interface ClientCapabilities {
  mode: ClientMode;
  /** True once a deployment manifest exists and a signer can connect. */
  wallet: boolean;
  contracts: boolean;
  marketFeed: boolean;
  transactions: boolean;
  persistence: "browser-local" | "chain-rpc" | "backend-api";
}

export const SIMULATION_CAPABILITIES: ClientCapabilities = {
  mode: "local-simulation",
  wallet: false,
  contracts: false,
  marketFeed: false,
  transactions: false,
  persistence: "browser-local",
};

/** Off-chain launch metadata the backend will persist (IPFS logo, socials). */
export interface LaunchMetadata {
  /** Rich text (max 500 characters), rendered as plain text in v1. */
  description: string;
  /** IPFS gateway URL of the uploaded logo. */
  logoUrl?: string;
  socials: {
    website?: string;
    x?: string;
    telegram?: string;
    discord?: string;
  };
}

/** A tradable launch as the UI models it, in level space. */
export interface LaunchRecord {
  poolId: PoolId;
  slug: string;
  creator: Hex;
  token: Hex;
  name: string;
  symbol: string;
  totalSupplyWei: string;
  phase: PoolPhase;
  level: number;
  openingLevel: number;
  farLevel: number;
  graduationLevel?: number;
  payoutPlan: string;
  devBuyShareWad: string;
  payoutPotWei: string;
  carryBitmap: string;
  completedMilestones: number;
  createdAt: string;
  /** Off-chain metadata; older/local records may omit it. */
  metadata?: LaunchMetadata;
}

export type TradeSide = "buy" | "sell";

export interface TradeRequest {
  side: TradeSide;
  /** Raw decimal string; ETH for buys, token for sells. */
  amount: string;
}

/** Quote math result (single-swap, re-quote on submission errors). */
export interface TradePreview {
  side: TradeSide;
  inputAmount: string;
  inputUnit: "ETH" | "token";
  estimatedOutput: string;
  outputUnit: "ETH" | "token";
  /** The 1% trading fee in the input currency (ETH on buys, token on sells). */
  feeAmount: string;
  feeUnit: "ETH" | "token";
  levelBefore: number;
  levelAfter: number;
  /** Bands the simulated path completes (post-swap level >= band upper). */
  milestonesCompleted: number;
  /** True when levelAfter >= farLevel - 1: next trade can graduate. */
  graduationNext: boolean;
}

export interface TradeResult extends TradePreview {
  launch: LaunchRecord;
  events: ProtocolEvent[];
  ethBalance: string;
  tokenBalance: string;
}

export interface CreateLaunchResult {
  launch: LaunchRecord;
  events: ProtocolEvent[];
  nextSequence: number;
}

/** Flush outcome covering the whole claim matrix (integration §7.2). */
export interface FlushOutcome {
  /** Net new pot redeemed (0 on carry-only or no-op flushes). */
  redeemedWei: string;
  /** floor(1% of new pot) paid to the flusher (0 on carry-only). */
  tipWei: string;
  deliveries: Array<{
    pluginIndex: number;
    status: "delivered" | "carried" | "redirected";
    amountWei: string;
  }>;
  creatorPathAccruedWei: string;
}

export interface ClaimOutcome {
  path: "direct" | "creator-path" | "protocol";
  success: boolean;
  attemptedWei: string;
}

export interface LaunchpadClient {
  readonly capabilities: ClientCapabilities;

  // Registry / config ------------------------------------------------------
  /** Live registry entries (append-only, stable indices). */
  listPluginEntries(): Promise<PluginEntry[]>;
  /** Active economic tuple (defaults 10% / 75% / 20%, version 1). */
  getEconomicConfig(): Promise<{
    version: number;
    harvestServiceFeeWad: string;
    quoteCreatorShareWad: string;
    tokenMilestoneFundShareWad: string;
  }>;

  // Launch flow ------------------------------------------------------------
  /** Validation mirroring LaunchSupport.validate (bounds + registry plan). */
  validateLaunchConfig(config: LaunchConfig): Promise<string[]>;
  /** Deterministic token address before any signature. */
  predictTokenAddress(config: LaunchConfig): Promise<Hex>;
  /** EIP-712 digest for cross-check against LaunchSupport.launchDigest. */
  computeLaunchDigest(config: LaunchConfig): Promise<Hex>;
  /**
   * Launch. Self-send mode attaches the dev-buy budget; relay mode (signature
   * present, third-party sender) skips the dev buy. Simulation always runs
   * the creator-self-send path. The metadata bag is off-chain (backend
   * persists it); it never enters the signed configuration.
   */
  createLaunch(
    config: LaunchConfig,
    sequence: number,
    metadata?: LaunchMetadata,
  ): Promise<CreateLaunchResult>;

  // Trading ---------------------------------------------------------------
  previewTrade(
    launch: LaunchRecord,
    request: TradeRequest,
  ): Promise<TradePreview>;
  executeTrade(
    launch: LaunchRecord,
    request: TradeRequest,
    sequence: number,
  ): Promise<TradeResult>;
  /** Deliberate graduation (permissionless, idempotent race with swaps). */
  graduate(launch: LaunchRecord, sequence: number): Promise<TradeResult>;

  // Pool views ------------------------------------------------------------
  getPoolState(launch: LaunchRecord): Promise<PoolStateView>;
  getClaimBalances(launch: LaunchRecord): Promise<ClaimBalances>;

  // Claims / flush / keeper actions ---------------------------------------
  /** Permissionless whole-pot flush; caller earns floor(1% of new pot). */
  flushPool(launch: LaunchRecord, sequence: number): Promise<FlushOutcome>;
  /** NFT-holder direct claim (graduation + quote fees). */
  claimDirect(launch: LaunchRecord, sequence: number): Promise<ClaimOutcome>;
  /** Holder-paid creator-path claim; flushes first, includes the tip. */
  claimCreatorPath(
    launch: LaunchRecord,
    sequence: number,
  ): Promise<ClaimOutcome>;

  // Event stream ----------------------------------------------------------
  /** Recent protocol events for a pool (indexer feed or simulation log). */
  getLaunchEvents(
    launch: LaunchRecord,
    limit?: number,
  ): Promise<ProtocolEvent[]>;
}
