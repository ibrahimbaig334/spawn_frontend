import { describe, expect, it } from "vitest";
import { demoReducer } from "./demo-reducer";
import { createSeedState } from "@/data/mock-seed";
import type { DemoAction, DemoState } from "@/types/demo";

function state(): DemoState {
  return createSeedState();
}

describe("demo reducer", () => {
  it("hydrates once and records persistence", () => {
    const initial = state();
    const data = initial.data;
    const hydrated = demoReducer(initial, {
      type: "hydrate",
      data,
    } as DemoAction);
    expect(hydrated.runtime.hydration).toBe("ready");
    const again = demoReducer(hydrated, {
      type: "hydrate",
      data,
    } as DemoAction);
    expect(again).toBe(hydrated);
  });

  it("toggles watchlist membership for known pools", () => {
    const current = state();
    const poolId = current.data.order.launches[0]!;
    // the first seed launch starts watched; toggling removes then re-adds
    const startsWatched = current.data.watchlist.includes(poolId);
    const first = demoReducer(current, {
      type: "toggle-watch",
      id: poolId,
    });
    expect(first.data.watchlist.includes(poolId)).toBe(!startsWatched);
    const second = demoReducer(first, {
      type: "toggle-watch",
      id: poolId,
    });
    expect(second.data.watchlist.includes(poolId)).toBe(startsWatched);
  });

  it("ignores toggles for unknown pools", () => {
    const current = state();
    const unchanged = demoReducer(current, {
      type: "toggle-watch",
      id: "pool-missing",
    });
    expect(unchanged).toBe(current);
  });

  it("adds a launch with its created activity and events", () => {
    const current = state();
    const poolId = "pool-new-1";
    const createdAt = new Date().toISOString();
    const added = demoReducer(current, {
      type: "add-launch",
      result: {
        launch: {
          poolId,
          slug: "new-token-1",
          creator: "0x000000000000000000000000000000000000000d",
          token: "0x00000000000000000000000000000000000000aa",
          name: "New Token",
          symbol: "NEW",
          totalSupplyWei: "1000000000000000000000000000",
          phase: "bonding-curve",
          level: -400_000,
          openingLevel: -400_000,
          farLevel: -400_000 + 6931,
          payoutPlan: "1",
          devBuyShareWad: "0",
          payoutPotWei: "0",
          carryBitmap: "0",
          completedMilestones: 0,
          createdAt,
        },
        events: [
          {
            kind: "Launched",
            poolId,
            creator: "0x000000000000000000000000000000000000000d" as `0x${string}`,
            token: "0x00000000000000000000000000000000000000aa" as `0x${string}`,
            totalSupply: "1000000000000000000000000000",
            openingLevel: -400_000,
            farLevel: -400_000 + 6931,
            configHash: `0x${"00".repeat(32)}` as `0x${string}`,
          },
        ],
        nextSequence: current.data.sequence + 1,
      },
    });
    expect(added.data.entities.launches[poolId]?.name).toBe("New Token");
    expect(added.data.order.launches[0]).toBe(poolId);
    expect(
      added.data.order.activities.some((id) =>
        id.startsWith(`activity-${poolId}`),
      ),
    ).toBe(true);
  });

  it("applies launch updates atomically", () => {
    const current = state();
    const poolId = current.data.order.launches[0]!;
    const launch = current.data.entities.launches[poolId]!;
    const sequence = current.data.sequence + 1;
    const updated = demoReducer(current, {
      type: "apply-launch-update",
      launch: { ...launch, level: launch.level + 50 },
      events: [],
      activity: {
        id: `activity-${poolId}-buy-${sequence}`,
        launchId: poolId,
        kind: "buy",
        amountEth: "1",
        sequence,
        occurredAt: new Date().toISOString(),
        source: "local-simulation",
      },
      tokenBalance: "1000000000000000000",
    });
    expect(updated.data.entities.launches[poolId]?.level).toBe(
      launch.level + 50,
    );
    expect(
      updated.data.portfolio.tokenBalances[poolId],
    ).toBe("1000000000000000000");
    expect(updated.data.order.activities[0]).toContain(
      `activity-${poolId}-buy-`,
    );
  });

  it("resets to the seed state", () => {
    const current = state();
    const poolId = current.data.order.launches[0]!;
    const toggled = demoReducer(current, {
      type: "toggle-watch",
      id: poolId,
    });
    const reset = demoReducer(toggled, { type: "reset" });
    expect(reset.data.version).toBe(3);
    expect(reset.runtime.hydration).toBe("pending");
  });
});
