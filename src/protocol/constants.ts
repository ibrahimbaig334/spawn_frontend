/**
 * Spawn protocol template constants — the immutable deployment-generation
 * numbers from the integration handoff (docs/technical/integration.md §9,
 * SPECS.md "swap-fees" / "graduation" capabilities).
 *
 * These mirror `Bounds.defaultTemplate()` in the contracts. Always read the
 * live `template()` view after deployment; this table is the documented
 * baseline the deployment script enforces (Deploy.s.sol cannot deploy custom
 * economics).
 */

export const WAD = 10n ** 18n;

/** Opening fully-diluted valuation for every launch, in ETH-wei. */
export const OPENING_FDV_WEI = 125n * WAD;
/** Curve positions spanning opening → far (JIT-deployed rungs 1-31). */
export const CURVE_POSITIONS = 32;
/** Curve span in levels (= one 2x market-cap doubling). */
export const CURVE_SPAN_LEVELS = 6931;
/** One milestone band rung in levels (~1.2504x market cap per rung). */
export const BAND_LEVEL_SPACING = 2235;
/** One band's wall width in levels (~4.5% of price). */
export const BAND_WIDTH_LEVELS = 447;
/** Core ladder bands (65% of supply), reaching ~800x graduation valuation. */
export const CORE_BAND_COUNT = 30;
/** Fee-funded extension bands above the core ladder, funded by token fees. */
export const MAX_FEE_FUNDED_BANDS = 30;
/** Curve supply share of total supply (WAD). */
export const CURVE_SUPPLY_SHARE_WAD = WAD / 4n;
/** Ladder supply share of total supply (WAD). */
export const LADDER_SUPPLY_SHARE_WAD = (WAD * 65n) / 100n;
/** Full-range (graduation LP seed) supply share of total supply (WAD). */
export const FULL_RANGE_SUPPLY_SHARE_WAD = WAD / 10n;
/** Graduation quote split: LP seed / direct creator / protocol (WAD). */
export const GRADUATION_LP_SEED_WAD = (WAD * 40n) / 100n;
export const GRADUATION_CREATOR_WAD = (WAD * 55n) / 100n;
export const GRADUATION_PROTOCOL_WAD = WAD / 20n;
/** Static trading fee: 1% in hundredths of a bip, forever. */
export const TRADING_FEE_HUNDREDTHS_BIP = 10_000;
export const TRADING_FEE_BPS = 100;
/** Pool tick spacing (immutable). */
export const POOL_TICK_SPACING = 1;
/** Dev-buy hard cap: 10% of total supply, in WAD. */
export const MAX_DEV_BUY_SHARE_WAD = WAD / 10n;
/** Per-swap work caps: band/curve deploys and harvests per swap. */
export const MAX_DEPLOYS_PER_SWAP = 8;
export const MAX_HARVESTS_PER_SWAP = 8;
/** Max payout plugins selectable per launch plan. */
export const MAX_PLAN_PLUGINS = 8;
/** Registry bound: append-only, stable indices 0-255. */
export const MAX_REGISTRY_ENTRIES = 256;
/** Plugin call gas bounds (published constants, spec "payout-plugins"). */
export const MIN_PLUGIN_GAS_LIMIT = 1;
export const MAX_PLUGIN_CALL_GAS = 500_000;
/** Flush tip: floor(1% of a newly redeemed post-service-fee pot). */
export const FLUSH_TIP_WAD = WAD / 100n;

/** Economic tuple defaults (governance-mutable prospectively, live read required). */
export interface EconomicConfig {
  version: number;
  /** Default 0.10e18, immutable cap 0.20e18. */
  harvestServiceFeeWad: bigint;
  /** Default 0.75e18, immutable cap 0.90e18. Protocol gets the exact remainder. */
  quoteCreatorShareWad: bigint;
  /** Default 0.20e18, immutable cap 0.50e18. Remainder burns pre-cap; 100% post-cap. */
  tokenMilestoneFundShareWad: bigint;
}

export const DEFAULT_ECONOMIC_CONFIG: EconomicConfig = {
  version: 1,
  harvestServiceFeeWad: WAD / 10n,
  quoteCreatorShareWad: (WAD * 75n) / 100n,
  tokenMilestoneFundShareWad: (WAD * 20n) / 100n,
};

/** Immutable governance caps (ProtocolTargetBound, not convention). */
export const ECONOMIC_CAPS = {
  harvestServiceFeeWad: WAD / 5n,
  quoteCreatorShareWad: (WAD * 90n) / 100n,
  tokenMilestoneFundShareWad: WAD / 2n,
} as const;

/** Canonical payout plan: registry bit 0 only (buyback-and-burn, take 2WAD/9). */
export const CANONICAL_PAYOUT_PLAN = 1n;
export const CANONICAL_BUYBACK_TAKE_WAD = (WAD * 2n) / 9n;

/** EIP-712 launch signing domain (START-HERE fact #2). */
export const LAUNCH_DOMAIN_NAME = "SpawnLaunchpad";
export const LAUNCH_DOMAIN_VERSION = "1";
/** Exact typehash string — copy verbatim from the handoff. */
export const LAUNCH_CONFIG_TYPEHASH =
  "LaunchConfig(address creator,string name,string symbol,uint256 totalSupply,uint64 devBuyShareWad,uint256 payoutPlan,uint256 deadline)";

/** Uniswap v4 / Base infra addresses pinned by the handoff. */
export const BASE_POOL_MANAGER = "0x498581fF718922c3f8e6A244956aF099B2652b2b";
export const BASE_MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11";

/** Enum encodings shared with the contracts (for decoding events). */
export const PHASE = {
  NONE: 0,
  BONDING_CURVE: 1,
  GRADUATED: 2,
} as const;
export const ACCRUAL_SOURCE = {
  CURVE_PROCEEDS: 0,
  SWAP_FEES: 1,
  MILESTONE_HARVEST: 2,
} as const;
export const PLUGIN_ROLE = {
  INVALID: 0,
  PAYOUT: 1,
  CREATOR_SYSTEM: 2,
  UTILITY: 3,
} as const;
