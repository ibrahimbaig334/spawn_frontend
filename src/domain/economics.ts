import type { ProceedsSplit } from "@/types/protocol";
import { PROTOCOL_TERMS } from "@/data/protocol-terms";

const SCALE = 10n ** 18n;

export function parseDecimal(value: string, decimals = 18): bigint | null {
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

export function currentFeeBps(completedMilestones: number): number {
  const tier = [...PROTOCOL_TERMS.feeTiers]
    .reverse()
    .find((candidate) => completedMilestones >= candidate.completedMilestones);
  return tier?.feeBps ?? PROTOCOL_TERMS.feeTiers[0]!.feeBps;
}

export function currentFeeLabel(completedMilestones: number): string {
  return `${currentFeeBps(completedMilestones) / 100}%`;
}

export function splitAmount(amount: bigint, split: ProceedsSplit) {
  const creator = (amount * BigInt(split.creator)) / 10_000n;
  const buyback = (amount * BigInt(split.buyback)) / 10_000n;
  const protocol = (amount * BigInt(split.protocol)) / 10_000n;
  const liquidity = amount - creator - buyback - protocol;
  return { creator, buyback, protocol, liquidity };
}

export function validateSplit(split: ProceedsSplit): string[] {
  const errors: string[] = [];
  const total =
    split.creator + split.buyback + split.protocol + split.liquidity;
  if (total !== 10_000) errors.push("The four routes must total exactly 100%.");
  if (split.creator > PROTOCOL_TERMS.maxCreatorShareBps) {
    errors.push("Creator share cannot exceed 70%.");
  }
  if (split.buyback < PROTOCOL_TERMS.minBuybackShareBps) {
    errors.push("Token purchase and removal must receive at least 10%.");
  }
  if (split.protocol < PROTOCOL_TERMS.minProtocolShareBps) {
    errors.push("Protocol must receive at least 5%.");
  }
  if (
    Object.values(split).some(
      (value) => !Number.isSafeInteger(value) || value < 0 || value > 10_000,
    )
  ) {
    errors.push("Every route must be a non-negative percentage.");
  }
  return errors;
}

export function targetValuationEth(milestoneNumber: number): string {
  if (milestoneNumber < 1) return PROTOCOL_TERMS.openingValuationEth;
  const scaled = BigInt(PROTOCOL_TERMS.openingValuationEth) * SCALE;
  let result = scaled;
  for (let index = 0; index < milestoneNumber; index += 1) {
    result = (result * 5n) / 4n;
  }
  return formatDecimal(result, 18, 0);
}

export function clampBps(value: number): number {
  return Math.min(10_000, Math.max(0, Math.round(value)));
}
