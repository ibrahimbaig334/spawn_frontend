import type {
  ActivityId,
  ActivityRecord,
  Comment,
  CommentId,
  CreateLaunchResult,
  HistoryPointId,
  HoldingLedgerEntry,
  Launch,
  LaunchId,
  LedgerEntryId,
  MarketHistoryPoint,
  Profile,
  ProfileId,
  TradeResult,
} from "./launch";

export interface DemoEntities {
  launches: Record<LaunchId, Launch>;
  profiles: Record<ProfileId, Profile>;
  activities: Record<ActivityId, ActivityRecord>;
  comments: Record<CommentId, Comment>;
  history: Record<HistoryPointId, MarketHistoryPoint>;
  ledger: Record<LedgerEntryId, HoldingLedgerEntry>;
}

export interface DemoOrder {
  launches: LaunchId[];
  profiles: ProfileId[];
  activities: ActivityId[];
  comments: CommentId[];
  history: HistoryPointId[];
  ledger: LedgerEntryId[];
}

export interface DemoDataV2 {
  version: 2;
  entities: DemoEntities;
  order: DemoOrder;
  watchlist: LaunchId[];
  portfolio: {
    accountProfileId: ProfileId;
    ethBalance: string;
  };
  sequence: number;
}

export interface DemoState {
  data: DemoDataV2;
  runtime: {
    hydration: "pending" | "ready";
    persistence: "unknown" | "available" | "unavailable";
  };
}

export type DemoAction =
  | { type: "hydrate"; data: DemoDataV2 }
  | { type: "mark-hydrated"; persistence: "available" | "unavailable" }
  | { type: "toggle-watch"; id: LaunchId }
  | { type: "apply-trade"; result: TradeResult }
  | { type: "add-launch"; result: CreateLaunchResult }
  | { type: "add-comment"; comment: Comment }
  | { type: "reset" };
