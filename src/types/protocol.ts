export type BasisPoints = number;

export interface ProceedsSplit {
  creator: BasisPoints;
  buyback: BasisPoints;
  protocol: BasisPoints;
  liquidity: BasisPoints;
}

export interface FeeTier {
  completedMilestones: number;
  feeBps: BasisPoints;
  label: string;
}

export interface ProtocolTerms {
  openingValuationEth: string;
  coreMilestones: number;
  maxAdditionalMilestones: number;
  initialMarketShareBps: BasisPoints;
  milestoneShareBps: BasisPoints;
  tradingShareBps: BasisPoints;
  defaultProceedsSplit: ProceedsSplit;
  maxCreatorShareBps: BasisPoints;
  minBuybackShareBps: BasisPoints;
  minProtocolShareBps: BasisPoints;
  maxCreatorPurchaseBps: BasisPoints;
  maxLockupMonths: number;
  feeTiers: readonly FeeTier[];
  maxCompletionsPerTrade: number;
}
