import type { ProtocolEvent } from "./protocol-model";
import type {
  CreateLaunchResult,
  LaunchRecord,
  TradeResult,
} from "@/services/launchpad-client";

export type LaunchId = string;
export type ProfileId = string;
export type ActivityId = string;
export type CommentId = string;
export type LedgerEntryId = string;
export type EntitySource = "fixture" | "local-simulation";

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

/** Activity kinds the timeline renders (protocol-event backed). */
export type ActivityKind =
  | "buy"
  | "sell"
  | "milestone"
  | "created"
  | "graduated"
  | "flush"
  | "claim";

export interface ActivityRecord {
  id: ActivityId;
  launchId: LaunchId;
  profileId?: ProfileId;
  kind: ActivityKind;
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

/** Ledger entry for one trade (buy/sell) with protocol fee accounting. */
export interface HoldingLedgerEntry {
  id: LedgerEntryId;
  launchId: LaunchId;
  side: "buy" | "sell";
  tokenAmount: string;
  grossInput: string;
  feeAmount: string;
  netOutput: string;
  levelAfter: number;
  receiptId: string;
  sequence: number;
  occurredAt: string;
  origin: "fixture" | "simulation";
}

export interface DemoEntities {
  launches: Record<LaunchId, LaunchRecord>;
  profiles: Record<ProfileId, Profile>;
  activities: Record<ActivityId, ActivityRecord>;
  comments: Record<CommentId, Comment>;
  ledger: Record<LedgerEntryId, HoldingLedgerEntry>;
}

export interface DemoOrder {
  launches: LaunchId[];
  profiles: ProfileId[];
  activities: ActivityId[];
  comments: CommentId[];
  ledger: LedgerEntryId[];
}

export interface DemoDataV3 {
  version: 3;
  entities: DemoEntities;
  order: DemoOrder;
  watchlist: LaunchId[];
  portfolio: {
    accountProfileId: ProfileId;
    ethBalance: string;
    /** tokenWei per launch id. */
    tokenBalances: Record<LaunchId, string>;
  };
  events: Record<LaunchId, ProtocolEvent[]>;
  sequence: number;
}

export interface DemoState {
  data: DemoDataV3;
  runtime: {
    hydration: "pending" | "ready";
    persistence: "unknown" | "available" | "unavailable";
  };
}

export type DemoAction =
  | { type: "hydrate"; data: DemoDataV3 }
  | { type: "mark-hydrated"; persistence: "available" | "unavailable" }
  | { type: "toggle-watch"; id: LaunchId }
  | { type: "apply-trade"; result: TradeResult; launchId: LaunchId }
  | { type: "add-launch"; result: CreateLaunchResult }
  | { type: "add-comment"; comment: Comment }
  | {
      type: "apply-launch-update";
      launch: LaunchRecord;
      events: ProtocolEvent[];
      activity?: ActivityRecord;
      ledger?: HoldingLedgerEntry;
      tokenBalance?: string;
      ethBalance?: string;
    }
  | { type: "reset" };
