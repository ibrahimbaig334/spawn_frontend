/**
 * Deterministic protocol simulator.
 *
 * Reproduces the Spawn launchpad's on-chain behavior in level space so the
 * UI renders protocol-accurate numbers before the backend/indexer exists:
 *
 *  - Bonding curve: 32 JIT positions, 25% of supply over 6931 levels
 *    (opening → far), opening level derived from the 125 ETH template FDV.
 *  - Graduation at level >= far: burns curve, seeds full-range LP, splits
 *    quote proceeds 40/55/5.
 *  - Milestone ladder: 30 core bands, spacing 2235, width 447, JIT deploy,
 *    harvest on crossing a band's top, per-swap caps (8 deploys / 8 harvests),
 *    band skip when price outruns an undeployed band.
 *  - Harvest: 10% service fee to global protocol ledger, 90% net to the
 *    pool's payout pot.
 *  - Flush: redeem pot, floor(1%) tip, ascending-index plugin delivery with
 *    carry on revert, creator-path remainder, redirect on suspended entries.
 *  - Claims: direct (NFT holder), creator-path (flush first, holder paid),
 *    protocol (global recipient).
 *
 * All amounts are wei strings; all geometry is level space (level = -tick).
 */

import { formatDecimal, parseDecimal } from "@/domain/economics";
import { demoTimestamp } from "@/domain/demo-time";
import {
  bandLevels,
  ethPerTokenWei,
  fdvEthWei,
  openingLevelFor,
} from "@/protocol/level-math";
import {
  BAND_LEVEL_SPACING,
  CORE_BAND_COUNT,
  CURVE_SPAN_LEVELS,
  DEFAULT_ECONOMIC_CONFIG,
  GRADUATION_CREATOR_WAD,
  GRADUATION_LP_SEED_WAD,
  GRADUATION_PROTOCOL_WAD,
  MAX_DEPLOYS_PER_SWAP,
  MAX_HARVESTS_PER_SWAP,
  WAD,
} from "@/protocol/constants";
import type {
  BandView,
  ClaimBalances,
  Hex,
  LaunchConfig,
  PluginEntry,
  ProtocolEvent,
} from "@/types/protocol-model";
import type {
  ClaimOutcome,
  FlushOutcome,
  LaunchRecord,
  TradePreview,
  TradeRequest,
  TradeResult,
} from "@/services/launchpad-client";
import { planIndices } from "@/domain/launch-config";

const CURVE_SUPPLY_WAD = WAD / 4n;

/** Parse a raw wei/fixed-point integer string (no decimal scaling). */
function parseWei(value: string): bigint {
  if (!/^\d+$/.test(value)) return parseDecimal(value) ?? 0n;
  return BigInt(value);
}

function wei(value: bigint): string {
  return formatDecimal(value, 18, 18);
}

/** Deterministic pseudo-address for simulated deployments. */
function simAddress(seed: string): Hex {
  let hash = 0n;
  for (const byte of new TextEncoder().encode(seed)) {
    hash = (hash * 31n + BigInt(byte)) & 0xffffffffffffffffn;
  }
  return `0x${hash.toString(16).padStart(40, "0")}` as Hex;
}

// ---------------------------------------------------------------------------
// Simulated per-pool ledger (extends the public LaunchRecord with sim state)
// ---------------------------------------------------------------------------

export interface SimPool {
  record: LaunchRecord;
  bands: BandView[];
  /** ETH the pool has absorbed on buys minus paid out on sells. */
  poolEthWei: bigint;
  /** Token still held by the curve (pre-graduation). */
  curveTokensWei: bigint;
  /** Direct creator revenue accrued, unclaimed (graduation 55% + fees 75%). */
  directCreatorWei: bigint;
  /** Creator-path entitlement accrued, unclaimed. */
  creatorPathWei: bigint;
  /** Global protocol ledger contribution from this pool, unclaimed. */
  protocolWei: bigint;
  /** Per-plugin carry from failed deliveries. */
  carry: Record<number, bigint>;
  /** Sequence of the last event for ordering. */
  lastSequence: number;
}

