/**
 * Payout-plan bitset helpers. Bit i of the plan selects payout plugin at
 * registry index i. Plan "0" is valid (everything to the creator path).
 */

import { WAD } from "@/protocol/constants";

export function hasPlanBit(plan: bigint, index: number): boolean {
  return ((plan >> BigInt(index)) & 1n) === 1n;
}

export function withPlanBit(plan: bigint, index: number): bigint {
  return plan | (1n << BigInt(index));
}

export function withoutPlanBit(plan: bigint, index: number): bigint {
  return plan & ~(1n << BigInt(index));
}

export function planIndices(plan: bigint, limit = 64): number[] {
  const indices: number[] = [];
  for (let i = 0; i < limit; i += 1) {
    if (hasPlanBit(plan, i)) indices.push(i);
  }
  return indices;
}

export function countPlanBits(plan: bigint): number {
  return planIndices(plan).length;
}

export function planTakesSumWad(
  plan: bigint,
  registry: { index: number; takeWad: bigint }[],
): bigint {
  let sum = 0n;
  for (const entry of registry) {
    if (hasPlanBit(plan, entry.index)) sum += entry.takeWad;
  }
  return sum;
}

export function planCreatorRemainderWad(
  plan: bigint,
  registry: { index: number; takeWad: bigint }[],
): bigint {
  return WAD - planTakesSumWad(plan, registry);
}
