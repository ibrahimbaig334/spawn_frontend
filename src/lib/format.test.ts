import { describe, expect, it } from "vitest";
import {
  formatBasisPoints,
  formatCompactNumber,
  formatDecimalString,
  formatEth,
  formatSubscriptPrice,
  formatTokenAmount,
  formatUsdCompact,
  truncateDecimals,
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

  it("truncates numbers to 2 decimal places without rounding", () => {
    expect(truncateDecimals("12.345")).toBe("12.34");
    expect(truncateDecimals("12.999")).toBe("12.99");
    expect(truncateDecimals(3.1)).toBe("3.10");
    expect(truncateDecimals("249999999.999999")).toBe("249,999,999.99");
    expect(truncateDecimals("0")).toBe("0");
  });

  it("renders tiny prices with subscript zero notation", () => {
    expect(formatSubscriptPrice("0.0000575")).toBe("0.0₄575");
    expect(formatSubscriptPrice("0.0000349501")).toBe("0.0₄349");
    expect(formatSubscriptPrice("0.000000125")).toBe("0.0₆125");
    expect(formatSubscriptPrice("0.5")).toBe("0.50");
    expect(formatSubscriptPrice("1.25")).toBe("1.25");
    expect(formatSubscriptPrice("0")).toBe("0.00");
  });

  it("compacts USD stats truncated to 2 decimals", () => {
    expect(formatUsdCompact("5800")).toBe("$5.8k");
    expect(formatUsdCompact("375000")).toBe("$375k");
    expect(formatUsdCompact(250)).toBe("$250");
    expect(formatUsdCompact("1250000000")).toBe("$1.25B");
    expect(formatUsdCompact("0")).toBe("$0");
  });
});
