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
