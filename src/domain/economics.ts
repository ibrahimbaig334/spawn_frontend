/**
 * Decimal helpers for 18-decimal fixed-point values stored as strings.
 * The protocol layer keeps all WAD values as raw integers; these helpers
 * convert between human decimal strings and bigint wei.
 */

export function parseDecimal(
  value: string,
  decimals = 18,
): bigint | null {
  if (!Number.isSafeInteger(decimals) || decimals < 0) return null;
  const normalized = value.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(normalized)) return null;
  const [whole = "0", fraction = ""] = normalized.split(".");
  if (fraction.length > decimals) return null;
  return (
    BigInt(whole) * 10n ** BigInt(decimals) +
    BigInt(fraction.padEnd(decimals, "0") || "0")
  );
}

export function formatDecimal(
  value: bigint,
  decimals = 18,
  precision = 4,
): string {
  if (
    !Number.isSafeInteger(decimals) ||
    decimals < 0 ||
    !Number.isSafeInteger(precision) ||
    precision < 0
  )
    return "0";
  const base = 10n ** BigInt(decimals);
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / base;
  const places = Math.min(decimals, precision);
  if (places === 0) return `${negative ? "-" : ""}${whole}`;
  const fraction = (absolute % base)
    .toString()
    .padStart(decimals, "0")
    .slice(0, places);
  const trimmed = fraction.replace(/0+$/, "");
  const formatted = trimmed ? `${whole}.${trimmed}` : whole.toString();
  return negative ? `-${formatted}` : formatted;
}
