import { describe, expect, it } from "vitest";
import { PROTOCOL_TERMS } from "@/data/protocol-terms";
import type { LaunchDraft } from "@/domain/launch-validation";
import {
  clearLaunchDraft,
  LAUNCH_DRAFT_STORAGE_KEY,
  loadLaunchDraft,
  parseStoredLaunchDraft,
  saveLaunchDraft,
} from "./launch-draft-storage";

const draft: LaunchDraft = {
  name: "Public Works",
  symbol: "WRK",
  supply: "1000000",
  description: "A deterministic local launch draft.",
  split: { ...PROTOCOL_TERMS.defaultProceedsSplit },
  creatorPurchaseEnabled: false,
  creatorPurchaseBps: 500,
  lockupMonths: 6,
  acknowledged: true,
};

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}

describe("launch draft storage", () => {
  it("round-trips V2 and always resets acknowledgement", () => {
    const storage = memoryStorage();
    expect(saveLaunchDraft(draft, storage)).toBe(true);
    expect(loadLaunchDraft(storage)).toEqual({ ...draft, acknowledged: false });
    expect(storage.getItem(LAUNCH_DRAFT_STORAGE_KEY)).toContain('"version":2');
  });

  it("migrates legacy split keys", () => {
    const legacy = JSON.stringify({
      version: 1,
      draft: {
        ...draft,
        split: { creator: 6000, removal: 2000, spawn: 1000, trading: 1000 },
      },
    });
    expect(parseStoredLaunchDraft(legacy)?.split).toEqual(
      PROTOCOL_TERMS.defaultProceedsSplit,
    );
  });

  it("rejects malformed drafts and safely clears storage", () => {
    expect(parseStoredLaunchDraft("{")).toBeNull();
    expect(
      parseStoredLaunchDraft(
        JSON.stringify({
          version: 2,
          draft: { ...draft, split: { creator: 10_000 } },
        }),
      ),
    ).toBeNull();
    const storage = memoryStorage();
    saveLaunchDraft(draft, storage);
    expect(clearLaunchDraft(storage)).toBe(true);
    expect(loadLaunchDraft(storage)).toBeNull();
  });
});
