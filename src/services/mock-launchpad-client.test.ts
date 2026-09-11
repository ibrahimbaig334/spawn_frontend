import { describe, expect, it } from "vitest";
import { mockLaunchpadClient } from "./mock-launchpad-client";
import type { LaunchConfig } from "@/types/protocol-model";

const NOW = 1_800_000_000;

function config(overrides: Partial<LaunchConfig> = {}): LaunchConfig {
  return {
    creator: "0x000000000000000000000000000000000000000d",
    name: "Test Token",
    symbol: "TST",
    totalSupply: "1000000000000000000000000000",
    devBuyShareWad: "0",
    payoutPlan: "1",
    deadline: NOW + 3_600,
    ...overrides,
  };
}

describe("mock launchpad client", () => {
  it("rejects an invalid launch configuration", async () => {
    await expect(
      mockLaunchpadClient.createLaunch(
        config({ devBuyShareWad: "200000000000000000" }),
        1,
      ),
    ).rejects.toThrow(/dev-buy-above-cap/);
  });

  it("launches a valid config at the 125 ETH opening FDV", async () => {
    const result = await mockLaunchpadClient.createLaunch(config(), 1);
    expect(result.launch.phase).toBe("bonding-curve");
    expect(result.launch.openingLevel).toBeLessThan(0);
    expect(result.launch.farLevel).toBe(result.launch.openingLevel + 6931);
    expect(result.launch.payoutPlan).toBe("1");
    expect(result.nextSequence).toBe(2);
    const events = result.events.map((event) => event.kind);
    expect(events).toContain("Launched");
    expect(events).toContain("LaunchConfigured");
  });

  it("predicts a deterministic token address from the config", async () => {
    const first = await mockLaunchpadClient.predictTokenAddress(config());
    const second = await mockLaunchpadClient.predictTokenAddress(config());
    expect(first).toMatch(/^0x[0-9a-f]{40}$/);
    expect(second).toBe(first);
    const changed = await mockLaunchpadClient.predictTokenAddress(
      config({ payoutPlan: "0" }),
    );
    expect(changed).not.toBe(first);
  });

  it("lists the canonical registry and economics", async () => {
    const entries = await mockLaunchpadClient.listPluginEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.index).toBe(0);
    expect(entries[0]?.role).toBe("payout");
    expect(BigInt(entries[0]!.takeWad)).toBe(
      (2n * 10n ** 18n) / 9n,
    );
    const economics = await mockLaunchpadClient.getEconomicConfig();
    expect(economics.harvestServiceFeeWad).toBe("100000000000000000");
    expect(economics.quoteCreatorShareWad).toBe("750000000000000000");
    expect(economics.tokenMilestoneFundShareWad).toBe("200000000000000000");
  });
});
