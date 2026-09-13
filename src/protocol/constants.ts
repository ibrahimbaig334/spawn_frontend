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

/** Opening fully-diluted valuation for every launch, in ETH-wei (~$5,000 at $2,500/ETH). */
export const OPENING_FDV_WEI = 2n * WAD;
/** Fixed total supply every launch MUST declare: 1,000,000,000 (18 decimals). */
export const FIXED_TOTAL_SUPPLY = 10n ** 27n;
/** Curve positions spanning opening → far (JIT-deployed rungs 1-31). */
export const CURVE_POSITIONS = 32;
/** Curve span in levels: two market-cap doublings (graduation at ~4x opening). */
export const CURVE_SPAN_LEVELS = 13_862;
/** Levels in one market-cap doubling (2x). */
export const LEVELS_PER_DOUBLING = 6_931;
/** Ladder spacing FLOOR in levels (~1.2504x market cap where the schedule locks). */
export const BAND_LEVEL_SPACING = 2_235;
/** First band step above graduation: 2x the graduation valuation. */
export const BAND_FIRST_STEP_LEVELS = 6_932;
/** Each successive band step shrinks by this many levels until the floor. */
export const BAND_STEP_DECAY_LEVELS = 391;
/** One band's wall width in levels (~4.5% of price). */
export const BAND_WIDTH_LEVELS = 447;
/** Core ladder bands (10% of supply), top ≈ 2,900x graduation valuation. */
export const CORE_BAND_COUNT = 22;
/** Fee-funded extension bands above the core ladder, funded by token fees. */
export const MAX_FEE_FUNDED_BANDS = 30;
/** Curve supply share of total supply (WAD) — 250M of 1B. */
export const CURVE_SUPPLY_SHARE_WAD = (WAD * 25n) / 100n;
/** Ladder supply share of total supply (WAD) — 100M of 1B. */
export const LADDER_SUPPLY_SHARE_WAD = WAD / 10n;
/** Graduation LP share supply (full-range + wall) of total supply (WAD) — 650M of 1B. */
export const FULL_RANGE_SUPPLY_SHARE_WAD = (WAD * 65n) / 100n;
/** Graduation quote split: LP seed / direct creator / protocol (WAD). */
export const GRADUATION_LP_SEED_WAD = (WAD * 20n) / 100n;
export const GRADUATION_CREATOR_WAD = (WAD * 70n) / 100n;
export const GRADUATION_PROTOCOL_WAD = WAD / 10n;
/** Wall position span above graduation (levels). */
export const WALL_WIDTH_LEVELS = 880_000;
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
  /** Default 1.00e18, immutable cap 1.00e18: token fees fund the milestone ladder (beyond capacity burns). */
  tokenMilestoneFundShareWad: bigint;
}

export const DEFAULT_ECONOMIC_CONFIG: EconomicConfig = {
  version: 1,
  harvestServiceFeeWad: WAD / 10n,
  quoteCreatorShareWad: (WAD * 75n) / 100n,
  tokenMilestoneFundShareWad: WAD,
};

/** Immutable governance caps (ProtocolTargetBound, not convention). */
export const ECONOMIC_CAPS = {
  harvestServiceFeeWad: WAD / 5n,
  quoteCreatorShareWad: (WAD * 90n) / 100n,
  tokenMilestoneFundShareWad: WAD,
} as const;

/** Canonical payout plan: registry bit 0 only (buyback-and-burn, take 2WAD/9). */
export const CANONICAL_PAYOUT_PLAN = 1n;
export const CANONICAL_BUYBACK_TAKE_WAD = (WAD * 2n) / 9n;

/** EIP-712 launch signing domain (START-HERE fact #2). */
export const LAUNCH_DOMAIN_NAME = "SpawnLaunchpad";
export const LAUNCH_DOMAIN_VERSION = "1";
/** Exact typehash string — copy verbatim from the handoff (uri included). */
export const LAUNCH_CONFIG_TYPEHASH =
  "LaunchConfig(address creator,string name,string symbol,string uri,uint256 totalSupply,uint64 devBuyShareWad,uint256 payoutPlan,uint256 deadline)";

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
