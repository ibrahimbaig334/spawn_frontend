import { parseDecimal, formatDecimal } from "@/domain/economics";

/**
 * Display helpers over the API's raw-wei string convention (§1): divide by
 * 10^18 only at the display edge. 256-bit strings never touch Number.
 */

/**
 * Parse an API numeric string to wei bigint. Integers are raw wei; decimal
 * strings (`"0.05"` WAD shares, `priceEth`) are treated as 18-decimal fixed.
 */
export function wei(value: string | null | undefined): bigint {
  if (!value) return 0n;
  const trimmed = value.trim();
  if (/^-?\d+$/.test(trimmed)) return BigInt(trimmed);
  const parsed = parseDecimal(trimmed, 18);
  return parsed ?? 0n;
}

export function formatWeiAs(value: string | null | undefined, precision = 4): string {
  return formatDecimal(wei(value), 18, precision);
}

/** Reference price used for USD approximations: $2,500/ETH (START-HERE). */
export const ETH_USD_REFERENCE = 2_500;

export function usdApproxFromEthWei(ethWei: string | null | undefined): number {
  if (!ethWei) return 0;
  const scaled = wei(ethWei);
  // If the input was an integer wei string it is 1e18-scaled; a decimal
  // string was parsed to 1e18-scaled too. Both are ETH * 1e18.
  return Number(formatDecimal(scaled, 18, 8)) * ETH_USD_REFERENCE;
}

export function formatUsdApproxFromEthWei(
  ethWei: string | null | undefined,
): string {
  const usd = usdApproxFromEthWei(ethWei);
  if (usd === 0) return "—";
  if (usd >= 1e6) return `$${(usd / 1e6).toFixed(2).replace(/\.?0+$/, "")}M`;
  if (usd >= 1e3) return `$${(usd / 1e3).toFixed(2).replace(/\.?0+$/, "")}k`;
  return `$${usd.toFixed(2)}`;
}

export function formatCompactEth(
  ethWei: string | null | undefined,
  precision = 2,
): string {
  const parsed = wei(ethWei);
  if (parsed === 0n && !ethWei) return "—";
  const units: Array<[bigint, string]> = [
    [10n ** 30n, "T"],
    [10n ** 27n, "B"],
    [10n ** 24n, "M"],
    [10n ** 21n, "K"],
  ];
  for (const [divisor, suffix] of units) {
    if (parsed >= divisor) {
      const scaled = (parsed * 10n ** BigInt(precision + 1)) / divisor;
      const text = formatDecimal(scaled, precision + 1, precision).replace(/\.?0+$/, "");
      return `${text}${suffix}`;
    }
  }
  return formatDecimal(parsed, 18, precision);
}

/** Slippage floor: amount * (1 - bps/10000) with bigint precision. */
export function applySlippBps(amount: bigint, bps: number): bigint {
  if (!Number.isFinite(bps) || bps < 0) return amount;
  return (amount * BigInt(10_000 - Math.round(bps))) / 10_000n;
}

export function phaseLabel(status: string | null | undefined): string {
  switch (status) {
    case "bonding":
      return "Bonding curve";
    case "graduated":
      return "Graduated";
    default:
      return "Unknown";
  }
}

export function relativeTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "—";
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function formatUtc(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "—";
  return date.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

export function formatLevel(level: number | null | undefined): string {
  if (level === null || level === undefined) return "—";
  return level.toLocaleString("en-US");
}

/** Multiple of the graduation FDV, formatted like 1.25× / 36× / 2,900×. */
export function formatRungMultiple(multiple: number): string {
  if (!Number.isFinite(multiple)) return "—";
  if (multiple < 10) return `${multiple.toFixed(2).replace(/0+$/, "").replace(/\.$/, ".0")}×`;
  if (multiple < 1000) return `${Math.round(multiple)}×`;
  return `${(multiple / 1000).toFixed(1).replace(/\.0$/, "")}k×`;
}
