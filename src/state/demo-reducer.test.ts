import { describe, expect, it } from "vitest";
import { createSeedData, createSeedState } from "@/data/mock-seed";
import { createMockLaunch } from "@/services/mock-launchpad-client";
import { simulateTrade } from "@/domain/trade-simulator";
import { demoReducer } from "./demo-reducer";
import { PROTOCOL_TERMS } from "@/data/protocol-terms";

const draft = {
  name: "New Launch",
  symbol: "NEW",
  supply: "1000000",
  description: "A deterministic local launch fixture.",
  split: { ...PROTOCOL_TERMS.defaultProceedsSplit },
  creatorPurchaseEnabled: false,
  creatorPurchaseBps: 500,
  lockupMonths: 6,
  acknowledged: true,
};

describe("demo reducer", () => {
  it("hydrates once and marks persistence available", () => {
    const initial = createSeedState();
    const stored = createSeedData();
    stored.portfolio.ethBalance = "7";
    const hydrated = demoReducer(initial, { type: "hydrate", data: stored });
    expect(hydrated.data.portfolio.ethBalance).toBe("7");
    expect(hydrated.runtime).toMatchObject({
      hydration: "ready",
      persistence: "available",
    });
    expect(
      demoReducer(hydrated, { type: "hydrate", data: createSeedData() }),
    ).toBe(hydrated);
  });

  it("adds a launch atomically and ignores a repeated result", () => {
    const initial = demoReducer(createSeedState(), {
      type: "mark-hydrated",
      persistence: "available",
    });
    const result = createMockLaunch(draft, initial.data.sequence + 1);
    const added = demoReducer(initial, { type: "add-launch", result });
    expect(added.data.entities.launches[result.launch.id]).toEqual(
      result.launch,
    );
    expect(added.data.order.launches[0]).toBe(result.launch.id);
    expect(demoReducer(added, { type: "add-launch", result })).toBe(added);
  });

  it("toggles valid watchlist entries and ignores missing launches", () => {
    const state = createSeedState();
    expect(demoReducer(state, { type: "toggle-watch", id: "missing" })).toBe(
      state,
    );
    const toggled = demoReducer(state, {
      type: "toggle-watch",
      id: "launch-paloma",
    });
    expect(toggled.data.watchlist).toContain("launch-paloma");
  });

  it("applies an atomic trade bundle once", () => {
    const initial = createSeedState();
    const launch = initial.data.entities.launches["launch-paloma"]!;
    const result = simulateTrade(
      launch,
      { side: "buy", amount: "1" },
      {
        ethBalance: initial.data.portfolio.ethBalance,
        tokenBalance: "2500000",
      },
      initial.data.sequence + 1,
    );
    const traded = demoReducer(initial, { type: "apply-trade", result });
    expect(traded.data.entities.launches[launch.id]).toEqual(result.launch);
    expect(traded.data.entities.ledger[result.ledgerEntry.id]).toEqual(
      result.ledgerEntry,
    );
    expect(traded.data.entities.history[result.historyPoint.id]).toEqual(
      result.historyPoint,
    );
    expect(traded.data.portfolio.ethBalance).toBe(result.ethBalance);
    expect(traded.data.sequence).toBe(result.nextSequence);
    expect(demoReducer(traded, { type: "apply-trade", result })).toBe(traded);
  });

  it("resets to fresh persisted seed data and ready runtime state", () => {
    const changed = createSeedState();
    changed.data.portfolio.ethBalance = "0";
    changed.runtime = { hydration: "ready", persistence: "available" };
    const reset = demoReducer(changed, { type: "reset" });
    expect(reset.data).toEqual(createSeedData());
    expect(reset.runtime).toEqual({
      hydration: "ready",
      persistence: "available",
    });
    expect(reset.data.entities.launches).not.toBe(
      createSeedData().entities.launches,
    );
  });
});
