/**
 * Launch configuration domain.
 *
 * Mirrors the signed-launch flow from the integration guide §4:
 *   build the config -> validate (bounds + registry plan) -> predictToken ->
 *   sign (EIP-712, domain SpawnLaunchpad v1, hook as verifying contract) ->
 *   launch (payable self-send with dev-buy budget, or relayed).
 *
 * The EIP-712 digest below is a bit-exact client-side computation so the UI
 * can cross-check against LaunchSupport.launchDigest(config, hook) before a
 * signature is requested (START-HERE rule #2).
 */

import { formatDecimal } from "@/domain/economics";
import {
  LAUNCH_DOMAIN_NAME,
  LAUNCH_DOMAIN_VERSION,
  MAX_DEV_BUY_SHARE_WAD,
  MAX_PLAN_PLUGINS,
  WAD,
} from "@/protocol/constants";
import type { LaunchConfig, PluginEntry } from "@/types/protocol-model";
import { ethPerTokenWei, openingLevelFor } from "@/protocol/level-math";
import type { Hex } from "@/types/protocol-model";

/** Parse a raw 18-decimal fixed-point (WAD) integer string. */
function parseWad(value: string): bigint | null {
  if (!/^\d+$/.test(value)) return null;
  return BigInt(value);
}

const HEX_LENGTH = 64;

/** keccak256 — until viem arrives, digest computation is injected. */
export type Keccak256 = (data: Uint8Array) => Hex;

