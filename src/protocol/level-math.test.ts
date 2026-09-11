import { describe, expect, it } from "vitest";
import {
  CURVE_SPAN_LEVELS,
  OPENING_FDV_WEI,
} from "./constants";
import {
  bandLevels,
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

describe("level math", () => {
  it("level = -tick in both directions", () => {
    expect(tickToLevel(6931)).toBe(-6931);
    expect(tickToLevel(-6931)).toBe(6931);
  });

  it("computes 1.0001^level ETH-per-token within sub-milli precision", () => {
    // level 0: price 1
    expect(ethPerTokenWei(0)).toBe(WAD);
    // level 6931: ~2.0 (one doubling)
    const doubled = ethPerTokenWei(6931);
    expect(doubled > 2n * WAD - 2n * M && doubled < 2n * WAD + 2n * M).toBe(
      true,
    );
    // negative levels: below 1
    expect(ethPerTokenWei(-6931) < WAD / 2n + M).toBe(true);
  });

  it("FDV = totalSupply * 1.0001^level with decimals cancelling", () => {
    const supply = 10n ** 24n; // 1M tokens
    const fdv = fdvEthWei(supply, 0);
    expect(fdv).toBe(10n ** 24n);
  });

  it("derives the opening level from supply at the 125 ETH template FDV", () => {
    // 1B-token 18-decimal supply: price 125e-9 ETH/token at launch
    const supply = 10n ** 27n;
    const level = openingLevelFor(supply);
    const fdv = fdvEthWei(supply, level);
    // brackets the template FDV from below within one level's movement
    expect(fdv >= OPENING_FDV_WEI).toBe(true);
    expect(fdvEthWei(supply, level - 1) < OPENING_FDV_WEI).toBe(true);
    // level is a large negative number (token opens far below 1 ETH)
    expect(level).toBeLessThan(0);
    expect(level).toBeGreaterThan(-500_000);
  });

  it("far level is exactly one doubling above opening", () => {
    const opening = openingLevelFor(10n ** 27n);
    expect(farLevelFor(opening)).toBe(opening + CURVE_SPAN_LEVELS);
    const supply = 10n ** 27n;
    const farFdv = fdvEthWei(supply, farLevelFor(opening));
    // ~2x the opening FDV (6931 levels ≈ 1.99983x; exact doubling is 6931.8)
    const expected = 2n * OPENING_FDV_WEI;
    expect(farFdv >= expected - expected / 500n).toBe(true);
    expect(farFdv < expected + expected / 500n).toBe(true);
  });

  it("computes band geometry from the graduation level", () => {
    const first = bandLevels(1000, 0);
    expect(first.levelLower).toBe(1000 + 2235);
    expect(first.levelUpper).toBe(1000 + 2235 + 447);
    const third = bandLevels(1000, 2);
    expect(third.levelLower).toBe(1000 + 3 * 2235);
  });

  it("splits the curve into 32 JIT positions", () => {
    const opening = -100_000;
    expect(curvePositionLower(opening, 0)).toBe(opening);
    // position 31 starts one rung (span/32) above opening
    expect(curvePositionLower(opening, 31)).toBe(
      opening + Math.floor((31 * CURVE_SPAN_LEVELS) / 32),
    );
    // halfway through the span is exactly halfway in level space
    const mid = opening + Math.floor(CURVE_SPAN_LEVELS / 2);
    const progress = curveProgress(
      mid,
      opening,
      opening + CURVE_SPAN_LEVELS,
    );
    expect(progress).toBeCloseTo(
      Math.floor(CURVE_SPAN_LEVELS / 2) / CURVE_SPAN_LEVELS,
      10,
    );
  });

  it("clamps curve progress outside the span", () => {
    expect(curveProgress(-1_000_000, -100_000, -100_000 + 6931)).toBe(0);
    expect(curveProgress(0, -100_000, -100_000 + 6931)).toBe(1);
  });
});