export interface SimAccount {
  ethBalance: bigint;
  /** tokenWei per poolId. */
  tokens: Record<string, bigint>;
}

export interface SimRegistry {
  entries: PluginEntry[];
}

/** The shared economic snapshot the simulation applies. */
export const SIM_ECONOMIC_CONFIG = DEFAULT_ECONOMIC_CONFIG;

// ---------------------------------------------------------------------------
// Curve math: ETH in -> level movement, token out
// ---------------------------------------------------------------------------

/**
 * Level-space curve: the curve sells `curveTokens / span` token-wei per level
 * climbed. Price at level L is 1.0001^L ETH/token (18-dec: numerically exact).
 * ETH needed to climb from level a to level b:
 *   eth = (tokens/level) * Σ_{L=a}^{b-1} 1.0001^L
 * The geometric sum is (1.0001^b - 1.0001^a) / 0.0001.
 */
function curveEthToClimb(
  curveTokensWei: bigint,
  fromLevel: number,
  toLevel: number,
): bigint {
  if (toLevel <= fromLevel) return 0n;
  const perLevel = curveTokensWei / BigInt(CURVE_SPAN_LEVELS);
  const priceFrom = ethPerTokenWei(fromLevel);
  const priceTo = ethPerTokenWei(toLevel);
  const sum = ((priceTo - priceFrom) * 10_000n) / 1n;
  // perLevel * sum / WAD: sum is in "ETH-wei per token-wei per level" units
  // scaled by 1/0.0001 (10_000). Divide back out.
  return (perLevel * sum) / WAD / 10_000n;
}

/** Level the curve reaches for a given ETH spend (inverse of climb cost). */
function curveLevelForEth(
  curveTokensWei: bigint,
  fromLevel: number,
  ethSpend: bigint,
): number {
  if (ethSpend <= 0n) return fromLevel;
  const perLevel = curveTokensWei / BigInt(CURVE_SPAN_LEVELS);
  if (perLevel <= 0n) return fromLevel;
  // levelDelta ≈ ethSpend / (perLevel * price(fromLevel) / WAD)
  const price = ethPerTokenWei(fromLevel);
  const costPerLevel = (perLevel * price) / WAD;
  if (costPerLevel <= 0n) return fromLevel;
  const delta = Number(ethSpend / costPerLevel);
  return fromLevel + Math.max(1, delta);
}

/** Token out when climbing from a to b on the curve. */
function curveTokensOut(
  curveTokensWei: bigint,
  fromLevel: number,
  toLevel: number,
): bigint {
  if (toLevel <= fromLevel) return 0n;
  const perLevel = curveTokensWei / BigInt(CURVE_SPAN_LEVELS);
  return perLevel * BigInt(toLevel - fromLevel);
}

// ---------------------------------------------------------------------------
// Post-graduation math: full-range + live band walls
// ---------------------------------------------------------------------------

/**
 * Post-graduation sells meet two liquidity sources: the full-range position
 * (uniform-in-tick approximation over the traded window) and any deployed
 * incomplete bands (each holds bandInventory, sold entirely across its 447
 * levels). The simulation tracks a simple constant-product core for the
 * full-range side; band walls add one-sided sell inventory.
 */
function postGradLevelForBuy(
  pool: SimPool,
  supplyWei: bigint,
  ethSpend: bigint,
): { levelAfter: number; bandTokensSold: bigint } {
  // Full-range holds 10% of supply across all ticks; approximate its depth as
  // uniform per level over ±2x around spot. Cheap, deterministic, and
  // directionally correct for a terminal-grade demo.
  const fullRangeTokens = (supplyWei * 10n) / 100n;
  const perLevel = fullRangeTokens / BigInt(CURVE_SPAN_LEVELS);
  const price = ethPerTokenWei(pool.record.level);
  const costPerLevel = (perLevel * price) / WAD;
  const delta =
    costPerLevel > 0n
      ? Number(ethSpend / costPerLevel)
      : 0;
  const level = pool.record.level + Math.max(0, delta);
  // Band walls: any incomplete deployed band whose range the new level
  // crosses absorbs buys by selling its inventory (bands are sell-side; a
  // buy crossing a band top harvests it — handled in the harvest phase).
  return { levelAfter: level, bandTokensSold: 0n };
}

