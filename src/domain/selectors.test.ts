import { describe, expect, it } from "vitest";
import { createSeedState } from "@/data/mock-seed";
import {
  selectLaunchBySlug,
  selectLaunches,
  selectMilestones,
  selectNextMilestone,
  selectPortfolioPositions,
  selectPortfolioTotals,
  selectRecentActivity,
  selectWatchlistedLaunches,
} from "./selectors";

describe("domain selectors", () => {
  it("preserves launch and watchlist order without mutating state", () => {
    const state = createSeedState();
    const order = [...state.data.order.launches];
    expect(selectLaunches(state).map(({ id }) => id)).toEqual(order);
    expect(selectWatchlistedLaunches(state).map(({ id }) => id)).toEqual([
      "launch-afterglow",
      "launch-silt",
    ]);
    expect(state.data.order.launches).toEqual(order);
    expect(selectLaunchBySlug(state, "paloma")?.id).toBe("launch-paloma");
  });

  it("builds completed, next, and ahead milestone views", () => {
    const launch = createSeedState().data.entities.launches["launch-paloma"]!;
    const milestones = selectMilestones(launch, 6);
    expect(milestones).toHaveLength(6);
    expect(milestones.some(({ state }) => state === "completed")).toBe(true);
    expect(milestones.find(({ state }) => state === "next")?.number).toBe(8);
    expect(
      milestones.every(
        ({ targetEth, allocationEth }) =>
          /^\d+(?:\.\d+)?$/.test(targetEth) &&
          /^\d+(?:\.\d+)?$/.test(allocationEth),
      ),
    ).toBe(true);
    expect(selectNextMilestone(launch)?.number).toBe(8);
  });

  it("sorts recent activity and derives portfolio totals", () => {
    const state = createSeedState();
    const activity = selectRecentActivity(state, 4);
    expect(activity).toHaveLength(4);
    expect(activity.map(({ sequence }) => sequence)).toEqual(
      [...activity.map(({ sequence }) => sequence)].sort((a, b) => b - a),
    );
    const totals = selectPortfolioTotals(state);
    expect(totals.positions.length).toBeGreaterThan(0);
    expect(totals.ethBalance).toBe("25");
  });

  it("uses weighted-average cost and absorbs residue on a full close", () => {
    const state = createSeedState();
    const launchId = "launch-paloma";
    state.data.entities.ledger = {
      first: {
        id: "first",
        launchId,
        side: "buy",
        tokenAmount: "3",
        grossEth: "1",
        feeEth: "0",
        netEth: "1",
        receiptId: "one",
        sequence: 301,
        occurredAt: "2025-03-17T18:00:00.000Z",
        origin: "simulation",
      },
      second: {
        id: "second",
        launchId,
        side: "buy",
        tokenAmount: "2",
        grossEth: "1",
        feeEth: "0",
        netEth: "1",
        receiptId: "two",
        sequence: 302,
        occurredAt: "2025-03-18T00:00:00.000Z",
        origin: "simulation",
      },
      partial: {
        id: "partial",
        launchId,
        side: "sell",
        tokenAmount: "2",
        grossEth: "1.2",
        feeEth: "0.1",
        netEth: "1.1",
        receiptId: "three",
        sequence: 303,
        occurredAt: "2025-03-18T06:00:00.000Z",
        origin: "simulation",
      },
    };
    state.data.order.ledger = ["partial", "second", "first"];
    const partial = selectPortfolioPositions(state).find(
      (position) => position.launch.id === launchId,
    )!;
    expect(partial.tokenQuantity).toBe("3");
    expect(partial.remainingCostBasisEth).toBe("1.2");
    expect(partial.averageCostEth).toBe("0.4");
    expect(partial.realizedPnlEth).toBe("0.3");

    state.data.entities.ledger.close = {
      id: "close",
      launchId,
      side: "sell",
      tokenAmount: "3",
      grossEth: "1.5",
      feeEth: "0.1",
      netEth: "1.4",
      receiptId: "four",
      sequence: 304,
      occurredAt: "2025-03-18T12:00:00.000Z",
      origin: "simulation",
    };
    state.data.order.ledger.unshift("close");
    const closed = selectPortfolioPositions(state).find(
      (position) => position.launch.id === launchId,
    )!;
    expect(closed.tokenQuantity).toBe("0");
    expect(closed.remainingCostBasisEth).toBe("0");
    expect(closed.realizedPnlEth).toBe("0.5");
    expect(closed.totalPnlEth).toBe("0.5");
  });
});
