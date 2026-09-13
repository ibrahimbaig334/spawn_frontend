import { describe, expect, it } from "vitest";
import { countPlanBits, hasPlanBit, planIndices, planTakesSumWad, withoutPlanBit, withPlanBit } from "./payout-plan";

const WAD = 10n ** 18n;

describe("payout plan bitset", () => {
  it("canonical plan is bit 0 only", () => {
    const plan = 1n;
    expect(hasPlanBit(plan, 0)).toBe(true);
    expect(hasPlanBit(plan, 1)).toBe(false);
    expect(planIndices(plan)).toEqual([0]);
  });

  it("add and remove bits without disturbing others", () => {
    let plan = 0n;
    plan = withPlanBit(plan, 3);
    plan = withPlanBit(plan, 7);
    expect(planIndices(plan)).toEqual([3, 7]);
    plan = withoutPlanBit(plan, 3);
    expect(hasPlanBit(plan, 3)).toBe(false);
    expect(hasPlanBit(plan, 7)).toBe(true);
    expect(countPlanBits(plan)).toBe(1);
  });

  it("sums registry takes for selected bits only", () => {
    const registry = [
      { index: 0, takeWad: (2n * WAD) / 9n },
      { index: 1, takeWad: WAD / 10n },
      { index: 2, takeWad: WAD / 5n },
    ];
    const plan = withPlanBit(withoutPlanBit(0b111n, 1), 0);
    expect(planIndices(plan)).toEqual([0, 2]);
    const sum = planTakesSumWad(plan, registry);
    expect(sum).toBe((2n * WAD) / 9n + WAD / 5n);
  });

  it("empty plan (creator remainder 100%) is valid", () => {
    expect(planIndices(0n)).toEqual([]);
    expect(planTakesSumWad(0n, [{ index: 0, takeWad: WAD }])).toBe(0n);
  });
});