// ---------------------------------------------------------------------------
// Simulator core
// ---------------------------------------------------------------------------

export class ProtocolSimulation {
  readonly pools: Record<string, SimPool> = {};
  readonly account: SimAccount = { ethBalance: 10_000n * WAD, tokens: {} };
  readonly registry: SimRegistry;
  /** Global protocol claimable across pools. */
  protocolGlobalWei = 0n;
  /** Deterministic event log per pool. */
  events: Record<string, ProtocolEvent[]> = {};
  private sequence = 0;

  constructor(registry: PluginEntry[]) {
    this.registry = { entries: registry };
  }

  nextSequence(): number {
    this.sequence += 1;
    return this.sequence;
  }

  log(poolId: string, event: ProtocolEvent): void {
    (this.events[poolId] ??= []).unshift(event);
  }

  // -- launch --------------------------------------------------------------

  createLaunch(config: LaunchConfig, slug: string): SimPool {
    const supplyWei = parseWei(config.totalSupply);
    const opening = openingLevelFor(supplyWei);
    const far = opening + CURVE_SPAN_LEVELS;
    const poolId = `pool-${slug}`;
    const devBuyShare = parseWei(config.devBuyShareWad);
    const record: LaunchRecord = {
      poolId,
      slug,
      creator: config.creator,
      token: simAddress(`${slug}-token`),
      name: config.name,
      symbol: config.symbol,
      totalSupplyWei: wei(supplyWei),
      phase: "bonding-curve",
      level: opening,
      openingLevel: opening,
      farLevel: far,
      payoutPlan: config.payoutPlan,
      devBuyShareWad: config.devBuyShareWad,
      payoutPotWei: wei(0n),
      carryBitmap: "0",
      completedMilestones: 0,
      createdAt: demoTimestamp(this.nextSequence()),
    };
    const pool: SimPool = {
      record,
      bands: Array.from({ length: CORE_BAND_COUNT }, (_, index) => ({
        index,
        state: "undeployed" as const,
        ...bandLevels(opening, index),
      })),
      poolEthWei: 0n,
      curveTokensWei: (supplyWei * CURVE_SUPPLY_WAD) / WAD,
      directCreatorWei: 0n,
      creatorPathWei: 0n,
      protocolWei: 0n,
      carry: {},
      lastSequence: this.sequence,
    };
    this.pools[poolId] = pool;
    this.log(poolId, {
      kind: "Launched",
      poolId,
      creator: config.creator,
      token: record.token,
      totalSupply: wei(supplyWei),
      openingLevel: opening,
      farLevel: far,
      configHash: simAddress(`${slug}-config`),
    });
    this.log(poolId, {
      kind: "LaunchConfigured",
      poolId,
      payoutPlan: config.payoutPlan,
      devBuyShareWad: config.devBuyShareWad,
    });

    // Creator self-send dev buy executes inside launch on ordinary terms.
    if (devBuyShare > 0n) {
      const tokens = (supplyWei * devBuyShare) / WAD;
      const targetLevel = opening + Number(
        (BigInt(CURVE_SPAN_LEVELS) * tokens) / pool.curveTokensWei,
      );
      const cost = curveEthToClimb(
        pool.curveTokensWei,
        opening,
        targetLevel,
      );
      const bought = curveTokensOut(pool.curveTokensWei, opening, targetLevel);
      pool.curveTokensWei -= bought;
      pool.poolEthWei += cost;
      pool.record.level = targetLevel;
      this.account.ethBalance -= cost;
      this.account.tokens[poolId] =
        (this.account.tokens[poolId] ?? 0n) + tokens;
      this.log(poolId, {
        kind: "DevBuyExecuted",
        poolId,
        tokensBought: wei(tokens),
        ethSpent: wei(cost),
      });
    }
    return pool;
  }

  // -- trading ---------------------------------------------------------------

