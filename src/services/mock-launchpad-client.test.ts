import { describe, expect, it } from "vitest";
import { PROTOCOL_TERMS } from "@/data/protocol-terms";
import type { LaunchDraft } from "@/domain/launch-validation";
import type { LaunchpadClient } from "./launchpad-client";
import { createMockLaunch, MockLaunchpadClient } from "./mock-launchpad-client";

const draft: LaunchDraft = {
  name: "Public Works",
  symbol: "wrk",
  supply: "1000000.5",
  description: "A deterministic typed launch used by the demo.",
  split: { ...PROTOCOL_TERMS.defaultProceedsSplit },
  creatorPurchaseEnabled: false,
  creatorPurchaseBps: 500,
  lockupMonths: 6,
  acknowledged: true,
};

describe("mock launchpad client", () => {
  it("creates normalized typed launches deterministically", async () => {
    const client: LaunchpadClient = new MockLaunchpadClient();
    const first = await client.createLaunch(draft, 101);
    expect(first).toEqual(createMockLaunch(draft, 101));
    expect(first.launch.id).toBe("launch-local-101");
    expect(first.launch.slug).toBe("public-works-101");
    expect(first.launch.symbol).toBe("WRK");
    expect(first.launch.supply).toBe("1000000.5");
    expect(first.launch.creatorPurchase).toEqual({
      enabled: false,
      shareBps: 0,
      lockupMonths: 0,
    });
    expect(first.nextSequence).toBe(102);
  });

  it("requires final launch acknowledgement", () => {
    expect(() =>
      createMockLaunch({ ...draft, acknowledged: false }, 101),
    ).toThrow(/Acknowledge/);
  });
});
