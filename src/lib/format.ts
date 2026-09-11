import { formatDecimal, parseDecimal } from "@/domain/economics";

function group(value: string): string {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function formatDecimalString(value: string, precision = 2): string {
  const parsed = parseDecimal(value);
  if (parsed === null || !Number.isInteger(precision) || precision < 0)
    return "—";
  const normalized = formatDecimal(parsed, 18, precision);
  const [whole = "0", fraction] = normalized.split(".");
  return fraction ? `${group(whole)}.${fraction}` : group(whole);
}

export function formatEth(value: string, precision = 2): string {
  const result = formatDecimalString(value, precision);
  return result === "—" ? result : `${result} ETH`;
}

export function formatTokenAmount(
  value: string,
  symbol?: string,
  precision = 2,
): string {
  const result = formatDecimalString(value, precision);
  return symbol && result !== "—" ? `${result} ${symbol}` : result;
}

export function formatBasisPoints(value: number): string {
  if (!Number.isInteger(value)) return "—";
  const negative = value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  const fraction = (absolute % 100)
    .toString()
    .padStart(2, "0")
    .replace(/0+$/, "");
  return `${negative}${Math.floor(absolute / 100)}${fraction ? `.${fraction}` : ""}%`;
}

export const formatPercent = formatBasisPoints;

export function formatCompactNumber(value: string): string {
  const parsed = parseDecimal(value);
  if (parsed === null) return "—";
  const units = [
    { divisor: 10n ** 30n, suffix: "T" },
    { divisor: 10n ** 27n, suffix: "B" },
    { divisor: 10n ** 24n, suffix: "M" },
    { divisor: 10n ** 21n, suffix: "K" },
  ] as const;
  const unit = units.find(({ divisor }) => parsed >= divisor);
  if (!unit) return formatDecimalString(value, 2);
  const tenths = (parsed * 10n) / unit.divisor;
  const fraction = tenths % 10n;
  return `${tenths / 10n}${fraction === 0n ? "" : `.${fraction}`}${unit.suffix}`;
}

/**
 * Truncates any number to exactly 2 decimal places without rounding
 * ("12.345" -> "12.34", "3.1" -> "3.10"). Display rule for every numeric
 * value on cards and stats rows.
 */
export function truncateDecimals(value: string | number): string {
  const text = typeof value === "number" ? String(value) : value;
  if (!/^-?\d*\.?\d*$/.test(text.trim())) return text;
  const [whole = "0", fraction] = text.trim().split(".");
  if (fraction === undefined) return group(whole);
  const clipped = fraction.slice(0, 2).padEnd(2, "0");
  return `${group(whole)}.${clipped}`;
}

/**
 * Subscript-notation price like the reference launchpad: 0.0₄575 means
 * 0.0000575. Used for tiny token prices; anything >= 0.01 falls back to
 * truncateDecimals. Returns the bare number — callers add the currency.
 */
export function formatSubscriptPrice(value: string): string {
  const parsed = parseDecimal(value);
  if (parsed === null || parsed === 0n) return "0.00";
  let text = formatDecimal(parsed, 18, 18);
  text = text.replace(/0+$/, "");
  if (text.endsWith(".")) text = text.slice(0, -1);
  const num = Number(text);
  if (!Number.isFinite(num)) return "0.00";
  if (num >= 0.01) return truncateDecimals(text);
  const fraction = text.split(".")[1] ?? "";
  const zeros = fraction.match(/^0+/)?.[0].length ?? 0;
  if (zeros === 0) return truncateDecimals(text);
  const significant = fraction.slice(zeros, zeros + 3);
  const subscript = String(zeros)
    .split("")
    .map((digit) => "₀₁₂₃₄₅₆₇₈₉"[Number(digit)] ?? digit)
    .join("");
  return `0.0${subscript}${significant}`;
}

/** Compact stat (market cap / volume) truncated to 2 decimals: $5.8k. */
export function formatUsdCompact(value: string | number): string {
  const text = typeof value === "number" ? String(value) : value;
  const num = Number(text);
  if (!Number.isFinite(num)) return "—";
  const units: Array<[number, string]> = [
    [1e15, "Q"],
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "k"],
  ];
  const unit = units.find(([divisor]) => Math.abs(num) >= divisor);
  if (!unit) return `$${truncateDecimals(text)}`;
  const scaled = truncateDecimals(num / unit[0]).replace(/\.?0+$/, "");
  return `$${scaled}${unit[1]}`;
}

/** Percentage change truncated to 2 decimals with an explicit sign. */
export function formatSignedPercent(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${truncateDecimals(value)}%`;
}