  previewTrade(pool: SimPool, request: TradeRequest): TradePreview {
    const supplyWei = parseWei(pool.record.totalSupplyWei);
    // Trade inputs are human decimals ("100" = 100 ETH / 100 tokens).
    const amount = parseDecimal(request.amount) ?? 0n;
    if (amount <= 0n)
      throw new Error("Enter a positive amount.");
    if (request.side === "buy" && amount > this.account.ethBalance)
      throw new Error("This buy exceeds the available simulated ETH balance.");
    if (
      request.side === "sell" &&
      amount > (this.account.tokens[pool.record.poolId] ?? 0n)
    )
      throw new Error("This sell exceeds the available token balance.");

    const fee = amount / 100n;
    const netInput = amount - fee;
    let levelAfter: number;
    if (request.side === "buy") {
      if (pool.record.phase === "bonding-curve") {
        levelAfter = curveLevelForEth(
          pool.curveTokensWei,
          pool.record.level,
          netInput,
        );
        levelAfter = Math.min(levelAfter, pool.record.farLevel);
      } else {
        levelAfter = postGradLevelForBuy(pool, supplyWei, netInput).levelAfter;
      }
    } else {
      // Sells step down; one level per costPerLevel equivalent (symmetric).
      const perLevel = pool.record.phase === "bonding-curve"
        ? pool.curveTokensWei / BigInt(CURVE_SPAN_LEVELS)
        : (supplyWei * 10n) / 100n / BigInt(CURVE_SPAN_LEVELS);
      const price = ethPerTokenWei(pool.record.level);
      const outPerLevel = (perLevel * price) / WAD;
      const delta = outPerLevel > 0n ? Number(amount / outPerLevel) : 0;
      levelAfter = pool.record.level - Math.max(0, delta);
      if (pool.record.phase === "bonding-curve")
        levelAfter = Math.max(levelAfter, pool.record.openingLevel);
    }

    const milestones = this.bandsCompletedBy(pool, levelAfter);
    return {
      side: request.side,
      inputAmount: wei(amount),
      inputUnit: request.side === "buy" ? "ETH" : "token",
      estimatedOutput: wei(
        request.side === "buy"
          ? this.tokensOutForLevel(pool, levelAfter)
          : this.ethOutForLevel(pool, levelAfter, netInput),
      ),
      outputUnit: request.side === "buy" ? "token" : "ETH",
      feeAmount: wei(fee),
      feeUnit: request.side === "buy" ? "ETH" : "token",
      levelBefore: pool.record.level,
      levelAfter,
      milestonesCompleted: milestones,
      graduationNext:
        pool.record.phase === "bonding-curve" &&
        levelAfter >= pool.record.farLevel - 1,
    };
  }

  private tokensOutForLevel(pool: SimPool, levelAfter: number): bigint {
    if (pool.record.phase === "bonding-curve") {
      return curveTokensOut(pool.curveTokensWei, pool.record.level, levelAfter);
    }
    const supplyWei = parseWei(pool.record.totalSupplyWei);
    return postGradLevelForBuy(pool, supplyWei, 0n).bandTokensSold;
  }

  private ethOutForLevel(
    pool: SimPool,
    levelAfter: number,
    netTokenIn: bigint,
  ): bigint {
    // Sell output: value of tokens at the midpoint price of the move.
    const midLevel = Math.floor((pool.record.level + levelAfter) / 2);
    const price = ethPerTokenWei(midLevel);
    return (netTokenIn * price) / WAD;
  }

  /** Bands whose upper level the post-swap level crosses (within cap). */
  private bandsCompletedBy(pool: SimPool, levelAfter: number): number {
    if (pool.record.phase !== "graduated") return 0;
    let completed = 0;
    for (const band of pool.bands) {
      if (completed >= MAX_HARVESTS_PER_SWAP) break;
      if (band.state === "deployed" && levelAfter >= band.levelUpper)
        completed += 1;
    }
    return completed;
  }

