import { describe, expect, it } from "vitest";
import { createSeedData, createSeedState } from "@/data/mock-seed";
import {
  clearDemoState,
  DEMO_STORAGE_KEY,
  loadDemoState,
  parseStoredDemoState,
  saveDemoState,
} from "./storage";

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

describe("demo storage", () => {
  it("round-trips persisted V2 data without runtime fields", () => {
    const storage = memoryStorage();
    const data = createSeedData();
    expect(saveDemoState(data, storage)).toBe(true);
    const raw = storage.getItem(DEMO_STORAGE_KEY);
    expect(raw).toContain('"version":2');
    expect(raw).not.toContain('"runtime"');
    expect(loadDemoState(storage)).toEqual(data);
  });

  it("rejects malformed, unsupported, and structurally invalid versions", () => {
    expect(parseStoredDemoState("{")).toBeNull();
    expect(
      parseStoredDemoState(JSON.stringify({ ...createSeedData(), version: 3 })),
    ).toBeNull();
    expect(
      parseStoredDemoState(
        JSON.stringify({
          ...createSeedData(),
          portfolio: { ...createSeedData().portfolio, ethBalance: 25 },
        }),
      ),
    ).toBeNull();
  });

  it("clears its versioned storage key", () => {
    const storage = memoryStorage();
    saveDemoState(createSeedData(), storage);
    expect(clearDemoState(storage)).toBe(true);
    expect(storage.getItem(DEMO_STORAGE_KEY)).toBeNull();
  });

  it("fails closed when storage throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(loadDemoState(broken)).toBeNull();
    expect(saveDemoState(createSeedState().data, broken)).toBe(false);
    expect(clearDemoState(broken)).toBe(false);
  });
});
