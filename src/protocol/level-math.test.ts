import { describe, expect, it } from "vitest";
import {
  BAND_FIRST_STEP_LEVELS,
  BAND_LEVEL_SPACING,
  BAND_STEP_DECAY_LEVELS,
  BAND_WIDTH_LEVELS,
  CURVE_SPAN_LEVELS,
  FIXED_TOTAL_SUPPLY,
  OPENING_FDV_WEI,
} from "./constants";
import {
  bandLevels,
  bandStepOffset,
  curvePositionLower,
  curveProgress,
  ethPerTokenWei,
  farLevelFor,
  fdvEthWei,
  openingLevelFor,
  tickToLevel,
} from "./level-math";

const WAD = 10n ** 18n;
const M = WAD / 1000n; // milli-ETH for tolerance checks

/** Naive recurrence: band i+1 starts max(spacing, first − decay·i) above band i. */
function offsetByRecurrence(index: number): number {
  let offset = 0;
  for (let i = 0; i <= index; i += 1) {
    offset += Math.max(BAND_LEVEL_SPACING, BAND_FIRST_STEP_LEVELS - BAND_STEP_DECAY_LEVELS * i);
  }
  return offset;
}

describe("level math", () => {
  it("level = -tick in both directions", () => {
    expect(tickToLevel(6931)).toBe(-6931);
    expect(tickToLevel(-6931)).toBe(6931);
  });

  it("computes 1.0001^level ETH-per-token within sub-milli precision", () => {
    expect(ethPerTokenWei(0)).toBe(WAD);
    const doubled = ethPerTokenWei(6931);
    expect(doubled > 2n * WAD - 2n * M && doubled < 2n * WAD + 2n * M).toBe(true);
    expect(ethPerTokenWei(-6931) < WAD / 2n + M).toBe(true);
  });

  it("FDV = totalSupply * 1.0001^level with decimals cancelling", () => {
    const supply = 10n ** 24n; // 1M tokens
    expect(fdvEthWei(supply, 0)).toBe(10n ** 24n);
  });

  it("derives the opening level from supply at the 2 ETH template FDV", () => {
    const level = openingLevelFor(FIXED_TOTAL_SUPPLY);
    const fdv = fdvEthWei(FIXED_TOTAL_SUPPLY, level);
    expect(fdv >= OPENING_FDV_WEI).toBe(true);
    expect(fdvEthWei(FIXED_TOTAL_SUPPLY, level - 1) < OPENING_FDV_WEI).toBe(true);
    // 1e27 supply at 2 ETH FDV: opens far below 1 ETH per token
    expect(level).toBeLessThan(0);
    expect(level).toBeGreaterThan(-500_000);
  });

  it("far level is two doublings above opening (~4x opening FDV)", () => {
    const opening = openingLevelFor(FIXED_TOTAL_SUPPLY);
    expect(farLevelFor(opening)).toBe(opening + CURVE_SPAN_LEVELS);
    const farFdv = fdvEthWei(FIXED_TOTAL_SUPPLY, farLevelFor(opening));
    const expected = 4n * OPENING_FDV_WEI;
    expect(farFdv >= expected - expected / 250n).toBe(true);
    expect(farFdv < expected + expected / 250n).toBe(true);
  });

  it("band schedule: 2x first step decaying to the 1.2504x floor", () => {
    expect(bandStepOffset(0)).toBe(BAND_FIRST_STEP_LEVELS); // 6932 ≈ 2x
    // steps shrink by 391 until the 2235 floor
    expect(bandStepOffset(1)).toBe(6932 + 6541);
    // closed form matches the naive recurrence across core + extensions
    for (let i = 0; i < 52; i += 1) {
      expect(bandStepOffset(i)).toBe(offsetByRecurrence(i));
    }
    // floor reached: 6932..2235 after 12 steps (decay 391 × 12 = 4692)
    expect(bandStepOffset(13) - bandStepOffset(12)).toBe(BAND_LEVEL_SPACING);
  });

  it("computes band geometry from the graduation level", () => {
    const first = bandLevels(1000, 0);
    expect(first.levelLower).toBe(1000 + 6932);
    expect(first.levelUpper).toBe(1000 + 6932 + BAND_WIDTH_LEVELS);
    const second = bandLevels(1000, 1);
    expect(second.levelLower - first.levelLower).toBe(6541);
  });

  it("splits the curve into 32 JIT positions", () => {
    const opening = -100_000;
    expect(curvePositionLower(opening, 0)).toBe(opening);
    expect(curvePositionLower(opening, 31)).toBe(
      opening + Math.floor((31 * CURVE_SPAN_LEVELS) / 32),
    );
  });

  it("clamps curve progress outside the span", () => {
    expect(curveProgress(-1_000_000, -100_000, -100_000 + CURVE_SPAN_LEVELS)).toBe(0);
    expect(curveProgress(0, -100_000, -100_000 + CURVE_SPAN_LEVELS)).toBe(1);
  });
});