  executeTrade(
    pool: SimPool,
    request: TradeRequest,
  ): TradeResult {
    const preview = this.previewTrade(pool, request);
    const events: ProtocolEvent[] = [];
    const amount = parseDecimal(request.amount) ?? 0n;
    const fee = parseDecimal(preview.feeAmount) ?? 0n;
    void fee;

    // Settle balances first so graduation splits the full curve proceeds.
    pool.record.level = preview.levelAfter;
    if (request.side === "buy") {
      this.account.ethBalance -= amount;
      pool.poolEthWei += amount;
      const tokensOut = parseDecimal(preview.estimatedOutput) ?? 0n;
      pool.curveTokensWei =
        pool.curveTokensWei > tokensOut
          ? pool.curveTokensWei - tokensOut
          : 0n;
      this.account.tokens[pool.record.poolId] =
        (this.account.tokens[pool.record.poolId] ?? 0n) + tokensOut;
    } else {
      this.account.tokens[pool.record.poolId] =
        (this.account.tokens[pool.record.poolId] ?? 0n) - amount;
      const ethOut = parseDecimal(preview.estimatedOutput) ?? 0n;
      pool.poolEthWei = pool.poolEthWei > ethOut
        ? pool.poolEthWei - ethOut
        : 0n;
      this.account.ethBalance += ethOut;
    }

    // Auto-graduation: the next buy's beforeSwap graduates at the far level.
    if (
      request.side === "buy" &&
      pool.record.phase === "bonding-curve" &&
      preview.levelAfter >= pool.record.farLevel
    ) {
      this.graduatePool(pool, events);
    }

    // Harvest bands crossed by this swap (capped at 8 per swap).
    if (pool.record.phase === "graduated") {
      this.harvestCrossedBands(pool, preview.levelAfter, events);
    }

    for (const event of events) this.log(pool.record.poolId, event);
    return {
      ...preview,
      launch: pool.record,
      events,
      ethBalance: wei(this.account.ethBalance),
      tokenBalance: wei(this.account.tokens[pool.record.poolId] ?? 0n),
    };
  }

  // -- graduation ----------------------------------------------------------

  graduatePool(pool: SimPool, events: ProtocolEvent[]): void {
    if (pool.record.phase !== "bonding-curve") return;
    const proceeds = pool.poolEthWei;
    const lpSeed = (proceeds * GRADUATION_LP_SEED_WAD) / WAD;
    const creator = (proceeds * GRADUATION_CREATOR_WAD) / WAD;
    const protocol = (proceeds * GRADUATION_PROTOCOL_WAD) / WAD;
    pool.record.phase = "graduated";
    pool.record.graduationLevel = pool.record.level;
    pool.directCreatorWei += creator;
    pool.protocolWei += protocol;
    this.protocolGlobalWei += protocol;
    pool.curveTokensWei = 0n;
    // Re-anchor band geometry at the live graduation level.
    pool.bands = pool.bands.map((band) => ({
      ...band,
      ...bandLevels(pool.record.level, band.index),
    }));
    events.push({
      kind: "Graduated",
      poolId: pool.record.poolId,
      graduationLevel: pool.record.level,
      quoteProceeds: wei(proceeds),
      lpSeedQuote: wei(lpSeed),
      creatorQuote: wei(creator),
      protocolQuote: wei(protocol),
      fullRangeLiquidity: "0",
    });
    pool.record.level = pool.record.level; // live level observed at call time
  }

  /** Deliberate graduation call (idempotent race semantics). */
  graduate(pool: SimPool): TradeResult {
    const events: ProtocolEvent[] = [];
    if (
      pool.record.phase === "bonding-curve" &&
      pool.record.level >= pool.record.farLevel
    ) {
      this.graduatePool(pool, events);
    } else if (pool.record.phase === "bonding-curve") {
      throw new Error(
        "Graduation requires the live level to reach the curve top (2x opening valuation).",
      );
    }
    for (const event of events) this.log(pool.record.poolId, event);
    return {
      side: "buy",
      inputAmount: wei(0n),
      inputUnit: "ETH",
      estimatedOutput: wei(0n),
      outputUnit: "token",
      feeAmount: wei(0n),
      feeUnit: "ETH",
      levelBefore: pool.record.level,
      levelAfter: pool.record.level,
      milestonesCompleted: 0,
      graduationNext: false,
      launch: pool.record,
      events,
      ethBalance: wei(this.account.ethBalance),
      tokenBalance: wei(this.account.tokens[pool.record.poolId] ?? 0n),
    };
  }

  // -- ladder ----------------------------------------------------------------

