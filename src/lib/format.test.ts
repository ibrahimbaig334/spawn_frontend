import { describe, expect, it } from "vitest";
import {
  formatBasisPoints,
  formatCompactNumber,
  formatDecimalString,
  formatEth,
  formatTokenAmount,
} from "./format";

describe("format helpers", () => {
  it("formats decimal strings without floating point conversion", () => {
    expect(formatDecimalString("12345678901234567890.98765", 3)).toBe(
      "12,345,678,901,234,567,890.987",
    );
    expect(formatEth("12.3400", 4)).toBe("12.34 ETH");
    expect(formatTokenAmount("1000", "SPWN")).toBe("1,000 SPWN");
  });

  it("formats basis points and compact quantities", () => {
    expect(formatBasisPoints(75)).toBe("0.75%");
    expect(formatBasisPoints(1_000)).toBe("10%");
    expect(formatCompactNumber("1250000")).toBe("1.2M");
  });

  it("returns a placeholder for invalid values", () => {
    expect(formatDecimalString("1e3")).toBe("—");
    expect(formatBasisPoints(1.5)).toBe("—");
  });
});
