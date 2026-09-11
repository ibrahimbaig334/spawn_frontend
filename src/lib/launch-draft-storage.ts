import type { LaunchDraft } from "@/domain/launch-draft";
import { INITIAL_DRAFT, validateDraft } from "@/domain/launch-draft";
import { SEED_REGISTRY } from "@/data/mock-seed";

export const LAUNCH_DRAFT_STORAGE_KEY = "spawn.launch-draft";
export const LAUNCH_DRAFT_STORAGE_VERSION = 3 as const;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

interface StoredDraftV3 {
  version: 3;
  draft: LaunchDraft;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function percent(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 10
  );
}

function validDraft(value: unknown): value is LaunchDraft {
  if (!isRecord(value)) return false;
  if (!isRecord(value.socials)) return false;
  return (
    typeof value.name === "string" &&
    typeof value.symbol === "string" &&
    typeof value.totalSupply === "string" &&
    typeof value.devBuyEnabled === "boolean" &&
    percent(value.devBuyPercent) &&
    /^\d+$/.test(String(value.payoutPlan)) &&
    typeof value.deadlineMinutes === "number" &&
    Number.isSafeInteger(value.deadlineMinutes) &&
    value.deadlineMinutes >= 5 &&
    value.deadlineMinutes <= 1440 &&
    typeof value.description === "string" &&
    value.description.length <= 500 &&
    (value.logoUrl === undefined || typeof value.logoUrl === "string") &&
    ["website", "x", "telegram", "discord"].every(
      (key) =>
        typeof (value.socials as Record<string, unknown>)[key] === "string",
    )
  );
}

function withoutDeadline(draft: LaunchDraft): LaunchDraft {
  return { ...draft };
}

export function parseStoredLaunchDraft(raw: string | null): LaunchDraft | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (
      isRecord(value) &&
      value.version === 3 &&
      isRecord(value.draft) &&
      validDraft(value.draft)
    ) {
      return withoutDeadline(value.draft);
    }
    return null;
  } catch {
    return null;
  }
}

export function loadLaunchDraft(storage?: StorageLike): LaunchDraft | null {
  const target =
    storage ??
    (typeof window === "undefined" ? undefined : window.localStorage);
  if (!target) return null;
  try {
    const draft = parseStoredLaunchDraft(target.getItem(LAUNCH_DRAFT_STORAGE_KEY));
    if (!draft) return null;
    // A stored draft referencing suspended/unknown plugins falls back clean.
    const errors = validateDraft(draft, SEED_REGISTRY);
    if (errors.payoutPlan) return INITIAL_DRAFT;
    return draft;
  } catch {
    return null;
  }
}

export function saveLaunchDraft(
  draft: LaunchDraft,
  storage?: StorageLike,
): boolean {
  const target =
    storage ??
    (typeof window === "undefined" ? undefined : window.localStorage);
  if (!target || !validDraft(draft)) return false;
  const value: StoredDraftV3 = {
    version: LAUNCH_DRAFT_STORAGE_VERSION,
    draft: withoutDeadline(draft),
  };
  try {
    target.setItem(LAUNCH_DRAFT_STORAGE_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function clearLaunchDraft(storage?: StorageLike): boolean {
  const target =
    storage ??
    (typeof window === "undefined" ? undefined : window.localStorage);
  if (!target) return false;
  try {
    target.removeItem(LAUNCH_DRAFT_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
