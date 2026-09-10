import type { LaunchDraft } from "@/domain/launch-validation";
import type {
  CreateLaunchResult,
  Launch,
  TradeContext,
  TradePreview,
  TradeRequest,
  TradeResult,
} from "@/types/launch";

export interface DemoCapabilities {
  mode: "deterministic-browser-demo";
  wallet: false;
  contracts: false;
  marketFeed: false;
  transactions: false;
  persistence: "browser-local";
}

export const DEMO_CAPABILITIES: DemoCapabilities = {
  mode: "deterministic-browser-demo",
  wallet: false,
  contracts: false,
  marketFeed: false,
  transactions: false,
  persistence: "browser-local",
};

export interface LaunchpadClient {
  readonly capabilities: DemoCapabilities;
  previewTrade(
    launch: Launch,
    request: TradeRequest,
    context: TradeContext,
  ): Promise<TradePreview>;
  executeTrade(
    launch: Launch,
    request: TradeRequest,
    context: TradeContext,
    sequence: number,
  ): Promise<TradeResult>;
  createLaunch(
    draft: LaunchDraft,
    sequence: number,
  ): Promise<CreateLaunchResult>;
}
