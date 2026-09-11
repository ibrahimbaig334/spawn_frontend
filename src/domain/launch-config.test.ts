import { describe, expect, it } from "vitest";
import {
  countPlanBits,
  hasPlanBit,
  launchDigest,
  planCreatorRemainderWad,
  planIndices,
  planTakeSumWad,
  validateLaunchConfig,
  withPlanBit,
  withoutPlanBit,
} from "./launch-config";
import { CANONICAL_PAYOUT_PLAN, WAD } from "@/protocol/constants";
import type { LaunchConfig, PluginEntry } from "@/types/protocol-model";

const NOW = 1_800_000_000;

function config(overrides: Partial<LaunchConfig> = {}): LaunchConfig {
  return {
    creator: "0x0000000000000000000000000000000000000001",
    name: "Test Token",
    symbol: "TST",
    totalSupply: "1000000000",
    devBuyShareWad: "0",
    payoutPlan: "0",
    deadline: NOW + 3_600,
    ...overrides,
  };
}

function entry(index: number, overrides: Partial<PluginEntry> = {}): PluginEntry {
  return {
    index,
    plugin: `0x${(index + 1).toString(16).padStart(40, "0")}`,
    takeWad: "200000000000000000",
    gasLimit: 200_000,
    role: "payout",
    suspended: false,
    codeHash: `0x${"ab".repeat(32)}`,
    ...overrides,
  };
}

/** keccak placeholder: rolling hash stretched to 32 bytes — structural tests only. */
const keccak: (data: Uint8Array) => `0x${string}` = (data) => {
  let h0 = 0xcbf29ce484222325n;
  let h1 = 0x9e3779b97f4a7c15n;
  for (const byte of data) {
    h0 = (h0 ^ BigInt(byte)) * 0x100000001b3n & 0xffffffffffffffffn;
    h1 = (h1 + BigInt(byte) * h0) & 0xffffffffffffffffn;
  }
  const body = (h0 ^ (h1 << 64n) ^ ((h0 * h1) << 128n) ^ ((h1 * 31n) << 192n))
    .toString(16)
    .slice(0, 64);
  return `0x${body.padEnd(64, "0")}`;
};

describe("payout plan bitset", () => {
  it("sets and clears bits at stable registry indices", () => {
    let plan = 0n;
    plan = withPlanBit(plan, 0);
    plan = withPlanBit(plan, 5);
    expect(hasPlanBit(plan, 0)).toBe(true);
    expect(hasPlanBit(plan, 5)).toBe(true);
    expect(hasPlanBit(plan, 1)).toBe(false);
    plan = withoutPlanBit(plan, 5);
    expect(hasPlanBit(plan, 5)).toBe(false);
  });

  it("lists selected indices ascending and counts them", () => {
    const plan = withPlanBit(withPlanBit(0n, 7), 3);
    expect(planIndices(plan)).toEqual([3, 7]);
    expect(countPlanBits(plan)).toBe(2);
  });

  it("sums selected takes and computes the creator remainder", () => {
    const registry = [entry(0), entry(1, { takeWad: "300000000000000000" })];
    const plan = withPlanBit(0n, 0);
    expect(planTakeSumWad(plan, registry)).toBe(WAD / 5n);
    expect(planCreatorRemainderWad(plan, registry)).toBe(
      WAD - WAD / 5n,
    );
  });

  it("canonical plan is bit 0 only", () => {
    expect(planIndices(CANONICAL_PAYOUT_PLAN)).toEqual([0]);
    expect(countPlanBits(CANONICAL_PAYOUT_PLAN)).toBe(1);
  });
});

describe("launch config validation", () => {
  it("accepts a valid config with an empty plan", () => {
    expect(validateLaunchConfig(config(), [], NOW)).toEqual([]);
  });

  it("rejects unknown, suspended, and non-payout selections", () => {
    const registry = [
      entry(0),
      entry(1, { suspended: true }),
      entry(2, { role: "utility" }),
    ];
    const plan = withPlanBit(
      withPlanBit(withPlanBit(0n, 0), 1),
      2,
    );
    const plan9 = withPlanBit(0n, 9);
    const issues = validateLaunchConfig(
      config({ payoutPlan: (plan | plan9).toString() }),
      registry,
      NOW,
    );
    expect(issues).toContain("plan-suspended-index");
    expect(issues).toContain("plan-non-payout-role");
    expect(issues).toContain("plan-unknown-index");
  });

  it("rejects more than eight plugins", () => {
    const registry = Array.from({ length: 9 }, (_, i) => entry(i, { takeWad: "10000000000000000" }));
    let plan = 0n;
    for (let i = 0; i < 9; i++) plan = withPlanBit(plan, i);
    expect(
      validateLaunchConfig(config({ payoutPlan: plan.toString() }), registry, NOW),
    ).toContain("plan-too-many-plugins");
  });

  it("rejects takes above one whole but accepts exactly one whole", () => {
    const registry = [entry(0, { takeWad: "600000000000000000" })];
    const over = withPlanBit(0n, 0);
    expect(
      validateLaunchConfig(config({ payoutPlan: over.toString() }), registry, NOW),
    ).toEqual([]);
    const extra = entry(1, { takeWad: "500000000000000001" });
    expect(
      validateLaunchConfig(
        config({
          payoutPlan: withPlanBit(over, 1).toString(),
        }),
        [registry[0]!, extra],
        NOW,
      ),
    ).toContain("plan-takes-exceed-whole");
  });

  it("rejects an expired deadline and an over-cap dev buy", () => {
    expect(
      validateLaunchConfig(config({ deadline: NOW - 1 }), [], NOW),
    ).toContain("deadline-not-future");
    expect(
      validateLaunchConfig(
        config({ devBuyShareWad: "100000000000000001" }),
        [],
        NOW,
      ),
    ).toContain("dev-buy-above-cap");
  });
});

describe("launch digest", () => {
  it("produces a 32-byte digest that changes with any field", () => {
    const base = config();
    const hook = "0x000000000000000000000000000000000000000a";
    const digest = launchDigest(base, 8453, hook, keccak);
    expect(digest).toMatch(/^0x[0-9a-f]{64}$/);
    const tampered = launchDigest(
      config({ name: "Test Token " }),
      8453,
      hook,
      keccak,
    );
    expect(tampered).not.toBe(digest);
    const planChanged = launchDigest(
      config({ payoutPlan: "1" }),
      8453,
      hook,
      keccak,
    );
    expect(planChanged).not.toBe(digest);
    const deadlineChanged = launchDigest(
      config({ deadline: NOW + 7_200 }),
      8453,
      hook,
      keccak,
    );
    expect(deadlineChanged).not.toBe(digest);
  });

  it("changes with the verifying hook address and chain", () => {
    const base = config();
    const hookA = "0x000000000000000000000000000000000000000a";
    const hookB = "0x000000000000000000000000000000000000000b";
    expect(launchDigest(base, 8453, hookB, keccak)).not.toBe(
      launchDigest(base, 8453, hookA, keccak),
    );
    expect(launchDigest(base, 1, hookA, keccak)).not.toBe(
      launchDigest(base, 8453, hookA, keccak),
    );
  });
});
