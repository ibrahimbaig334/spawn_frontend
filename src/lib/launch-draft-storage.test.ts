import { describe, expect, it } from "vitest";
import {
  clearLaunchDraft,
  loadLaunchDraft,
  saveLaunchDraft,
} from "./launch-draft-storage";
import { INITIAL_DRAFT, type LaunchDraft } from "@/domain/launch-draft";

function storage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

function draft(overrides: Partial<LaunchDraft> = {}): LaunchDraft {
  return {
    ...INITIAL_DRAFT,
    name: "Test Token",
    symbol: "TST",
    ...overrides,
  };
}

describe("launch draft storage", () => {
  it("round-trips a valid protocol draft", () => {
    const store = storage();
    const value = draft({ devBuyEnabled: true, devBuyPercent: 2.5 });
    expect(saveLaunchDraft(value, store)).toBe(true);
    const restored = loadLaunchDraft(store);
    expect(restored).toEqual(value);
  });

  it("rejects malformed drafts and closed storage", () => {
    const store = storage();
    expect(
      saveLaunchDraft(draft({ payoutPlan: "not-a-number" }), store),
    ).toBe(false);
    expect(
      saveLaunchDraft(draft({ deadlineMinutes: 3 }), store),
    ).toBe(false);
    const failing = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    };
    expect(saveLaunchDraft(draft(), failing)).toBe(false);
    expect(loadLaunchDraft(failing)).toBe(null);
  });

  it("clears stored drafts", () => {
    const store = storage();
    saveLaunchDraft(draft(), store);
    expect(clearLaunchDraft(store)).toBe(true);
    expect(loadLaunchDraft(store)).toBe(null);
    expect(clearLaunchDraft(store)).toBe(true);
  });
});
