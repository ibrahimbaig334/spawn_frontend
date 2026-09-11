/**
 * Deterministic in-browser implementation of the LaunchpadClient contract.
 *
 * Runs the protocol simulator locally: until the backend/indexer and the
 * chain deployments exist, every screen renders through this client with
 * protocol-accurate math (level space, static 1% fee, band geometry,
 * harvest/pot/flush/claim semantics).
 */

import { validateLaunchConfig } from "@/domain/launch-config";
import { ProtocolSimulation } from "@/domain/protocol-simulator";
import {
  CANONICAL_BUYBACK_TAKE_WAD,
  CANONICAL_PAYOUT_PLAN,
} from "@/protocol/constants";
import type {
  ClaimBalances,
  Hex,
  LaunchConfig,
  PluginEntry,
  PoolStateView,
  ProtocolEvent,
} from "@/types/protocol-model";
import type {
  ClaimOutcome,
  ClientCapabilities,
  CreateLaunchResult,
  FlushOutcome,
  LaunchMetadata,
  LaunchpadClient,
  LaunchRecord,
  TradePreview,
  TradeRequest,
  TradeResult,
} from "./launchpad-client";
import { SIMULATION_CAPABILITIES } from "./launchpad-client";

function slugFor(name: string, sequence: number): string {
  const base =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "launch";
  return `${base}-${sequence}`;
}

/**
 * The simulated registry mirrors the canonical deployment: index 0 is the
 * reference buyback-and-burn plugin with take 2WAD/9.
 */
const SIM_REGISTRY: PluginEntry[] = [
  {
    index: 0,
    plugin: "0x0000000000000000000000000000000000000b07",
    takeWad: CANONICAL_BUYBACK_TAKE_WAD.toString(),
    gasLimit: 500_000,
    role: "payout",
    suspended: false,
    codeHash: `0x${"bb".repeat(32)}` as Hex,
  },
];

const LOCAL_CREATOR: Hex = "0x000000000000000000000000000000000000000d";

export class MockLaunchpadClient implements LaunchpadClient {
  readonly capabilities: ClientCapabilities = SIMULATION_CAPABILITIES;
  private simulation = new ProtocolSimulation(SIM_REGISTRY);
  private sequence = 0;

  private pool(launch: LaunchRecord) {
    const pool = this.simulation.pools[launch.poolId];
    if (!pool) throw new Error("This launch is not in local simulation state.");
    return pool;
  }

  async listPluginEntries(): Promise<PluginEntry[]> {
    return this.simulation.registry.entries.map((entry) => ({ ...entry }));
  }

  async getEconomicConfig() {
    return {
      version: this.simulation.constructor && 1,
      harvestServiceFeeWad: "100000000000000000",
      quoteCreatorShareWad: "750000000000000000",
      tokenMilestoneFundShareWad: "200000000000000000",
    };
  }

  async validateLaunchConfig(config: LaunchConfig): Promise<string[]> {
    return validateLaunchConfig(
      config,
      this.simulation.registry.entries,
      Math.floor(Date.now() / 1000),
    );
  }

  async predictTokenAddress(config: LaunchConfig): Promise<Hex> {
    // Deterministic stand-in for LaunchSupport.predictToken: derived from the
    // config + creator exactly like the CREATE2 salt composition.
    let hash = 0x6d023n;
    const material = `${config.creator}:${config.name}:${config.symbol}:${config.totalSupply}:${config.payoutPlan}`;
    for (const byte of new TextEncoder().encode(material)) {
      hash = (hash * 31n + BigInt(byte)) & 0xffffffffffffffffn;
    }
    return `0x${hash.toString(16).padStart(40, "0")}` as Hex;
  }

  async computeLaunchDigest(_config: LaunchConfig): Promise<Hex> {
    void _config;
    // Requires keccak256 — injected when the chain client lands. The
    // simulation performs no signature validation (direct-send mode).
    throw new Error(
      "EIP-712 digests require the deployed hook address (chain mode).",
    );
  }