function hexToBytes(value: Hex): Uint8Array {
  const clean = value.slice(2);
  const bytes = new Uint8Array(clean.length / 2);
  for (let index = 0; index < clean.length; index += 2) {
    bytes[index / 2] = Number.parseInt(clean.slice(index, index + 2), 16);
  }
  return bytes;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function encodeUint(value: bigint): Uint8Array {
  const hex = value.toString(16).padStart(HEX_LENGTH, "0");
  return hexToBytes(`0x${hex.length % 2 ? `0${hex}` : hex}`);
}

function encodeBytes32(value: Hex): Uint8Array {
  return hexToBytes(value);
}

function toWords(text: string): Uint8Array {
  const encoded = new TextEncoder().encode(text);
  if (encoded.length === 0) return encodeUint(0n);
  const padded = new Uint8Array(Math.ceil(encoded.length / 32) * 32);
  padded.set(encoded);
  return concat(encodeUint(BigInt(encoded.length)), padded);
}

/** Domain separator per EIP-712 with the SpawnLaunchpad domain. */
export function launchDomainSeparator(
  chainId: number,
  hookAddress: Hex,
  keccak256: Keccak256,
): Hex {
  const typeHash = keccak256(
    new TextEncoder().encode(
      "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)",
    ),
  );
  return keccak256(
    concat(
      encodeBytes32(typeHash),
      toWords(LAUNCH_DOMAIN_NAME),
      toWords(LAUNCH_DOMAIN_VERSION),
      encodeUint(BigInt(chainId)),
      encodeUint(BigInt(hookAddress)),
    ),
  );
}

/** keccak256 of the exact LaunchConfig typehash string (verbatim from handoff). */
function launchConfigTypeHash(keccak256: Keccak256): Hex {
  return keccak256(
    new TextEncoder().encode(
      "LaunchConfig(address creator,string name,string symbol,uint256 totalSupply,uint64 devBuyShareWad,uint256 payoutPlan,uint256 deadline)",
    ),
  );
}

/**
 * The EIP-712 struct hash of a LaunchConfig. Values must already be
 * normalized (address checksum-agnostic hex, uints as bigint).
 */
export function launchConfigStructHash(
  config: LaunchConfig,
  keccak256: Keccak256,
): Hex {
  const totalSupply = parseWad(config.totalSupply);
  const devBuy = parseWad(config.devBuyShareWad);
  const plan = BigInt(config.payoutPlan);
  const deadline = BigInt(config.deadline);
  if (totalSupply === null || devBuy === null)
    throw new Error("LaunchConfig contains invalid decimal values.");
  return keccak256(
    concat(
      encodeBytes32(launchConfigTypeHash(keccak256)),
      encodeUint(BigInt(config.creator)),
      toWords(config.name),
      toWords(config.symbol),
      encodeUint(totalSupply),
      encodeUint(devBuy),
      encodeUint(plan),
      encodeUint(deadline),
    ),
  );
}

/** The full launch digest the creator signs. */
export function launchDigest(
  config: LaunchConfig,
  chainId: number,
  hookAddress: Hex,
  keccak256: Keccak256,
): Hex {
  return keccak256(
    concat(
      new TextEncoder().encode("\x19\x01"),
      encodeBytes32(launchDomainSeparator(chainId, hookAddress, keccak256)),
      encodeBytes32(launchConfigStructHash(config, keccak256)),
    ),
  );
}

// ---------------------------------------------------------------------------
// Payout plan bitset helpers
// ---------------------------------------------------------------------------

/** Plan with the given registry index selected. */
export function withPlanBit(plan: bigint, index: number): bigint {
  return plan | (1n << BigInt(index));
}

/** Plan with the given registry index cleared. */
export function withoutPlanBit(plan: bigint, index: number): bigint {
  return plan & ~(1n << BigInt(index));
}

export function hasPlanBit(plan: bigint, index: number): boolean {
  return Boolean((plan >> BigInt(index)) & 1n);
}

/** Selected registry indices in ascending order. */
export function planIndices(plan: bigint): number[] {
  const indices: number[] = [];
  for (let index = 0; index < 256; index += 1) {
    if (hasPlanBit(plan, index)) indices.push(index);
  }
  return indices;
}

export function countPlanBits(plan: bigint): number {
  return planIndices(plan).length;
}

/** Sum of selected entries' fixed takes, in WAD. */
export function planTakeSumWad(plan: bigint, registry: PluginEntry[]): bigint {
  return planIndices(plan).reduce((sum, index) => {
    const entry = registry[index];
    const take = entry ? parseWad(entry.takeWad) : null;
    return sum + (take ?? 0n);
  }, 0n);
}

/**
 * Creator remainder of a distributable amount in WAD: 1e18 minus selected
 * takes. The creator is the mandatory implicit remainder sink.
 */
export function planCreatorRemainderWad(
  plan: bigint,
  registry: PluginEntry[],
): bigint {
  return WAD - planTakeSumWad(plan, registry);
}

// ---------------------------------------------------------------------------
// Validation mirroring LaunchSupport.validate
// ---------------------------------------------------------------------------

export type LaunchConfigIssue =
  | "creator-invalid"
  | "name-empty"
  | "symbol-invalid"
  | "supply-invalid"
  | "dev-buy-above-cap"
  | "plan-unknown-index"
  | "plan-suspended-index"
  | "plan-non-payout-role"
  | "plan-too-many-plugins"
  | "plan-takes-exceed-whole"
  | "deadline-not-future";

export function validateLaunchConfig(
  config: LaunchConfig,
  registry: PluginEntry[],
  nowSeconds: number,
): LaunchConfigIssue[] {
  const issues: LaunchConfigIssue[] = [];
  if (!/^0x[0-9a-fA-F]{40}$/.test(config.creator))
    issues.push("creator-invalid");
  if (!config.name.trim()) issues.push("name-empty");
  if (!/^[A-Za-z0-9]{2,8}$/.test(config.symbol.trim()))
    issues.push("symbol-invalid");
  const supply = parseWad(config.totalSupply);
  if (supply === null || supply <= 0n) issues.push("supply-invalid");
  const devBuy = parseWad(config.devBuyShareWad);
  if (devBuy === null || devBuy > MAX_DEV_BUY_SHARE_WAD)
    issues.push("dev-buy-above-cap");

  const plan = BigInt(config.payoutPlan);
  const indices = planIndices(plan);
  if (indices.length > MAX_PLAN_PLUGINS)
    issues.push("plan-too-many-plugins");
  let takeSum = 0n;
  for (const index of indices) {
    const entry = registry[index];
    if (!entry) {
      issues.push("plan-unknown-index");
      continue;
    }
    if (entry.suspended) issues.push("plan-suspended-index");
    if (entry.role !== "payout") issues.push("plan-non-payout-role");
    const take = parseWad(entry.takeWad);
    takeSum += take ?? 0n;
  }
  if (takeSum > WAD) issues.push("plan-takes-exceed-whole");

  if (config.deadline <= nowSeconds) issues.push("deadline-not-future");
  return issues;
}

export const LAUNCH_ISSUE_COPY: Record<LaunchConfigIssue, string> = {
  "creator-invalid": "Creator address is not a valid account.",
  "name-empty": "Enter a token name.",
  "symbol-invalid": "Use 2-8 letters or numbers for the symbol.",
  "supply-invalid": "Enter a positive total supply.",
  "dev-buy-above-cap": "Dev buy cannot exceed 10% of supply.",
  "plan-unknown-index": "A selected plugin is not registered.",
  "plan-suspended-index": "A selected plugin is suspended.",
  "plan-non-payout-role": "A selected entry is not a payout plugin.",
  "plan-too-many-plugins": "Select at most 8 plugins.",
  "plan-takes-exceed-whole": "Plugin takes must total at most 100%.",
  "deadline-not-future": "Deadline must be in the future.",
};

// ---------------------------------------------------------------------------
// Pre-launch dev-buy quote (integration §4.5)
// ---------------------------------------------------------------------------

/**
 * Dev-buy token amount: totalSupply * devBuyShareWad. Fixed-token-amount
 * semantics — the ETH cost is computed at execution on the fresh curve.
 */
export function devBuyTokensWei(config: LaunchConfig): bigint {
  const supply = parseWad(config.totalSupply);
  const share = parseWad(config.devBuyShareWad);
  if (supply === null || share === null) return 0n;
  return (supply * share) / WAD;
}

/**
 * Deterministic ETH cost of the dev buy on the fresh curve, reproduced
 * client-side: position 0 holds 25% of supply from the opening level, so a
 * fixed-token buy of `tokens` at price 1.0001^opening moves the level to
 *   levelEnd = opening - log_1.0001(tokens / curvePosition0Tokens)
 * (buying reduces outstanding curve token => level rises... expressed in
 * level space: the curve sells token as level climbs; remaining inventory
 * after the buy is curveTokens - tokens).
 *
 * ETH cost integrates the curve's liquidity. With position 0 distributing
 * curve tokens uniformly across levels [opening, far] (span S = 6931, token
 * per level = curveTokens / S), the ETH absorbed to advance from level L to
 * L' is sum over levels of (token sold per level) * (price at that level):
 *   ethCost = (curveTokens / S) * Σ_{L..L'} 1.0001^L
 * The geometric sum evaluates exactly: (1.0001^L' - 1.0001^L) / 0.0001.
 */
export function devBuyEthCostWei(config: LaunchConfig): bigint {
  const supply = parseWad(config.totalSupply);
  const share = parseWad(config.devBuyShareWad);
  if (supply === null || share === null || share <= 0n) return 0n;
  const tokens = (supply * share) / WAD;
  const curveTokens = (supply * 25n) / 100n;
  if (tokens > curveTokens || tokens <= 0n) return 0n;
  const opening = openingLevelFor(supply);
  const span = 6931;
  // remaining fraction of the curve after the buy
  // level movement where fraction f of the curve remains:
  // tokens consumed span fraction 1 - f, and level advances linearly
  const levelsConsumed = Number(
    (BigInt(span) * tokens + curveTokens - 1n) / curveTokens,
  );
  const startLevel = opening;
  const endLevel = opening + levelsConsumed;
  // geometric sum of prices over consumed levels, scaled per-token-per-level
  const perLevelTokens = curveTokens / BigInt(span);
  // Σ price = (priceBase(end+1) - priceBase(start)) / 0.0001
  const priceStart = ethPerTokenWei(startLevel);
  const priceEnd = ethPerTokenWei(endLevel + 1);
  const priceDelta = priceEnd > priceStart ? priceEnd - priceStart : 0n;
  const geometricSum = (priceDelta * 10_000n) / 1n;
  return (perLevelTokens * geometricSum) / WAD / 10_000n;
}

/** Suggested msg.value for the self-send launch: cost + 5% headroom. */
export function devBuyBudgetWei(config: LaunchConfig): bigint {
  const cost = devBuyEthCostWei(config);
  if (cost <= 0n) return 0n;
  return cost + cost / 20n;
}

export function formatWad(wad: bigint): string {
  return formatDecimal(wad, 18, 4);
}
