import type { ProceedsSplit } from "@/types/protocol";
import { PROTOCOL_TERMS } from "@/data/protocol-terms";
import { validateSplit } from "./economics";

export interface LaunchDraft {
  name: string;
  symbol: string;
  supply: string;
  description: string;
  split: ProceedsSplit;
  creatorPurchaseEnabled: boolean;
  creatorPurchaseBps: number;
  lockupMonths: number;
  acknowledged: boolean;
}

export type LaunchDraftErrors = Partial<
  Record<keyof LaunchDraft | "split", string>
>;

export function validateLaunchDraft(
  draft: LaunchDraft,
  final = false,
): LaunchDraftErrors {
  const errors: LaunchDraftErrors = {};
  if (draft.name.trim().length < 2 || draft.name.trim().length > 40) {
    errors.name = "Use a name between 2 and 40 characters for this demo.";
  }
  if (!/^[A-Za-z0-9]{2,8}$/.test(draft.symbol.trim())) {
    errors.symbol = "Use 2–8 letters or numbers for this demo.";
  }
  if (!/^(?:[1-9]\d*)(?:\.\d+)?$/.test(draft.supply.trim())) {
    errors.supply = "Enter a positive total supply.";
  }
  if (
    draft.description.trim().length < 12 ||
    draft.description.trim().length > 140
  ) {
    errors.description = "Use 12–140 characters for this demo.";
  }
  const splitErrors = validateSplit(draft.split);
  if (splitErrors.length) errors.split = splitErrors[0];
  if (draft.creatorPurchaseEnabled) {
    if (
      !Number.isSafeInteger(draft.creatorPurchaseBps) ||
      draft.creatorPurchaseBps <= 0 ||
      draft.creatorPurchaseBps > PROTOCOL_TERMS.maxCreatorPurchaseBps
    ) {
      errors.creatorPurchaseBps =
        "Creator purchase must be above 0% and no more than 10%.";
    }
    if (
      !Number.isSafeInteger(draft.lockupMonths) ||
      draft.lockupMonths < 0 ||
      draft.lockupMonths > PROTOCOL_TERMS.maxLockupMonths
    ) {
      errors.lockupMonths = "Choose a lock-up from 0 to 12 months.";
    }
  }
  if (final && !draft.acknowledged) {
    errors.acknowledged = "Acknowledge that this creates demo data only.";
  }
  return errors;
}
