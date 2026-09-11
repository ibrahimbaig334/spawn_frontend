/** Shared plan copy for the plan bitset count. */
export function PLAN_COPY(planCount: number): string {
  return planCount === 0
    ? "Empty plan: every pot flows to the creator path."
    : `${planCount} selected payout plugin${planCount === 1 ? "" : "s"}; the creator is the mandatory remainder.`;
}
