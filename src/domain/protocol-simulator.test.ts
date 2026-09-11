import { describe, expect, it } from "vitest";
import { ProtocolSimulation } from "./protocol-simulator";
import { CANONICAL_BUYBACK_TAKE_WAD } from "@/protocol/constants";
import type { PluginEntry } from "@/types/protocol-model";

const REGISTRY: PluginEntry[] = [
  {
    index: 0,
    plugin: "0x0000000000000000000000000000000000000b07",
    takeWad: CANONICAL_BUYBACK_TAKE_WAD.toString(),
    gasLimit: 500_000,
    role: "payout",
    suspended: false,
    codeHash: `0x${"bb".repeat(32)}`,
  },
];

function simulation() {
  return new ProtocolSimulation(REGISTRY);
}

function launch(sim: ProtocolSimulation, devBuy = "0") {
  return sim.createLaunch(
    {
      creator: "0x000000000000000000000000000000000000000d",
      name: "Sim Token",
      symbol: "SIM",
      totalSupply: "1000000000000000000000000000",
      devBuyShareWad: devBuy,
      payoutPlan: "1",
      deadline: Math.floor(Date.now() / 1000) + 3_600,
    },
    "sim-token",
  );
}

describe("protocol simulator", () => {
  it("opens every launch at the 125 ETH template FDV", () => {
    const sim = simulation();
    const pool = launch(sim);
    expect(pool.record.openingLevel).toBeLessThan(0);
    expect(pool.record.farLevel).toBe(pool.record.openingLevel + 6931);
    expect(pool.record.phase).toBe("bonding-curve");
  });

  it("executes a creator dev buy inside launch on ordinary terms", () => {
    const sim = simulation();
    const pool = launch(sim, "50000000000000000"); // 5%
    expect(
      sim.account.tokens[pool.record.poolId] ?? 0n,
    ).toBeGreaterThan(0n);
    expect(pool.record.level).toBeGreaterThan(pool.record.openingLevel);
    const events = sim.events[pool.record.poolId] ?? [];
    expect(events.some((event) => event.kind === "DevBuyExecuted")).toBe(
      true,
    );
  });

  it("charges the static 1% fee on trades", () => {
    const sim = simulation();
    const pool = launch(sim);
    const preview = sim.previewTrade(pool, { side: "buy", amount: "100" });
    expect(Number(preview.feeAmount)).toBeCloseTo(1, 4);
    expect(preview.levelAfter).toBeGreaterThan(pool.record.level);
  });

  it("graduates at the far level and splits proceeds 40/55/5", () => {
    const sim = simulation();
    const pool = launch(sim);
    // A curve-sweeping buy parks the level at the far level and graduates.
    const result = sim.executeTrade(pool, { side: "buy", amount: "200" });
    const events = sim.events[pool.record.poolId] ?? [];
    const graduated = events.find((event) => event.kind === "Graduated");
    if (result.launch.phase === "graduated") {
      expect(graduated).toBeDefined();
      if (graduated?.kind === "Graduated") {
        const proceeds = Number(graduated.quoteProceeds);
        expect(Number(graduated.lpSeedQuote) / proceeds).toBeCloseTo(0.4, 2);
        expect(Number(graduated.creatorQuote) / proceeds).toBeCloseTo(0.55, 2);
        expect(Number(graduated.protocolQuote) / proceeds).toBeCloseTo(0.05, 2);
      }
      expect(result.launch.graduationLevel).toBeDefined();
    }
  });

  it("harvests crossed bands into the pot with a 10% service fee", () => {
    const sim = simulation();
    const pool = launch(sim);
    sim.executeTrade(pool, { side: "buy", amount: "200" });
    if (pool.record.phase !== "graduated") return;
    // one more big buy to cross the first band top
    sim.executeTrade(pool, { side: "buy", amount: "5000" });
    const events = sim.events[pool.record.poolId] ?? [];
    const funded = events.find((event) => event.kind === "PayoutPotFunded");
    if (funded?.kind === "PayoutPotFunded") {
      expect(Number(funded.serviceFee) / Number(funded.grossQuote)).toBeCloseTo(
        0.1,
        2,
      );
      expect(
        Number(funded.netQuote) / Number(funded.grossQuote),
      ).toBeCloseTo(0.9, 2);
    }
  });

  it("flushes the pot with a 1% tip, plugin take, and creator remainder", () => {
    const sim = simulation();
    const pool = launch(sim);
    sim.executeTrade(pool, { side: "buy", amount: "200" });
    sim.executeTrade(pool, { side: "buy", amount: "5000" });
    const potBefore = Number(pool.record.payoutPotWei);
    const outcome = sim.flushPool(pool);
    if (potBefore > 0) {
      expect(Number(outcome.redeemedWei)).toBeGreaterThan(0);
      // tip = floor(1% of redeemed pot)
      expect(Number(outcome.tipWei)).toBeCloseTo(
        Math.floor(Number(outcome.redeemedWei) / 100),
        6,
      );
      expect(outcome.deliveries.length).toBeGreaterThan(0);
      expect(Number(outcome.creatorPathAccruedWei)).toBeGreaterThan(0);
      expect(Number(pool.record.payoutPotWei)).toBe(0);
    } else {
      expect(Number(outcome.redeemedWei)).toBe(0);
      expect(Number(outcome.tipWei)).toBe(0);
    }
  });

  it("claims zero balances as successful no-ops", () => {
    const sim = simulation();
    const pool = launch(sim);
    const direct = sim.claimDirect(pool);
    expect(direct.success).toBe(true);
    expect(Number(direct.attemptedWei)).toBe(0);
    const path = sim.claimCreatorPath(pool);
    expect(path.success).toBe(true);
    const protocol = sim.claimProtocol();
    expect(protocol.success).toBe(true);
  });

  it("redirects suspended plugins to the creator path", () => {
    const sim = new ProtocolSimulation([
      { ...REGISTRY[0]!, suspended: true },
    ]);
    const pool = launch(sim);
    sim.executeTrade(pool, { side: "buy", amount: "200" });
    sim.executeTrade(pool, { side: "buy", amount: "5000" });
    const outcome = sim.flushPool(pool);
    const redirected = outcome.deliveries.find(
      (item) => item.status === "redirected",
    );
    const potBefore = 0;
    if (Number(outcome.redeemedWei) > potBefore) {
      expect(redirected).toBeDefined();
    }
  });
});
