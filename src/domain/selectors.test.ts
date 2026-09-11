import { describe, expect, it } from "vitest";
import { createSeedState } from "@/data/mock-seed";
import {
  deriveCurveProgress,
  deriveFdvEth,
  deriveGraduationNext,
  derivePhaseLabel,
  derivePriceEth,
  selectLaunchBySlug,
  selectLaunches,
  selectMilestoneSchedule,
  selectPlanPluginCount,
  selectPortfolioTotals,
} from "./selectors";

describe("protocol selectors", () => {
  const state = createSeedState();

  it("seeds deterministic protocol-accurate pools", () => {
    const launches = selectLaunches(state);
    expect(launches.length).toBeGreaterThanOrEqual(3);
    for (const launch of launches) {
      expect(launch.phase === "bonding-curve" || launch.phase === "graduated")
        .toBe(true);
      expect(launch.farLevel - launch.openingLevel).toBe(6931);
      expect(launch.payoutPlan).toBe("1");
    }
  });

  it("derives price and FDV in level space", () => {
    const launch = selectLaunchBySlug(state, "atelier-north-token");
    if (!launch) throw new Error("seed launch missing");
    const price = Number(derivePriceEth(launch));
    const fdv = Number(deriveFdvEth(launch));
    expect(price).toBeGreaterThan(0);
    expect(fdv).toBeGreaterThan(0);
    // FDV = supply * price within rounding
    const supply = Number(launch.totalSupplyWei);
    expect(fdv / (supply * price)).toBeCloseTo(1, 4);
  });

  it("computes curve progress and the graduation signal", () => {
    const launch = selectLaunchBySlug(state, "atelier-north-token");
    if (!launch) throw new Error("seed launch missing");
    const progress = deriveCurveProgress(launch);
    expect(progress).toBeGreaterThanOrEqual(0);
    expect(progress).toBeLessThanOrEqual(1);
    if (launch.phase === "graduated") {
      expect(progress).toBe(1);
      expect(derivePhaseLabel(launch)).toBe("Graduated");
      expect(deriveGraduationNext(launch)).toBe(false);
    } else {
      expect(derivePhaseLabel(launch)).toBe("Bonding curve");
    }
  });

  it("builds the milestone schedule from band geometry", () => {
    const graduated = selectLaunches(state).find(
      (launch) => launch.phase === "graduated",
    );
    if (!graduated) throw new Error("no graduated seed");
    const schedule = selectMilestoneSchedule(graduated, [
      {
        index: 0,
        state: "completed",
        levelLower: graduated.graduationLevel! + 2235,
        levelUpper: graduated.graduationLevel! + 2235 + 447,
      },
      {
        index: 1,
        state: "deployed",
        levelLower: graduated.graduationLevel! + 2 * 2235,
        levelUpper: graduated.graduationLevel! + 2 * 2235 + 447,
      },
      {
        index: 2,
        state: "skipped",
        levelLower: graduated.graduationLevel! + 3 * 2235,
        levelUpper: graduated.graduationLevel! + 3 * 2235 + 447,
      },
    ]);
    expect(schedule).toHaveLength(3);
    expect(schedule[0]?.state).toBe("completed");
    // band index 1 sits at 1.0001^(2*2235) ≈ 1.564x graduation
    expect(schedule[1]?.rungMultiple).toBe("1.564x");
  });

  it("reads the canonical plan bitset", () => {
    const launch = selectLaunchBySlug(state, "atelier-north-token");
    if (!launch) throw new Error("seed launch missing");
    expect(selectPlanPluginCount(launch)).toBe(1);
  });

  it("computes portfolio totals from the ledger", () => {
    const totals = selectPortfolioTotals(state);
    expect(totals.positions.length).toBeGreaterThan(0);
    expect(Number(totals.ethBalance)).toBeGreaterThan(0);
  });
});
