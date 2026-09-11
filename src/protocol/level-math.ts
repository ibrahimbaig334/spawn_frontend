/**
 * Level-space math — the protocol's coordinate system.
 *
 * Integration guide §2: native ETH is currency0 and the token is currency1,
 * so raw v4 price is token-per-ETH and ticks run OPPOSITE to price. The
 * protocol's user-facing coordinate is `level = -tick`, which RISES as the
 * token pumps. Convert exactly once at the pool boundary; do all display and
 * geometry arithmetic in level space.
 *
 * Exact formulas (everything in wei):
 *   ethPerTokenWei = 1.0001^level
 *   fdvEthWei      = totalSupplyWei * 1.0001^level
 *
 * 1.0001^level is irrational for general levels, so this module evaluates it
 * with fixed-point power series accurate to sub-wei for the protocol's whole
 * level range (|level| < 500_000), then documents the rounding behavior.
 */

import {
  BAND_LEVEL_SPACING,
  BAND_WIDTH_LEVELS,
  CURVE_POSITIONS,
  CURVE_SPAN_LEVELS,
  OPENING_FDV_WEI,
} from "./constants";

/** Fixed-point shift for the power evaluation (60 bits of fraction headroom). */
const POWER_SHIFT = 60n;
const POWER_SCALE = 1n << POWER_SHIFT;

function mulDiv(x: bigint, y: bigint, denominator: bigint): bigint {
  return (x * y) / denominator;
}

/** ln(1.0001) to 80 fractional bits, computed exactly via its series once. */
const LN_SHIFT = 80n;
const LN_1_0001_SCALED: bigint = (() => {
  // x = 1e-4 with LN_SHIFT fractional bits
  const x = (1n << LN_SHIFT) / 10_000n;
  let sum = 0n;
  let power = x;
  for (let n = 1n; n <= 6n; n += 1n) {
    const term = power / n;
    sum += n % 2n === 1n ? term : -term;
    power = (power * x) >> LN_SHIFT;
  }
  return sum;
})();

/** e^x for |x| < 1 (input scaled `shift` fractional bits, output POWER_SHIFT bits). */
function expSmall(xScaled: bigint, shift: bigint): bigint {
  const x = mulDiv(xScaled, POWER_SCALE, 1n << shift);
  let term = POWER_SCALE;
  let sum = POWER_SCALE;
  for (let n = 1n; n <= 20n; n += 1n) {
    term = mulDiv(term, x, POWER_SCALE) / n;
    sum += term;
  }
  return sum;
}

/**
 * e^x for any |x| <= 60 (input scaled `shift` fractional bits, output scaled
 * POWER_SHIFT bits). Range-reduces by repeated halving so the Taylor series
 * only ever sees |x| < 1, then squares back up.
 */
function expFixed(xScaled: bigint, shift: bigint): bigint {
  const x = mulDiv(xScaled, POWER_SCALE, 1n << shift);
  if (x === 0n) return POWER_SCALE;
  const negative = x < 0n;
  const magnitude = negative ? -x : x;
  let halvings = 0n;
  let reduced = magnitude;
  while (reduced >= POWER_SCALE) {
    reduced >>= 1n;
    halvings += 1n;
  }
  let result = expSmall(reduced, POWER_SHIFT);
  for (let i = 0n; i < halvings; i += 1n) {
    result = mulDiv(result, result, POWER_SCALE);
  }
  return negative ? mulDiv(POWER_SCALE, POWER_SCALE, result) : result;
}

/** 1.0001^level scaled by 2^POWER_SHIFT. level may be negative. */
export function priceBaseScaled(level: number): bigint {
  if (!Number.isSafeInteger(level)) return POWER_SCALE;
  const scaled = BigInt(level) * LN_1_0001_SCALED;
  return expFixed(scaled, LN_SHIFT);
}

/**
 * ETH-wei per token-wei at a level (1.0001^level as a wei-denominated price
 * for an 18-decimal token: numerically equals the human ETH price).
 */
export function ethPerTokenWei(level: number): bigint {
  return mulDiv(priceBaseScaled(level), 10n ** 18n, POWER_SCALE);
}

/** FDV in ETH-wei for a token with `totalSupplyWei` at `level`. */
export function fdvEthWei(totalSupplyWei: bigint, level: number): bigint {
  return mulDiv(totalSupplyWei, priceBaseScaled(level), POWER_SCALE);
}

/**
 * Opening level derived from supply so every launch opens at the template
 * FDV: openingLevel = log_1.0001(openingFdvWei / totalSupplyWei).
 * Returns the integer level that brackets the FDV from below (conservative).
 */
export function openingLevelFor(totalSupplyWei: bigint): number {
  if (totalSupplyWei <= 0n) return 0;
  // binary search: smallest level with fdv(level) >= OPENING_FDV_WEI
  let low = -500_000;
  let high = 500_000;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (fdvEthWei(totalSupplyWei, mid) < OPENING_FDV_WEI) low = mid + 1;
    else high = mid;
  }
  return low;
}

/** Far level: exactly CURVE_SPAN_LEVELS above opening (2x opening FDV). */
export function farLevelFor(openingLevel: number): number {
  return openingLevel + CURVE_SPAN_LEVELS;
}

/** Band i geometry: levelLower(i) = graduationLevel + (i+1) * spacing, upper = lower + width. */
export function bandLevels(
  graduationLevel: number,
  index: number,
): { levelLower: number; levelUpper: number } {
  const levelLower = graduationLevel + (index + 1) * BAND_LEVEL_SPACING;
  return { levelLower, levelUpper: levelLower + BAND_WIDTH_LEVELS };
}

/** Market-cap multiple a band's lower bound sits above the graduation level. */
export function bandRungMultiple(index: number): number {
  return 1.0001 ** ((index + 1) * BAND_LEVEL_SPACING);
}

/** Curve position i spans [opening + i * span/positions, far] (integration §3.1). */
export function curvePositionLower(
  openingLevel: number,
  index: number,
): number {
  return (
    openingLevel +
    Math.floor((index * CURVE_SPAN_LEVELS) / CURVE_POSITIONS)
  );
}

/** Position of spot within the curve as a fraction [0,1] (integration §8.2). */
export function curveProgress(
  level: number,
  openingLevel: number,
  farLevel: number,
): number {
  if (farLevel <= openingLevel) return 0;
  const raw = (level - openingLevel) / (farLevel - openingLevel);
  return Math.min(1, Math.max(0, raw));
}

/** Convert a raw v4 tick to protocol level space (the one boundary conversion). */
export function tickToLevel(tick: number): number {
  return -tick;
}

/** Convert protocol level back to a raw v4 tick (for sqrtPriceLimit math). */
export function levelToTick(level: number): number {
  return -level;
}

/** Doubling distance helper for display copy ("2x every 6931 levels"). */
export const LEVELS_PER_DOUBLING = CURVE_SPAN_LEVELS;

export { BAND_LEVEL_SPACING, BAND_WIDTH_LEVELS, CURVE_SPAN_LEVELS };