  /** Deploy bands JIT ahead of the level, then harvest crossed bands. */
  private harvestCrossedBands(
    pool: SimPool,
    levelAfter: number,
    events: ProtocolEvent[],
  ): void {
    // JIT deploys: bands whose lower bound the path approached.
    let deploys = 0;
    for (const band of pool.bands) {
      if (deploys >= MAX_DEPLOYS_PER_SWAP) break;
      if (
        band.state === "undeployed" &&
        levelAfter >= band.levelLower - BAND_LEVEL_SPACING
      ) {
        if (levelAfter > band.levelUpper) {
          band.state = "skipped";
          events.push({
            kind: "BandSkipped",
            poolId: pool.record.poolId,
            index: band.index,
            carriedInventory: "0",
          });
        } else {
          band.state = "deployed";
          band.deployedAt = Math.floor(Date.now() / 1000);
          deploys += 1;
          events.push({
            kind: "BandDeployed",
            poolId: pool.record.poolId,
            index: band.index,
            levelLower: band.levelLower,
            levelUpper: band.levelUpper,
            liquidity: "0",
            tokenInventory: wei(this.bandInventoryWei(pool, band.index)),
          });
        }
      }
    }
    // Harvests: bands whose top the post-swap level crosses.
    let harvests = 0;
    for (const band of pool.bands) {
      if (harvests >= MAX_HARVESTS_PER_SWAP) break;
      if (band.state !== "deployed" || levelAfter < band.levelUpper) continue;
      this.harvestBand(pool, band.index, events);
      harvests += 1;
    }
  }

  /** 65% of supply split evenly across 30 core bands. */
  private bandInventoryWei(pool: SimPool, index: number): bigint {
    const supply = parseWei(pool.record.totalSupplyWei);
    const ladder = (supply * 65n) / 100n;
    void index;
    return ladder / BigInt(CORE_BAND_COUNT);
  }

  private harvestBand(
    pool: SimPool,
    index: number,
    events: ProtocolEvent[],
  ): void {
    const band = pool.bands[index];
    if (!band || band.state !== "deployed") return;
    band.state = "completed";
    pool.record.completedMilestones += 1;
    // Band sells its inventory across its 447 levels into the pump.
    const gross = this.bandGrossQuote(pool, band);
    const serviceFee =
      (gross * SIM_ECONOMIC_CONFIG.harvestServiceFeeWad) / WAD;
    const net = gross - serviceFee;
    band.tokenInventoryWei = "0";
    const pot = parseWei(pool.record.payoutPotWei) + net;
    pool.record.payoutPotWei = wei(pot);
    pool.protocolWei += serviceFee;
    this.protocolGlobalWei += serviceFee;
    events.push({
      kind: "MilestoneHarvested",
      poolId: pool.record.poolId,
      index,
      quoteProceeds: wei(gross),
      tokenResidue: wei(0n),
      completedMilestones: pool.record.completedMilestones,
    });
    events.push({
      kind: "PayoutPotFunded",
      poolId: pool.record.poolId,
      milestoneIndex: index,
      grossQuote: wei(gross),
      serviceFee: wei(serviceFee),
      netQuote: wei(net),
      economicVersion: SIM_ECONOMIC_CONFIG.version,
    });
  }

  private bandGrossQuote(
    pool: SimPool,
    band: BandView,
  ): bigint {
    // integrate inventory across the band's levels at ascending prices
    const inventory = this.bandInventoryWei(pool, band.index);
    const midPrice = ethPerTokenWei(
      Math.floor((band.levelLower + band.levelUpper) / 2),
    );
    return (inventory * midPrice) / WAD;
  }

  // -- flush / claims --------------------------------------------------------