  async createLaunch(
    config: LaunchConfig,
    sequence: number,
    metadata?: LaunchMetadata,
  ): Promise<CreateLaunchResult> {
    const issues = await this.validateLaunchConfig(config);
    if (issues.length)
      throw new Error(`Launch configuration rejected: ${issues.join(", ")}.`);
    const normalized: LaunchConfig = {
      ...config,
      creator: LOCAL_CREATOR,
    };
    const slug = slugFor(normalized.name, sequence);
    const pool = this.simulation.createLaunch(normalized, slug);
    pool.record.metadata = metadata
      ? {
          description: metadata.description,
          logoUrl: metadata.logoUrl,
          socials: { ...metadata.socials },
        }
      : undefined;
    this.sequence = sequence;
    return {
      launch: pool.record,
      events: this.simulation.events[pool.record.poolId] ?? [],
      nextSequence: sequence + 1,
    };
  }

  async previewTrade(
    launch: LaunchRecord,
    request: TradeRequest,
  ): Promise<TradePreview> {
    return this.simulation.previewTrade(this.pool(launch), request);
  }

  async executeTrade(
    launch: LaunchRecord,
    request: TradeRequest,
    _sequence: number,
  ): Promise<TradeResult> {
    void _sequence;
    return this.simulation.executeTrade(this.pool(launch), request);
  }

  async graduate(
    launch: LaunchRecord,
    _sequence: number,
  ): Promise<TradeResult> {
    void _sequence;
    return this.simulation.graduate(this.pool(launch));
  }

  async getPoolState(launch: LaunchRecord): Promise<PoolStateView> {
    const pool = this.pool(launch);
    return {
      poolId: pool.record.poolId,
      phase: pool.record.phase,
      level: pool.record.level,
      openingLevel: pool.record.openingLevel,
      farLevel: pool.record.farLevel,
      graduationLevel: pool.record.graduationLevel,
      totalSupplyWei: pool.record.totalSupplyWei,
      bands: pool.bands.map((band) => ({ ...band })),
      completedMilestones: pool.record.completedMilestones,
      payoutPotWei: pool.record.payoutPotWei,
      carryBitmap: "0",
    };
  }

  async getClaimBalances(launch: LaunchRecord): Promise<ClaimBalances> {
    return this.simulation.claimBalances(this.pool(launch));
  }

  async flushPool(
    launch: LaunchRecord,
    _sequence: number,
  ): Promise<FlushOutcome> {
    void _sequence;
    const pool = this.pool(launch);
    const outcome = this.simulation.flushPool(pool);
    this.logFlush(pool.record.poolId, outcome);
    return outcome;
  }

  private logFlush(poolId: string, outcome: FlushOutcome): void {
    if (parseWeiPositive(outcome.redeemedWei) > 0n)
      this.simulation.log(poolId, {
        kind: "PayoutPotRedeemed",
        poolId,
        amount: outcome.redeemedWei,
      });
    for (const item of outcome.deliveries) {
      this.simulation.log(poolId, {
        kind:
          item.status === "delivered"
            ? "PluginPayoutDelivered"
            : item.status === "carried"
              ? "PluginPayoutCarried"
              : "PluginPayoutRedirected",
        poolId,
        pluginIndex: item.pluginIndex,
        plugin: "0x0000000000000000000000000000000000000b07",
        currentShare: item.amountWei,
        previousCarry: "0",
        ...(item.status === "delivered"
          ? { delivered: item.amountWei }
          : item.status === "carried"
            ? { carried: item.amountWei }
            : { redirected: item.amountWei }),
      } as ProtocolEvent);
    }
    if (parseWeiPositive(outcome.creatorPathAccruedWei) > 0n)
      this.simulation.log(poolId, {
        kind: "CreatorPathAccrued",
        poolId,
        amount: outcome.creatorPathAccruedWei,
      });
  }

  async claimDirect(
    launch: LaunchRecord,
    _sequence: number,
  ): Promise<ClaimOutcome> {
    void _sequence;
    return this.simulation.claimDirect(this.pool(launch));
  }

  async claimCreatorPath(
    launch: LaunchRecord,
    _sequence: number,
  ): Promise<ClaimOutcome> {
    void _sequence;
    return this.simulation.claimCreatorPath(this.pool(launch));
  }

  async getLaunchEvents(
    launch: LaunchRecord,
    limit = 50,
  ): Promise<ProtocolEvent[]> {
    return (this.simulation.events[launch.poolId] ?? []).slice(0, limit);
  }
}

function parseWeiPositive(value: string): bigint {
  if (!/^\d+$/.test(value)) return 0n;
  return BigInt(value);
}

export const mockLaunchpadClient: LaunchpadClient = new MockLaunchpadClient();
export { CANONICAL_PAYOUT_PLAN };
