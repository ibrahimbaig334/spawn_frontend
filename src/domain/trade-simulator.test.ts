import { describe, expect, it } from "vitest";
import { createSeedState } from "@/data/mock-seed";
import { splitAmount } from "./economics";
import {
  previewTrade,
  simulateTrade,
  TradeSimulationError,
} from "./trade-simulator";

function fixture() {
  const state = createSeedState();
  return {
    launch: state.data.entities.launches["launch-paloma"]!,
    context: {
      ethBalance: state.data.portfolio.ethBalance,
      tokenBalance: "2500000",
    },
  };
}

describe("trade simulator", () => {
  it("uses asset-aware decimal strings and deterministic receipts", () => {
    const { launch, context } = fixture();
    const first = simulateTrade(
      launch,
      { side: "buy", amount: "2.5" },
      context,
      301,
    );
    const second = simulateTrade(
      launch,
      { side: "buy", amount: "2.5" },
      context,
      301,
    );
    expect(second).toEqual(first);
    expect(first.receiptId).toBe("demo_launch-paloma_301");
    expect(first.inputAmount).toBe("2.5");
    expect(first.inputUnit).toBe("ETH");
    expect(first.nextSequence).toBe(301 + first.activities.length);
  });

  it("caps a buy at eight completions and carries progress below the next completion", () => {
    const { launch, context } = fixture();
    const changed = { ...launch, progressBps: 9_900, valuationEth: "1" };
    const result = simulateTrade(
      changed,
      { side: "buy", amount: "20" },
      context,
      301,
    );
    expect(result.newlyCompleted).toBe(8);
    expect(result.launch.completedMilestones).toBe(
      changed.completedMilestones + 8,
    );
    expect(result.afterProgressBps).toBeLessThan(10_000);
  });

  it("uses token quantity for sells and never lowers completed milestones", () => {
    const { launch, context } = fixture();
    const result = simulateTrade(
      launch,
      { side: "sell", amount: "1000" },
      context,
      301,
    );
    expect(result.inputUnit).toBe("token");
    expect(result.outputUnit).toBe("ETH");
    expect(result.launch.progressBps).toBeLessThanOrEqual(launch.progressBps);
    expect(result.launch.completedMilestones).toBe(launch.completedMilestones);
    expect(result.launch.additionalMilestones).toBe(
      launch.additionalMilestones,
    );
    expect(result.newlyCompleted).toBe(0);
  });

  it("assigns every split remainder to liquidity", () => {
    const result = splitAmount(7n, {
      creator: 6_000,
      buyback: 2_000,
      protocol: 1_000,
      liquidity: 1_000,
    });
    expect(result).toEqual({
      creator: 4n,
      buyback: 1n,
      protocol: 0n,
      liquidity: 2n,
    });
    expect(Object.values(result).reduce((sum, value) => sum + value, 0n)).toBe(
      7n,
    );
  });

  it("rejects invalid, over-precise, and insufficient balances", () => {
    const { launch, context } = fixture();
    expect(() =>
      previewTrade(launch, { side: "buy", amount: "0" }, context),
    ).toThrow(TradeSimulationError);
    expect(() =>
      previewTrade(
        launch,
        { side: "buy", amount: "1.0000000000000000001" },
        context,
      ),
    ).toThrow(TradeSimulationError);
    expect(() =>
      previewTrade(launch, { side: "buy", amount: "26" }, context),
    ).toThrow(/balance/);
    expect(() =>
      previewTrade(launch, { side: "sell", amount: "2500001" }, context),
    ).toThrow(/balance/);
  });
});
