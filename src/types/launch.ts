import type { BasisPoints, ProceedsSplit } from "./protocol";

export type LaunchId = string;
export type ProfileId = string;
export type ActivityId = string;
export type CommentId = string;
export type HistoryPointId = string;
export type LedgerEntryId = string;
export type LaunchStage = "launch" | "milestones" | "core-complete";
export type TradeSide = "buy" | "sell";
export type MilestoneState = "completed" | "next" | "ahead";
export type EntitySource = "fixture" | "local-simulation";

export interface CreatorPurchase {
  enabled: boolean;
  shareBps: BasisPoints;
  lockupMonths: number;
}

export interface Profile {
  id: ProfileId;
  slug: string;
  displayName: string;
  handle: string;
  bio: string;
  initials: string;
  visualSeed: number;
  joinedAt: string;
  kind: "fictional-demo" | "local-demo";
}

export interface ActivityRecord {
  id: ActivityId;
  launchId: LaunchId;
  profileId?: ProfileId;
  kind: "buy" | "sell" | "milestone" | "created";
  amountEth?: string;
  tokenAmount?: string;
  milestoneNumber?: number;
  receiptId?: string;
  sequence: number;
  occurredAt: string;
  source: EntitySource;
}

export interface Comment {
  id: CommentId;
  launchId: LaunchId;
  authorProfileId: ProfileId;
  body: string;
  sequence: number;
  createdAt: string;
  source: EntitySource;
}

export interface MarketHistoryPoint {
  id: HistoryPointId;
  launchId: LaunchId;
  valuationEth: string;
  sequence: number;
  recordedAt: string;
  source: EntitySource | "migration";
}

export interface HoldingLedgerEntry {
  id: LedgerEntryId;
  launchId: LaunchId;
  side: TradeSide;
  tokenAmount: string;
  grossEth: string;
  feeEth: string;
  netEth: string;
  receiptId: string;
  sequence: number;
  occurredAt: string;
  origin: "fixture" | "simulation";
}

export interface Launch {
  id: LaunchId;
  slug: string;
  creatorProfileId: ProfileId;
  name: string;
  symbol: string;
  description: string;
  stage: LaunchStage;
  supply: string;
  valuationEth: string;
  progressBps: BasisPoints;
  completedMilestones: number;
  additionalMilestones: number;
  proceedsSplit: ProceedsSplit;
  creatorPurchase: CreatorPurchase;
  liquidityEth: string;
  removedTokens: string;
  creatorClaimableEth: string;
  createdSequence: number;
  createdAt: string;
  source: EntitySource;
  visualSeed: number;
}

export interface MilestoneView {
  number: number;
  state: MilestoneState;
  targetEth: string;
  allocationEth: string;
  feeBps: BasisPoints;
}

export interface TradeRequest {
  side: TradeSide;
  amount: string;
}

export interface TradeContext {
  ethBalance: string;
  tokenBalance: string;
}

export interface TradePreview {
  side: TradeSide;
  inputAmount: string;
  inputUnit: "ETH" | "token";
  estimatedOutput: string;
  outputUnit: "ETH" | "token";
  grossEth: string;
  feeEth: string;
  tokenAmount: string;
  beforeProgressBps: BasisPoints;
  afterProgressBps: BasisPoints;
  newlyCompleted: number;
  feeBps: BasisPoints;
}

export interface TradeResult extends TradePreview {
  launch: Launch;
  ethBalance: string;
  ledgerEntry: HoldingLedgerEntry;
  historyPoint: MarketHistoryPoint;
  activities: ActivityRecord[];
  receiptId: string;
  nextSequence: number;
}

export interface CreateLaunchResult {
  launch: Launch;
  profile?: Profile;
  historyPoint: MarketHistoryPoint;
  activity: ActivityRecord;
  nextSequence: number;
}
