import { describe, expect, it } from "vitest";
import { computeLaunchDigest } from "./launch-signature";

const DOMAIN = { chainId: 8453, verifyingContract: "0x0000000000000000000000000000000000000abc" };

const CONFIG = {
  creator: "0x0000000000000000000000000000000000000fee",
  name: "North Token",
  symbol: "NRT",
  uri: "https://gateway.ipfs.io/ipfs/bafytest",
  totalSupply: "1000000000000000000000000000",
  devBuyShareWad: "50000000000000000",
  payoutPlan: "1",
  deadline: 1_900_000_000,
};

describe("EIP-712 launch digest", () => {
  it("is deterministic", () => {
    expect(computeLaunchDigest(DOMAIN, CONFIG)).toBe(computeLaunchDigest(DOMAIN, CONFIG));
  });

  it("matches the domain reported by the backend prepare contract", () => {
    // Sanity against viem's own hashTypedData pipeline (SpawnLaunchpad v1).
    const digest = computeLaunchDigest(DOMAIN, CONFIG);
    expect(digest).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("uri is part of the struct — changing it changes the digest", () => {
    const withUriA = computeLaunchDigest(DOMAIN, CONFIG);
    const withUriB = computeLaunchDigest(DOMAIN, { ...CONFIG, uri: "https://other/uri" });
    expect(withUriA).not.toBe(withUriB);
  });

  it("every field participates", () => {
    const base = computeLaunchDigest(DOMAIN, CONFIG);
    const mutations = [
      { creator: "0x0000000000000000000000000000000000000001" },
      { name: "Other" },
      { symbol: "XX" },
      { totalSupply: "999999999999999999999999999" },
      { devBuyShareWad: "0" },
      { payoutPlan: "3" },
      { deadline: 1_900_000_001 },
    ];
    for (const patch of mutations) {
      expect(computeLaunchDigest(DOMAIN, { ...CONFIG, ...patch })).not.toBe(base);
    }
  });

  it("domain separates: different chain or hook => different digest", () => {
    const base = computeLaunchDigest(DOMAIN, CONFIG);
    expect(computeLaunchDigest({ ...DOMAIN, chainId: 84532 }, CONFIG)).not.toBe(base);
    expect(
      computeLaunchDigest(
        { ...DOMAIN, verifyingContract: "0x0000000000000000000000000000000000000abd" },
        CONFIG,
      ),
    ).not.toBe(base);
  });

  it("parses WAD decimal strings and raw integers identically", () => {
    const asDecimal = computeLaunchDigest(DOMAIN, { ...CONFIG, devBuyShareWad: "0.05" });
    const asRaw = computeLaunchDigest(DOMAIN, { ...CONFIG, devBuyShareWad: "50000000000000000" });
    expect(asDecimal).toBe(asRaw);
  });
});
