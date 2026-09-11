import {
  hasPlanBit,
  planIndices,
  planCreatorRemainderWad,
  planTakeSumWad,
  withPlanBit,
  withoutPlanBit,
  devBuyEthCostWei,
  devBuyTokensWei,
  devBuyBudgetWei,
} from "@/domain/launch-config";
import type { LaunchConfig, PluginEntry } from "@/types/protocol-model";
import { formatDecimal } from "@/domain/economics";
import { parseDecimal } from "@/domain/economics";
import { MAX_DEV_BUY_SHARE_WAD, WAD } from "@/protocol/constants";
import type { LaunchMetadata } from "@/services/launchpad-client";

export const MAX_DESCRIPTION_LENGTH = 500;

export interface LaunchDraft {
  name: string;
  symbol: string;
  totalSupply: string;
  devBuyEnabled: boolean;
  /** Percent of supply, 0-10 (UI); converted to WAD for the config. */
  devBuyPercent: number;
  /** Bitset as decimal string. */
  payoutPlan: string;
  deadlineMinutes: number;
  /** Rich text description (max 500 characters). */
  description: string;
  /** IPFS gateway URL of the uploaded logo. */
  logoUrl?: string;
  socials: {
    website: string;
    x: string;
    telegram: string;
    discord: string;
  };
}

export type LaunchDraftErrors = Partial<
  Record<keyof LaunchDraft | "payoutPlan" | "socials", string>
>;

export const INITIAL_DRAFT: LaunchDraft = {
  name: "",
  symbol: "",
  totalSupply: "1000000000",
  devBuyEnabled: false,
  devBuyPercent: 1,
  payoutPlan: "1",
  deadlineMinutes: 60,
  description: "",
  socials: { website: "", x: "", telegram: "", discord: "" },
};

/** Social URL validation: http(s) links or bare handles/domains. */
function validSocialUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (/^https?:\/\/\S+\.\S+/i.test(trimmed)) return true;
  return /^[\w-]+(\.[\w-]+)+([/?#]\S*)?$/.test(trimmed);
}

/** Build the on-chain LaunchConfig struct from a UI draft. */
export function draftToConfig(
  draft: LaunchDraft,
  creator: `0x${string}`,
): LaunchConfig {
  const shareWad =
    draft.devBuyEnabled && draft.devBuyPercent > 0
      ? (WAD * BigInt(Math.round(draft.devBuyPercent * 100))) / 10_000n
      : 0n;
  return {
    creator,
    name: draft.name.trim(),
    symbol: draft.symbol.trim().toUpperCase(),
    totalSupply: draft.totalSupply.trim(),
    devBuyShareWad: shareWad.toString(),
    payoutPlan: draft.payoutPlan,
    deadline: Math.floor(Date.now() / 1000) + draft.deadlineMinutes * 60,
  };
}

/** Build the off-chain metadata bag for createLaunch. */
export function draftToMetadata(draft: LaunchDraft): LaunchMetadata {
  const socials: LaunchMetadata["socials"] = {};
  if (draft.socials.website.trim()) socials.website = draft.socials.website.trim();
  if (draft.socials.x.trim()) socials.x = draft.socials.x.trim();
  if (draft.socials.telegram.trim()) socials.telegram = draft.socials.telegram.trim();
  if (draft.socials.discord.trim()) socials.discord = draft.socials.discord.trim();
  return {
    description: draft.description.trim(),
    logoUrl: draft.logoUrl,
    socials,
  };
}

export function validateDraft(
  draft: LaunchDraft,
  registry: PluginEntry[],
): LaunchDraftErrors {
  const errors: LaunchDraftErrors = {};
  if (draft.name.trim().length < 2 || draft.name.trim().length > 40) {
    errors.name = "Use a name between 2 and 40 characters.";
  }
  if (!/^[A-Za-z0-9]{2,8}$/.test(draft.symbol.trim())) {
    errors.symbol = "Use 2-8 letters or numbers.";
  }
  const supply = parseDecimal(draft.totalSupply);
  if (supply === null || supply <= 0n) {
    errors.totalSupply = "Enter a positive total supply (18 decimals max).";
  }
  if (draft.devBuyEnabled) {
    if (
      !Number.isFinite(draft.devBuyPercent) ||
      draft.devBuyPercent <= 0 ||
      draft.devBuyPercent > 10
    ) {
      errors.devBuyPercent =
        "Dev buy must be above 0% and at most 10% of supply.";
    }
  }
  if (draft.deadlineMinutes < 5 || draft.deadlineMinutes > 1440) {
    errors.deadlineMinutes = "Signing deadline must be 5 to 1440 minutes out.";
  }
  const plan = BigInt(draft.payoutPlan);
  if (planIndices(plan).length > 8) {
    errors.payoutPlan = "Select at most 8 payout plugins.";
  }
  const takeSum = planTakeSumWad(plan, registry);
  if (takeSum > WAD) {
    errors.payoutPlan = "Plugin takes must total at most 100%.";
  }
  const description = draft.description.trim();
  if (!description) {
    errors.description = "Describe your token for the card's back face.";
  } else if (description.length > MAX_DESCRIPTION_LENGTH) {
    errors.description = `Descriptions are limited to ${MAX_DESCRIPTION_LENGTH} characters.`;
  }
  for (const [key, value] of Object.entries(draft.socials)) {
    if (!validSocialUrl(value)) {
      errors.socials = `The ${key} link must be a valid URL (https://...).`;
      break;
    }
  }
  return errors;
}

/** UI summary of a plan's economics. */
export interface PlanSummary {
  selectedIndices: number[];
  takeSumPercent: string;
  creatorRemainderPercent: string;
  /** Pre-launch dev-buy quote values. */
  devBuyTokens: string;
  devBuyEthCost: string;
  devBuyBudget: string;
}

export function planSummary(
  draft: LaunchDraft,
  registry: PluginEntry[],
): PlanSummary {
  const config = draftToConfig(draft, "0x0000000000000000000000000000000000000000");
  const plan = BigInt(draft.payoutPlan);
  const takeSum = planTakeSumWad(plan, registry);
  const remainder = planCreatorRemainderWad(plan, registry);
  const cost = draft.devBuyEnabled ? devBuyEthCostWei(config) : 0n;
  const tokens = draft.devBuyEnabled ? devBuyTokensWei(config) : 0n;
  return {
    selectedIndices: planIndices(plan),
    takeSumPercent: formatDecimal((takeSum * 100n) / WAD, 18, 2),
    creatorRemainderPercent: formatDecimal((remainder * 100n) / WAD, 18, 2),
    devBuyTokens: formatDecimal(tokens, 18, 2),
    devBuyEthCost: formatDecimal(cost, 18, 4),
    devBuyBudget: formatDecimal(devBuyBudgetWei(config), 18, 4),
  };
}

export {
  hasPlanBit,
  withPlanBit,
  withoutPlanBit,
  MAX_DEV_BUY_SHARE_WAD,
};