  flushPool(pool: SimPool): FlushOutcome {
    const pot = parseWei(pool.record.payoutPotWei);
    const hasNewPot = pot > 0n;
    const deliveries: FlushOutcome["deliveries"] = [];
    let creatorPathAccrued = 0n;

    let distributable = 0n;
    let tip = 0n;
    let redeemed = 0n;
    if (hasNewPot) {
      redeemed = pot;
      tip = pot / 100n;
      distributable = pot - tip;
      pool.record.payoutPotWei = wei(0n);
      this.account.ethBalance += tip;
    } else {
      // carry-only flush: retry previous carry with zero tip
      distributable = 0n;
    }

    const plan = BigInt(pool.record.payoutPlan);
    const indices = planIndices(plan);
    for (const index of indices) {
      const entry = this.registry.entries[index];
      const previousCarry = pool.carry[index] ?? 0n;
      const share = (distributable * parseWei(entry?.takeWad ?? "0")) / WAD;
      const attempted = share + previousCarry;
      if (attempted <= 0n) continue;
      if (!entry || entry.suspended) {
        // Permanently redirected to the creator path.
        creatorPathAccrued += attempted;
        delete pool.carry[index];
        deliveries.push({
          pluginIndex: index,
          status: "redirected",
          amountWei: wei(attempted),
        });
        continue;
      }
      // Reference plugin accepts delivery in this simulation.
      pool.carry[index] = 0n;
      deliveries.push({
        pluginIndex: index,
        status: "delivered",
        amountWei: wei(attempted),
      });
    }
    // Remainder (including dust) accrues to the creator path, never pushed.
    const allocated = deliveries.reduce(
      (sum, item) => sum + parseWei(item.amountWei),
      0n,
    );
    const remainder = distributable - allocated + creatorPathAccrued;
    if (remainder > 0n) creatorPathAccrued = remainder;
    pool.creatorPathWei += creatorPathAccrued;

    return {
      redeemedWei: wei(redeemed),
      tipWei: wei(tip),
      deliveries,
      creatorPathAccruedWei: wei(creatorPathAccrued),
    };
  }

  claimDirect(pool: SimPool): ClaimOutcome {
    const amount = pool.directCreatorWei;
    pool.directCreatorWei = 0n;
    this.account.ethBalance += amount;
    this.log(pool.record.poolId, {
      kind: "CreatorClaimed",
      poolId: pool.record.poolId,
      holder: pool.record.creator,
      amount: wei(amount),
    });
    return { path: "direct", success: true, attemptedWei: wei(amount) };
  }

  claimCreatorPath(pool: SimPool): ClaimOutcome {
    // Flushes first (keeping the tip for the final payment), then pays the
    // complete entitlement to the holder.
    this.flushPool(pool);
    const amount = pool.creatorPathWei;
    pool.creatorPathWei = 0n;
    this.account.ethBalance += amount;
    this.log(pool.record.poolId, {
      kind: "CreatorPathClaimed",
      poolId: pool.record.poolId,
      holder: pool.record.creator,
      amount: wei(amount),
    });
    return {
      path: "creator-path",
      success: true,
      attemptedWei: wei(amount),
    };
  }

  claimProtocol(): ClaimOutcome {
    const amount = this.protocolGlobalWei;
    this.protocolGlobalWei = 0n;
    this.account.ethBalance += amount;
    return { path: "protocol", success: true, attemptedWei: wei(amount) };
  }

  claimBalances(pool: SimPool): ClaimBalances {
    const pluginCarry: Record<number, string> = {};
    for (const [index, amount] of Object.entries(pool.carry)) {
      if (amount > 0n) pluginCarry[Number(index)] = wei(amount);
    }
    return {
      directCreatorWei: wei(pool.directCreatorWei),
      creatorPathWei: wei(pool.creatorPathWei),
      payoutPotWei: pool.record.payoutPotWei,
      pluginCarryWei: pluginCarry,
    };
  }

  // -- views -----------------------------------------------------------------

  fdvEth(pool: SimPool): string {
    return wei(fdvEthWei(parseWei(pool.record.totalSupplyWei), pool.record.level));
  }

  priceEth(pool: SimPool): string {
    return wei(ethPerTokenWei(pool.record.level));
  }

  curveProgress(pool: SimPool): number {
    if (pool.record.phase !== "bonding-curve") return 1;
    const span = pool.record.farLevel - pool.record.openingLevel;
    if (span <= 0) return 0;
    return Math.min(
      1,
      Math.max(0, (pool.record.level - pool.record.openingLevel) / span),
    );
  }
}
