import type { ProtocolTerms } from "@/types/protocol";

export const PROTOCOL_TERMS: ProtocolTerms = {
  openingValuationEth: "125",
  coreMilestones: 30,
  maxAdditionalMilestones: 30,
  initialMarketShareBps: 2_500,
  milestoneShareBps: 6_500,
  tradingShareBps: 1_000,
  defaultProceedsSplit: {
    creator: 6_000,
    buyback: 2_000,
    protocol: 1_000,
    liquidity: 1_000,
  },
  maxCreatorShareBps: 7_000,
  minBuybackShareBps: 1_000,
  minProtocolShareBps: 500,
  maxCreatorPurchaseBps: 1_000,
  maxLockupMonths: 12,
  feeTiers: [
    { completedMilestones: 0, feeBps: 100, label: "1%" },
    { completedMilestones: 8, feeBps: 75, label: "0.75%" },
    { completedMilestones: 16, feeBps: 50, label: "0.5%" },
  ],
  maxCompletionsPerTrade: 8,
};

export const DEMO_STATUS = "Interactive concept · Demo data";
export const TRANSACTION_STATUS = "No wallet or transaction is connected.";
export const MILESTONE_RISK =
  "Reaching a milestone only means demo trading touched its target. It does not prove lasting demand, and the market can reverse.";
